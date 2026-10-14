import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { htmlToText } from "./ice";
import { RAW_DIR, download, logResult } from "./lib";
import { readXls, readXlsx, sheetsToText, type Sheet } from "./workbook-lib";
import { ohssSource, type OhssSource } from "../../lib/lpr-entities";

/**
 * Legal-immigration track fetch (green cards and naturalizations): downloads the DHS Office of
 * Homeland Security Statistics (OHSS) workbooks listed in `pipeline/reference/lpr-catalog.json` into
 * `pipeline/raw/ohss/` and writes a text extract next to each (`<file>.txt`). The transform reads
 * ONLY the extracts.
 *
 * Workbook extract format: `## sheet: <name>` (for a zip, `<member>!<sheet>`), then one line per non-empty
 * row, `<Excel row number>\t<cell> | <cell> | ...` with cells in their column positions, so the
 * transform can record the exact cell every value came from. Only the catalog's `members` (zip)
 * and `sheets` are extracted: the quarterly reports' I-94 sheets are left for the visas track,
 * and one of them repeats a footnote across all 16,384 columns. Pages (the annual flow reports, the
 * quarterly report's landing page) are kept as visible text for the notes' verbatim quotes.
 *
 * Yearbook editions before FY2017 publish `.xls` (Excel 97–2003) inside zips; `workbook-lib.ts`
 * reads them without a dependency. Safe to re-run: existing snapshots are never re-downloaded unless
 * `--refresh`, and extracts are rewritten deterministically, so an unchanged source is no diff.
 * OHSS posts each edition at a new address (a new Yearbook or quarterly report means a new catalog
 * source). See docs/LPR_METHODOLOGY.md, "Refreshing".
 *
 * Needs `unzip` on PATH.
 */
const DIR = `${RAW_DIR}/ohss`;
const CATALOG = "pipeline/reference/lpr-catalog.json";

function workbook(path: string, name: string): Sheet[] {
  return /\.xlsx$/i.test(name) ? readXlsx(path) : readXls(path);
}

/** The selected sheets of one workbook; a sheet the catalog names but the workbook lacks is an error. */
function pick(sheets: Sheet[], wanted: readonly string[] | undefined, where: string): Sheet[] {
  if (!wanted) return sheets;
  return wanted.map((w) => {
    const s = sheets.find((x) => x.name === w);
    if (!s) throw new Error(`${where}: no sheet "${w}" (sheets: ${sheets.map((x) => x.name).join(", ")})`);
    return s;
  });
}

export function extractText(s: OhssSource, path: string): string {
  if (s.kind === "html") return htmlToText(readFileSync(path, "utf8")) + "\n";
  if (s.kind === "xlsx") return sheetsToText(pick(readXlsx(path), s.sheets, s.file), { rowNumbers: true });
  if (!s.members) throw new Error(`${s.id}: a zip source must list the members to extract`);
  const tmp = mkdtempSync(join(tmpdir(), "ohss-"));
  try {
    const out: Sheet[] = [];
    for (const m of s.members) {
      const file = join(tmp, m.replace(/[^\w.-]+/g, "_"));
      writeFileSync(file, execFileSync("unzip", ["-p", path, m], { maxBuffer: 1 << 26 }));
      const sheets = workbook(file, m);
      for (const sh of pick(sheets, s.sheets, `${s.file}!${m}`)) {
        out.push({ name: `${m}!${sh.name}`, rows: sh.rows });
      }
    }
    return sheetsToText(out, { rowNumbers: true });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

async function main() {
  const refresh = process.argv.includes("--refresh");
  // Only the source list is needed here, so a catalog whose tables are mid-edit can still be fetched.
  const { sources } = z.object({ sources: z.array(ohssSource) }).parse(JSON.parse(await readFile(CATALOG, "utf8")));
  console.log("fetch:ohss");
  for (const s of sources) {
    const path = `${DIR}/${s.file}`;
    if (refresh || !existsSync(path)) logResult(await download(s.url, path));
    await writeFile(`${DIR}/${s.text_file}`, extractText(s, path));
  }
  console.log(`  ${sources.length} sources, text extracts written`);
}

if (process.argv[1]?.endsWith("ohss.ts")) {
  main().catch((err: unknown) => {
    console.error("\nfetch:ohss FAILED");
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}

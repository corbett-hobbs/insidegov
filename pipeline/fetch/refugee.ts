import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { RAW_DIR, download, logResult } from "./lib";
import { htmlToText } from "./ice";
import { readXlsx, sheetsToText } from "./workbook-lib";
import { refugeeSource, type RefugeeSource } from "../../lib/refugee-entities";

/**
 * Refugee-admissions track fetch: downloads the documents listed in
 * `pipeline/reference/refugee-catalog.json` into `pipeline/raw/refugee/` and writes a plain-text
 * extract next to each (`<file>.txt`). The transform reads ONLY the extracts and checks every
 * curated number against a verbatim quote, so a snapshot that drifts fails the build.
 *
 * Safe to re-run (a scheduled job may): existing snapshots are never re-downloaded unless
 * `--refresh`, extracts are rewritten deterministically, and the Federal Register index below is
 * written sorted with stable fields, so an unchanged source is no diff. New determinations are found
 * through that index; the State Department's workbook is renamed every month ("Refugee Admissions
 * Report as of <date>.xlsx"), so a new month is a new catalog source. See
 * docs/REFUGEE_ADMISSIONS_METHODOLOGY.md, "Refreshing".
 *
 * Needs `unzip` on PATH for the workbook extracts.
 */
const DIR = `${RAW_DIR}/refugee`;
const CATALOG = "pipeline/reference/refugee-catalog.json";

/**
 * Every sheet of an .xlsx, in workbook order, as `## sheet: <name>` followed by one line per row.
 * Cells keep their column position (`a |  | c`), so a row with a blank middle cell is not shifted
 * left — the per-year admissions sheets leave the ceiling column empty on country rows.
 */
export function workbookToText(path: string): string {
  return sheetsToText(readXlsx(path));
}

async function extract(s: RefugeeSource): Promise<void> {
  const path = `${DIR}/${s.file}`;
  const text = s.kind === "xlsx" ? workbookToText(path) : htmlToText(await readFile(path, "utf8")) + "\n";
  await writeFile(`${DIR}/${s.text_file}`, text);
}

/** Federal Register API listing of every presidential document mentioning "refugee admissions", 1994 on. */
const FR_INDEX = `${DIR}/fr-refugee-admissions-index.json`;
const FR_API =
  "https://www.federalregister.gov/api/v1/documents.json?per_page=1000&order=oldest&conditions%5Btype%5D%5B%5D=PRESDOCU&conditions%5Bterm%5D=%22refugee%20admissions%22" +
  ["title", "document_number", "citation", "publication_date", "signing_date", "subtype", "presidential_document_number"].map((f) => `&fields%5B%5D=${f}`).join("");

const frIndexRow = z.object({
  title: z.string(),
  document_number: z.string(),
  citation: z.string().nullable(),
  publication_date: z.string(),
  signing_date: z.string().nullable(),
  subtype: z.string().nullable(),
  presidential_document_number: z.string().nullable(),
});

/**
 * Discovery, not data: the transform fails when this index lists a refugee-admissions
 * determination the catalog has neither curated nor ignored, so a new or emergency PD can't
 * slip by. Written sorted with only stable fields, so an unchanged listing is no diff.
 */
async function writeFrIndex(): Promise<number> {
  const res = await fetch(FR_API);
  if (!res.ok) throw new Error(`GET ${FR_API} -> ${res.status} ${res.statusText}`);
  const body = z.object({ count: z.number(), results: z.array(frIndexRow) }).parse(await res.json());
  if (body.results.length !== body.count) throw new Error(`Federal Register index: got ${body.results.length} of ${body.count} rows (raise per_page)`);
  const rows = [...body.results].sort((a, b) => a.publication_date.localeCompare(b.publication_date) || a.document_number.localeCompare(b.document_number));
  await writeFile(FR_INDEX, `[\n${rows.map((r) => JSON.stringify(r)).join(",\n")}\n]\n`);
  return rows.length;
}

async function main() {
  const refresh = process.argv.includes("--refresh");
  // Only the source list is needed here, so a catalog whose curated values are mid-edit can still be fetched.
  const { sources } = z.object({ sources: z.array(refugeeSource) }).parse(JSON.parse(await readFile(CATALOG, "utf8")));
  console.log("fetch:refugee");
  for (const s of sources) {
    const path = `${DIR}/${s.file}`;
    if (refresh || !existsSync(path)) logResult(await download(s.url, path));
    await extract(s);
  }
  console.log(`  ${sources.length} sources, text extracts written`);
  console.log(`  Federal Register index: ${await writeFrIndex()} presidential documents mention "refugee admissions"`);
}

if (process.argv[1]?.endsWith("refugee.ts")) {
  main().catch((err: unknown) => {
    console.error("\nfetch:refugee FAILED");
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}

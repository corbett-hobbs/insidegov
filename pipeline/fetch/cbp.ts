import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import { z } from "zod";
import { htmlToText } from "./ice";
import { RAW_DIR, download, logResult } from "./lib";
import { readXlsx, sheetsToText } from "./workbook-lib";
import { cbpSource, encountersVintages, type CbpSource, type EncountersVintage } from "../../lib/encounters-entities";

/**
 * CBP border-encounters track fetch. Two jobs, both keyless and safe to re-run:
 *
 * 1. The fixed sources in `pipeline/reference/cbp-encounters-catalog.json` (the Border Patrol history PDFs, CBP's
 *    archived statistics pages, the OHSS workbooks): downloaded into `pipeline/raw/cbp/` when missing (`--refresh`
 *    re-downloads), with a text extract written next to each. The transform reads only the extracts.
 *
 * 2. The encounters CSVs. CBP posts a new file every month on its Nationwide Encounters document page, named for
 *    the four fiscal years it covers and the last month in it (`nationwide-encounters-fy23-fy26-aug-aor.csv`), so
 *    the address changes every month. The page is snapshotted and read for links; the newest area-of-responsibility
 *    file is downloaded, and `encounters-vintages.json` records the files kept. One file is kept per range of years:
 *    a newer month of the same range replaces the older one, and a new range is added beside the old ranges, which
 *    are never removed. That way a year that drops out of the newest file is still on disk. An unchanged page is no
 *    diff beyond the page snapshot itself.
 *
 * Needs `pdftotext` (poppler) and `unzip` on PATH for the extracts.
 */
const DIR = `${RAW_DIR}/cbp`;
const CATALOG = "pipeline/reference/cbp-encounters-catalog.json";
const VINTAGES = `${DIR}/encounters-vintages.json`;
const LISTING = "https://www.cbp.gov/document/stats/nationwide-encounters";
const LISTING_FILE = "cbp-nationwide-encounters-document.html";

const MONTHS = ["oct", "nov", "dec", "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep"] as const;

function extractText(s: CbpSource, path: string): string {
  if (s.kind === "pdf") return execFileSync("pdftotext", ["-layout", path, "-"], { maxBuffer: 1 << 28 }).toString("utf8");
  if (s.kind === "html") return htmlToText(readFileSync(path, "utf8")) + "\n";
  const sheets = readXlsx(path);
  const picked = (s.sheets ?? sheets.map((x) => x.name)).map((name) => {
    const sh = sheets.find((x) => x.name === name);
    if (!sh) throw new Error(`${s.file}: no sheet "${name}" (sheets: ${sheets.map((x) => x.name).join(", ")})`);
    return sh;
  });
  return sheetsToText(picked, { rowNumbers: true });
}

/** A CSV link on the listing page, with what its name says about it. */
export interface ListedVintage {
  url: string;
  file: string;
  fy_start: number;
  fy_end: number;
  through: EncountersVintage["through"];
  posted: string;
}

const MON_ABBR: Record<string, string> = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };

/** Every area-of-responsibility encounters CSV linked from the listing page (the `-state` files hold the same totals by state). */
export function listVintages(html: string): ListedVintage[] {
  const out = new Map<string, ListedVintage>();
  for (const m of html.matchAll(/href="(\/sites\/default\/files\/[^"]*?nationwide-encounters-fy(\d{2})-fy(\d{2})(?:-([a-z]{3}))?-aor(?:_\d+)?\.csv)"/g)) {
    const path = m[1];
    const folder = path.match(/\/files\/(\d{4})-(\d{2})\//) ?? path.match(/\/documents\/(\d{4})-([A-Z][a-z]{2})\//);
    if (!folder) throw new Error(`encounters CSV link with no dated folder: ${path}`);
    const posted = `${folder[1]}-${MON_ABBR[folder[2]] ?? folder[2]}`;
    const through = (m[4] ?? null) as ListedVintage["through"];
    if (through !== null && !MONTHS.includes(through)) throw new Error(`encounters CSV link with an unknown month "${through}": ${path}`);
    out.set(path, { url: `https://www.cbp.gov${path}`, file: path.split("/").pop()!, fy_start: 2000 + Number(m[2]), fy_end: 2000 + Number(m[3]), through, posted });
  }
  return [...out.values()];
}

/** Later is newer: by last fiscal year, then by last month (a file with no month was posted after its last year ended). */
export function vintageRank(v: Pick<EncountersVintage, "fy_end" | "through" | "posted">): number {
  const month = v.through === null ? MONTHS.length : MONTHS.indexOf(v.through);
  return v.fy_end * 100 + month;
}

async function sha256(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function updateVintages(refresh: boolean): Promise<string> {
  const res = await fetch(LISTING);
  if (!res.ok) throw new Error(`GET ${LISTING} -> ${res.status} ${res.statusText}`);
  const html = await res.text();
  await writeFile(`${DIR}/${LISTING_FILE}`, html);
  await writeFile(`${DIR}/${LISTING_FILE.replace(/\.html$/, ".txt")}`, htmlToText(html) + "\n");

  const listed = listVintages(html);
  if (!listed.length) throw new Error(`${LISTING}: no encounters CSV links found (page layout changed?)`);
  const newest = listed.reduce((a, b) => (vintageRank(b) > vintageRank(a) || (vintageRank(b) === vintageRank(a) && b.posted > a.posted) ? b : a));

  const kept = existsSync(VINTAGES) ? encountersVintages.parse(JSON.parse(await readFile(VINTAGES, "utf8"))) : [];
  const sameRange = kept.find((v) => v.fy_start === newest.fy_start && v.fy_end === newest.fy_end);
  let action = "unchanged";
  if (!sameRange || vintageRank(newest) > vintageRank(sameRange) || newest.url !== sameRange.url || refresh) {
    const path = `${DIR}/${newest.file}`;
    logResult(await download(newest.url, path));
    const entry: EncountersVintage = { file: newest.file, url: newest.url, fy_start: newest.fy_start, fy_end: newest.fy_end, through: newest.through, posted: newest.posted, sha256: await sha256(path) };
    if (sameRange && sameRange.file !== newest.file) await rm(`${DIR}/${sameRange.file}`, { force: true });
    const next = [...kept.filter((v) => v !== sameRange), entry].sort((a, b) => a.fy_start - b.fy_start || vintageRank(a) - vintageRank(b));
    await writeFile(VINTAGES, `[\n${next.map((v) => JSON.stringify(v)).join(",\n")}\n]\n`);
    action = sameRange ? `replaced ${sameRange.file}` : "added";
  }
  for (const v of kept) if (!existsSync(`${DIR}/${v.file}`)) throw new Error(`${VINTAGES} lists ${v.file}, which is not on disk`);
  return `newest encounters file ${newest.file} (FY${newest.fy_start}-FY${newest.fy_end}, through ${newest.through ?? "year end"}): ${action}`;
}

async function main() {
  const refresh = process.argv.includes("--refresh");
  // Only the source list is needed here, so a catalog whose curated values are mid-edit can still be fetched.
  const { sources } = z.object({ sources: z.array(cbpSource) }).parse(JSON.parse(await readFile(CATALOG, "utf8")));
  console.log("fetch:cbp");
  for (const s of sources) {
    const path = `${DIR}/${s.file}`;
    if (refresh || !existsSync(path)) logResult(await download(s.url, path));
    await writeFile(`${DIR}/${s.text_file}`, extractText(s, path));
  }
  console.log(`  ${sources.length} sources, text extracts written`);
  console.log(`  ${await updateVintages(refresh)}`);
}

if (process.argv[1]?.endsWith("cbp.ts")) {
  main().catch((err: unknown) => {
    console.error("\nfetch:cbp FAILED");
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}

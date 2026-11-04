import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RAW_DIR, run } from "./lib";

/**
 * Clemency, Clinton onward, from the Justice Department's Office of the Pardon Attorney: the fiscal-year statistics, the
 * bypass-share page, each president's recipient pages, and the one Biden group warrant table with usable text (only its `pdftotext -layout`
 * text is kept, which is what the transform reads, so it needs no PDF tools).
 *
 * Freshness: .github/workflows/clemency-freshness.yml.
 */
export const CLEMENCY_RAW = `${RAW_DIR}/clemency`;
const BASE = "https://www.justice.gov/pardon";
export const CLEMENCY_PAGES = [
  "clemency-statistics",
  "past-clemency-action-and-statistics",
  "clemency-grants-president-donald-j-trump-2025-present",
  "pardons-granted-president-joseph-biden-2021-2025",
  "commutations-granted-president-joseph-biden-2021-2025",
  "pardons-granted-president-donald-j-trump-2017-2021",
  "commutations-granted-president-donald-j-trump-2017-2021",
  "pardons-granted-president-barack-h-obama-2009-2017",
  "commutations-granted-president-barack-h-obama-2009-2017",
  "pardons-granted-president-george-w-bush-2001-2009",
  "commutations-granted-president-george-w-bush-2001-2009",
  "pardons-granted-president-william-j-clinton-1993-2001",
  "commutations-granted-president-william-j-clinton-1993-2001",
] as const;

/** The disclosure table for Biden's Jan 17, 2025 warrant 2: the one group warrant PDF with a clean text layer and offenses. */
export const BIDEN_DISCLOSURE = "1387881";

async function get(url: string): Promise<Response> {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; InsideGov data fetch)" } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res;
}

/** Keeps only the page's main content, so a change to DOJ's site chrome doesn't show up as a data change. */
export function mainContent(html: string): string {
  const from = html.indexOf("<main");
  const to = html.lastIndexOf("</main>");
  return from >= 0 && to > from ? html.slice(from, to + 7) : html;
}

async function main() {
  await mkdir(CLEMENCY_RAW, { recursive: true });
  for (const page of CLEMENCY_PAGES) {
    const html = mainContent(await (await get(`${BASE}/${page}`)).text());
    await writeFile(`${CLEMENCY_RAW}/${page}.html`, html);
    console.log(`${page}: ${html.length} bytes`);
  }
  // Biden's term is over, so this can't change: its text is committed and read only if missing.
  for (const id of [BIDEN_DISCLOSURE]) {
    const txt = `${CLEMENCY_RAW}/biden-warrant-${id}.txt`;
    if (existsSync(txt)) continue;
    const pdf = join(tmpdir(), `biden-warrant-${id}.pdf`);
    await writeFile(pdf, new Uint8Array(await (await get(`https://www.justice.gov/pardon/media/${id}/dl?inline`)).arrayBuffer()));
    execFileSync("pdftotext", ["-layout", pdf, txt]);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) void run("clemency", main);

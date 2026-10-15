import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { RAW_DIR, download, logResult } from "./lib";
import { extractTable39 } from "./ohss-removals-lib";
import { removalsHistoryCatalog } from "../../lib/removals-history-entities";

/**
 * INS-era removals fetch: downloads the OHSS Yearbook Table 39 pages listed in
 * `pipeline/reference/removals-history-catalog.json` into `pipeline/raw/ohss-removals/` and writes a text extract next to
 * each (`<file>.txt`, see `ohss-removals-lib.ts`). The transform reads ONLY the extracts. Existing snapshots are never
 * re-downloaded unless `--refresh`; extracts are deterministic, so an unchanged source is no diff. OHSS posts each Yearbook
 * edition at a new address, so a newer edition means a new catalog entry (the weekly ohss-review workflow flags it).
 * See docs/IMMIGRATION_SOURCE_NOTES.md §10.
 */
const DIR = `${RAW_DIR}/ohss-removals`;
const CATALOG = "pipeline/reference/removals-history-catalog.json";

async function main() {
  const refresh = process.argv.includes("--refresh");
  const catalog = removalsHistoryCatalog.parse(JSON.parse(await readFile(CATALOG, "utf8")));
  console.log("fetch:ohss-removals");
  for (const s of catalog.sources) {
    const path = `${DIR}/${s.file}`;
    if (refresh || !existsSync(path)) logResult(await download(s.url, path));
    await writeFile(`${DIR}/${s.text_file}`, extractTable39(await readFile(path, "utf8")));
  }
  console.log(`  ${catalog.sources.length} sources, text extracts written`);
}

if (process.argv[1]?.endsWith("ohss-removals.ts")) {
  main().catch((err: unknown) => {
    console.error("\nfetch:ohss-removals FAILED");
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}

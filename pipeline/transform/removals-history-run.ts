import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { enforcementRow, isNationalRemovals } from "../../lib/enforcement-entities";
import { removalsHistoryCatalog } from "../../lib/removals-history-entities";
import { HISTORICAL_ADMINISTRATIONS } from "../../lib/troops-presidents";
import { RAW_DIR } from "../fetch/lib";
import { ADMINISTRATIONS } from "./administrations";
import { buildRemovalsHistory, RemovalsHistoryError } from "./removals-history";

/**
 * INS-era removals transform: pipeline/reference/removals-history-catalog.json + the Table 39 text extracts in
 * raw/ohss-removals -> pipeline/output/removals_history_{series,report}.json. Reads `enforcement_series.json` for the
 * comparison with ICE, so it runs after `enforcement-run.ts`. Deterministic (`as_of` is the catalog's retrieval date).
 * FY1980–FY1992 predate `administrations.json` (1993 on), so the page-local historical presidents table is prepended,
 * as the encounters, refugee and green-card readers do.
 */
const OUT = "pipeline/output";
const RAW = `${RAW_DIR}/ohss-removals`;
const CATALOG = "pipeline/reference/removals-history-catalog.json";

const oneRowPerLine = (rows: readonly unknown[]) => `[\n${rows.map((r) => JSON.stringify(r)).join(",\n")}\n]\n`;

async function main() {
  console.log("transform:removals-history");
  const catalog = removalsHistoryCatalog.parse(JSON.parse(await readFile(CATALOG, "utf8")));
  const text = async (file: string) => {
    try {
      return await readFile(`${RAW}/${file}`, "utf8");
    } catch {
      throw new RemovalsHistoryError(`${RAW}/${file} is missing — run pnpm fetch:ohss-removals`);
    }
  };
  const primary = catalog.sources.find((s) => s.role === "primary")!;
  const comparison = catalog.sources.find((s) => s.role === "comparison");
  if (!comparison) throw new RemovalsHistoryError("the catalog needs a comparison source");
  const ice = new Map(
    (JSON.parse(await readFile(`${OUT}/enforcement_series.json`, "utf8")) as unknown[])
      .map((r) => enforcementRow.parse(r))
      .filter(isNationalRemovals)
      .map((r) => [r.period, r.value] as const),
  );
  const built = buildRemovalsHistory({
    primary: { source: primary, text: await text(primary.text_file) },
    comparison: { source: comparison, text: await text(comparison.text_file) },
    ice,
    administrations: [...HISTORICAL_ADMINISTRATIONS, ...ADMINISTRATIONS.filter((a) => !HISTORICAL_ADMINISTRATIONS.some((h) => h.term_id === a.term_id))],
  });

  const sources = await Promise.all(
    catalog.sources.map(async (s) => {
      const body = await readFile(`${RAW}/${s.file}`);
      return { id: s.id, path: `${RAW}/${s.file}`, bytes: body.byteLength, sha256: createHash("sha256").update(body).digest("hex") };
    }),
  );
  await mkdir(OUT, { recursive: true });
  await writeFile(`${OUT}/removals_history_series.json`, oneRowPerLine(built.rows));
  await writeFile(`${OUT}/removals_history_report.json`, JSON.stringify({ ...built.report, sources }, null, 2) + "\n");
  const r = built.report;
  console.log(`  ${r.rows} rows, FY${r.first_period}..FY${r.last_period} from the ${r.edition} edition; compared with ICE for ${r.ice_comparison.length} years`);
  console.log(`  vs the ${r.edition_revisions.compared_edition} edition: ${r.edition_revisions.changed}/${r.edition_revisions.years} early years differ (max ${r.edition_revisions.max_abs_difference}); later years max ${r.edition_revisions.later_years.max_abs_difference} (FY${r.edition_revisions.later_years.max_abs_year})`);
}

if (process.argv[1]?.endsWith("removals-history-run.ts")) {
  main().catch((err: unknown) => {
    console.error("\ntransform:removals-history FAILED");
    console.error(err instanceof z.ZodError ? z.prettifyError(err) : err instanceof Error ? err.message : err);
    process.exit(1);
  });
}

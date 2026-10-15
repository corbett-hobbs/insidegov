import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { cbpCatalog, encountersVintages } from "../../lib/encounters-entities";
import { assertEncountersInvariants } from "../../lib/encounters-derive";
import { HISTORICAL_ADMINISTRATIONS } from "../../lib/troops-presidents";
import { RAW_DIR } from "../fetch/lib";
import { ADMINISTRATIONS } from "./administrations";
import { buildEncounters, EncountersDataError } from "./encounters";

/**
 * CBP border-encounters track transform: pipeline/reference/cbp-encounters-catalog.json + the text extracts and
 * encounters CSVs in raw/cbp (`pnpm fetch:cbp`) -> output/encounters_{series,monthly,notes,report}.json.
 * Deterministic (`as_of` is the catalog's retrieval date).
 *
 * Presidents: the series starts in FY1980, before `ADMINISTRATIONS` (1993 on), so fiscal years are attributed with the
 * historical presidents table prepended, as the refugee and green-card tracks do. No new terms table.
 */
const OUT = "pipeline/output";
const RAW = `${RAW_DIR}/cbp`;
const CATALOG = "pipeline/reference/cbp-encounters-catalog.json";

const oneRowPerLine = (rows: readonly unknown[]) => (rows.length === 0 ? "[]\n" : `[\n${rows.map((r) => JSON.stringify(r)).join(",\n")}\n]\n`);

async function main() {
  console.log("transform:encounters");
  const catalog = cbpCatalog.parse(JSON.parse(await readFile(CATALOG, "utf8")));
  const texts = new Map<string, string>();
  for (const s of catalog.sources) {
    try {
      texts.set(s.id, await readFile(`${RAW}/${s.text_file}`, "utf8"));
    } catch {
      throw new EncountersDataError(`${RAW}/${s.text_file} is missing — run pnpm fetch:cbp`);
    }
  }
  const manifest = encountersVintages.parse(JSON.parse(await readFile(`${RAW}/encounters-vintages.json`, "utf8")));
  const vintages = await Promise.all(
    manifest.map(async (vintage) => {
      const body = await readFile(`${RAW}/${vintage.file}`);
      const sha = createHash("sha256").update(body).digest("hex");
      if (sha !== vintage.sha256) throw new EncountersDataError(`${vintage.file}: sha256 ${sha.slice(0, 12)} does not match encounters-vintages.json (${vintage.sha256.slice(0, 12)}); re-run pnpm fetch:cbp`);
      return { vintage, csv: body.toString("utf8") };
    }),
  );
  const administrations = [...HISTORICAL_ADMINISTRATIONS, ...ADMINISTRATIONS.filter((a) => !HISTORICAL_ADMINISTRATIONS.some((h) => h.term_id === a.term_id))];
  const built = buildEncounters({ catalog, texts, vintages, administrations });
  assertEncountersInvariants(built.series, built.notes);

  const sources = await Promise.all(
    catalog.sources.map(async (s) => {
      const body = await readFile(`${RAW}/${s.file}`);
      return { id: s.id, path: `${RAW}/${s.file}`, bytes: body.byteLength, sha256: createHash("sha256").update(body).digest("hex") };
    }),
  );

  await mkdir(OUT, { recursive: true });
  await writeFile(`${OUT}/encounters_series.json`, oneRowPerLine(built.series));
  await writeFile(`${OUT}/encounters_monthly.json`, oneRowPerLine(built.monthly));
  await writeFile(`${OUT}/encounters_notes.json`, oneRowPerLine(built.notes));
  await writeFile(`${OUT}/encounters_report.json`, JSON.stringify({ ...built.report, sources }, null, 2) + "\n");

  const r = built.report as { first_period: number; last_period: number; coverage: { ofo: { first: number } | null; title42: { first: number; last: number } | null }; preliminary: { fy: number; months: number } | null };
  console.log(`  ${built.series.length} rows, FY${r.first_period}..FY${r.last_period}; OFO from FY${r.coverage.ofo?.first}; Title 42 FY${r.coverage.title42?.first}..FY${r.coverage.title42?.last}`);
  console.log(`  ${built.monthly.length} monthly rows; preliminary: ${r.preliminary ? `FY${r.preliminary.fy} (${r.preliminary.months} months)` : "none"}`);
}

if (process.argv[1]?.endsWith("encounters-run.ts")) {
  main().catch((err: unknown) => {
    console.error("\ntransform:encounters FAILED");
    console.error(err instanceof z.ZodError ? z.prettifyError(err) : err instanceof Error ? err.message : err);
    process.exit(1);
  });
}

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { refugeeCatalog } from "../../lib/refugee-entities";
import { HISTORICAL_ADMINISTRATIONS } from "../../lib/troops-presidents";
import { RAW_DIR } from "../fetch/lib";
import { ADMINISTRATIONS } from "./administrations";
import { indexCountries } from "./removals-country-names";
import { buildRefugee, RefugeeDataError, type FrIndexRow } from "./refugee";

/**
 * Refugee-admissions track transform: pipeline/reference/refugee-catalog.json + the text extracts
 * in raw/refugee (`pnpm fetch:refugee`) + output/countries.json (the trade crosswalk that defines
 * `country_key`) -> output/refugee_{series,determinations,regions,by_country,monthly,policy,notes,
 * report}.json. Deterministic (`as_of` is the catalog's retrieval date). Run after trade-run.
 *
 * Presidents: the series starts in FY1980, before `ADMINISTRATIONS` (1993 on), so fiscal years are
 * attributed with the historical presidents table the troops and economy pages already use
 * (`HISTORICAL_ADMINISTRATIONS`, same `term_id` convention) prepended. No new terms table.
 */
const OUT = "pipeline/output";
const RAW = `${RAW_DIR}/refugee`;
const CATALOG = "pipeline/reference/refugee-catalog.json";

const oneRowPerLine = (rows: readonly unknown[]) =>
  rows.length === 0 ? "[]\n" : `[\n${rows.map((r) => JSON.stringify(r)).join(",\n")}\n]\n`;

async function main() {
  console.log("transform:refugee");
  const catalog = refugeeCatalog.parse(JSON.parse(await readFile(CATALOG, "utf8")));
  const texts = new Map<string, string>();
  for (const s of catalog.sources) {
    try {
      texts.set(s.id, await readFile(`${RAW}/${s.text_file}`, "utf8"));
    } catch {
      throw new RefugeeDataError(`${RAW}/${s.text_file} is missing — run pnpm fetch:refugee`);
    }
  }
  const frIndex = JSON.parse(await readFile(`${RAW}/fr-refugee-admissions-index.json`, "utf8")) as FrIndexRow[];
  const countries = (JSON.parse(await readFile(`${OUT}/countries.json`, "utf8")) as { country_code: string; name: string; kind: string }[]).filter(
    (c) => c.kind === "country" || c.kind === "former",
  );
  const administrations = [...HISTORICAL_ADMINISTRATIONS, ...ADMINISTRATIONS.filter((a) => !HISTORICAL_ADMINISTRATIONS.some((h) => h.term_id === a.term_id))];
  const built = buildRefugee({ catalog, texts, frIndex, administrations, countries: indexCountries(countries) });

  const sources = await Promise.all(
    catalog.sources.map(async (s) => {
      const body = await readFile(`${RAW}/${s.file}`);
      return { id: s.id, path: `${RAW}/${s.file}`, bytes: body.byteLength, sha256: createHash("sha256").update(body).digest("hex") };
    }),
  );

  await mkdir(OUT, { recursive: true });
  await writeFile(`${OUT}/refugee_series.json`, oneRowPerLine(built.series));
  await writeFile(`${OUT}/refugee_determinations.json`, oneRowPerLine(built.determinations));
  await writeFile(`${OUT}/refugee_regions.json`, oneRowPerLine(built.regions));
  await writeFile(`${OUT}/refugee_by_country.json`, oneRowPerLine(built.byCountry));
  await writeFile(`${OUT}/refugee_monthly.json`, oneRowPerLine(built.monthly));
  await writeFile(`${OUT}/refugee_policy.json`, oneRowPerLine(built.policy));
  await writeFile(`${OUT}/refugee_notes.json`, oneRowPerLine(built.notes));
  await writeFile(`${OUT}/refugee_report.json`, JSON.stringify({ ...built.report, sources }, null, 2) + "\n");

  const r = built.report as { ceiling_years: { first: number; last: number; missing: number[] }; admissions_years: { first: number; last: number }; determinations: number; policy_events: number; country_years: { rows: number; countries: number; first: number; last: number } };
  console.log(`  ${built.series.length} fiscal years; ceilings FY${r.ceiling_years.first}..FY${r.ceiling_years.last} (missing: ${r.ceiling_years.missing.map((p) => `FY${p}`).join(", ") || "none"}); admissions FY${r.admissions_years.first}..FY${r.admissions_years.last}`);
  console.log(`  ${r.determinations} determinations; ${r.country_years.rows} country rows (${r.country_years.countries} countries, FY${r.country_years.first}..FY${r.country_years.last}); ${r.policy_events} policy events`);
}

if (process.argv[1]?.endsWith("refugee-run.ts")) {
  main().catch((err: unknown) => {
    console.error("\ntransform:refugee FAILED");
    console.error(err instanceof z.ZodError ? z.prettifyError(err) : err instanceof Error ? err.message : err);
    process.exit(1);
  });
}

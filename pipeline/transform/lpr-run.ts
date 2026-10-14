import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { lprCatalog } from "../../lib/lpr-entities";
import { assertLprInvariants } from "../../lib/lpr-derive";
import { HISTORICAL_ADMINISTRATIONS } from "../../lib/troops-presidents";
import { RAW_DIR } from "../fetch/lib";
import { ADMINISTRATIONS } from "./administrations";
import { buildLpr, LprDataError } from "./lpr";
import { indexCountries } from "./removals-country-names";

/**
 * Legal-immigration track transform (green cards and naturalizations):
 * pipeline/reference/lpr-catalog.json + the OHSS workbook extracts in raw/ohss (`pnpm fetch:ohss`)
 * + output/countries.json (the trade crosswalk that defines `country_key`) + output/refugee_series.json
 * (cross-check only) -> output/lpr_{series,by_country,notes,report}.json. Deterministic (`as_of` is
 * the catalog's retrieval date). Run after trade-run and refugee-run.
 *
 * Presidents: the totals start in FY1977, before `ADMINISTRATIONS` (1993 on), so the historical
 * presidents table the troops, economy and refugee pages use is prepended. No new terms table.
 */
const OUT = "pipeline/output";
const RAW = `${RAW_DIR}/ohss`;
const CATALOG = "pipeline/reference/lpr-catalog.json";

const oneRowPerLine = (rows: readonly unknown[]) =>
  rows.length === 0 ? "[]\n" : `[\n${rows.map((r) => JSON.stringify(r)).join(",\n")}\n]\n`;

async function main() {
  console.log("transform:lpr");
  const catalog = lprCatalog.parse(JSON.parse(await readFile(CATALOG, "utf8")));
  const texts = new Map<string, string>();
  for (const s of catalog.sources) {
    try {
      texts.set(s.id, await readFile(`${RAW}/${s.text_file}`, "utf8"));
    } catch {
      throw new LprDataError(`${RAW}/${s.text_file} is missing — run pnpm fetch:ohss`);
    }
  }
  const countries = (JSON.parse(await readFile(`${OUT}/countries.json`, "utf8")) as { country_code: string; name: string; kind: string }[]).filter(
    (c) => c.kind === "country" || c.kind === "former",
  );
  const refugee = JSON.parse(await readFile(`${OUT}/refugee_series.json`, "utf8")) as { period: number; admissions: number | null }[];
  const administrations = [...HISTORICAL_ADMINISTRATIONS, ...ADMINISTRATIONS.filter((a) => !HISTORICAL_ADMINISTRATIONS.some((h) => h.term_id === a.term_id))];
  const built = buildLpr({
    catalog,
    texts,
    administrations,
    countries: indexCountries(countries),
    refugeeAdmissions: new Map(refugee.flatMap((r) => (r.admissions === null ? [] : [[r.period, r.admissions] as const]))),
  });

  // The page's invariants fail here, not at the next site build.
  assertLprInvariants(built.series, built.byCountry, built.notes);

  const sources = await Promise.all(
    catalog.sources.map(async (s) => {
      const body = await readFile(`${RAW}/${s.file}`);
      return { id: s.id, path: `${RAW}/${s.file}`, bytes: body.byteLength, sha256: createHash("sha256").update(body).digest("hex") };
    }),
  );

  await mkdir(OUT, { recursive: true });
  await writeFile(`${OUT}/lpr_series.json`, oneRowPerLine(built.series));
  await writeFile(`${OUT}/lpr_by_country.json`, oneRowPerLine(built.byCountry));
  await writeFile(`${OUT}/lpr_notes.json`, oneRowPerLine(built.notes));
  await writeFile(`${OUT}/lpr_report.json`, JSON.stringify({ ...built.report, sources }, null, 2) + "\n");

  const r = built.report;
  console.log(`  ${r.rows} series rows: LPR totals FY${r.lpr_total_years.first}..FY${r.lpr_total_years.last}, classes FY${r.lpr_class_years.first}..FY${r.lpr_class_years.last}; naturalizations FY${r.naturalization_years.first}..FY${r.naturalization_years.last}; newest Yearbook FY${r.latest_yearbook}`);
  console.log(`  ${r.country_years.rows} by-country rows (${r.country_years.countries} countries); ${r.vintages.comparisons} vintage comparisons, ${r.vintages.yearbook_restatements.length} recorded Yearbook restatements, ${r.vintages.quarterly_vs_yearbook.totals.length} quarterly totals revised`);
}

if (process.argv[1]?.endsWith("lpr-run.ts")) {
  main().catch((err: unknown) => {
    console.error("\ntransform:lpr FAILED");
    console.error(err instanceof z.ZodError ? z.prettifyError(err) : err instanceof Error ? err.message : err);
    process.exit(1);
  });
}

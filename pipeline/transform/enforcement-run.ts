import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { z } from "zod";
import { iceCatalog } from "../../lib/enforcement-entities";
import { assertEnforcementInvariants } from "../../lib/immigration-derive";
import { RAW_DIR } from "../fetch/lib";
import { ADMINISTRATIONS } from "./administrations";
import { buildEnforcement, EnforcementDataError } from "./enforcement";

/**
 * Immigration-enforcement track transform: pipeline/reference/ice-removals-catalog.json
 * + the ICE text extracts (and chart snapshots) in raw/ice -> pipeline/output/
 * {enforcement_series,enforcement_notes,enforcement_report}.json.
 * Deterministic (no run timestamp; `as_of` is the catalog's retrieval date).
 * Presidential tenures come from the existing `ADMINISTRATIONS` table — there is
 * no second terms file.
 */
const OUT = "pipeline/output";
const RAW = `${RAW_DIR}/ice`;
const CATALOG = "pipeline/reference/ice-removals-catalog.json";

const oneRowPerLine = (rows: readonly unknown[]) =>
  rows.length === 0 ? "[]\n" : `[\n${rows.map((r) => JSON.stringify(r)).join(",\n")}\n]\n`;

async function main() {
  console.log("transform:enforcement");
  const catalog = iceCatalog.parse(JSON.parse(await readFile(CATALOG, "utf8")));
  const texts = new Map<string, string>();
  for (const s of catalog.sources) {
    try {
      texts.set(s.id, await readFile(`${RAW}/${s.text_file}`, "utf8"));
    } catch {
      throw new EnforcementDataError(`${RAW}/${s.text_file} is missing — run pnpm fetch:ice`);
    }
  }
  const figureFiles = new Set(await readdir(RAW));
  const built = buildEnforcement({ catalog, texts, figureFiles, administrations: ADMINISTRATIONS });

  // The page's invariants (contiguous years, day sums, attribution, anchors) fail here, not at the next site build.
  assertEnforcementInvariants(built.series, built.report, ADMINISTRATIONS);

  const hash = async (file: string) => {
    const body = await readFile(`${RAW}/${file}`);
    return { path: `${RAW}/${file}`, bytes: body.byteLength, sha256: createHash("sha256").update(body).digest("hex") };
  };
  const sources = await Promise.all(catalog.sources.map(async (s) => ({ id: s.id, ...(await hash(s.file)) })));
  // Rendered-page snapshots that image-only chart values were read from.
  const figures = await Promise.all(
    [...new Set([...catalog.years, ...catalog.values].flatMap((y) => (y.figure_file ? [y.figure_file] : [])))].sort().map(hash),
  );

  await mkdir(OUT, { recursive: true });
  await writeFile(`${OUT}/enforcement_series.json`, oneRowPerLine(built.series));
  await writeFile(`${OUT}/enforcement_notes.json`, oneRowPerLine(built.notes));
  await writeFile(`${OUT}/enforcement_report.json`, JSON.stringify({ ...built.report, sources, figures }, null, 2) + "\n");

  const r = built.report;
  console.log(`  ${r.rows} rows, FY${r.first_period}..FY${r.last_period}, gaps: ${r.missing_periods.length ? r.missing_periods.join(",") : "none"}`);
  console.log(`  status ${JSON.stringify(r.by_status)}; blended years: ${r.blended_periods.map((p) => `FY${p}`).join(", ")}`);
  console.log(`  anchors ok: ${r.anchors.map((a) => `FY${a.period}=${a.value.toLocaleString("en-US")}`).join(", ")}`);
  const b = r.breakdowns;
  console.log(`  breakdowns: ${b.rows} rows in ${b.coverage.length} series; ${b.partitions.length} breakdowns sum to their totals (${b.exceptions.length} documented exception); ${b.sum_checks.length} printed subtotals match; ${b.disagreements.length} disagreements recorded`);
}

if (process.argv[1]?.endsWith("enforcement-run.ts")) {
  main().catch((err: unknown) => {
    console.error("\ntransform:enforcement FAILED");
    console.error(err instanceof z.ZodError ? z.prettifyError(err) : err instanceof Error ? err.message : err);
    process.exit(1);
  });
}

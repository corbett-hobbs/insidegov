import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { administration } from "./executive-orders-entities";
import { buildRefugeePayload } from "./refugee-derive";
import { refugeeCountryRow, refugeeDeterminationRow, refugeeNote, refugeePolicyRow, refugeeRegionRow, refugeeSeriesRow } from "./refugee-entities";
import type { RefugeePayload } from "./refugee-types";

/**
 * Build-time reader for the refugee section of /presidency/immigration: parses the pipeline outputs at the boundary (a bad file
 * fails the build), then hands the page a dense payload. Shaping and the invariants (regions and countries add up to each year's
 * admissions) are in the pure, unit-tested `lib/refugee-derive.ts`.
 */

const read = (file: string): unknown[] => JSON.parse(readFileSync(join(process.cwd(), "pipeline", "output", file), "utf8")) as unknown[];

let cache: RefugeePayload | null = null;

export function getRefugeePayload(): RefugeePayload {
  if (cache) return cache;
  cache = buildRefugeePayload({
    series: read("refugee_series.json").map((r) => refugeeSeriesRow.parse(r)),
    regions: read("refugee_regions.json").map((r) => refugeeRegionRow.parse(r)),
    countries: read("refugee_by_country.json").map((r) => refugeeCountryRow.parse(r)),
    policy: read("refugee_policy.json").map((r) => refugeePolicyRow.parse(r)),
    notes: read("refugee_notes.json").map((r) => refugeeNote.parse(r)),
    determinations: read("refugee_determinations.json").map((r) => refugeeDeterminationRow.parse(r)),
    admins: read("administrations.json").map((r) => administration.parse(r)),
  });
  return cache;
}

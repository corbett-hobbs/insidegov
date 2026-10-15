import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildEncountersPayload } from "./encounters-derive";
import { encountersNoteRow, encountersSeriesRow } from "./encounters-entities";
import type { EncountersPayload } from "./encounters-types";
import { administration } from "./executive-orders-entities";
import { HISTORICAL_ADMINISTRATIONS } from "./troops-presidents";

/**
 * Build-time reader for the CBP border-encounters track: parses the pipeline outputs at the boundary (a bad file fails
 * the build), then hands the page a dense payload. Shaping and the invariants are in the pure, unit-tested
 * `lib/encounters-derive.ts`. The series starts in FY1980, before `administrations.json` (1993 on), so the historical
 * presidents table is prepended, as the refugee and green-card readers do.
 */

const read = (file: string): unknown[] => JSON.parse(readFileSync(join(process.cwd(), "pipeline", "output", file), "utf8")) as unknown[];

let cache: EncountersPayload | null = null;

export function getEncountersPayload(): EncountersPayload {
  if (cache) return cache;
  const admins = read("administrations.json").map((r) => administration.parse(r));
  cache = buildEncountersPayload({
    series: read("encounters_series.json").map((r) => encountersSeriesRow.parse(r)),
    notes: read("encounters_notes.json").map((r) => encountersNoteRow.parse(r)),
    admins: [...HISTORICAL_ADMINISTRATIONS, ...admins.filter((a) => !HISTORICAL_ADMINISTRATIONS.some((h) => h.term_id === a.term_id))],
  });
  return cache;
}

import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { administration } from "./executive-orders-entities";
import { buildLprPayload } from "./lpr-derive";
import { lprCountryRow, lprNoteRow, lprSeriesRow } from "./lpr-entities";
import type { LprPayload } from "./lpr-types";
import { HISTORICAL_ADMINISTRATIONS } from "./troops-presidents";

/**
 * Build-time reader for the legal-immigration track (green cards and naturalizations): parses the
 * pipeline outputs at the boundary (a bad file fails the build), then hands a page a dense payload.
 * Shaping and the invariants are in the pure, unit-tested `lib/lpr-derive.ts`. The series starts in
 * FY1977, before `administrations.json` (1993 on), so the historical presidents table is prepended,
 * as the troops and refugee pipelines do. No page reads it yet (session F).
 */

const read = (file: string): unknown[] => JSON.parse(readFileSync(join(process.cwd(), "pipeline", "output", file), "utf8")) as unknown[];

let cache: LprPayload | null = null;

export function getLprPayload(): LprPayload {
  if (cache) return cache;
  const admins = read("administrations.json").map((r) => administration.parse(r));
  cache = buildLprPayload({
    series: read("lpr_series.json").map((r) => lprSeriesRow.parse(r)),
    byCountry: read("lpr_by_country.json").map((r) => lprCountryRow.parse(r)),
    notes: read("lpr_notes.json").map((r) => lprNoteRow.parse(r)),
    admins: [...HISTORICAL_ADMINISTRATIONS, ...admins.filter((a) => !HISTORICAL_ADMINISTRATIONS.some((h) => h.term_id === a.term_id))],
  });
  return cache;
}

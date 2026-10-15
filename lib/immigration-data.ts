import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { enforcementNote, enforcementReport, enforcementRow } from "./enforcement-entities";
import { administration } from "./executive-orders-entities";
import { removalsHistoryReport, removalsHistoryRow } from "./removals-history-entities";
import { HISTORICAL_ADMINISTRATIONS } from "./troops-presidents";
import { buildImmigrationData, type ImmigrationPageData } from "./immigration-derive";

/**
 * Build-time reader for /presidency/immigration: parses the three enforcement
 * files and the administrations table, runs the invariant checks (a failure
 * fails the build) and hands the page its shaped data. Shaping is in the pure,
 * unit-tested `lib/immigration-derive.ts`.
 */

const OUT = join(process.cwd(), "pipeline", "output");
const read = (file: string): unknown[] | unknown => JSON.parse(readFileSync(join(OUT, file), "utf8"));

let cache: ImmigrationPageData | null = null;

export function getImmigrationPageData(): ImmigrationPageData {
  if (cache) return cache;
  const admins = (read("administrations.json") as unknown[]).map((r) => administration.parse(r));
  cache = buildImmigrationData(
    (read("enforcement_series.json") as unknown[]).map((r) => enforcementRow.parse(r)),
    (read("enforcement_notes.json") as unknown[]).map((r) => enforcementNote.parse(r)),
    enforcementReport.parse(read("enforcement_report.json")),
    // The INS-era years start in FY1980, before `administrations.json` (1993 on): prepend the historical presidents.
    [...HISTORICAL_ADMINISTRATIONS, ...admins.filter((a) => !HISTORICAL_ADMINISTRATIONS.some((h) => h.term_id === a.term_id))],
    {
      rows: (read("removals_history_series.json") as unknown[]).map((r) => removalsHistoryRow.parse(r)),
      report: removalsHistoryReport.parse(read("removals_history_report.json")),
    },
  );
  return cache;
}

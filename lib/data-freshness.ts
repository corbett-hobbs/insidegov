import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { latestDate } from "./freshness-dates";

/**
 * The date each branch's data was last known to change, read from the `pipeline/output` reports the freshness
 * workflows rewrite. The sitemap uses these as `lastModified` so a crawler is told a page changed only when its
 * data did, not on every deploy. A report that is missing or malformed contributes nothing; with no date at all
 * a branch returns `undefined` and the sitemap omits `lastModified` rather than invent one.
 */
const OUT = join(process.cwd(), "pipeline", "output");

function readJson(file: string): unknown {
  try {
    return JSON.parse(readFileSync(join(OUT, file), "utf8"));
  } catch {
    return null;
  }
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});

let cache: { presidency?: Date; congress?: Date; court?: Date; all?: Date } | null = null;

function load() {
  if (cache) return cache;

  const eoRange = obj(readJson("executive_orders_report.json")).signing_range;
  const presidency = latestDate([
    Array.isArray(eoRange) ? eoRange[eoRange.length - 1] : null,
    obj(readJson("foreign_assistance_meta.json")).data_through,
    ...Object.values(obj(obj(readJson("energy_report.json")).last_observation)),
    obj(obj(readJson("trade_report.json")).sources)["country.xlsx"] &&
      obj(obj(obj(readJson("trade_report.json")).sources)["country.xlsx"]).last_period,
  ]);

  const congress = latestDate([obj(readJson("committee_bills_meta.json")).data_through]);

  // SCDB releases are named "2026_01" (year_release); the release is the best date the database gives.
  const scdb = obj(readJson("decisions_meta.json")).scdb_version;
  const court = latestDate([typeof scdb === "string" ? scdb.replace("_", "-") : null]);

  cache = { presidency, congress, court, all: latestDate([presidency, congress, court]) };
  return cache;
}

export type Branch = "presidency" | "congress" | "court";

/** When a branch's data last changed, or `undefined` when no report says. */
export const branchFreshness = (branch: Branch): Date | undefined => load()[branch];

/** The newest date across every branch: for the home page and the site-wide pages. */
export const siteFreshness = (): Date | undefined => load().all;

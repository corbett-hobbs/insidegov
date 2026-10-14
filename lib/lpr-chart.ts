import type { LprClassKey, LprNoteOut, LprPayload, LprRegionKey, LprYear } from "./lpr-types";

/**
 * Pure geometry and grouping for the green-card cards (`components/immigration/Lpr*`): the six colour groups the bars are
 * stacked in, the y-axis, the numbered notes on the axis, and the country map's fixed bins. No React; unit-tested in
 * `lpr-chart.test.ts`.
 */

export type LprMetric = "lpr" | "naturalizations";

/**
 * OHSS prints seven classes; refugees and asylees are drawn as one colour so the stack reuses the six validated sector slots (the
 * way foreign aid does). Bottom to top. The seven classes stay in the table view.
 */
export const LPR_GROUPS = [
  { key: "immediate_relatives", name: "Immediate relatives of citizens", classes: ["immediate_relatives"] },
  { key: "family_preference", name: "Family-sponsored preferences", classes: ["family_preference"] },
  { key: "employment_preference", name: "Employment-based preferences", classes: ["employment_preference"] },
  { key: "diversity", name: "Diversity (visa lottery)", classes: ["diversity"] },
  { key: "humanitarian", name: "Refugees and asylees", classes: ["refugees", "asylees"] },
  { key: "other", name: "Other classes", classes: ["other"] },
] as const satisfies readonly { key: string; name: string; classes: readonly LprClassKey[] }[];
export type LprGroupKey = (typeof LPR_GROUPS)[number]["key"];

/**
 * The continents OHSS prints above its country rows, bottom to top of a stack (largest first). Naturalizations are stacked by these
 * (by country of birth; the newest, preliminary year by nationality), so the bars say where new citizens came from.
 */
export const LPR_REGION_STACK = [
  { key: "north_america", name: "North America (incl. Mexico, Central America, Caribbean)", short: "North America" },
  { key: "asia", name: "Asia", short: "Asia" },
  { key: "europe", name: "Europe", short: "Europe" },
  { key: "south_america", name: "South America", short: "South America" },
  { key: "africa", name: "Africa", short: "Africa" },
  { key: "oceania", name: "Oceania", short: "Oceania" },
  { key: "unknown", name: "Unknown", short: "Unknown" },
] as const satisfies readonly { key: LprRegionKey; name: string; short: string }[];

/** Region totals per fiscal year for one measure, for the chart and its cards. */
export function regionsByFy(p: LprPayload, metric: LprMetric): Map<number, Partial<Record<LprRegionKey, number>>> {
  return new Map(p.regionYears.filter((r) => r.metric === metric).map((r) => [r.fy, r.regions]));
}

/** A year's classes folded into the six groups; null before FY1999 (totals only). */
export function groupValues(y: LprYear): Record<LprGroupKey, number> | null {
  if (!y.classes) return null;
  const c = y.classes;
  return Object.fromEntries(LPR_GROUPS.map((g) => [g.key, (g.classes as readonly LprClassKey[]).reduce((s, k) => s + c[k], 0)])) as Record<LprGroupKey, number>;
}

/** The smallest round number at or above `max` x `pad`. */
export function niceMax(max: number, pad = 1.06): number {
  const target = Math.max(1, max) * pad;
  const mag = 10 ** Math.floor(Math.log10(target));
  for (const s of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (s * mag >= target) return s * mag;
  return 10 * mag;
}

/** Gridline values: a round step that gives at most five intervals. */
export function gridTicks(yMax: number): number[] {
  const step = [10_000, 20_000, 25_000, 50_000, 100_000, 200_000, 250_000, 500_000, 1_000_000, 2_000_000].find((s) => yMax / s <= 5) ?? yMax;
  const out: number[] = [];
  for (let v = 0; v <= yMax + 1; v += step) out.push(v);
  return out;
}

/** "0", "500k", "1.5M". */
export const axisText = (v: number) => (v === 0 ? "0" : v >= 1_000_000 ? `${+(v / 1_000_000).toFixed(2)}M` : v >= 1000 ? `${+(v / 1000).toFixed(1)}k` : String(v));

/** "1.36M", "894k". */
export const compactCount = (v: number) => (v >= 1_000_000 ? `${+(v / 1_000_000).toFixed(2)}M` : v >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v)));

export interface LprMarker {
  n: number;
  /** Fiscal year the marker sits on; a .5 sits on the line between two years' bars (the pandemic years). */
  at: number;
  title: string;
  text: string;
}

/**
 * The numbered notes tied to a place on the axis, built from the pipeline's own notes so the wording is not repeated here: the
 * FY2008 restatement (green cards only), the pandemic years (FY2020–21 for green cards, FY2020 for naturalizations) and the
 * preliminary newest year. Only markers inside the shown years are returned, numbered in order.
 */
export function lprMarkers(notes: readonly LprNoteOut[], metric: LprMetric, firstFy: number, lastFy: number, lastIsPreliminary: boolean): LprMarker[] {
  const byId = new Map(notes.map((n) => [n.id, n]));
  const defs: { id: string; at: number; show: boolean }[] = [
    { id: "fy2008-special-immigrants", at: 2008, show: metric === "lpr" },
    { id: metric === "lpr" ? "covid-19-lpr" : "covid-19-naturalizations", at: metric === "lpr" ? 2020.5 : 2020, show: true },
    { id: "fy2025-preliminary", at: lastFy, show: lastIsPreliminary },
  ];
  return defs
    .filter((d) => d.show && byId.has(d.id) && d.at >= firstFy && d.at <= lastFy)
    .map((d, i) => ({ n: i + 1, at: d.at, title: byId.get(d.id)!.title, text: byId.get(d.id)!.text }));
}

export interface LprBins {
  /** Upper bounds of every bin but the last, ascending. */
  thresholds: number[];
  labels: string[];
  /** Percent of the accent colour for each bin. */
  mix: number[];
}

/** Fixed absolute bins per measure so the years compare while the year menu moves. */
export const LPR_BINS: Record<LprMetric, LprBins> = {
  lpr: { thresholds: [1_000, 10_000, 50_000, 100_000], labels: ["1–999", "1,000–9,999", "10,000–49,999", "50,000–99,999", "100,000+"], mix: [22, 40, 62, 80, 100] },
  naturalizations: { thresholds: [500, 5_000, 25_000, 50_000], labels: ["1–499", "500–4,999", "5,000–24,999", "25,000–49,999", "50,000+"], mix: [22, 40, 62, 80, 100] },
};

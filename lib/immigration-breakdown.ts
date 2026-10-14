import { CRIMINALITY_SCHEMES, isNationalRemovals, type Criminality, type EnforcementRow } from "./enforcement-entities";

/**
 * Pure shaping for the criminal-history card on /presidency/immigration: ICE removals by criminal history, for everyone
 * ICE removed or only those first apprehended by ICE or by Border Patrol (CBP). No I/O; tested over the real files.
 *
 * Criminal history is as recorded in ICE systems at the time of the enforcement action. Categories changed over time and
 * are never mixed within a year: convicted / not convicted (FY2013–FY2015), convicted / pending charges / no known
 * record (FY2016 on), and a combined convicted-or-pending figure alone (FY2025).
 */

export type AgencyView = "all" | "ice" | "cbp";
export type Measure = "counts" | "share";

/** Stack order, bottom to top. */
export const CRIM_ORDER: readonly Criminality[] = ["convicted", "pending_charges", "other_immigration_violator", "not_convicted", "convicted_or_pending"];

export interface CrimPart {
  key: Criminality;
  value: number;
}

export interface CrimBar {
  fy: number;
  parts: CrimPart[];
  /** Sum of the parts. */
  total: number;
  /** What a share is a share of: the year's national removals for "all" (so FY2025's combined figure is a share of all removals), else the bar's own total. */
  denominator: number;
  status: "final" | "preliminary";
  /** Border Patrol bars are the national figure minus ICE's own arrests: ICE prints no Border Patrol criminality split. */
  derived: boolean;
}

const order = (parts: CrimPart[]) => parts.sort((a, b) => CRIM_ORDER.indexOf(a.key) - CRIM_ORDER.indexOf(b.key));

/**
 * One bar per fiscal year ICE gives a criminal-history split for, in the chosen view. "all" runs FY2013–FY2025; "ice"
 * and "cbp" FY2017–FY2024 (the years ICE prints interior removals by criminality). Years absent from a view are absent,
 * never zero.
 */
export function criminalityBars(rows: readonly EnforcementRow[], view: AgencyView): CrimBar[] {
  const national = new Map(rows.filter(isNationalRemovals).map((r) => [r.period, r]));
  const slice = (agency: "ice" | null) => {
    const byYear = new Map<number, CrimPart[]>();
    for (const r of rows) {
      if (r.metric !== "removals" || r.arresting_agency !== agency || r.criminality === null) continue;
      (byYear.get(r.period) ?? byYear.set(r.period, []).get(r.period)!).push({ key: r.criminality, value: r.value });
    }
    return byYear;
  };
  const everyone = slice(null);
  const interior = slice("ice");
  const threeWay = (parts: CrimPart[] | undefined) => !!parts && CRIMINALITY_SCHEMES.three_way.every((k) => parts.some((p) => p.key === k)) && parts.length === 3;
  const bar = (fy: number, parts: CrimPart[], denominator: number | null, derived = false): CrimBar => {
    const total = parts.reduce((s, p) => s + p.value, 0);
    return { fy, parts: order([...parts]), total, denominator: denominator ?? total, status: national.get(fy)!.status, derived };
  };
  const years = [...(view === "all" ? everyone : interior).keys()].sort((a, b) => a - b);
  const out: CrimBar[] = [];
  for (const fy of years) {
    if (view === "all") out.push(bar(fy, everyone.get(fy)!, national.get(fy)!.value));
    else if (view === "ice") out.push(bar(fy, interior.get(fy)!, null));
    else {
      const all = everyone.get(fy);
      const ice = interior.get(fy)!;
      if (!threeWay(all) || !threeWay(ice)) continue;
      out.push(bar(fy, ice.map((p) => ({ key: p.key, value: all!.find((a) => a.key === p.key)!.value - p.value })), null, true));
    }
  }
  return out;
}

/** The share of a bar with a conviction or pending charges (FY2025's combined figure counts as is), as 0–1. */
export function convictedOrPendingShare(b: CrimBar): number {
  const v = b.parts.filter((p) => p.key === "convicted" || p.key === "pending_charges" || p.key === "convicted_or_pending").reduce((s, p) => s + p.value, 0);
  return v / b.denominator;
}

/** The label of a convicted share: ICE's two-way years only know "convicted" (no pending category), so it is that share. */
export const convictedOnly = (b: CrimBar): boolean => b.parts.some((p) => p.key === "not_convicted");

/**
 * One fixed count ceiling for all three views, so heights compare when the view changes: the tallest "all" bar x 1.08,
 * up to the next 100,000. (ICE-only and Border Patrol-only bars are parts of the "all" bars.)
 */
export function criminalityYMax(rows: readonly EnforcementRow[]): number {
  const max = Math.max(...criminalityBars(rows, "all").map((b) => b.total));
  return Math.ceil((max * 1.08) / 100_000) * 100_000;
}

/** Years each view covers, for the chart's empty-slot labels. */
export function viewCoverage(rows: readonly EnforcementRow[], view: AgencyView): { first: number; last: number } {
  const fys = criminalityBars(rows, view).map((b) => b.fy);
  return { first: Math.min(...fys), last: Math.max(...fys) };
}

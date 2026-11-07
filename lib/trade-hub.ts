import { MONTH_NAMES } from "./indicator-time";
import { monthIndex, periodOf } from "./trade-derive";
import type { Monthly } from "./trade-types";

/**
 * Pure shaping for the homepage Presidency card: the national duty rate (calculated duties ÷ imports for
 * consumption, the trade page's Chart 2 series) trimmed to the months it exists, the presidential terms on the
 * same month axis, and the figures the card's stat prints. No I/O.
 */

export interface HubTerm {
  label: string;
  party: "D" | "R";
  startYear: number;
  /** The sitting president's term (no end year). */
  current: boolean;
  /** Month offsets into `rates`, `e` exclusive, clipped to the series. */
  s: number;
  e: number;
}

export interface HubTariff {
  /** First month with a rate, "YYYY-MM". */
  first: string;
  /** Percent per month from `first` to the last published month; null where a month is missing. */
  rates: (number | null)[];
  terms: HubTerm[];
  /** The newest month's rate: "August 2026". */
  latest: { label: string; rate: number };
  /** The full calendar year before the sitting president's term began, for "up from X% in YYYY". */
  baseline: { year: number; rate: number } | null;
  /** The highest monthly rate in the series; null when it is the newest month. */
  peak: { label: string; rate: number } | null;
}

/** A term on the shared axis, as `getEraLayers` gives it (days from 1991-01-01). */
export interface AxisTerm {
  label: string;
  party: "D" | "R";
  startYear: number;
  endYear: number | null;
  /** First and last axis month of the term (from the days via `monthIndexOfDay`). */
  m0: number;
  m1: number;
}

const round2 = (x: number) => Math.round(x * 100) / 100;

export function buildHubTariff(duties: Monthly, imports: Monthly, terms: readonly AxisTerm[]): HubTariff {
  const rateAt = (i: number) => {
    const d = duties[i];
    const v = imports[i];
    return d == null || v == null || v <= 0 ? null : (d / v) * 100;
  };
  let a = 0;
  while (a < duties.length && rateAt(a) === null) a++;
  let b = duties.length - 1;
  while (b >= a && rateAt(b) === null) b--;
  if (a > b) throw new Error("trade-hub: no month has a duty rate");

  const rates = Array.from({ length: b - a + 1 }, (_, k) => {
    const r = rateAt(a + k);
    return r === null ? null : round2(r);
  });
  const last = periodOf(b);
  const latest = { label: `${MONTH_NAMES[Number(last.slice(5)) - 1]} ${last.slice(0, 4)}`, rate: round2(rateAt(b)!) };

  const hubTerms = terms
    .map((t) => ({ label: t.label, party: t.party, startYear: t.startYear, current: t.endYear === null, s: Math.max(0, t.m0 - a), e: Math.min(rates.length, t.m1 - a + 1) }))
    .filter((t) => t.e > t.s);

  const sitting = terms.find((t) => t.endYear === null);
  let baseline: HubTariff["baseline"] = null;
  if (sitting) {
    const year = sitting.startYear - 1;
    const i0 = monthIndex(`${year}-01`);
    let d = 0;
    let v = 0;
    for (let i = i0; i < i0 + 12; i++) {
      if (duties[i] == null || imports[i] == null) {
        d = NaN;
        break;
      }
      d += duties[i]!;
      v += imports[i]!;
    }
    if (Number.isFinite(d) && v > 0) baseline = { year, rate: round2((d / v) * 100) };
  }

  let top = 0;
  rates.forEach((r, k) => {
    if (r !== null && r >= (rates[top] ?? -Infinity)) top = k;
  });
  const topPeriod = periodOf(a + top);
  const peak =
    top === rates.length - 1
      ? null
      : { label: `${MONTH_NAMES[Number(topPeriod.slice(5)) - 1]} ${topPeriod.slice(0, 4)}`, rate: rates[top]! };

  return { first: periodOf(a), rates, terms: hubTerms, latest, baseline, peak };
}

/** "6.9%": one decimal, the precision the card prints. */
export const fmtRate = (r: number) => `${r.toFixed(1)}%`;

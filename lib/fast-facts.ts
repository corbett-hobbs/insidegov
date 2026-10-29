/**
 * The homepage "Latest numbers" strip: six headline figures, each from a different page and each one the page itself
 * shows. Pure builders only (no I/O); `lib/fast-facts-data.ts` reads the datasets and feeds them in. Wording rules:
 * a figure is never printed without the date it describes, and a year still in progress says so.
 */
import { MONTH_ABBR } from "./indicator-time";

export interface FastFact {
  /** Small caps label above the number: "Gas". */
  label: string;
  /** The big number: "$4.28". */
  figure: string;
  /** One line of context under it. */
  caption: string;
  /** The page it opens, and the link text. */
  href: string;
  linkText: string;
  /** What the figure describes, in a few words: "week of Oct 19". */
  asOf: string;
}

const dayLabel = (iso: string) => {
  const [, m, d] = iso.split("-").map(Number);
  return `${MONTH_ABBR[m - 1]} ${d}`;
};

/** The observation about a year before the newest one (within a week either side), or null when the series is shorter. */
export function yearEarlier<T extends { date: string }>(points: readonly T[]): T | null {
  const last = points[points.length - 1];
  if (!last) return null;
  const target = Date.parse(`${last.date}T00:00:00Z`) - 365 * 864e5;
  let best: T | null = null;
  let gap = Infinity;
  for (const p of points) {
    const g = Math.abs(Date.parse(`${p.date}T00:00:00Z`) - target);
    if (g < gap) {
      best = p;
      gap = g;
    }
  }
  return best && gap <= 7 * 864e5 ? best : null;
}

const dir = (now: number, then: number) => (now > then ? "up from" : now < then ? "down from" : "the same as");

export function gasFact(points: readonly { date: string; value: number }[]): FastFact {
  const last = points[points.length - 1];
  const prev = yearEarlier(points);
  const usd = (v: number) => `$${v.toFixed(2)}`;
  return {
    label: "Gas",
    figure: usd(last.value),
    caption: `a gallon of regular${prev ? `, ${dir(last.value, prev.value)} ${usd(prev.value)} a year ago` : ""}`,
    href: "/presidency/economy",
    linkText: "Economy",
    asOf: `week of ${dayLabel(last.date)}`,
  };
}

/** `rates` is percent per month, newest last (`HubTariff.rates`); `label` is the newest month, "August 2026". */
export function tariffFact(rates: readonly (number | null)[], label: string): FastFact {
  const now = rates[rates.length - 1];
  if (now == null) throw new Error("tariff series ends on a missing month");
  const prev = rates.length > 12 ? rates[rates.length - 13] : null;
  const pct = (v: number) => `${v.toFixed(1)}%`;
  const [month, year] = label.split(" ");
  return {
    label: "Tariffs",
    figure: pct(now),
    caption: `average tariff on imports${prev != null ? `, ${dir(now, prev)} ${pct(prev)} a year earlier` : ""}`,
    href: "/presidency/trade",
    linkText: "Trade",
    asOf: `${month.slice(0, 3)} ${year}`,
  };
}

/** Weekly Strategic Petroleum Reserve stocks in thousand barrels, oldest first. */
export function sprFact(points: readonly { date: string; value: number }[]): FastFact {
  const last = points[points.length - 1];
  const prev = yearEarlier(points);
  const mb = (v: number) => `${Math.round(v / 1000)}M`;
  return {
    label: "Oil reserve",
    figure: mb(last.value),
    caption: `barrels in the Strategic Petroleum Reserve${prev ? `, ${dir(last.value, prev.value)} ${mb(prev.value)} a year ago` : ""}`,
    href: "/presidency/energy",
    linkText: "Energy",
    asOf: `week of ${dayLabel(last.date)}`,
  };
}

/** Laws enacted so far in the Congress in progress, through the data's last date. */
export function lawsFact(lawsThisCongress: number, dataThrough: string): FastFact {
  return {
    label: "Laws",
    figure: lawsThisCongress.toLocaleString("en-US"),
    caption: "laws enacted so far this Congress",
    href: "/congress/laws",
    linkText: "Laws",
    asOf: `through ${dayLabel(dataThrough)}`,
  };
}

/** Orders signed so far this calendar year against the whole of the year before, the chart's two newest bars. */
export function executiveOrdersFact(thisYear: number, year: number, lastYear: number, throughDate: string): FastFact {
  return {
    label: "Executive orders",
    figure: thisYear.toLocaleString("en-US"),
    caption: `signed so far in ${year}, after ${lastYear.toLocaleString("en-US")} in ${year - 1}`,
    href: "/presidency/executive-orders",
    linkText: "Executive orders",
    asOf: `through ${dayLabel(throughDate)}`,
  };
}

const compact = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n);

export interface EncounterYearInput {
  fy: number;
  months: number;
  preliminary: boolean;
  total: number;
}

/**
 * Nationwide border encounters in the newest fiscal year against the peak year, the same two bars the chart draws. A
 * year in progress is "since October" and carries "(preliminary)"; a finished one is plain. The peak is the biggest
 * full year, so a part-year is never its own peak.
 */
export function encountersFact(years: readonly EncounterYearInput[]): FastFact {
  const latest = years[years.length - 1];
  const peak = years.filter((y) => !y.preliminary).reduce((a, b) => (b.total > a.total ? b : a));
  const share = Math.round((latest.total / peak.total) * 100);
  const part = latest.preliminary;
  return {
    label: "Border",
    figure: compact(latest.total),
    caption: `border encounters ${part ? "since October (preliminary)" : `in FY${latest.fy}`}, ${share < 1 ? "under 1" : `about ${share}`}% of FY${peak.fy}’s ${compact(peak.total)} peak`,
    href: "/presidency/immigration",
    linkText: "Immigration",
    asOf: part ? `Oct to ${MONTH_ABBR[(9 + latest.months - 1) % 12]}` : `FY${latest.fy}`,
  };
}

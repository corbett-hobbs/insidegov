import { detectEventTermComparison, detectExtremes, detectSeries, eventMonthlySeries, truncate, truncateEvents } from "./detect";
import { addDays, addMonths } from "./format";
import type { Administration, EventSet, Insight, Series } from "./types";

/**
 * Which insights to look for, and which to keep. Pure: the CLI (run.ts) and the backfill (backfill.ts) load data and
 * decide the dates; this decides what a date produces.
 */

/** Monthly totals of an event set: laws cluster at session ends, so months compare with the same calendar month. */
const EVENT_MONTHLY: Record<string, { name: string; seasonal: boolean; words: Series["words"] }> = {
  executive_orders: { name: "executive orders signed", seasonal: false, words: { high: "most", low: "fewest", up: "rose", down: "fell" } },
  laws: { name: "public laws enacted", seasonal: true, words: { high: "most", low: "fewest", up: "rose", down: "fell" } },
};

/** The last day of the month before `date`'s month. */
export function lastFullMonthEnd(date: string): string {
  return addDays(`${date.slice(0, 7)}-01`, -1);
}

/**
 * Insights at each date: the series cut at that date, so each reads as "when this period was the newest".
 * Weekly series compare terms only on the first week of a month, so a weekly refresh does not repeat the same chart.
 */
export function seriesInsightsAt(series: Series, admins: Administration[], dates: string[]): Insight[] {
  return dates.flatMap((d) => {
    const cut = truncate(series, d);
    if (cut.points.at(-1)?.date !== d) return [];
    const prev = cut.points.at(-2);
    const firstOfMonth = !prev || prev.date.slice(0, 7) !== d.slice(0, 7);
    return detectSeries(cut, admins).filter((i) => i.kind !== "term_comparison" || series.frequency !== "weekly" || firstOfMonth);
  });
}

/**
 * Insights for an event set as of the end of each given month: the count by that day of the term against earlier terms,
 * and a new high for the month's total. Month ends keep the cadence monthly however often the data is refreshed.
 */
export function eventInsightsAt(set: EventSet, admins: Administration[], monthEnds: string[]): Insight[] {
  const monthly = EVENT_MONTHLY[set.id];
  return monthEnds.flatMap((end) => {
    const cut = truncateEvents(set, end);
    const out = detectEventTermComparison(cut, admins, end);
    if (monthly) {
      const series = eventMonthlySeries(cut, addDays(end, 1), { id: `${set.id}.monthly`, name: `the number of ${monthly.name}`, seasonal: monthly.seasonal, weight: set.weight, words: monthly.words });
      // A month with none is not news, and neither is the fewest: only new highs.
      out.push(...detectExtremes({ ...series, skip: ["move", "term"] }).filter((i) => i.kind === "extreme_high"));
    }
    return out;
  });
}

/** Dates in `series` after `after` (the previous data's newest date, or a cutoff). */
export function newDates(series: Series, after: string): string[] {
  return series.points.filter((p) => p.date > after).map((p) => p.date);
}

/** Month ends after `after` up to the last full month before `latest` (the newest event, or today). */
export function newMonthEnds(after: string, latest: string): string[] {
  const out: string[] = [];
  const last = lastFullMonthEnd(latest);
  for (let m = `${after.slice(0, 7)}-01`; addDays(addMonths(m, 1), -1) <= last; m = addMonths(m, 1)) {
    const end = addDays(addMonths(m, 1), -1);
    if (end > after) out.push(end);
  }
  return out;
}

export type SelectOptions = { max: number; perSeries: number; perDataset: number };

/**
 * The most notable insights, highest score first: one per series and kind (the newest term comparison, the best-scoring
 * of any other kind, so three straight weekly lows make one draft), at most `perSeries` per series and `perDataset` per
 * dataset.
 */
export function selectInsights(insights: Insight[], opts: SelectOptions): Insight[] {
  const best = new Map<string, Insight>();
  for (const i of insights) {
    const key = `${i.seriesId}|${i.kind}`;
    const cur = best.get(key);
    const better = !cur || (i.kind === "term_comparison" ? i.period > cur.period : i.score > cur.score || (i.score === cur.score && i.period > cur.period));
    if (better) best.set(key, i);
  }
  const pool = [...best.values()].sort((a, b) => b.score - a.score || b.period.localeCompare(a.period) || a.id.localeCompare(b.id));
  const perSeries = new Map<string, number>();
  const perDataset = new Map<string, number>();
  const out: Insight[] = [];
  for (const i of pool) {
    if (out.length >= opts.max) break;
    if ((perSeries.get(i.seriesId) ?? 0) >= opts.perSeries || (perDataset.get(i.dataset) ?? 0) >= opts.perDataset) continue;
    perSeries.set(i.seriesId, (perSeries.get(i.seriesId) ?? 0) + 1);
    perDataset.set(i.dataset, (perDataset.get(i.dataset) ?? 0) + 1);
    out.push(i);
  }
  return out;
}

import { detectEventTermComparison, detectExtremes, detectLatest, detectSeries, eventMonthlySeries, truncate, truncateEvents } from "./detect";
import { addDays, addMonths } from "./format";
import { estimateRelease } from "./freshness";
import type { Administration, EventSet, Insight, Series } from "./types";

/**
 * Which insights to look for, and which to keep. Pure: the CLI (run.ts) and the backfill (backfill.ts) load data and
 * decide the dates; this decides what a date produces.
 */

/** Monthly totals of an event set: laws cluster at session ends, so months compare with the same calendar month. */
const EVENT_MONTHLY: Record<string, { name: string; title: string; seasonal: boolean; words: Series["words"] }> = {
  executive_orders: { name: "executive orders signed", title: "Executive orders signed each month", seasonal: false, words: { high: "most", low: "fewest", up: "rose", down: "fell" } },
  laws: { name: "public laws enacted", title: "Laws passed", seasonal: true, words: { high: "most", low: "fewest", up: "rose", down: "fell" } },
};

/** The last day of the month before `date`'s month. */
export function lastFullMonthEnd(date: string): string {
  return addDays(`${date.slice(0, 7)}-01`, -1);
}

/** Term comparisons run quarterly (on March, June, September and December data), not with every refresh. */
export const TERM_MONTHS = ["03", "06", "09", "12"];

/**
 * Whether a term comparison is due at `date`: a quarter-end month for monthly data and month-end roundups, the first
 * week of a quarter-end month for weekly data. The comparison is the same chart month to month otherwise.
 */
export function termComparisonDue(frequency: Series["frequency"], date: string, prevDate: string | undefined): boolean {
  if (!TERM_MONTHS.includes(date.slice(5, 7))) return false;
  return frequency !== "weekly" || !prevDate || prevDate.slice(0, 7) !== date.slice(0, 7);
}

/**
 * The routine `latest` reading is a fallback: kept only when nothing else came out of the same series and period, so a
 * refresh always has something to post but a notable one is not posted twice.
 */
function withoutRedundantLatest(insights: Insight[]): Insight[] {
  const other = new Set(insights.filter((i) => i.kind !== "latest").map((i) => `${i.seriesId}|${i.period}`));
  return insights.filter((i) => i.kind !== "latest" || !other.has(`${i.seriesId}|${i.period}`));
}

/** Insights at each date: the series cut at that date, so each reads as "when this period was the newest". */
export function seriesInsightsAt(series: Series, admins: Administration[], dates: string[]): Insight[] {
  // A news-only series (types.ts Series.newsOnly) posts only when the news is about it: nothing from a data refresh.
  if (series.newsOnly) return [];
  return dates.flatMap((d) => {
    const cut = truncate(series, d);
    if (cut.points.at(-1)?.date !== d) return [];
    const due = termComparisonDue(series.frequency, d, cut.points.at(-2)?.date);
    return withoutRedundantLatest(detectSeries(cut, admins).filter((i) => i.kind !== "term_comparison" || due)).map((i) => (series.anchor ? { ...i, anchor: series.anchor } : i));
  });
}

/**
 * Insights for an event set as of the end of each given month: the month's total (a new high, or the routine reading),
 * and at quarter ends the count by that day of the term against earlier terms.
 */
export function eventInsightsAt(set: EventSet, admins: Administration[], monthEnds: string[]): Insight[] {
  const monthly = EVENT_MONTHLY[set.id];
  return monthEnds.flatMap((end) => {
    const cut = truncateEvents(set, end);
    const out = termComparisonDue("monthly", end, undefined) ? detectEventTermComparison(cut, admins, end) : [];
    if (monthly) {
      const series = eventMonthlySeries(cut, addDays(end, 1), {
        id: `${set.id}.monthly`,
        title: monthly.title,
        name: `the number of ${monthly.name}`,
        seasonal: monthly.seasonal,
        weight: set.weight,
        words: monthly.words,
        headline: true,
      });
      // A month with none is not news, and neither is the fewest: only new highs, else the routine reading.
      const notable = detectExtremes(series).filter((i) => i.kind === "extreme_high");
      out.push(...(notable.length || out.length ? notable : detectLatest(series)));
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

/**
 * An estimated release date for an insight, when the real one is unknown (the backfill, or drafting by date): the
 * period end plus the series' typical publication lag. (The output files' `as_of`/`fetched_at` fields are when the
 * site re-read a source, not when the source published, so they cannot stand in.) Event roundups (executive orders,
 * laws) count as released the day after the month ends.
 */
export function releaseEstimator(series: Series[]): (insight: Insight) => string {
  const lag = new Map(series.map((s) => [s.id, s.releaseLagDays] as const));
  return (i) => estimateRelease(i.frequency, i.period, lag.get(i.seriesId) ?? 1);
}

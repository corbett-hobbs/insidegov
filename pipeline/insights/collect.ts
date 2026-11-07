import { detectEventTermComparison, detectExtremes, detectLatest, detectSeries, eventMonthlySeries, truncate, truncateEvents } from "./detect";
import { addDays, addMonths } from "./format";
import { estimateRelease } from "./freshness";
import { superlativeTitle, termExtreme } from "./title";
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

/**
 * A whole and its parts, for one post per data update (`selectInsights`). When the whole has a notable reading of its own
 * (a high, a low, a big move, a term comparison, not the routine `latest` one), its parts never post on their own: the
 * update is one post, and a part's notable line chart (imports at their highest in 35 years) is **folded** into it. Which
 * of them leads is the most sensational: a high or a low leads (its caption, its chart, its cover slide, its "why" and
 * breakdown, with the superlative as its title), and the rest follow as one Instagram slide and one thread reply each. When
 * the whole has only its routine reading, its parts compete for the post on score like any other series. The key is the
 * whole's series id.
 */
export const FOLDS: Record<string, string[]> = {
  // Imports and exports are what the deficit is made of: the deficit is the more salient number, a part's superlative the more arresting.
  "trade.deficit": ["trade.imports", "trade.exports"],
};

/** The most readings of its parts one post folds in. */
export const MAX_FOLDED = 2;

/** Kinds that fold from a part: a line chart worth a slide of its own. A term comparison of a part is a bar chart the whole's own already covers. */
const FOLDABLE: Insight["kind"][] = ["extreme_high", "extreme_low", "move_up", "move_down"];

/** A reading with a superlative leads a post, and the superlative is its title: a high or a low, or a term comparison whose current term tops (or bottoms) every earlier one. */
const superlative = (i: Insight) => i.kind === "extreme_high" || i.kind === "extreme_low" || termExtreme(i) !== null;

/** The whole whose post folds in this series' readings, or undefined for a series that is not part of one. */
export function wholeOf(seriesId: string): string | undefined {
  return Object.keys(FOLDS).find((whole) => FOLDS[whole]!.includes(seriesId));
}

/** The facts of an insight folded into a post, ids prefixed with its series (`imports_latest_value`) so they never collide with the post's own. */
export function foldedFacts(folded: Insight): Insight["facts"] {
  const prefix = folded.seriesId.split(".").pop()!;
  return folded.facts.map((f) => ({ ...f, id: `${prefix}_${f.id}` }));
}

export type SelectOptions = { max: number };

/** The dataset a draft id (`<series>:<kind>:<date>`) belongs to: its series id up to the first "." (event sets have none). News ids start "news" and match no dataset. */
export function datasetOfId(id: string): string {
  return id.split(/[.:]/)[0]!;
}

/**
 * Whether a data update already has its post, for the daily catch-up (`drafted`: the ids of every draft issue ever
 * opened). A draft of any series and kind in the same dataset, for this period or a newer one, covers every insight
 * of the update, so a late run never opens a second post for a release. The one exception is the routine reading: a
 * draft of it does not cover a notable one for the same update, which replaces it (open-issues.ts retireLatest).
 */
export function coveredByDraft(insight: Pick<Insight, "dataset" | "kind" | "period">, drafted: Iterable<string>): boolean {
  for (const id of drafted) {
    const [, kind] = id.split(":");
    const date = id.slice(id.lastIndexOf(":") + 1);
    if (datasetOfId(id) === insight.dataset && date >= insight.period && (kind !== "latest" || insight.kind === "latest")) return true;
  }
  return false;
}

/**
 * The posts for a data refresh: **one per dataset**, never more. A refresh that gives several notable readings (imports
 * at a high, the deficit against earlier terms, imports against earlier terms) is one update and gets one post.
 *
 * Within a dataset, only the newest period counts (an older month is stale beside it). Per series and kind the newest
 * term comparison and the best-scoring of any other kind are kept (three straight weekly lows make one candidate).
 * The post starts from the highest-scoring candidate that is not a part of a whole with a notable reading (`FOLDS`); that
 * whole's parts' notable line charts fold into it (at most `MAX_FOLDED`, best first). If the post itself has no
 * superlative (a high, a low, a term comparison it tops) and a folded reading does, the folded one **leads** and the post follows it, so the sensational finding is
 * the one that opens the post on every platform. The lead carries the rest in `Insight.folded` and, when it has one, its superlative as the title (`superlativeTitle`). Datasets are ranked by their post's score and cut to `max`.
 */
export function selectInsights(insights: Insight[], opts: SelectOptions): Insight[] {
  const best = new Map<string, Insight>();
  for (const i of insights) {
    const key = `${i.seriesId}|${i.kind}`;
    const cur = best.get(key);
    const better = !cur || (i.kind === "term_comparison" ? i.period > cur.period : i.score > cur.score || (i.score === cur.score && i.period > cur.period));
    if (better) best.set(key, i);
  }
  const byDataset = new Map<string, Insight[]>();
  for (const i of best.values()) byDataset.set(i.dataset, [...(byDataset.get(i.dataset) ?? []), i]);
  const rank = (a: Insight, b: Insight) => b.score - a.score || b.period.localeCompare(a.period) || a.id.localeCompare(b.id);
  const posts: Insight[] = [];
  for (const all of byDataset.values()) {
    const newest = all.reduce((m, i) => (i.period > m ? i.period : m), "");
    const update = all.filter((i) => i.period === newest).sort(rank);
    const wholes = new Set(update.filter((i) => i.kind !== "latest").map((i) => i.seriesId));
    const isPart = (i: Insight) => {
      const whole = wholeOf(i.seriesId);
      return whole !== undefined && wholes.has(whole);
    };
    const anchor = update.find((i) => !isPart(i));
    if (!anchor) continue;
    const parts = update.filter((i) => wholeOf(i.seriesId) === anchor.seriesId && FOLDABLE.includes(i.kind) && i.chart.type === "line").slice(0, MAX_FOLDED);
    const lead = superlative(anchor) ? undefined : parts.find(superlative);
    const post = lead ?? anchor;
    const followers = lead ? [anchor, ...parts.filter((p) => p !== lead)] : parts;
    const titled = (i: Insight): Insight => (superlative(i) ? { ...i, title: superlativeTitle(i) ?? i.title } : i);
    const out = titled(post);
    posts.push(followers.length ? { ...out, folded: followers.map(titled) } : out);
  }
  return posts.sort(rank).slice(0, opts.max);
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

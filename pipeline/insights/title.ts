import { fmtDate, monthName } from "./format";
import type { ChartSpec, Frequency } from "./types";

/**
 * The one place a chart's title is made, and the rules every title and axis label must follow (a standing convention,
 * enforced in code: buildDrafts drops a draft that breaks them, and title.test.ts runs every generator on the real data).
 *
 * A title is what a reader would call the chart: "Inflation, 2016 to 2026", "Jobs added each month, 2021 to 2026", "The
 * federal deficit by fiscal year". Method and fine print are DATA NOTES: they go in `note` (Series.note), printed beside
 * the source at the bottom left ("Source: Bureau of Labor Statistics, via FRED · Nonfarm payrolls, seasonally
 * adjusted"). Never in the title, and never in the axis label, which is the unit and nothing else.
 *
 * Every renderer draws `Insight.title`, never `headline` (the issue's and index's descriptive line, which may be long and
 * state the finding), so a new chart type cannot skip the rule by building its own text.
 */

/** Words that are method, not subject: they belong in the data note. */
const METHOD = /\b(seasonally|not seasonally|non-?farm|adjusted|inflation-adjusted|nominal|deflated|real|index|year[- ]over[- ]year|annualized|percent change|per capita|CPI|BLS|FRED|SA|NSA)\b/i;
/** Phrases that restate a comparison base in the title: the chart's own marks and axis say it. */
const COMPARISON = /\b(from|against|than) (a|the same \w+) (year|month|quarter|week) (earlier|ago)\b|\bshown as\b|\bwith an?\b/i;

export const TITLE_MAX_CHARS = 80;

/** Why a chart title breaks the rule (none: it follows it). */
export function titleProblems(title: string): string[] {
  const errors: string[] = [];
  const method = title.match(METHOD);
  if (method) errors.push(`names method ("${method[0]}"): put it in the data note beside the source`);
  const comparison = title.match(COMPARISON);
  if (comparison) errors.push(`explains the measure ("${comparison[0]}"): put it in the data note`);
  if (/[():;]/.test(title)) errors.push("has a parenthesis, colon or semicolon: a title is plain words, notes go beside the source");
  if (title.length > TITLE_MAX_CHARS) errors.push(`${title.length} characters; the limit is ${TITLE_MAX_CHARS}`);
  if (title.trim().length < 4) errors.push("too short");
  // One date range at most: "2016 to 2026".
  if ((title.match(/\b(19|20)\d{2}\b/g) ?? []).length > 2) errors.push("more than one date range");
  return errors;
}

/** Method words an axis label may not carry (it is the unit: "percent change" and "percent from a year earlier" are units). */
const AXIS_METHOD = /\b(seasonally|not seasonally|non-?farm|adjusted|inflation-adjusted|nominal|deflated|CPI|BLS|FRED)\b/i;

/** The axis label is the unit ("dollars, billions"), not method: those words are data notes too. */
export function axisProblems(label: string): string[] {
  const method = label.match(AXIS_METHOD);
  return method ? [`names method ("${method[0]}"): the axis label is the unit; put it in the data note`] : [];
}

/**
 * The drawn title for a chart: the subject in plain words, then what the chart spans. A line gets its range ("Inflation,
 * 2016 to 2026"), a bar chart what each bar is ("The federal deficit by fiscal year", "Electricity generation each
 * August"). The term comparisons name their own.
 */
export function chartTitle(subject: string, chart: ChartSpec, opts: { frequency: Frequency; seasonal: boolean; latest: string }): string {
  if (chart.type === "line") return `${subject}, ${fmtDate(chart.points[0]!.date, "year")} to ${fmtDate(opts.latest, "year")}`;
  if (opts.seasonal) return `${subject} each ${monthName(opts.latest)}`;
  if (opts.frequency === "fiscal_year") return `${subject} by fiscal year`;
  if (opts.frequency === "annual") return `${subject} by year`;
  return subject;
}

/** The term comparison's title: the same point in every presidential term. */
export function termTitle(subject: string): string {
  return `${subject} at the same point in each presidential term`;
}

/** Whether the current term's bar is above (or below) every earlier term's in a term comparison (at least three terms), so the comparison has a superlative. */
export function termExtreme(insight: { kind: string; chart: ChartSpec }): "highest" | "lowest" | null {
  if (insight.kind !== "term_comparison" || insight.chart.type !== "bars") return null;
  const bars = insight.chart.bars;
  const now = bars.filter((b) => b.emphasis);
  if (bars.length < 3 || now.length !== 1) return null;
  const others = bars.filter((b) => !b.emphasis).map((b) => b.value);
  return now[0]!.value > Math.max(...others) ? "highest" : now[0]!.value < Math.min(...others) ? "lowest" : null;
}

/**
 * The title of a post's lead when it has a superlative: the finding itself, not a description of the chart. A high or a low
 * reads "U.S. goods imports are the highest in data going back to January 1991" (built from its headline's subject and
 * tail); a term comparison whose current term tops (or bottoms) every earlier one reads "The U.S. goods trade deficit is the
 * highest of 6 terms at the same point". Held to the title rule above; null for any other reading, or a sentence that fails
 * the rule, which then keeps its plain title.
 */
export function superlativeTitle(insight: { kind: string; headline: string; chart: ChartSpec }): string | null {
  const plural = (subject: string) => (/[^s]s$/i.test(subject) ? "are" : "is");
  let title: string | null = null;
  const term = termExtreme(insight);
  if (term && insight.chart.type === "bars") {
    const m = insight.headline.match(/^(.+?) at the same point in each presidential term$/);
    if (m) title = `${m[1]} ${plural(m[1]!)} the ${term} of ${insight.chart.bars.length} terms at the same point`;
  } else if (insight.kind === "extreme_high" || insight.kind === "extreme_low") {
    const m = insight.headline.match(/^(.+?): (the (?:highest|lowest|largest|smallest|most|fewest) .+)$/);
    if (m) title = `${m[1]} ${plural(m[1]!)} ${m[2]}`;
  }
  return title && !titleProblems(title).length ? title : null;
}

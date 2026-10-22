import {
  addDays,
  addMonths,
  daysBetween,
  dateStyleFor,
  fmtDate,
  fmtInt,
  fmtPct,
  fmtUnit,
  fmtUnitAbs,
  monthName,
  monthsBetween,
  pctDecimals,
  shortMonth,
  yearsBetween,
} from "./format";
import type { Administration, CellRef, ChartSpec, DateStyle, EventSet, Fact, Insight, Point, Series, UnitFormat } from "./types";

/**
 * Pure insight detectors. Each looks only at the NEWEST observation of a series (truncate the series first to ask
 * "what was notable when this month landed"), so a detector run after a data refresh reports what the refresh added.
 *
 *   detectExtremes   new high or low: the latest value is the highest/lowest in at least MIN_YEARS (or ever)
 *   detectMoves      biggest move: the latest one-period change is the largest in that direction in MIN_YEARS (or ever)
 *   detectTermComparison / detectEventTermComparison
 *                    same point in term: the current term against every earlier term at the same elapsed time
 *
 * Thresholds are deliberately conservative: a draft goes to a human, but a feed of "highest in 14 months" is noise.
 */

/** A new high/low or a biggest move must be the first in at least this many years. */
export const MIN_YEARS = 3;
/** A "record" (no earlier value as extreme) needs at least this much history to mean anything. */
export const MIN_RECORD_YEARS = 5;
/** Moves smaller than this percent are never news, whatever their rank. */
export const MIN_MOVE_PCT = 1;
/** Term comparisons need the current term and at least two earlier ones (never a two-way, us-versus-them chart). */
export const MIN_TERMS = 3;
/** And at least this far into the current term. */
export const MIN_TERM_DAYS = 45;

const sameMonth = (a: string, b: string) => a.slice(5, 7) === b.slice(5, 7);

export function unitFact(id: string, value: number, unit: UnitFormat, cells: CellRef[]): Fact {
  return { id, text: fmtUnit(value, unit), value, format: { kind: "unit", unit }, derivation: { op: "value", cells } };
}

export function dateFact(id: string, date: string, style: DateStyle): Fact {
  return { id, text: fmtDate(date, style), value: date, format: { kind: "date", style }, derivation: { op: "date", date, style } };
}

export function pctFact(id: string, from: Point, to: Point): Fact {
  const value = ((to.value - from.value) / Math.abs(from.value)) * 100;
  const decimals = pctDecimals(value);
  return { id, text: fmtPct(value, decimals), value, format: { kind: "pct", decimals }, derivation: { op: "pct_change", from: from.cells, to: to.cells } };
}

export function changeFact(id: string, from: Point, to: Point, unit: UnitFormat): Fact {
  const value = to.value - from.value;
  return { id, text: fmtUnitAbs(value, unit), value, format: { kind: "unit_abs", unit }, derivation: { op: "change", from: from.cells, to: to.cells } };
}

function intFact(id: string, value: number, derivation: Fact["derivation"]): Fact {
  return { id, text: fmtInt(value), value, format: { kind: "int" }, derivation };
}

/** "in August 2026", "in the week of October 12, 2026", "in fiscal 2025". */
export function when(series: Series, dateText: string): string {
  return series.frequency === "weekly" ? `in the week of ${dateText}` : `in ${dateText}`;
}

/** Chart label date: "Jun 2026", or "Jun 19, 2026" for weekly data. */
export function markDate(series: Series, date: string): string {
  return series.frequency === "weekly" ? `${shortMonth(date).slice(0, 3)} ${Number(date.slice(8, 10))}, ${date.slice(0, 4)}` : shortMonth(date);
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function words(series: Series) {
  return series.words ?? { high: "highest", low: "lowest", up: "rose", down: "fell" };
}

export function linePoints(series: Series, from: string, to: string) {
  return series.points.filter((p) => p.date >= from && p.date <= to).map((p) => ({ date: p.date, value: p.value }));
}

/** A line chart window that shows the comparison point and at least a few years of context. */
function lineWindow(series: Series, latest: Point, comparison: string | null, minYears: number): string {
  const first = series.points[0]!.date;
  const minStart = addMonths(latest.date, -12 * minYears);
  const start = comparison ? (addMonths(comparison, -12) < minStart ? addMonths(comparison, -12) : minStart) : first;
  const capped = addMonths(latest.date, -12 * 30);
  const s = start < capped ? capped : start;
  return s < first ? first : s;
}

/** Same-calendar-month bars (seasonal) or one bar per fiscal year, ending at the latest point. */
export function periodBars(series: Series, latest: Point, from: string, style: DateStyle): ChartSpec {
  const pts = series.points.filter((p) => p.date >= from && p.date <= latest.date && (!series.seasonal || sameMonth(p.date, latest.date)));
  return {
    type: "bars",
    unit: series.unit,
    axisLabel: series.axisLabel,
    orientation: "vertical",
    bars: pts.slice(-16).map((p) => ({ label: style === "fiscal_year" ? `FY${p.date.slice(2, 4)}` : p.date.slice(0, 4), value: p.value, emphasis: p.date === latest.date })),
  };
}

export function usesBars(series: Series): boolean {
  return series.seasonal || series.frequency === "fiscal_year";
}

/** New high or low at the latest observation. */
export function detectExtremes(series: Series): Insight[] {
  if (series.skip?.includes("extreme")) return [];
  const pts = series.points;
  const latest = pts.at(-1);
  if (!latest || pts.length < 3) return [];
  const pool = pts.slice(0, -1).filter((p) => !series.seasonal || sameMonth(p.date, latest.date));
  if (pool.length === 0) return [];
  const style = dateStyleFor(series.frequency);
  const out: Insight[] = [];
  for (const dir of ["high", "low"] as const) {
    const beats = (p: Point) => (dir === "high" ? p.value >= latest.value : p.value <= latest.value);
    const prior = pool.findLast(beats) ?? null;
    const years = yearsBetween((prior ?? pool[0]!).date, latest.date);
    if (prior ? years < MIN_YEARS : years < MIN_RECORD_YEARS) continue;

    const w = words(series)[dir];
    const latestFact = unitFact("latest_value", latest.value, series.unit, latest.cells);
    const latestDate = dateFact("latest_date", latest.date, style);
    const facts: Fact[] = [latestFact, latestDate];
    const forMonth = series.seasonal ? ` for any ${monthName(latest.date)}` : "";
    let tail: string;
    if (prior) {
      const priorValue = unitFact("prior_value", prior.value, series.unit, prior.cells);
      const priorDate = dateFact("prior_date", prior.date, style);
      facts.push(priorValue, priorDate);
      tail = `the ${w}${forMonth} since ${priorDate.text} (${priorValue.text})`;
    } else {
      const first = dateFact("series_start", pool[0]!.date, style);
      facts.push(first);
      tail = `the ${w}${forMonth} in data going back to ${first.text}`;
    }
    const headline = `${capitalize(series.name)}: ${tail.replace(/ \(.*\)$/, "")}`;
    const template = `${capitalize(series.name)}: ${latestFact.text} ${when(series, latestDate.text)}, ${tail}.`;
    const chart: ChartSpec = usesBars(series)
      ? periodBars(series, latest, prior ? addMonths(prior.date, -24) : pool[0]!.date, style)
      : {
          type: "line",
          unit: series.unit,
          axisLabel: series.axisLabel,
          frequency: series.frequency,
          points: linePoints(series, lineWindow(series, latest, prior?.date ?? null, 5), latest.date),
          marks: [
            { date: latest.date, label: `${markDate(series, latest.date)}: ${latestFact.text}`, emphasis: true },
            ...(prior ? [{ date: prior.date, label: `${markDate(series, prior.date)}: ${fmtUnit(prior.value, series.unit)}`, emphasis: false }] : []),
          ],
        };
    out.push({
      id: `${series.id}:extreme_${dir}:${latest.date}`,
      dataset: series.dataset,
      seriesId: series.id,
      kind: dir === "high" ? "extreme_high" : "extreme_low",
      period: latest.date,
      frequency: series.frequency,
      headline,
      template,
      facts,
      context: series.context ?? [],
      chart,
      url: series.url,
      source: series.source,
      score: (Math.min(years, 30) + (prior ? 0 : 5)) * series.weight * (!prior && isStreak(pool, dir) ? 0.3 : 1),
      alt: `${usesBars(series) ? "Bar" : "Line"} chart of ${series.name} (${series.axisLabel}) ending ${latestDate.text}, when it was ${latestFact.text}: ${tail}.`,
    });
  }
  return out;
}

/** The previous comparable value was itself a new high/low: records are routine for this series (solar, LNG). */
function isStreak(pool: Point[], dir: "high" | "low"): boolean {
  const prev = pool.at(-1)!;
  return pool.slice(0, -1).every((p) => (dir === "high" ? p.value < prev.value : p.value > prev.value));
}

type Change = { from: Point; to: Point; delta: number };

/** One-period changes (year over year for seasonal series), as a percent or an absolute change. */
export function changes(series: Series): Change[] {
  const out: Change[] = [];
  const byDate = new Map(series.points.map((p) => [p.date, p] as const));
  series.points.forEach((to, i) => {
    const from = series.seasonal ? byDate.get(addMonths(to.date, -12)) : series.points[i - 1];
    if (!from) return;
    if (series.moveMode === "pct") {
      if (from.value <= 0) return;
      out.push({ from, to, delta: ((to.value - from.value) / from.value) * 100 });
    } else out.push({ from, to, delta: to.value - from.value });
  });
  return out;
}

const PERIOD_WORD = { weekly: "one-week", monthly: "one-month", fiscal_year: "one-year" } as const;

/** The latest change is the largest in its direction in MIN_YEARS (or ever). */
export function detectMoves(series: Series): Insight[] {
  if (series.skip?.includes("move")) return [];
  const all = changes(series);
  const last = all.at(-1);
  if (!last || last.to !== series.points.at(-1) || last.delta === 0) return [];
  if (series.moveMode === "pct" && Math.abs(last.delta) < MIN_MOVE_PCT) return [];
  const up = last.delta > 0;
  const pool = all.slice(0, -1);
  if (pool.length === 0) return [];
  const prior = pool.findLast((c) => (up ? c.delta >= last.delta : c.delta <= last.delta)) ?? null;
  const years = yearsBetween((prior ?? pool[0]!).to.date, last.to.date);
  if (prior ? years < MIN_YEARS : years < MIN_RECORD_YEARS) return [];

  const style = dateStyleFor(series.frequency);
  const w = words(series);
  const latestFact = unitFact("latest_value", last.to.value, series.unit, last.to.cells);
  const latestDate = dateFact("latest_date", last.to.date, style);
  const prevFact = unitFact("previous_value", last.from.value, series.unit, last.from.cells);
  const prevDate = dateFact("previous_date", last.from.date, style);
  const change = series.moveMode === "pct" ? pctFact("change", last.from, last.to) : changeFact("change", last.from, last.to, series.unit);
  const facts: Fact[] = [latestFact, latestDate, prevFact, prevDate, change];
  const kindWord = series.seasonal ? "year-over-year" : PERIOD_WORD[series.frequency];
  const dirWord = up ? "increase" : "decrease";
  let tail: string;
  if (prior) {
    const priorDate = dateFact("prior_move_date", prior.to.date, style);
    const priorChange = series.moveMode === "pct" ? pctFact("prior_move_change", prior.from, prior.to) : changeFact("prior_move_change", prior.from, prior.to, series.unit);
    facts.push(priorDate, priorChange);
    tail = `the largest ${kindWord} ${dirWord} since ${priorDate.text} (${priorChange.text})`;
  } else {
    const first = dateFact("series_start", series.points[0]!.date, style);
    facts.push(first);
    tail = `the largest ${kindWord} ${dirWord} in data going back to ${first.text}`;
  }
  const verb = up ? w.up : w.down;
  const headline = `${capitalize(series.name)}: ${tail.replace(/ \(.*\)$/, "")}`;
  const template = `${capitalize(series.name)} ${verb} ${change.text} from ${prevFact.text} ${when(series, prevDate.text)} to ${latestFact.text} ${when(series, latestDate.text)}, ${tail}.`;
  const chart: ChartSpec = usesBars(series)
    ? periodBars(series, last.to, addMonths(last.to.date, -12 * 12), style)
    : {
        type: "line",
        unit: series.unit,
        axisLabel: series.axisLabel,
        frequency: series.frequency,
        // A move is about the last step, so a short window where that step is wide enough to see.
        points: linePoints(series, addMonths(last.to.date, series.frequency === "weekly" ? -12 : -36), last.to.date),
        marks: [
          { date: last.to.date, label: `${markDate(series, last.to.date)}: ${latestFact.text}`, emphasis: true },
          { date: last.from.date, label: `${markDate(series, last.from.date)}: ${prevFact.text}`, emphasis: false },
        ],
      };
  return [
    {
      id: `${series.id}:move_${up ? "up" : "down"}:${last.to.date}`,
      dataset: series.dataset,
      seriesId: series.id,
      kind: up ? "move_up" : "move_down",
      period: last.to.date,
      frequency: series.frequency,
      headline,
      template,
      facts,
      context: series.context ?? [],
      chart,
      url: series.url,
      source: series.source,
      score: (Math.min(years, 30) + (prior ? 0 : 5)) * series.weight * 0.8,
      alt: `${usesBars(series) ? "Bar" : "Line"} chart of ${series.name} (${series.axisLabel}). It ${verb} ${change.text} to ${latestFact.text} ${when(series, latestDate.text)}, ${tail}.`,
    },
  ];
}

/** "Trump 2025": a president's last name and the year the tenure began (Trump served two). */
export function termLabel(a: Administration): string {
  return `${a.president.split(" ").at(-1)} ${a.start.slice(0, 4)}`;
}

/** How many terms a comparison shows, counted from the administrations file (a caption may say "of the 6 terms"). */
function termsShownFact(rows: TermValue[]): Fact {
  return intFact("terms_shown", rows.length, {
    op: "value",
    cells: rows.map((r) => ({ file: "pipeline/output/administrations.json", key: { term_id: r.term.term_id }, field: "__row" })),
  });
}

/** The year a term began, so a caption may name "the 2017 term". */
function termYearFact(a: Administration): Fact {
  return { ...dateFact(`term_start_${a.term_id}`, a.start, "year"), president: a.president.split(" ").at(-1) };
}

function lastOnOrBefore(points: Point[], date: string): Point | undefined {
  return points.findLast((p) => p.date <= date);
}

type TermValue = { term: Administration; value: number; fact: Fact; extra?: Fact[] };

function rankPhrase(rows: TermValue[], current: TermValue, more: string, less: string): string {
  const max = Math.max(...rows.map((r) => r.value));
  const min = Math.min(...rows.map((r) => r.value));
  const n = rows.length;
  if (current.value === max && rows.filter((r) => r.value === max).length === 1) return `, the ${more} of the ${n} terms shown`;
  if (current.value === min && rows.filter((r) => r.value === min).length === 1) return `, the ${less} of the ${n} terms shown`;
  return "";
}

/** Rank wording for percent changes, which can have either sign. */
function levelRankPhrase(rows: TermValue[], current: TermValue): string {
  const n = rows.length;
  const unique = (v: number) => rows.filter((r) => r.value === v).length === 1;
  const max = Math.max(...rows.map((r) => r.value));
  const min = Math.min(...rows.map((r) => r.value));
  const v = current.value;
  if (v === max && unique(v)) return `, the ${v > 0 ? "largest increase" : "smallest decrease"} of the ${n} terms shown`;
  if (v === min && unique(v)) return `, the ${v < 0 ? "largest decrease" : "smallest increase"} of the ${n} terms shown`;
  return "";
}

function termBars(rows: TermValue[], current: Administration, unit: UnitFormat | null, axisLabel: string): ChartSpec {
  return {
    type: "bars",
    unit,
    axisLabel,
    orientation: "horizontal",
    bars: rows.map((r) => ({ label: termLabel(r.term), value: r.value, emphasis: r.term.term_id === current.term_id })),
  };
}

/**
 * Same point in term for a series: a flow is summed over the first K full months of each term (K = full months of the
 * current term so far); a level is compared from the start of each term to the same number of days in.
 */
export function detectTermComparison(series: Series, admins: Administration[]): Insight[] {
  if (series.skip?.includes("term") || series.frequency === "fiscal_year") return [];
  const latest = series.points.at(-1);
  const current = admins.find((a) => a.end === null || a.end >= (latest?.date ?? ""));
  if (!latest || !current || current.start > latest.date) return [];
  const first = series.points[0]!.date;
  const style = dateStyleFor(series.frequency);
  const rows: TermValue[] = [];
  let spanText: string;
  let spanFacts: Fact[];
  let valueWord: string;

  if (series.kind === "flow") {
    if (series.frequency !== "monthly") return [];
    const m0 = addMonths(current.start, 1);
    const k = monthsBetween(m0, latest.date) + 1;
    if (k < 2) return [];
    const byDate = new Map(series.points.map((p) => [p.date, p] as const));
    for (const t of admins) {
      const start = addMonths(t.start, 1);
      const months = Array.from({ length: k }, (_, i) => addMonths(start, i));
      if (t.end && months.at(-1)! > t.end) continue;
      const pts = months.map((m) => byDate.get(m));
      if (pts.some((p) => !p)) continue;
      const value = pts.reduce((s, p) => s + p!.value, 0);
      const cells = pts.flatMap((p) => p!.cells);
      rows.push({ term: t, value, fact: unitFact(`term_${t.term_id}`, value, series.totalUnit ?? series.unit, cells) });
    }
    const monthsFact: Fact = { id: "full_months", text: fmtInt(k), value: k, format: { kind: "int" }, derivation: { op: "duration", from: m0, to: addMonths(latest.date, 1), unit: "months" } };
    spanFacts = [monthsFact, dateFact("span_start", m0, "month"), dateFact("span_end", latest.date, "month")];
    spanText = `in the first ${monthsFact.text} full months of each term (${spanFacts[1]!.text} to ${spanFacts[2]!.text} in the current term)`;
    valueWord = "totaled";
  } else {
    const offset = daysBetween(current.start, latest.date);
    if (offset < MIN_TERM_DAYS) return [];
    const slack = series.frequency === "weekly" ? 7 : 31;
    for (const t of admins) {
      const end = addDays(t.start, offset);
      if ((t.end && end > t.end) || t.start < first) continue;
      const base = lastOnOrBefore(series.points, t.start);
      const at = lastOnOrBefore(series.points, end);
      if (!base || !at || at === base || daysBetween(base.date, t.start) > slack || daysBetween(at.date, end) > slack) continue;
      const pct = pctFact(`term_${t.term_id}`, base, at);
      rows.push({
        term: t,
        value: pct.value as number,
        fact: pct,
        extra: t === current ? [unitFact("current_start_value", base.value, series.unit, base.cells), unitFact("current_latest_value", at.value, series.unit, at.cells)] : undefined,
      });
    }
    const daysFact: Fact = { id: "days_in", text: fmtInt(offset), value: offset, format: { kind: "int" }, derivation: { op: "duration", from: current.start, to: latest.date, unit: "days" } };
    spanFacts = [daysFact, dateFact("latest_date", latest.date, style)];
    spanText = `in the first ${daysFact.text} days of each term`;
    valueWord = "changed by";
  }

  const cur = rows.find((r) => r.term.term_id === current.term_id);
  if (!cur || rows.length < MIN_TERMS) return [];
  const startFact = dateFact("current_term_start", current.start, "day");
  // The current term's figure first: it is the headline number a caption must include.
  const ordered = [cur, ...rows.filter((r) => r !== cur)];
  const facts = [...ordered.flatMap((r) => [r.fact, ...(r.extra ?? []), termYearFact(r.term)]), ...spanFacts, startFact, termsShownFact(rows)];
  const others = rows.filter((r) => r !== cur);
  const lead = `${current.president}'s term that began ${startFact.text}`;
  let template: string;
  let detail: string;
  let chart: ChartSpec;
  if (series.kind === "flow") {
    const rank = rankPhrase(rows, cur, "highest", "lowest");
    template = `${capitalize(series.name)} ${valueWord} ${cur.fact.text} ${spanText.replace("each term", lead)}${rank}.`;
    detail = `Same span, earlier terms: ${others.map((r) => `${termLabel(r.term)} ${r.fact.text}`).join("; ")}.`;
    chart = termBars(rows, current, series.totalUnit ?? series.unit, `${series.totalAxisLabel ?? series.axisLabel}, total of the first ${spanFacts[0]!.text} full months of each term`);
  } else {
    const dir = (r: TermValue) => `${r.value >= 0 ? "up" : "down"} ${r.fact.text}`;
    const [a, b] = cur.extra!;
    const rank = levelRankPhrase(rows, cur);
    template = `${capitalize(series.name)} went from ${a!.text} to ${b!.text} ${spanText.replace("each term", lead)}, ${dir(cur)}${rank}.`;
    detail = `Same point, earlier terms: ${others.map((r) => `${termLabel(r.term)} ${dir(r)}`).join("; ")}.`;
    chart = termBars(rows, current, null, `percent change, first ${spanFacts[0]!.text} days of each term`);
  }
  const headline = `${capitalize(series.name)} at the same point in each presidential term`;
  return [
    {
      id: `${series.id}:term:${latest.date}`,
      dataset: series.dataset,
      seriesId: series.id,
      kind: "term_comparison",
      period: latest.date,
      frequency: series.frequency,
      headline,
      template,
      facts,
      context: [
        detail,
        "Term comparisons put each presidential term side by side at the same elapsed time; they do not attribute the change to anyone.",
        ...(series.context ?? []),
        series.kind === "level" ? "A term's change runs from the last observation on or before inauguration day to the last one on or before the same number of days in." : "A term's total covers its first full calendar months after inauguration.",
      ],
      chart,
      url: series.url,
      source: series.source,
      score: (6 + (rankPhrase(rows, cur, "x", "y") ? 4 : 0)) * series.weight,
      alt: `Bar chart comparing ${series.name} ${spanText}, one bar per term from ${termLabel(rows[0]!.term)} to ${termLabel(cur.term)}. ${template}`,
    },
  ];
}

/** Counts of records (orders signed, laws enacted) in the first N days of each term, N = days into the current term. */
export function detectEventTermComparison(set: EventSet, admins: Administration[], asOf: string): Insight[] {
  const current = admins.find((a) => a.start <= asOf && (a.end === null || a.end >= asOf));
  if (!current) return [];
  const offset = daysBetween(current.start, asOf);
  if (offset < MIN_TERM_DAYS) return [];
  const rows: TermValue[] = [];
  for (const t of admins) {
    const end = addDays(t.start, offset);
    if (t.start < set.coverageStart || (t.end && end > t.end)) continue;
    const cells = set.events.filter((e) => e.date >= t.start && e.date <= end).map((e) => e.cell);
    rows.push({ term: t, value: cells.length, fact: intFact(`term_${t.term_id}`, cells.length, { op: "value", cells }) });
  }
  const cur = rows.find((r) => r.term.term_id === current.term_id);
  if (!cur || rows.length < MIN_TERMS) return [];
  const daysFact: Fact = { id: "days_in", text: fmtInt(offset), value: offset, format: { kind: "int" }, derivation: { op: "duration", from: current.start, to: asOf, unit: "days" } };
  const asOfFact = dateFact("as_of", asOf, "day");
  const startFact = dateFact("current_term_start", current.start, "day");
  const others = rows.filter((r) => r !== cur);
  const rank = rankPhrase(rows, cur, "most", "fewest");
  const template = `${capitalize(set.name)} ${set.verb} in the first ${daysFact.text} days of ${current.president}'s term that began ${startFact.text}: ${cur.fact.text}${rank}.`;
  const detail = `Same point, earlier terms: ${others.map((r) => `${termLabel(r.term)} ${r.fact.text}`).join("; ")}.`;
  return [
    {
      id: `${set.id}:term:${asOf}`,
      dataset: set.dataset,
      seriesId: set.id,
      kind: "term_comparison",
      period: asOf,
      frequency: "monthly",
      headline: `${capitalize(set.name)} ${set.verb} in the first ${daysFact.text} days of each term`,
      template,
      facts: [...[cur, ...others].flatMap((r) => [r.fact, termYearFact(r.term)]), daysFact, asOfFact, startFact, termsShownFact(rows)],
      context: [
        detail,
        "Term comparisons put each presidential term side by side at the same elapsed time; they count records and say nothing about their content or importance.",
        `Terms that began before ${fmtDate(set.coverageStart, "month")} are left out because the data starts then.`,
      ],
      chart: termBars(rows, current, { scale: 1, decimals: 0, suffix: "" }, `${set.name} ${set.verb}, first ${daysFact.text} days of each term`),
      url: set.url,
      source: set.source,
      score: (6 + (rank ? 4 : 0)) * set.weight,
      alt: `Bar chart of ${set.name} ${set.verb} in the first ${daysFact.text} days of each presidential term since ${termLabel(rows[0]!.term)}. ${template}`,
    },
  ];
}

/** Monthly counts of an event set as a series (full months before `asOf` only), for extremes on monthly totals. */
export function eventMonthlySeries(set: EventSet, asOf: string, opts: Pick<Series, "id" | "name" | "seasonal" | "weight" | "words" | "headline">): Series {
  const lastFull = addMonths(asOf.slice(0, 7) + "-01", -1);
  const first = set.coverageStart.slice(0, 7) + "-01";
  const byMonth = new Map<string, CellRef[]>();
  for (const e of set.events) {
    const m = e.date.slice(0, 7) + "-01";
    if (m < first || m > lastFull) continue;
    (byMonth.get(m) ?? byMonth.set(m, []).get(m)!).push(e.cell);
  }
  const points: Point[] = [];
  for (let m = first; m <= lastFull; m = addMonths(m, 1)) {
    const cells = byMonth.get(m) ?? [];
    points.push({ date: m, value: cells.length, cells });
  }
  return {
    ...opts,
    dataset: set.dataset,
    axisLabel: `${set.name} per month`,
    unit: { scale: 1, decimals: 0, suffix: "" },
    frequency: "monthly",
    kind: "flow",
    moveMode: "abs",
    skip: ["move", "term"],
    releaseLagDays: 1,
    points,
    url: set.url,
    source: set.source,
  };
}

/** A series cut at `date` (inclusive): what the data looked like when that period was the newest. */
export function truncate(series: Series, date: string): Series {
  return { ...series, points: series.points.filter((p) => p.date <= date) };
}

export function truncateEvents(set: EventSet, date: string): EventSet {
  return { ...set, events: set.events.filter((e) => e.date <= date) };
}

/** The point a year before `p`: 12 months for monthly data, 52 weeks (within 3 days) for weekly, the prior fiscal year. */
export function yearEarlier(series: Series, p: Point): Point | undefined {
  if (series.frequency === "monthly") return series.points.find((q) => q.date === addMonths(p.date, -12));
  if (series.frequency === "fiscal_year") return series.points.find((q) => q.date === `${Number(p.date.slice(0, 4)) - 1}-09-30`);
  const target = addDays(p.date, -364);
  return series.points.find((q) => Math.abs(daysBetween(q.date, target)) <= 3);
}

/**
 * The routine reading for a dataset's headline series: the newest value, its change on the period (not for seasonal
 * series) and on the year. Scored below anything notable, so it posts only when a refresh brought nothing else.
 */
export function detectLatest(series: Series): Insight[] {
  if (!series.headline) return [];
  const pts = series.points;
  const latest = pts.at(-1);
  const prev = pts.at(-2);
  if (!latest || !prev) return [];
  const yearAgo = yearEarlier(series, latest);
  const style = dateStyleFor(series.frequency);
  const latestFact = unitFact("latest_value", latest.value, series.unit, latest.cells);
  const latestDate = dateFact("latest_date", latest.date, style);
  const facts: Fact[] = [latestFact, latestDate];
  const parts: string[] = [];
  const dirText = (f: Fact) => ((f.value as number) === 0 ? "unchanged" : `${(f.value as number) > 0 ? "up" : "down"} ${f.text}`);
  const pctOk = (from: Point) => series.moveMode === "pct" && from.value > 0;
  if (!series.seasonal && series.frequency !== "fiscal_year") {
    const change = pctOk(prev) ? pctFact("change_period", prev, latest) : changeFact("change_period", prev, latest, series.unit);
    const prevDate = dateFact("previous_date", prev.date, style);
    facts.push(change, prevDate, unitFact("previous_value", prev.value, series.unit, prev.cells));
    parts.push(`${dirText(change)} from ${series.frequency === "weekly" ? "the week of " : ""}${prevDate.text}`);
  }
  if (yearAgo) {
    const change = pctOk(yearAgo) ? pctFact("change_year", yearAgo, latest) : changeFact("change_year", yearAgo, latest, series.unit);
    const yaValue = unitFact("year_ago_value", yearAgo.value, series.unit, yearAgo.cells);
    facts.push(change, yaValue, dateFact("year_ago_date", yearAgo.date, style));
    parts.push(`${dirText(change)} from a year earlier (${yaValue.text})`);
  }
  if (parts.length === 0) return [];
  const template = `${capitalize(series.name)}: ${latestFact.text} ${when(series, latestDate.text)}, ${parts.join(" and ")}.`;
  const from = addMonths(latest.date, series.frequency === "weekly" ? -12 : series.frequency === "fiscal_year" ? -12 * 12 : -36);
  const chart: ChartSpec = usesBars(series)
    ? periodBars(series, latest, from, style)
    : {
        type: "line",
        unit: series.unit,
        axisLabel: series.axisLabel,
        frequency: series.frequency,
        points: linePoints(series, from, latest.date),
        marks: [
          { date: latest.date, label: `${markDate(series, latest.date)}: ${latestFact.text}`, emphasis: true },
          ...(yearAgo && yearAgo.date >= from ? [{ date: yearAgo.date, label: `${markDate(series, yearAgo.date)}: ${fmtUnit(yearAgo.value, series.unit)}`, emphasis: false }] : []),
        ],
      };
  return [
    {
      id: `${series.id}:latest:${latest.date}`,
      dataset: series.dataset,
      seriesId: series.id,
      kind: "latest",
      period: latest.date,
      frequency: series.frequency,
      headline: `${capitalize(series.name)}, ${series.frequency === "weekly" ? "week of " : ""}${latestDate.text}`,
      template,
      facts,
      context: series.context ?? [],
      chart,
      url: series.url,
      source: series.source,
      score: 2 * series.weight,
      alt: `${usesBars(series) ? "Bar" : "Line"} chart of ${series.name} (${series.axisLabel}) through ${latestDate.text}. ${template}`,
    },
  ];
}

/** Every detector on one series. */
export function detectSeries(series: Series, admins: Administration[]): Insight[] {
  return [...detectExtremes(series), ...detectMoves(series), ...detectTermComparison(series, admins), ...detectLatest(series)];
}

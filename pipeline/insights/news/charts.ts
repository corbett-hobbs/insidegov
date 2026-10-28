import { existsSync, readdirSync } from "node:fs";
import { displayCountryName } from "../../../lib/trade-names";
import { readOutput } from "../datasets";
import { capitalize, changeFact, dateFact, linePoints, markDate, pctFact, periodBars, unitFact, usesBars, when, yearEarlier } from "../detect";
import { addMonths, bareIfSameYear, dateStyleFor, daysBetween, fmtDate, fmtUnit, monthName, shortMonth } from "../format";
import { CAPTION_MAX_CHARS } from "../caption";
import { chartTitle } from "../title";
import type { Breakdown, ChartSpec, DateStyle, Fact, Insight, Point, Series, UnitFormat } from "../types";

/**
 * Context charts for news drafts. Unlike the data-release detectors these do not look for anything notable: the news
 * is the reason to post, and the chart answers "where does this stand, and how did it get here" from data the site
 * already has. Every number is still a Fact traced to its cells, and the caption check still applies.
 *
 * Every caption first says which way the latest value moved from the previous reading (a status update, not only a
 * comparison with the past), then compares with the PEAK in the chart's window (how far the latest value is from it, and
 * how far back the peak stands in all the data). A year earlier is the fallback: when there is no peak to compare with (bar charts,
 * or the latest value IS the peak), or when the peak sentence does not fit the caption limit.
 */

/** A caption clause and the facts it uses (a fact the caption does not use is left out of the draft). */
type Clause = { text: string; facts: Fact[] };

/** The first clause that fits the caption limit after `lead` and `head`, else none. */
function firstFitting(lead: string, head: string, options: Clause[]): Clause {
  return options.find((c) => `${lead} ${head}${c.text}.`.length <= CAPTION_MAX_CHARS) ?? { text: "", facts: [] };
}

/**
 * The highest point of `all` in the window from `from`, and how far back it stands over ALL the data: since the last
 * value at least as high, or "in data going back to" the first year (never "since <window start>", which reads as a
 * date). Weekly peaks are named by month (the chart marks the week). `which` ("July ") says a seasonal series' peak is
 * that month's.
 */
function windowPeak(all: Point[], from: string, latest: Point, unit: UnitFormat, style: DateStyle, which = "") {
  const window = all.filter((p) => p.date >= from && p.date <= latest.date);
  const peak = window.reduce((a, b) => (b.value > a.value ? b : a), window[0]!);
  const higher = all.filter((p) => p.date < peak.date && p.value >= peak.value).at(-1);
  const monthly = style === "day" ? "month" : style;
  const reachFact = higher ? dateFact("higher_date", higher.date, monthly) : dateFact("data_start", all[0]!.date, "year");
  return {
    peak,
    isLatest: peak.date === latest.date,
    reach: { text: higher ? `the highest ${which}since ${reachFact.text}` : `the highest ${which}in data going back to ${reachFact.text}`, facts: [reachFact] },
    value: unitFact("peak_value", peak.value, unit, peak.cells),
    date: dateFact("peak_date", peak.date, bareIfSameYear(monthly, peak.date, latest.date)),
  };
}

/**
 * The carousel's "bigger picture" card for a chart with two lines: each line's highest and lowest reading in the chart's
 * window beside its latest, as bars on one scale. Every value is a fact traced to its cells; the card says nothing the
 * data does not.
 */
function whereEachStands(main: Series, mainUnit: UnitFormat, other: Series, from: string, latest: Point, latestFact: Fact, pairNote: string, years: number): { breakdown: Breakdown; facts: Fact[] } | null {
  const facts: Fact[] = [];
  const block = (s: Series, unit: UnitFormat, key: string, label: string, now: Point, nowFact: Fact) => {
    const win = s.points.filter((p) => p.date >= from && p.date <= now.date);
    if (win.length < 3) return null;
    const hi = win.reduce((a, b) => (b.value > a.value ? b : a));
    const lo = win.reduce((a, b) => (b.value < a.value ? b : a));
    const row = (name: string, id: string, p: Point) => {
      const f = unitFact(`trend_${key}_${id}`, p.value, unit, p.cells);
      facts.push(f);
      return { name, fact: f.id };
    };
    const rows = [row(`Peak, ${hi.date.slice(0, 4)}`, "peak", hi), row(`Low, ${lo.date.slice(0, 4)}`, "low", lo)];
    facts.push({ ...nowFact, id: `trend_${key}_latest` });
    return { label, rows: [...rows, { name: "Latest", fact: `trend_${key}_latest` }] };
  };
  const a = block(main, mainUnit, "a", capitalize(main.name.replace(/^the /, "")), latest, latestFact);
  const otherLatest = other.points.at(-1);
  const b = otherLatest ? block(other, { ...other.unit, decimals: Math.min(1, other.unit.decimals) }, "b", capitalize(other.name.replace(/^the /, "")), otherLatest, unitFact("x", otherLatest.value, { ...other.unit, decimals: Math.min(1, other.unit.decimals) }, otherLatest.cells)) : null;
  if (!a || !b) return null;
  return {
    facts,
    breakdown: {
      title: `Where each stands against the last ${years === 10 ? "ten" : years} years`,
      kicker: "The bigger picture",
      levels: true,
      blocks: [a, b],
      note: `Highest and lowest readings since ${from.slice(0, 4)}.${pairNote ? ` ${pairNote.replace(/^./, (c) => c.toUpperCase())}.` : ""}`,
    },
  };
}

/** A series' latest value against its peak in the window (`peak`), else against a year earlier. */
export function seriesContext(series: Series, opts: { years: number; peak: boolean; lead: string; id: string; compare?: Series; pair?: { subject: string; note: string; source?: string } }): Insight | null {
  const latest = series.points.at(-1);
  if (!latest || series.points.length < 3) return null;
  const style = dateStyleFor(series.frequency);
  // With a second series the figures are the headline numbers of a status update: one decimal, as inflation reads.
  const unit = opts.compare ? { ...series.unit, decimals: Math.min(1, series.unit.decimals) } : series.unit;
  const cunit = opts.compare ? { ...opts.compare.unit, decimals: Math.min(1, opts.compare.unit.decimals) } : undefined;
  const from = addMonths(latest.date, -12 * opts.years);
  const latestFact = unitFact("latest_value", latest.value, unit, latest.cells);
  const latestDate = dateFact("latest_date", latest.date, style);
  const facts: Fact[] = [latestFact, latestDate];
  const bars = usesBars(series);
  // "Name stood at value when" ("was" beside a second series, to fit) reads right whether the name is singular (a price) or plural (encounters, exports).
  const head = `${capitalize(series.name)} ${opts.compare ? "was" : "stood at"} ${latestFact.text} ${when(series, latestDate.text)}`;

  const yearAgo = yearEarlier(series, latest);
  let year: { short: Clause; full: Clause } | null = null;
  if (yearAgo) {
    const change = series.moveMode === "pct" && yearAgo.value > 0 ? pctFact("change_year", yearAgo, latest) : changeFact("change_year", yearAgo, latest, series.changeUnit ?? unit);
    const yaValue = unitFact("year_ago_value", yearAgo.value, unit, yearAgo.cells);
    const v = change.value as number;
    const short = v === 0 ? ", unchanged from a year earlier" : `, ${v > 0 ? "up" : "down"} ${change.text} from a year earlier`;
    year = { short: { text: short, facts: [change] }, full: { text: v === 0 ? short : `${short} (${yaValue.text})`, facts: [change, yaValue] } };
  }
  const join = (...cs: Clause[]): Clause => ({ text: cs.map((c) => c.text).join(""), facts: cs.flatMap((c) => c.facts) });

  // The previous reading, ahead of everything else. Not for seasonal series (the last month is not comparable) or fiscal years.
  // With a second series the Fed's weekly rate is read against a month earlier: it moves only at decisions, so last week says nothing.
  const monthAgo = opts.compare ? series.points.find((q) => Math.abs(daysBetween(q.date, addMonths(latest.date, -1))) <= 3) : undefined;
  const prevPoint = series.seasonal || series.frequency === "fiscal_year" ? undefined : monthAgo ?? series.points.at(-2);
  let prev: Clause | null = null;
  if (prevPoint) {
    const prevValue = unitFact("previous_value", prevPoint.value, unit, prevPoint.cells);
    const prevDate = dateFact("previous_date", prevPoint.date, bareIfSameYear(style, prevPoint.date, latest.date));
    // Judged on the figures as printed: 3.9% against 3.9% is unchanged, whatever the hundredths.
    const dir = prevValue.text === latestFact.text ? "unchanged" : latest.value > prevPoint.value ? "up" : "down";
    const text =
      prevPoint === monthAgo
        ? dir === "unchanged" ? ", unchanged from a month earlier" : `, ${dir} from ${prevValue.text} a month earlier`
        : `, ${dir} from ${prevValue.text} ${when(series, prevDate.text)}`;
    prev = { text, facts: [prevValue, prevDate] };
  }
  // "up from 3.4% in August 2026" then ", and down from a peak ..." / ", the highest since ...": the join word follows.
  const withPrev = (c: Clause, joiner: string): Clause[] => (prev ? [{ text: prev.text + (joiner ? `${joiner} ${c.text.replace(/^, /, "")}` : c.text), facts: [...prev.facts, ...c.facts] }, c] : [c]);

  let peak: Point | undefined;
  /** The peak with only its year, for when the month does not fit beside a second series. */
  let peakYear: Clause | null = null;
  const options: Clause[] = [];
  if (opts.peak) {
    // Seasonal series compare like months (the July peak), as their bar charts do.
    const pool = series.seasonal ? series.points.filter((p) => p.date.slice(5, 7) === latest.date.slice(5, 7)) : series.points;
    const which = series.seasonal ? `${monthName(latest.date)} ` : "";
    const w = windowPeak(pool, from, latest, unit, style, which);
    if (w.isLatest) {
      // The latest value is the peak: say how far back it stands, with the year-earlier change.
      const reach = { text: `, ${w.reach.text}`, facts: w.reach.facts };
      if (year) options.push(...withPrev(join(year.full, reach), " and"), ...withPrev(join(year.short, reach), " and"));
      options.push(...withPrev(reach, ""));
    } else {
      if (!bars) peak = w.peak;
      // One sentence, newest value first and the peak at the end ("…: $6.18 a gallon in the week of October 12, 2026,
      // down from a peak of $6.53 a gallon in September 2026, the highest in data going back to 1994").
      const peakText = `, down from ${series.seasonal ? `the ${which}` : "a "}peak of ${w.value.text} in ${w.date.text}`;
      peakYear = { text: peakText.replace(` in ${w.date.text}`, ` in ${dateFact("peak_date", w.peak.date, "year").text}`), facts: [w.value, dateFact("peak_date", w.peak.date, "year")] };
      options.push(
        ...withPrev({ text: `${peakText}, ${w.reach.text}`, facts: [w.value, w.date, ...w.reach.facts] }, " and"),
        ...withPrev({ text: peakText, facts: [w.value, w.date] }, " and"),
      );
    }
  }
  if (year) options.push(...withPrev(year.full, " and"), ...withPrev(year.short, " and"));
  if (prev) options.push(prev);
  // A second series (inflation beside the Fed's rate): its own sentence with its latest reading and the move on the previous
  // one, kept ahead of the peak's reach when the caption is too long for both.
  const cmpLatest = opts.compare?.points.at(-1);
  const cmpPrev = opts.compare && !opts.compare.seasonal ? opts.compare.points.at(-2) : undefined;
  let cmpClause: Clause | null = null;
  let cmpShort: Clause | null = null;
  let cmpNoDate: Clause | null = null;
  if (opts.compare && cmpLatest) {
    const cv = unitFact("compare_value", cmpLatest.value, cunit!, cmpLatest.cells);
    const cd = dateFact("compare_date", cmpLatest.date, dateStyleFor(opts.compare.frequency));
    const cf: Fact[] = [cv, cd];
    let text = `. ${opts.pair?.subject ?? opts.compare.title} was ${cv.text} ${when(opts.compare, cd.text)}`;
    cmpShort = { text, facts: [cv, cd] };
    if (cmpPrev) {
      const pv = unitFact("compare_previous_value", cmpPrev.value, cunit!, cmpPrev.cells);
      const pd = dateFact("compare_previous_date", cmpPrev.date, bareIfSameYear(dateStyleFor(opts.compare.frequency), cmpPrev.date, cmpLatest.date));
      const dir = cmpLatest.value > cmpPrev.value ? "up" : cmpLatest.value < cmpPrev.value ? "down" : "unchanged";
      cmpNoDate = { text: `${text}, ${dir} from ${pv.text}`, facts: [cv, cd, pv] };
      text += `, ${dir} from ${pv.text} ${when(opts.compare, pd.text)}`;
      cf.push(pv, pd);
    }
    cmpClause = { text, facts: cf };
  }
  // Richest first: every option with the full sentence, then with only the latest reading, then the sentence alone.
  // Beside a second series the Fed's "unchanged from a month earlier" and the peak matter most: shorten the peak's date to its
  // year, then the inflation sentence's previous date, before dropping either.
  const ladder: Clause[] = [];
  if (prev && peakYear && cmpClause && cmpShort) {
    const yp = join(prev, { text: peakYear.text.replace(/^,/, " and"), facts: peakYear.facts });
    ladder.push(join(yp, cmpClause));
    if (cmpNoDate) ladder.push(join(yp, cmpNoDate));
    ladder.push(join(yp, cmpShort));
  }
  const withCmp = cmpClause && cmpShort ? [...ladder, ...options.map((c) => join(c, cmpClause!)), ...options.map((c) => join(c, cmpShort!)), cmpClause, cmpShort, ...options] : options;
  const clause = firstFitting(opts.lead, head, withCmp);
  facts.push(...clause.facts);
  const sentence = head + clause.text;

  const cmpWindow = opts.compare?.points.filter((p) => p.date >= from && p.date <= latest.date).map((p) => ({ date: p.date, value: p.value })) ?? [];
  const chart: ChartSpec = bars
    ? periodBars(series, latest, from, style)
    : {
        type: "line",
        unit: unit,
        axisLabel: series.axisLabel,
        frequency: series.frequency,
        points: linePoints(series, from, latest.date),
        marks: [
          // Two lines are each named at their end ("Federal funds rate, 3.9%"), so the date stays out of the label.
          { date: latest.date, label: opts.compare ? latestFact.text : `${markDate(series, latest.date)}: ${latestFact.text}`, emphasis: true },
          ...(peak ? [{ date: peak.date, label: `${markDate(series, peak.date)}: ${fmtUnit(peak.value, unit)}`, emphasis: false }] : []),
        ],
        ...(opts.compare && cmpLatest && cmpWindow.length > 1
          ? { comparison: { label: `${opts.pair?.subject ?? capitalize(opts.compare.title.toLowerCase())}: ${fmtUnit(cmpLatest.value, cunit!)}`, mainLabel: capitalize(series.title.replace(/^The /, "")), points: cmpWindow } }
          : {}),
      };
  const template = `${opts.lead} ${sentence}.`;
  const trend = opts.compare && cmpLatest && chart.type === "line" ? whereEachStands(series, unit, opts.compare, from, latest, latestFact, `${opts.pair?.note ?? ""}`, opts.years) : null;
  if (trend) facts.push(...trend.facts);
  return {
    ...(opts.compare ? { alsoSeriesId: opts.compare.id } : {}),
    ...(trend ? { breakdown: trend.breakdown } : {}),
    id: opts.id,
    dataset: series.dataset,
    seriesId: series.id,
    kind: "news",
    period: latest.date,
    frequency: series.frequency,
    headline: `${capitalize(series.name)}${opts.compare ? ` and ${opts.compare.name}` : ""}${bars ? "" : `, ${fmtDate(chart.type === "line" ? chart.points[0]!.date : latest.date, "year")} to ${fmtDate(latest.date, "year")}`}`,
    title: chartTitle(opts.compare ? `${series.title} and ${opts.compare.title.replace(/^./, (c) => c.toLowerCase())}` : series.title, chart, { frequency: series.frequency, seasonal: series.seasonal, latest: latest.date }),
    template,
    lead: opts.lead,
    facts,
    context: [
      ...(series.context ?? []),
      ...(opts.compare ? [`The chart has two lines on one axis, ${series.name} and ${opts.compare.name}. The caption may state each one's latest reading; it must not say either causes, answers or should follow the other.`] : []),
      `This chart is posted because the topic is in the news. The caption opens with the fixed sentence "${opts.lead}" and then says only what the data shows; it never describes or comments on the news itself.`,
    ],
    chart,
    url: series.url,
    ...(series.anchor ? { anchor: series.anchor } : {}),
    source: opts.pair?.source ?? series.source,
    note: opts.compare ? (opts.pair?.note ?? series.note) : series.note,
    score: 3 * series.weight,
    alt: `${bars ? "Bar" : "Line"} chart of ${series.name} (${series.axisLabel}) through ${latestDate.text}. ${sentence}.`,
  };
}

const RATE: UnitFormat = { scale: 100, decimals: 1, suffix: "%" };
const NATIONAL = "pipeline/output/duties_national.json";
const BY_COUNTRY = "pipeline/output/duties_by_country";
const TARIFF_YEARS = 10;

type NationalRow = { period: string; rate: number | null };
type CountryRow = { country_code: string; year: number; rate: (number | null)[]; import_value_year: number | null };

/** All-countries rate by month: calculated duties ÷ imports for consumption. */
function nationalPoints(): Point[] {
  return readOutput<NationalRow[]>(NATIONAL)
    .filter((r) => typeof r.rate === "number")
    .map((r) => ({ date: `${r.period}-01`, value: r.rate!, cells: [{ file: NATIONAL, key: { period: r.period }, field: "rate" }] }));
}

function countryYears(): number[] {
  return existsSync(BY_COUNTRY) ? readdirSync(BY_COUNTRY).filter((f) => /^\d{4}\.json$/.test(f)).map((f) => Number(f.slice(0, 4))).sort() : [];
}

/** One partner's rate by month, from the yearly files (each row holds twelve months; months not out yet are null). */
function countryPoints(code: string, fromYear: number): Point[] {
  const out: Point[] = [];
  for (const year of countryYears().filter((y) => y >= fromYear)) {
    const file = `${BY_COUNTRY}/${year}.json`;
    const row = readOutput<CountryRow[]>(file).find((r) => r.country_code === code);
    row?.rate.forEach((v, i) => {
      if (typeof v === "number") out.push({ date: `${year}-${String(i + 1).padStart(2, "0")}-01`, value: v, cells: [{ file, key: { country_code: code, year }, field: "rate", index: i }] });
    });
  }
  return out;
}

/** The trade partners tariff news can name: countries (no groups) importing at least `minImports` in the last full year. */
export function tariffPartners(minImports: number): { code: string; name: string }[] {
  const years = countryYears();
  const year = years.at(-2) ?? years.at(-1);
  if (!year) return [];
  const names = new Map(readOutput<{ country_code: string; name: string; is_aggregate: boolean }[]>("pipeline/output/countries.json").filter((c) => !c.is_aggregate).map((c) => [c.country_code, c.name] as const));
  return readOutput<CountryRow[]>(`${BY_COUNTRY}/${year}.json`)
    .filter((r) => names.has(r.country_code) && (r.import_value_year ?? 0) >= minImports)
    .sort((a, b) => (b.import_value_year ?? 0) - (a.import_value_year ?? 0))
    .map((r) => ({ code: r.country_code, name: displayCountryName(r.country_code, names.get(r.country_code)!) }));
}

const rateNote =
  "The rate is calculated duties divided by the value of imports for consumption: the tariff actually collected, averaged over every product. It is not a statutory or announced rate, and it moves months after a tariff changes, so never compare it with rates in the news.";

/**
 * The collected tariff rate for one partner against all countries (or all countries alone), monthly for the last
 * TARIFF_YEARS years, ending at the newest month both have.
 */
export function tariffContext(country: { code: string; name: string } | undefined, opts: { lead: string; id: string }): Insight | null {
  const national = nationalPoints();
  if (national.length < 13) return null;
  // The partner's whole history, so the peak's reach is measured over all the data, not just the chart's years.
  const main = country ? countryPoints(country.code, 0) : national;
  const latest = country ? main.filter((p) => national.some((n) => n.date === p.date)).at(-1) : main.at(-1);
  if (!latest) return null;
  const from = addMonths(latest.date, -12 * TARIFF_YEARS);
  const style = "month" as const;
  const latestFact = unitFact("latest_value", latest.value, RATE, latest.cells);
  const latestDate = dateFact("latest_date", latest.date, style);
  const facts: Fact[] = [latestFact, latestDate];
  const subject = country ? `imports from ${country.name}` : "U.S. imports";
  let head = `The average tariff collected on ${subject} was ${latestFact.text} in ${latestDate.text}`;
  const nat = national.find((n) => n.date === latest.date)!;
  if (country) {
    const natFact = unitFact("all_countries_value", nat.value, RATE, nat.cells);
    facts.push(natFact);
    head += `, against ${natFact.text} on imports from all countries`;
  }
  // Rates compare as values ("3.8%"), never as a percent change of a percent. With a country, the clause names it, so
  // it cannot be read as the all-countries rate.
  const whose = country ? ` for ${country.name}` : "";
  const w = windowPeak(main, from, latest, RATE, style);
  const yearAgo = main.find((p) => p.date === addMonths(latest.date, -12));
  const ya = yearAgo ? unitFact("year_ago_value", yearAgo.value, RATE, yearAgo.cells) : null;
  const yaDate = yearAgo ? dateFact("year_ago_date", yearAgo.date, style) : null;
  const yearClause: Clause[] = ya && yaDate ? [{ text: `. In ${yaDate.text} the rate${whose} was ${ya.text}`, facts: [ya, yaDate] }] : [];
  // Which way the rate moved from the previous month comes first, then the peak (or a year earlier).
  const prevPoint = main.filter((p) => p.date < latest.date).at(-1);
  const prevFact = prevPoint ? unitFact("previous_value", prevPoint.value, RATE, prevPoint.cells) : null;
  const prevDate = prevPoint ? dateFact("previous_date", prevPoint.date, bareIfSameYear(style, prevPoint.date, latest.date)) : null;
  const prevClause: Clause | null =
    prevPoint && prevFact && prevDate
      ? { text: `. The rate${whose} is ${latest.value > prevPoint.value ? "up" : latest.value < prevPoint.value ? "down" : "unchanged"} from ${prevFact.text} in ${prevDate.text}`, facts: [prevFact, prevDate] }
      : null;
  const peakOptions: Clause[] = w.isLatest
    ? [...yearClause.map((c) => ({ text: `. That is ${w.reach.text}${c.text}`, facts: [...w.reach.facts, ...c.facts] })), { text: `. That is ${w.reach.text}`, facts: w.reach.facts }, ...yearClause]
    : [
        { text: `. The peak${whose} was ${w.value.text} in ${w.date.text}, ${w.reach.text}`, facts: [w.value, w.date, ...w.reach.facts] },
        { text: `. The peak${whose} was ${w.value.text} in ${w.date.text}`, facts: [w.value, w.date] },
        ...yearClause,
      ];
  const options: Clause[] = [...(prevClause ? peakOptions.map((c) => ({ text: prevClause.text + c.text, facts: [...prevClause.facts, ...c.facts] })) : []), ...peakOptions, ...(prevClause ? [prevClause] : [])];
  const clause = firstFitting(opts.lead, head, options);
  facts.push(...clause.facts);
  const template = `${opts.lead} ${head}${clause.text}.`;
  const peak = w.isLatest ? undefined : w.peak;
  const inWindow = (pts: Point[]) => pts.filter((p) => p.date >= from && p.date <= latest.date).map((p) => ({ date: p.date, value: p.value }));
  const chart: ChartSpec = {
    type: "line",
    unit: RATE,
    axisLabel: "tariffs collected, % of import value",
    frequency: "monthly",
    points: inWindow(main),
    marks: [
      { date: latest.date, label: `${shortMonth(latest.date)}: ${latestFact.text}`, emphasis: true },
      ...(peak ? [{ date: peak.date, label: `Peak, ${shortMonth(peak.date)}: ${fmtUnit(peak.value, RATE)}`, emphasis: false }] : []),
    ],
    ...(country ? { comparison: { label: `All countries: ${fmtUnit(nat.value, RATE)}`, mainLabel: country.name, points: inWindow(national) } } : {}),
  };
  return {
    id: opts.id,
    dataset: "trade",
    seriesId: country ? `tariff.${country.code}` : "tariff.all",
    kind: "news",
    period: latest.date,
    frequency: "monthly",
    headline: country ? `Tariff rate collected on imports from ${country.name}, against all countries` : "Tariff rate collected on U.S. imports",
    title: country ? `Tariffs on ${country.name} vs. all countries` : "Tariffs on U.S. imports",
    template,
    lead: opts.lead,
    facts,
    context: [
      rateNote,
      "Monthly figures; dollar values are nominal.",
      `This chart is posted because the topic is in the news. The caption opens with the fixed sentence "${opts.lead}" and then says only what the data shows; it never describes or comments on the news itself.`,
    ],
    chart,
    url: "/presidency/trade",
    // The tariff card, filtered to the country (the trade page keeps its filters in the query string).
    anchor: country ? `?country=${country.code}#tariffs` : "#tariffs",
    source: "U.S. Census Bureau and USITC",
    note: "Duties collected as a share of the value of imports",
    score: 4.5,
    alt: `Line chart of the average tariff collected on ${subject}${country ? ", with all countries for comparison" : ""}, monthly through ${latestDate.text}. ${template.slice(opts.lead.length + 1)}`,
  };
}

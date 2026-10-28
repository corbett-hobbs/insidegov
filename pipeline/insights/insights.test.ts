import { describe, expect, it } from "vitest";
import { buildPostRecord, graphemes } from "./bluesky";
import { checkCaption, numberTokens, templateCaption } from "./caption";
import { eventInsightsAt, newMonthEnds, selectInsights, seriesInsightsAt, termComparisonDue } from "./collect";
import { MIN_YEARS, changes, detectEventTermComparison, detectExtremes, detectLatest, detectMoves, detectTermComparison, termLabel, truncate } from "./detect";
import type { Draft } from "./drafts";
import { addMonths, fmtDate, fmtPct, fmtUnit } from "./format";
import { issueBody, issueTitle, parseDraftBlock } from "./issue";
import type { Administration, EventSet, Insight, Series } from "./types";
import { CellIndex, verifyInsight } from "./verify";

const FILE = "pipeline/output/test_obs.json";
const ADMIN_FILE = "pipeline/output/administrations.json";

const ADMINS: Administration[] = [
  { term_id: "2001-01-20", president: "George W. Bush", start: "2001-01-20", end: "2009-01-19" },
  { term_id: "2009-01-20", president: "Barack Obama", start: "2009-01-20", end: "2017-01-19" },
  { term_id: "2017-01-20", president: "Donald Trump", start: "2017-01-20", end: "2021-01-19" },
  { term_id: "2021-01-20", president: "Joe Biden", start: "2021-01-20", end: "2025-01-19" },
  { term_id: "2025-01-20", president: "Donald Trump", start: "2025-01-20", end: null },
];

/** A monthly series from `start`, one value per month, with rows for the CellIndex. */
function monthly(values: number[], over: Partial<Series> = {}, start = "2000-01-01"): { series: Series; rows: Record<string, unknown>[] } {
  const rows = values.map((value, i) => ({ series_id: "T", date: addMonths(start, i), value }));
  const series: Series = {
    id: "test.series",
    dataset: "energy",
    title: "Test output",
    name: "test output",
    axisLabel: "units",
    unit: { scale: 1, decimals: 1, suffix: " units" },
    frequency: "monthly",
    seasonal: false,
    kind: "level",
    moveMode: "pct",
    points: rows.map((r) => ({ date: r.date, value: r.value, cells: [{ file: FILE, key: { series_id: "T", date: r.date }, field: "value" }] })),
    url: "/presidency/energy",
    source: "Test agency",
    weight: 1,
    releaseLagDays: 30,
    ...over,
  };
  return { series, rows };
}

const indexFor = (rows: Record<string, unknown>[], admins = ADMINS) => new CellIndex(undefined, { [FILE]: rows, [ADMIN_FILE]: admins });

/** Flat around 100 with a gentle wiggle, so nothing is notable unless a test makes it so. */
const flat = (n: number) => Array.from({ length: n }, (_, i) => 100 + (i % 2 === 0 ? 0.2 : -0.2));

describe("format", () => {
  it("formats units, percents and dates", () => {
    expect(fmtUnit(13612.4, { scale: 0.001, decimals: 2, suffix: " million barrels a day" })).toBe("13.61 million barrels a day");
    expect(fmtUnit(3.1249, { scale: 1, decimals: 2, prefix: "$", suffix: " a gallon" })).toBe("$3.12 a gallon");
    expect(fmtUnit(-0.04, { scale: 1, decimals: 1, suffix: "" })).toBe("0.0");
    expect(fmtPct(-12.345, 1)).toBe("12.3%");
    expect(fmtDate("2026-08-01", "month")).toBe("August 2026");
    expect(fmtDate("2026-10-12", "day")).toBe("October 12, 2026");
    expect(fmtDate("2025-09-30", "fiscal_year")).toBe("fiscal 2025");
  });

  it("labels terms by last name and start year", () => {
    expect(termLabel(ADMINS[4]!)).toBe("Trump 2025");
  });
});

describe("detectExtremes", () => {
  it("reports a new high as the highest since the last value at least as high", () => {
    const values = flat(120);
    values[40] = 130; // April 2003
    values.push(125);
    const { series, rows } = monthly(values);
    const [ins] = detectExtremes(series);
    expect(ins?.kind).toBe("extreme_high");
    expect(ins?.template).toBe("Test output: 125.0 units in January 2010, the highest since May 2003 (130.0 units).");
    expect(verifyInsight(ins!, indexFor(rows))).toEqual([]);
    expect(checkCaption(ins!.template, ins!.facts)).toEqual([]);
  });

  it("needs at least MIN_YEARS since an equal or more extreme value", () => {
    const values = flat(120);
    values[120 - 12 * (MIN_YEARS - 1)] = 130;
    values.push(125);
    expect(detectExtremes(monthly(values).series)).toEqual([]);
  });

  it("calls a value beyond all history a high in data going back to the first observation", () => {
    const { series } = monthly([...flat(80), 150]);
    const [ins] = detectExtremes(series);
    expect(ins?.template).toContain("the highest in data going back to January 2000");
  });

  it("compares seasonal series with the same calendar month only", () => {
    // Every July is 200, other months 100; this July is 190: high for July? No (earlier Julys 200). Low? Not either.
    const values: number[] = Array.from({ length: 121 }, (_, i) => (i % 12 === 6 ? 200 : 100));
    values[120] = 99; // January 2010, lowest January
    const { series } = monthly(values, { seasonal: true });
    const [ins] = detectExtremes(series);
    expect(ins?.kind).toBe("extreme_low");
    expect(ins?.template).toContain("the lowest for any January in data going back to January 2000");
  });

  it("scores a record lower when the previous value was a record too (a steadily growing series)", () => {
    const growing = monthly(Array.from({ length: 100 }, (_, i) => 10 + i)).series;
    const jump = monthly([...flat(99), 150]).series;
    expect(detectExtremes(growing)[0]!.score).toBeLessThan(detectExtremes(jump)[0]!.score);
  });
});

describe("detectMoves", () => {
  it("finds the largest one-month rise in years and states the change from the facts", () => {
    const values = flat(120);
    values[30] = values[29]! * 1.2; // a 20% jump in July 2002
    values.push(values[119]! * 1.1);
    const { series, rows } = monthly(values);
    const [ins] = detectMoves(series);
    expect(ins?.kind).toBe("move_up");
    expect(ins?.template).toMatch(/^Test output rose 10% from .* the largest one-month increase since July 2002 \(20%\)\.$/);
    expect(verifyInsight(ins!, indexFor(rows))).toEqual([]);
  });

  it("ignores moves under 1%", () => {
    expect(detectMoves(monthly([...flat(120), 100.5]).series)).toEqual([]);
  });

  it("uses year-over-year changes for seasonal series", () => {
    const { series } = monthly(Array.from({ length: 30 }, (_, i) => 100 + i), { seasonal: true });
    const c = changes(series);
    expect(c[0]!.from.date).toBe("2000-01-01");
    expect(c[0]!.to.date).toBe("2001-01-01");
  });

  it("measures absolute changes when asked (series near or below zero)", () => {
    const { series } = monthly([...flat(120).map((v) => v - 100), -40], { moveMode: "abs" });
    const [ins] = detectMoves(series);
    expect(ins?.facts.find((f) => f.id === "change")?.text).toBe("39.8 units");
  });
});

describe("term comparisons", () => {
  it("compares a level's change from inauguration to the same day of every term", () => {
    // Monthly from 2000: a steady climb, so later terms start higher.
    const { series, rows } = monthly(
      Array.from({ length: 12 * 26 + 8 }, (_, i) => 100 + i),
      { frequency: "monthly" },
    );
    const [ins] = detectTermComparison(series, ADMINS);
    expect(ins?.kind).toBe("term_comparison");
    expect(ins?.chart.type === "bars" && ins.chart.bars.map((b) => b.label)).toEqual(["Bush 2001", "Obama 2009", "Trump 2017", "Biden 2021", "Trump 2025"]);
    expect(ins?.facts[0]!.id).toBe("term_2025-01-20");
    expect(verifyInsight(ins!, indexFor(rows))).toEqual([]);
    expect(checkCaption(ins!.template, ins!.facts)).toEqual([]);
  });

  it("sums a flow over the same full months of each term", () => {
    const { series, rows } = monthly(Array.from({ length: 12 * 26 + 8 }, () => 10), { kind: "flow" });
    const [ins] = detectTermComparison(series, ADMINS);
    const bars = ins!.chart.type === "bars" ? ins!.chart.bars : [];
    // Feb 2025..Aug 2026 = 19 months at 10 each, same span for every term.
    expect(bars.every((b) => b.value === 190)).toBe(true);
    expect(ins!.facts.find((f) => f.id === "full_months")?.text).toBe("19");
    expect(verifyInsight(ins!, indexFor(rows))).toEqual([]);
  });

  it("needs at least three terms with data (never a two-way comparison)", () => {
    const { series } = monthly(Array.from({ length: 80 }, () => 10), { kind: "flow" }, "2019-10-01");
    expect(detectTermComparison(series, ADMINS)).toEqual([]);
  });

  it("counts records in the first N days of each term, leaving out terms that start before coverage", () => {
    const events: EventSet["events"] = [];
    const rows: Record<string, unknown>[] = [];
    let n = 0;
    for (const a of ADMINS) for (let d = 0; d < 5; d++) {
      const date = addMonths(a.start, d).slice(0, 8) + "21";
      rows.push({ id: ++n });
      events.push({ date, cell: { file: FILE, key: { id: n }, field: "__row" } });
    }
    const set: EventSet = { id: "eo", dataset: "executive_orders", name: "executive orders", title: "Executive orders signed", verb: "signed", events, coverageStart: "2005-01-01", url: "/x", source: "Federal Register", weight: 1 };
    const [ins] = detectEventTermComparison(set, ADMINS, "2025-04-30");
    // 100 days in: Feb 21, Mar 21, Apr 21 (Jan 21 too) of each term = 4; Bush 2001 left out.
    expect(ins?.chart.type === "bars" && ins.chart.bars.map((b) => [b.label, b.value])).toEqual([
      ["Obama 2009", 4],
      ["Trump 2017", 4],
      ["Biden 2021", 4],
      ["Trump 2025", 4],
    ]);
    expect(verifyInsight(ins!, indexFor(rows))).toEqual([]);
    expect(checkCaption(ins!.template, ins!.facts)).toEqual([]);
  });
});

describe("verify", () => {
  it("fails a fact whose cell value changed or whose row is missing", () => {
    const values = [...flat(80), 150];
    const { series, rows } = monthly(values);
    const [ins] = detectExtremes(series);
    const changed = rows.map((r) => (r.date === "2006-09-01" ? { ...r, value: 151 } : r));
    expect(verifyInsight(ins!, indexFor(changed))[0]).toMatch(/latest_value: data gives 151/);
    expect(verifyInsight(ins!, indexFor(rows.slice(0, -1)))[0]).toMatch(/0 rows/);
  });
});

describe("checkCaption", () => {
  const facts = [{ text: "$4.33 a gallon" }, { text: "39%" }, { text: "January 20, 2025" }, { text: "13.61 million barrels a day" }];

  it("tokenizes numbers with percent signs and scale words", () => {
    expect(numberTokens("Up 12 percent to $3.12, or 13.6 million barrels; 1,234 in 2025.")).toEqual(["12%", "3.12", "13.6 million", "1234", "2025"]);
  });

  it("accepts a caption that uses only fact numbers", () => {
    expect(checkCaption("The average price of regular gas was $4.33 a gallon, up 39% since January 20, 2025.", facts)).toEqual([]);
  });

  it("leaves method notes to the chart", () => {
    expect(checkCaption("The average price of regular gas was $4.33 a gallon, up 39% since January 20, 2025, in seasonally adjusted Census data.", facts).join()).toMatch(/method note/);
    expect(checkCaption("The average price of regular gas was $4.33 a gallon, not adjusted for inflation.", facts).join()).toMatch(/method note/);
  });

  it("rejects numbers that are not facts, including re-rounded ones", () => {
    expect(checkCaption("The average price of regular gas was $4.33 a gallon, up 40% since January 20, 2025.", facts).join()).toMatch(/numbers not among the facts: 40%/);
    expect(checkCaption("Crude oil production hit 13.6 million barrels a day as gas reached $4.33 a gallon.", facts).join()).toMatch(/13.6 million/);
  });

  it("rejects loaded words, causal claims, spelled-out quantities, links and the missing headline number", () => {
    const errs = checkCaption("Gas prices soared 39% because of Republicans and nearly doubled! See https://x.com", facts).join(" | ");
    expect(errs).toMatch(/soared/);
    expect(errs).toMatch(/republicans/);
    expect(errs).toMatch(/because of/);
    expect(errs).toMatch(/doubled/);
    expect(errs).toMatch(/link/);
    expect(errs).toMatch(/headline number/);
  });

  it("rejects a term comparison that names some earlier terms but not all", () => {
    const { series } = monthly(Array.from({ length: 12 * 26 + 8 }, (_, i) => 100 + i));
    const ins = detectTermComparison(series, ADMINS)[0]!;
    const cur = ins.facts[0]!.text;
    const at = (id: string) => ins.facts.find((f) => f.id === `term_${id}`)!.text;
    expect(checkCaption(`Test output rose ${cur} in the term that began January 20, 2025; at the same point the 2021 term was up ${at("2021-01-20")}.`, ins.facts).join()).toMatch(/names 1 of the 4 earlier terms/);
    expect(checkCaption(`Test output rose ${cur} in the term that began January 20, 2025; Biden's was up ${at("2021-01-20")}.`, ins.facts).join()).toMatch(/names 1 of the 4/);
    expect(checkCaption(`Test output rose ${cur} in the term that began January 20, 2025, Trump's second.`, ins.facts)).toEqual([]);
  });

  it("caps the length", () => {
    expect(checkCaption(`Gas was $4.33 a gallon. ${"x".repeat(300)}`, facts).join()).toMatch(/limit/);
  });
});

describe("collect", () => {
  it("runs term comparisons quarterly: quarter-end months, and only the first week of one for weekly data", () => {
    expect(termComparisonDue("monthly", "2026-09-01", "2026-08-01")).toBe(true);
    expect(termComparisonDue("monthly", "2026-08-01", "2026-07-01")).toBe(false);
    expect(termComparisonDue("weekly", "2026-09-07", "2026-08-31")).toBe(true);
    expect(termComparisonDue("weekly", "2026-09-14", "2026-09-07")).toBe(false);
    const { series } = monthly(Array.from({ length: 12 * 26 + 8 }, (_, i) => 100 + i));
    const kinds = (d: string) => seriesInsightsAt(series, ADMINS, [d]).map((i) => i.kind);
    expect(kinds("2026-06-01")).toContain("term_comparison");
    expect(kinds("2026-07-01")).not.toContain("term_comparison");
  });

  it("keeps the routine latest reading only when nothing else came out of that series and period", () => {
    const { series } = monthly([...flat(120), 100.1], { headline: true });
    expect(seriesInsightsAt(series, ADMINS, ["2010-01-01"]).map((i) => i.kind)).toEqual(["latest"]);
    const jump = monthly([...flat(120), 150], { headline: true }).series;
    expect(seriesInsightsAt(jump, ADMINS, ["2010-01-01"]).map((i) => i.kind)).not.toContain("latest");
  });

  it("lists month ends after a date up to the last full month", () => {
    expect(newMonthEnds("2026-08-14", "2026-10-20")).toEqual(["2026-08-31", "2026-09-30"]);
    expect(newMonthEnds("2026-09-30", "2026-10-20")).toEqual([]);
  });

  it("keeps one insight per series and kind and caps per series and dataset", () => {
    const mk = (id: string, seriesId: string, kind: Insight["kind"], period: string, score: number): Insight => ({
      ...detectExtremes(monthly([...flat(80), 150]).series)[0]!,
      id,
      seriesId,
      kind,
      period,
      score,
    });
    const picked = selectInsights(
      [mk("a1", "a", "extreme_low", "2026-01-01", 5), mk("a2", "a", "extreme_low", "2026-02-01", 9), mk("a3", "a", "term_comparison", "2026-01-01", 20), mk("a4", "a", "term_comparison", "2026-02-01", 6), mk("b1", "b", "move_up", "2026-01-01", 1)],
      { max: 10, perSeries: 5, perDataset: 2 },
    );
    expect(picked.map((i) => i.id)).toEqual(["a2", "a4"]);
  });

  it("produces event insights at month ends", () => {
    const set: EventSet = { id: "laws", dataset: "laws", name: "public laws", title: "Laws passed", verb: "enacted", events: [], coverageStart: "1973-01-03", url: "/congress/laws", source: "Congress.gov", weight: 1 };
    expect(eventInsightsAt(set, ADMINS, ["2026-09-30"]).map((i) => i.kind)).toEqual(["term_comparison"]);
  });
});

describe("issue and poster", () => {
  const { series } = monthly([...flat(80), 150]);
  const ins = detectExtremes(series)[0]!;
  const draft: Draft = {
    id: ins.id,
    slug: "x",
    dataset: ins.dataset,
    kind: ins.kind,
    period: ins.period,
    headline: ins.headline,
    title: ins.title,
    caption: ins.template,
    caption_source: "template",
    caption_model: null,
    link: "https://insidegov.fyi/presidency/energy",
    post_text: `${ins.template}\n\nhttps://insidegov.fyi/presidency/energy`,
    image: "x.png",
    alt: "Line chart -- with a double dash",
    source: ins.source,
    score: 1,
    facts: ins.facts.map((f) => ({ id: f.id, text: f.text, derivation: f.derivation })),
    template: ins.template,
    series_id: ins.seriesId,
    frequency: ins.frequency,
    release: null,
  };

  it("round-trips the hidden draft block, even with -- in the text", () => {
    const body = issueBody(draft, "https://example.org/x.png");
    const block = parseDraftBlock(body);
    expect(block?.caption).toBe(draft.caption);
    expect(block?.alt).toBe(draft.alt);
    expect(checkCaption(block!.caption, block!.facts)).toEqual([]);
    expect(issueTitle(draft)).toMatch(new RegExp(`\\[${ins.id}\\]$`));
  });

  it("the template caption passes its own check", () => {
    expect(templateCaption(ins)).toMatchObject({ source: "template" });
  });

  it("builds a Bluesky record with the link facet at UTF-8 byte offsets", () => {
    const blob = { $type: "blob" as const, ref: { $link: "cid" }, mimeType: "image/png", size: 1 };
    const rec = buildPostRecord("Prices – up 5%", "https://insidegov.fyi/x", blob, "alt", "2026-10-20T00:00:00Z");
    const bytes = Buffer.from(rec.text, "utf8");
    const { byteStart, byteEnd } = rec.facets[0]!.index;
    expect(bytes.subarray(byteStart, byteEnd).toString("utf8")).toBe("https://insidegov.fyi/x");
    expect(graphemes(rec.text)).toBeLessThanOrEqual(300);
    expect(() => buildPostRecord("x".repeat(290), "https://insidegov.fyi/x", blob, "alt", "")).toThrow(/graphemes/);
  });
});

describe("truncate", () => {
  it("cuts a series at a date", () => {
    const { series } = monthly(flat(24));
    expect(truncate(series, "2000-06-01").points.at(-1)?.date).toBe("2000-06-01");
  });
});

describe("detectLatest", () => {
  it("gives the newest value with its change on the period and on the year, for headline series only", () => {
    const values = [...flat(119), 100, 110];
    const { series, rows } = monthly(values, { headline: true });
    const [ins] = detectLatest(series);
    expect(ins?.kind).toBe("latest");
    expect(ins?.template).toBe("Test output: 110.0 units in January 2010, up 10% from December 2009 and up 9.8% from a year earlier (100.2 units).");
    expect(verifyInsight(ins!, indexFor(rows))).toEqual([]);
    expect(checkCaption(ins!.template, ins!.facts)).toEqual([]);
    expect(detectLatest(monthly(values).series)).toEqual([]);
  });

  it("leaves out the period change for seasonal series", () => {
    const [ins] = detectLatest(monthly([...flat(119), 100, 110], { headline: true, seasonal: true }).series);
    expect(ins?.template).not.toMatch(/December 2009/);
  });
});

describe("breakdowns", () => {
  it("traces every electricity and trade breakdown number to the data", async () => {
    const { loadDataset } = await import("./datasets");
    const { withBreakdown } = await import("./breakdown");
    const energy = loadDataset("energy").series;
    const trade = loadDataset("trade").series;
    const index = new CellIndex();
    const base = { kind: "latest", frequency: "monthly", facts: [], source: "S", chart: { type: "line", points: [], marks: [] } } as never as Insight;
    const lastPower = energy.find((s) => s.id === "energy.power_total")!.points.at(-1)!.date;
    const power = withBreakdown({ ...base, id: "p", dataset: "energy", seriesId: "energy.power_total", period: lastPower }, energy);
    expect(power.breakdown?.blocks).toHaveLength(2);
    expect(power.breakdown?.blocks[0]!.rows.map((r) => r.name)).toContain("Natural gas");
    expect(verifyInsight(power, index)).toEqual([]);
    const lastTrade = trade.find((s) => s.id === "trade.deficit")!.points.at(-1)!.date;
    const deficit = withBreakdown({ ...base, id: "t", dataset: "trade", seriesId: "trade.deficit", period: lastTrade }, trade);
    expect(deficit.breakdown?.blocks[0]!.rows).toHaveLength(5);
    expect(verifyInsight(deficit, index)).toEqual([]);
    expect(withBreakdown({ ...base, id: "g", dataset: "gas", seriesId: "gas.regular", period: lastTrade }, []).breakdown).toBeUndefined();
  });
});

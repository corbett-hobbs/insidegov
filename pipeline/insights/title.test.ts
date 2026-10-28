import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { detectEventTermComparison, detectSeries } from "./detect";
import { DATASETS, loadAdministrations, loadDataset } from "./datasets";
import { buildDrafts } from "./drafts";
import { seriesContext, tariffContext } from "./news/charts";
import { axisProblems, chartTitle, titleProblems } from "./title";
import { eventInsightsAt, newMonthEnds } from "./collect";
import type { Insight } from "./types";

/**
 * The standing rule for every chart: a plain, human title; method and fine print as data notes beside the source; the
 * axis label only the unit. These tests run every generator on the real data, so a new series or chart type that breaks
 * the rule fails here, and buildDrafts refuses it at run time.
 */

describe("title rule", () => {
  it("flags method, explanations and punctuation in a title, and passes plain ones", () => {
    // The titles that read as methodology rather than as what the chart is.
    for (const bad of [
      "U.S. real GDP growth from a year earlier, 2016 to 2026",
      "The federal budget deficit, with a surplus shown as negative",
      "The monthly change in U.S. nonfarm payroll employment, 2016 to 2026",
      "U.S. goods trade deficit (seasonally adjusted)",
      "Consumer price index, year-over-year",
      "Gas prices: regular, not adjusted for inflation",
    ]) expect(titleProblems(bad), bad).not.toEqual([]);
    for (const good of ["Inflation, 2016 to 2026", "Jobs added each month, 2021 to 2026", "The federal deficit by fiscal year", "U.S. electricity generation each August", "Tariffs on Canada vs. all countries", "Mortgage rates, 2016 to 2026"]) {
      expect(titleProblems(good), good).toEqual([]);
    }
    expect(axisProblems("billions of dollars a month, seasonally adjusted")).not.toEqual([]);
    expect(axisProblems("billions of dollars a month")).toEqual([]);
  });

  it("builds a title from the subject: a line gets its range, bars what each bar is", () => {
    const line = { type: "line" as const, unit: { scale: 1, decimals: 0, suffix: "" }, axisLabel: "x", frequency: "monthly" as const, points: [{ date: "2016-03-01", value: 1 }], marks: [] };
    const bars = { type: "bars" as const, unit: null, axisLabel: "x", bars: [], orientation: "vertical" as const };
    expect(chartTitle("Inflation", line, { frequency: "monthly", seasonal: false, latest: "2026-09-01" })).toBe("Inflation, 2016 to 2026");
    expect(chartTitle("The federal deficit", bars, { frequency: "fiscal_year", seasonal: false, latest: "2026-09-30" })).toBe("The federal deficit by fiscal year");
    expect(chartTitle("Household income", bars, { frequency: "annual", seasonal: false, latest: "2025-01-01" })).toBe("Household income by year");
    expect(chartTitle("U.S. electricity generation", bars, { frequency: "monthly", seasonal: true, latest: "2026-08-01" })).toBe("U.S. electricity generation each August");
  });
});

describe("every chart the pipeline can draw follows it", () => {
  const admins = loadAdministrations();
  const loaded = DATASETS.map((d) => loadDataset(d));
  const series = loaded.flatMap((l) => l.series);
  const insights: Insight[] = [];
  for (const s of series) {
    // The data-release detectors at the newest period and a few earlier ones, and the news context chart.
    const dates = s.points.slice(-6).map((p) => p.date);
    for (const d of dates) {
      const cut = { ...s, points: s.points.filter((p) => p.date <= d) };
      if (cut.points.length > 24) insights.push(...detectSeries(cut, admins));
    }
    for (const peak of [true, false]) {
      const i = seriesContext(s, { years: 10, peak, lead: "X is in the news.", id: `n:${s.id}` });
      if (i) insights.push(i);
    }
  }
  for (const set of loaded.flatMap((l) => l.events)) insights.push(...eventInsightsAt(set, admins, newMonthEnds("2025-12-31", "2026-10-15")), ...detectEventTermComparison(set, admins, "2026-09-30"));
  for (const c of [undefined, { code: "CAN", name: "Canada" }, { code: "SAU", name: "Saudi Arabia" }]) {
    const i = tariffContext(c, { lead: "X is in the news.", id: "n:tariff" });
    if (i) insights.push(i);
  }

  it("has titles and data notes on every series, written as plain words", () => {
    expect(series.length).toBeGreaterThan(30);
    for (const s of series) {
      expect(titleProblems(s.title), `${s.id}: "${s.title}"`).toEqual([]);
      expect(axisProblems(s.axisLabel), `${s.id} axis`).toEqual([]);
      if (s.totalAxisLabel) expect(axisProblems(s.totalAxisLabel), `${s.id} total axis`).toEqual([]);
    }
    for (const set of loaded.flatMap((l) => l.events)) expect(titleProblems(set.title), set.id).toEqual([]);
  });

  it("draws only titles and axis labels that pass, for every kind of insight", () => {
    expect(insights.length).toBeGreaterThan(100);
    const kinds = new Set(insights.map((i) => i.kind));
    for (const k of ["extreme_high", "move_up", "term_comparison", "latest", "news"]) expect(kinds.has(k as Insight["kind"]), k).toBe(true);
    for (const i of insights) {
      expect(titleProblems(i.title), `${i.id}: "${i.title}"`).toEqual([]);
      expect(i.chart.axisLabel ? axisProblems(i.chart.axisLabel) : [], `${i.id} axis`).toEqual([]);
    }
  });

  it("carries every series' data note onto its charts, to print beside the source", () => {
    const noteOf = new Map(series.map((s) => [s.id, s.note]));
    expect(series.filter((s) => s.note).length).toBeGreaterThan(20);
    for (const i of insights) if (noteOf.has(i.seriesId)) expect(i.note, i.id).toBe(noteOf.get(i.seriesId));
  });

  it("titles the cards the way a reader would say them", () => {
    const title = (id: string, peak = true) => seriesContext(series.find((s) => s.id === id)!, { years: 10, peak, lead: "X.", id: "n" })!.title;
    expect(title("economy.inflation")).toMatch(/^Inflation, \d{4} to \d{4}$/);
    expect(title("economy.jobs_added", false)).toMatch(/^Jobs added each month, \d{4} to \d{4}$/);
    expect(title("economy.gdp_growth")).toMatch(/^Economic growth, \d{4} to \d{4}$/);
    expect(title("economy.deficit")).toBe("The federal deficit by fiscal year");
    expect(title("economy.household_income")).toBe("Household income by year");
    expect(title("energy.power_total")).toMatch(/^U\.S\. electricity generation each \w+$/);
    expect(tariffContext({ code: "CAN", name: "Canada" }, { lead: "X.", id: "n" })!.title).toBe("Tariffs on Canada vs. all countries");
  });

  it("puts the method beside the source: the jobs, deficit and GDP notes carry what the titles leave out", () => {
    const note = (id: string) => series.find((s) => s.id === id)!.note ?? "";
    expect(note("economy.jobs_added")).toMatch(/Nonfarm payrolls/);
    expect(note("economy.deficit")).toMatch(/surplus shows as negative/i);
    expect(note("economy.gdp_growth")).toMatch(/change from a year earlier/);
    expect(note("trade.deficit")).toMatch(/Seasonally adjusted/);
    expect(tariffContext(undefined, { lead: "X.", id: "n" })!.note).toMatch(/Duties collected/);
  });
});

describe("renderers", () => {
  it("draw Insight.title, never the headline, so a new chart type cannot skip the rule", () => {
    for (const file of ["chart.tsx", "carousel.tsx"]) {
      const src = readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
      expect(src.match(/insight\.headline/g) ?? [], file).toEqual([]);
    }
  });

  it("refuses a draft whose title breaks the rule", async () => {
    const s = loadDataset("gas").series.find((x) => x.id === "economy.inflation")!;
    const good = seriesContext(s, { years: 10, peak: true, lead: "X is in the news.", id: "n:bad" })!;
    const { drafts, dropped } = await buildDrafts([{ ...good, title: "The monthly change in U.S. nonfarm payroll employment" }], { outDir: "/private/tmp/claude-501/title-guard", useLlm: false, log: () => {} });
    expect(drafts).toEqual([]);
    expect(dropped[0]).toMatch(/breaks the title rule.*nonfarm/);
  });
});

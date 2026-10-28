import { describe, expect, it } from "vitest";
import { templateCaption } from "../caption";
import { seriesInsightsAt } from "../collect";
import { monthlyChange, realHourlyEarnings, yearOverYearPercent } from "../../../lib/indicator-derive";
import { DATASETS, loadAdministrations, loadDataset, readOutput } from "../datasets";
import type { Headline } from "../types";
import { CellIndex, verifyInsight } from "../verify";
import { type Candidate, topicOf } from "./cards";
import { seriesContext } from "./charts";
import { slidePlan } from "../carousel";
import { planThread } from "../thread";
import { whyPrompt } from "../research";
import { partnersFor } from "./match";
import { outletById } from "./outlets";
import { coverageLine, couldDraft, hasRecent, isCurrent, postableCharts, powerSource, socialBuild, socialStories } from "./social";
import { COUNTRY_ALIASES, NEWS_PAGES, PAGE_CHARTS, PAGE_TOPICS } from "./topics";

const NOW = "2026-10-27T18:00:00.000Z";
const hoursAgo = (hrs: number) => new Date(Date.parse(NOW) - hrs * 3_600_000).toISOString();
let n = 0;
const h = (outletId: string, title: string, published = hoursAgo(2)): Headline => ({ title, source: outletById.get(outletId)?.name ?? outletId, url: `https://example.com/${outletId}/${++n}`, published, feed: "outlets", outletId });
const topic = (id: string) => PAGE_TOPICS.find((t) => t.id === id)!;
const cand = (id: string, headlines: Headline[], key = id): Candidate => ({ topic: topic(id), key, headlines });
const PARTNERS = partnersFor([{ code: "CAN", name: "Canada" }], COUNTRY_ALIASES);

describe("news-only series", () => {
  const admins = loadAdministrations();
  const all = DATASETS.flatMap((d) => loadDataset(d).series);

  it("marks every weekly series and every single electricity source news-only", () => {
    const weekly = all.filter((s) => s.frequency === "weekly").map((s) => s.id);
    expect(weekly.sort()).toEqual(["economy.fed_funds", "economy.mortgage_rate", "economy.treasury_10y", "energy.spr", "gas.diesel", "gas.regular"]);
    for (const s of all) {
      if (s.frequency === "weekly" || /^energy\.power_(coal|gas|nuclear|wind|solar)$/.test(s.id)) expect(s.newsOnly, s.id).toBe(true);
    }
    // The summary stat is not: total generation keeps its release-day post.
    expect(all.find((s) => s.id === "energy.power_total")!.newsOnly).toBeUndefined();
  });

  it("drafts nothing from a data release for a news-only series, however notable the reading", () => {
    for (const s of all.filter((x) => x.newsOnly)) {
      const dates = s.points.map((p) => p.date);
      expect(seriesInsightsAt(s, admins, dates), s.id).toEqual([]);
    }
    // ...while the total still does (the routine reading at least).
    const total = all.find((s) => s.id === "energy.power_total")!;
    expect(seriesInsightsAt(total, admins, [total.points.at(-1)!.date]).length).toBeGreaterThan(0);
  });

  it("still charts a news-only series for a story, with facts that verify", () => {
    const ids = ["gas.diesel", "energy.spr", "energy.power_solar", "energy.petroleum_imports", ...all.filter((s) => s.id.startsWith("economy.")).map((s) => s.id)];
    for (const id of ids) {
      const series = all.find((s) => s.id === id)!;
      const insight = seriesContext(series, { years: 10, peak: id !== "economy.jobs_added" && id !== "economy.debt", lead: "X is in the news.", id: `news:${id}:2026-10-27` })!;
      expect(insight, id).not.toBeNull();
      expect(verifyInsight(insight, new CellIndex()), id).toEqual([]);
      expect(templateCaption(insight)).toMatchObject({ source: "template" });
      expect(insight.anchor ?? "", id).toMatch(/^(#[a-z-]+)?$/);
    }
  });

  it("writes a rate's change in percentage points, never as a percent", () => {
    const series = loadDataset("gas").series.find((s) => s.id === "economy.unemployment")!;
    // Trim to a rising series so the latest value is the peak and the year-earlier clause is used.
    const rising = { ...series, points: series.points.slice(-60).map((p, i) => ({ ...p, value: 3 + i * 0.05 })) };
    const text = seriesContext(rising, { years: 10, peak: true, lead: "Unemployment is in the news.", id: "news:u" })!.template;
    expect(text).toMatch(/up [\d.]+ percentage points from a year earlier/);
  });
});

describe("the Economy page's cards as series", () => {
  const all = DATASETS.flatMap((d) => loadDataset(d).series);
  const economy = all.filter((s) => s.id.startsWith("economy."));
  const rows = readOutput<Record<string, unknown>[]>("pipeline/output/indicator_observations.json");
  const pts = (id: string) => rows.filter((r) => r.series_id === id).map((r) => ({ date: String(r.date), value: r.value as number })).sort((a, b) => a.date.localeCompare(b.date));

  it("has a series for every card but the misery index, all news-only", () => {
    expect(economy.map((s) => s.id).sort()).toEqual(["economy.debt", "economy.deficit", "economy.fed_funds", "economy.gdp_growth", "economy.household_income", "economy.inflation", "economy.jobs_added", "economy.mortgage_rate", "economy.real_earnings", "economy.treasury_10y", "economy.unemployment"]);
    for (const s of economy) {
      expect(s.newsOnly, s.id).toBe(true);
      expect(s.anchor, s.id).toMatch(/^#chart-/);
      expect(PAGE_CHARTS.economy.map((c) => c.id), s.id).toContain(s.anchor!.slice(1));
    }
  });

  it("traces every point to the rows it came from, derived values included", () => {
    const index = new CellIndex();
    for (const s of economy) {
      expect(s.points.length, s.id).toBeGreaterThan(20);
      for (const p of s.points) expect(index.sum(p.cells), `${s.id} ${p.date}`).toBeCloseTo(p.value, 6);
    }
  });

  it("computes inflation, jobs added and real pay as the page does (lib/indicator-derive.ts)", () => {
    const at = (id: string) => all.find((s) => s.id === id)!.points.at(-1)!;
    const infl = yearOverYearPercent(pts("CPIAUCSL")).filter((p) => p.value !== null).at(-1)!;
    expect(at("economy.inflation")).toMatchObject({ date: infl.date, value: infl.value });
    const jobs = monthlyChange(pts("PAYEMS")).filter((p) => p.value !== null).at(-1)!;
    expect(at("economy.jobs_added")).toMatchObject({ date: jobs.date, value: jobs.value });
    const pay = realHourlyEarnings(pts("AHETPI"), pts("CPIAUCSL")).points.filter((p) => p.value !== null).at(-1)!;
    expect(at("economy.real_earnings")).toMatchObject({ date: pay.date, value: pay.value });
  });

  it("merges Treasury's newer deficit and debt after FRED's, as the page does", () => {
    const treasury = readOutput<{ deficit: { fiscal_year: number; value: number }[]; debt: { date: string; total: number }[] }>("pipeline/output/treasury_fiscal.json");
    const fredDeficit = pts("FYFSD").at(-1)!;
    const deficit = all.find((s) => s.id === "economy.deficit")!;
    const newerYears = treasury.deficit.filter((d) => `${d.fiscal_year}-09-30` > fredDeficit.date);
    expect(deficit.points.at(-1)!.date).toBe(`${(newerYears.at(-1) ?? { fiscal_year: Number(fredDeficit.date.slice(0, 4)) }).fiscal_year}-09-30`);
    // FRED wins where it has a value; a deficit reads positive.
    expect(deficit.points.find((p) => p.date === fredDeficit.date)!.value).toBe(-fredDeficit.value);
    const fredDebt = pts("GFDEBTN").at(-1)!;
    const debt = all.find((s) => s.id === "economy.debt")!;
    expect(debt.points.find((p) => p.date === fredDebt.date)!.value).toBe(fredDebt.value);
    expect(debt.points.at(-1)!.date).toBe([fredDebt.date, ...treasury.debt.map((d) => d.date)].sort().at(-1));
  });

  it("writes quarters as Q1 2026, years as 2025, and rate changes in percentage points", () => {
    const text = (id: string, peak = true) => seriesContext(all.find((s) => s.id === id)!, { years: 10, peak, lead: "X is in the news.", id: "n" })!.template;
    expect(text("economy.gdp_growth")).toMatch(/ stood at -?[\d.]+% in Q[1-4] \d{4}/);
    expect(text("economy.debt", false)).toMatch(/\$[\d.]+T in Q[1-4] \d{4}, (up|down) from \$[\d.]+T in Q[1-4] \d{4} and (up|down) [\d.]+% from a year earlier/);
    expect(text("economy.household_income", false)).toMatch(/\$[\d,]+ in \d{4}/);
    expect(text("economy.jobs_added", false)).toMatch(/ jobs in \w+ \d{4}, (up|down) from [\d,-]+ jobs in \w+ and (up|down) [\d,]+ jobs from a year earlier/);
    expect(text("economy.inflation", false)).toMatch(/percentage points from a year earlier/);
  });
});

describe("a Fed rate decision story", () => {
  const all = DATASETS.flatMap((d) => loadDataset(d).series);
  const g = (id: string) => all.find((s) => s.id === id)!;
  const route = (title: string) => topicOf(title, PAGE_TOPICS, [])?.key;

  it("goes to the Fed topic even when the headline says inflation, while inflation news stays inflation", () => {
    expect(route("Fed holds interest rates steady even as inflation remains high")).toBe("fed_rates");
    expect(route("Federal Reserve leaves interest rates unchanged despite rising inflation")).toBe("fed_rates");
    expect(route("CPI rises 3.7% in September")).toBe("inflation");
    expect(route("Inflation hits 3.7% as Fed weighs rates")).toBe("inflation");
  });

  it("charts the federal funds rate with inflation beside it, traced to the data", () => {
    const insight = seriesContext(g("economy.fed_funds"), { years: 10, peak: true, lead: "X is in the news.", id: "n", compare: g("economy.inflation") })!;
    expect(insight.template).toMatch(/federal funds rate was \d\.\d% in the week of .*(unchanged|(up|down) from \d\.\d%) a? ?.*month earlier.*peak of \d\.\d% in .*\. Inflation was \d\.\d% in \w+ \d{4}, (up|down) from \d\.\d%/);
    expect(insight.title).toBe("The federal funds rate and inflation, 2016 to 2026");
    expect(insight.chart.type === "line" && insight.chart.comparison?.points.length).toBeGreaterThan(1);
    expect(verifyInsight(insight, new CellIndex())).toEqual([]);
    // The carousel's bigger-picture card: each line's peak, low and latest as traced facts, shown as levels.
    expect(insight.alsoSeriesId).toBe("economy.inflation");
    expect(insight.breakdown?.levels).toBe(true);
    expect(insight.breakdown?.blocks.map((b) => b.rows.length)).toEqual([3, 3]);
    for (const row of insight.breakdown!.blocks.flatMap((b) => b.rows)) expect(insight.facts.some((f) => f.id === row.fact), row.fact).toBe(true);
  });

  it("is researched like a data release, from the story's headlines, and its why stays out of the caption", () => {
    const insight = seriesContext(g("economy.fed_funds"), { years: 10, peak: true, lead: "X is in the news.", id: "n", compare: g("economy.inflation") })!;
    const news = { topic: "fed_rates", key: "fed_rates", seenAt: NOW, expiresAt: NOW, reason: "test", headlines: [{ title: "Fed holds rates", source: "CBS News", url: "https://www.cbsnews.com/x", published: NOW, feed: "outlets" as const, outletId: "cbsnews" }] };
    const prompt = JSON.parse(whyPrompt({ ...insight, news }));
    expect(prompt.in_the_news[0].url).toBe("https://www.cbsnews.com/x");
    expect(prompt.release_pages.join(" ")).toMatch(/federalreserve\.gov/);
    const why = { title: "Why it held", captionLine: "x", paragraphs: ["Words only."], sources: [{ name: "FOMC", url: "https://www.federalreserve.gov/x" }] };
    const kinds = slidePlan({ ...insight, kind: "news", why }).map((s) => s.kind);
    expect(kinds).toEqual(expect.arrayContaining(["why", "explainer"]));
    // The same thread as a data draft: why, the bigger-picture levels (unsigned, with a chart), what it measures, sources.
    const plan = planThread({ ...insight, kind: "news", why })!;
    const texts = plan.replies.map((r) => r.text);
    expect(texts.some((t) => t.startsWith("Why it held."))).toBe(true);
    expect(texts.some((t) => /Where each stands/.test(t) && /Peak, \d{4} \d\.\d%/.test(t) && !/\+\d/.test(t))).toBe(true);
    expect(plan.replies.filter((r) => r.chart !== undefined)).toHaveLength(2);
    expect(texts.some((t) => /federal funds rate is the interest rate/.test(t)) && texts.some((t) => /^Inflation is how much/.test(t))).toBe(true);
    expect(texts.at(-1)).toMatch(/^Data: /);
  });
});

describe("which stories become posts", () => {
  it("gives each topic its chart: the social topics', the extras, and nothing where the site has no series", () => {
    expect(socialBuild(cand("diesel", []), [])!.build).toMatchObject({ seriesId: "gas.diesel" });
    expect(socialBuild(cand("venezuela_oil", []), [])!).toMatchObject({ build: { seriesId: "energy.petroleum_imports" }, note: expect.stringContaining("not Venezuela alone") });
    expect(socialBuild(cand("tariff", [], "tariff.CAN"), [])!.build.kind).toBe("tariff");
    expect(socialBuild(cand("markets", []), [], "chart-mis")).toBeNull();
    expect(couldDraft(topic("diesel"))).toBe(true);
    expect(couldDraft(topic("green_cards"))).toBe(false);
    expect(couldDraft(topic("diesel"))).toBe(true);
    // A chartless story with a chart picked from the page's charts takes that chart, keyed by the chart's topic.
    expect(socialBuild(cand("markets", []), [], "chart-mort")).toMatchObject({ build: { seriesId: "economy.mortgage_rate" }, key: "mortgage" });
    expect(socialBuild(cand("markets", []), [], "chart-infl")).toMatchObject({ build: { seriesId: "economy.inflation" }, key: "inflation" });
    // The Economy page's cards each have one: a jobs-report headline gets the payroll change, not the unemployment rate.
    const economy: Record<string, string> = { inflation: "economy.inflation", jobs: "economy.jobs_added", gdp: "economy.gdp_growth", wages: "economy.real_earnings", income: "economy.household_income", deficit: "economy.deficit", debt: "economy.debt", unemployment: "economy.unemployment", mortgage: "economy.mortgage_rate", fed_rates: "economy.fed_funds", treasury_yields: "economy.treasury_10y" };
    for (const [id, seriesId] of Object.entries(economy)) expect(socialBuild(cand(id, []), [])!.build, id).toMatchObject({ seriesId });
    expect(socialBuild(cand("jobs", []), [])!.lead()).toBe("The jobs report is in the news.");
    expect(topicOf("Economy adds 142,000 jobs as unemployment rate holds at 4.2%", PAGE_TOPICS, PARTNERS)!.topic.id).toBe("jobs");
    // The oil card shows imports and exports: never offered, never taken from a pick.
    expect(postableCharts("energy").map((c) => c.id)).not.toContain("oil");
    expect(socialBuild(cand("oil_markets", []), [], "oil")).toBeNull();
  });

  it("routes trade-talk headlines about a partner to the tariffs chart, ahead of Inflation, and leaves other trade news alone", () => {
    const of = (t: string) => topicOf(t, PAGE_TOPICS, PARTNERS);
    // Canada trade talks are tariff news for Canada even without the word "tariff", and even when the headline also says "inflation".
    expect(of("White House tempers its tough talk on Canada trade as inflation tops voter concerns")).toMatchObject({ key: "tariff.CAN", topic: { id: "tariff" } });
    expect(of("Canada reports limited progress in trade talks with US")).toMatchObject({ key: "tariff.CAN" });
    expect(of("US-Canada Trade Talks Are Picking Up Pace But No Deal Yet, Carney Says")).toMatchObject({ key: "tariff.CAN" });
    // A talks headline with no partner we track is the chartless trade-deals topic; the trade gap is the balance chart.
    expect(of("Uzbekistan-U.S. deepening trade relations after business summit")?.topic.id).toBe("trade_deals");
    expect(of("US Trade Gap Hits Widest Since March 2025 on Capital Goods")?.topic.id).toBe("trade_deficit");
    // Not trade talks: central bank news, trade-ins, the Canadian trade deficit, inflation on its own.
    expect(of("Bank of Canada Hikes to 2.5%, Says More Could Be Needed")).toBeNull();
    expect(of("Canada trade deficit widens in September")?.topic.id).not.toBe("tariff");
    expect(of("Inflation cools as consumer prices rise 2.9%")?.topic.id).toBe("inflation");
  });

  it("charts the one electricity source a story names, and nothing for a mixed or unnamed one", () => {
    const solar = [h("nbcnews", "Solar projects face new federal review"), h("foxnews", "Trump administration targets solar farms on federal land")];
    expect(powerSource(solar)!.build).toMatchObject({ seriesId: "energy.power_solar" });
    expect(powerSource(solar)!.lead()).toBe("Solar power is in the news.");
    expect(socialBuild(cand("power_sources", solar), solar)!.key).toBe("power_sources.solar");
    expect(powerSource([h("nbcnews", "Coal plants stay open as nuclear reactors restart")])).toBeNull();
    expect(powerSource([h("nbcnews", "Renewable energy faces a tax change")])).toBeNull();
    // A story about the grid as a whole is the total, not a source.
    expect(socialBuild(cand("electricity", []), [])!.build).toMatchObject({ seriesId: "energy.power_total" });
  });

  it("needs two outlets, a first headline from the last day, and a chart; one story per chart, the stronger first", () => {
    const two = [h("nbcnews", "Trump and Rubio visit tanker carrying Venezuelan crude"), h("nypost", "Trump brings Venezuelan oil to Texas")];
    const old = [h("nbcnews", "Venezuelan oil tanker docks", hoursAgo(40)), h("nypost", "Venezuelan oil arrives", hoursAgo(38))];
    const stories = socialStories(
      [
        { candidate: cand("venezuela_oil", two), headlines: two, reason: "same development" },
        { candidate: cand("diesel", [h("nbcnews", "Diesel prices jump")]), headlines: [h("nbcnews", "Diesel prices jump")] },
        { candidate: cand("gasoline", old), headlines: old },
        { candidate: cand("markets", two), headlines: two },
      ],
      NOW,
    );
    expect(stories.map((s) => s.key)).toEqual(["venezuela_oil"]);
    expect(stories[0]).toMatchObject({ outlets: 2, reason: "same development" });
    expect(isCurrent(old, NOW)).toBe(false);
    // A story running from days-old previews to today's decision is still worth the check (it drops the previews); one with nothing new is not.
    const preview = { ...old[0]!, published: "2026-10-25T12:00:00.000Z" };
    const decision = { ...old[0]!, published: "2026-10-27T17:00:00.000Z" };
    expect(isCurrent([preview, decision], NOW)).toBe(false);
    expect(hasRecent([preview, decision], NOW)).toBe(true);
    expect(hasRecent([preview], NOW)).toBe(false);

    // Tariffs naming one partner outrank tariffs in general, and only one of them is drafted.
    const t1 = [h("nbcnews", "Trump raises tariffs on Canada"), h("foxnews", "Canada tariffs take effect")];
    const t2 = [h("nbcnews", "Tariffs on imports rise"), h("foxnews", "New tariffs announced"), h("wsj", "Tariff changes hit importers")];
    const tariffs = socialStories(
      [
        { candidate: { ...cand("tariff", t2, "tariff.all"), country: undefined }, headlines: t2 },
        { candidate: { ...cand("tariff", t1, "tariff.CAN"), country: { code: "CAN", name: "Canada" } }, headlines: t1 },
      ],
      NOW,
    );
    expect(tariffs.map((s) => s.key)).toEqual(["tariff.CAN"]);
  });

  it("lists who covered a story, left to right, for the reviewer", () => {
    expect(coverageLine([h("nbcnews", "a"), h("wsj", "b"), h("nbcnews", "c")])).toBe("Lean Left NBC News, Center Wall Street Journal");
  });

  it("only offers the Claude check charts the site can post", () => {
    for (const page of NEWS_PAGES) for (const c of postableCharts(page)) expect(PAGE_TOPICS.some((t) => t.chartId === c.id), c.id).toBe(true);
    expect(postableCharts("economy").map((c) => c.id)).toEqual(expect.arrayContaining(["chart-gas", "chart-diesel", "chart-un", "chart-mort"]));
    // Every Economy card but the misery index (a derived blend no story names) can be charted.
    expect(postableCharts("economy").map((c) => c.id).sort()).toEqual(PAGE_CHARTS.economy.map((c) => c.id).filter((id) => id !== "chart-mis").sort());
  });
});

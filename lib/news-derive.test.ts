import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MAX_STORIES, OUTLET_LOGO_IDS, countsFor, formatStoryDate, hasEnoughOutlets, orderHeadlines, outletInitials, selectStories, toQuestionGroups, updatedLabel } from "./news-derive";
import { faqFile, newsFile, type Lean, type NewsHeadline, type NewsStory } from "./news-types";
import { ENERGY_CHARTS, energyFaq, energyNews } from "../components/energy/energy-news";
import { TRADE_CHARTS, tradeFaq } from "../components/trade/trade-news";
import { IMMIGRATION_CHARTS } from "../components/immigration/immigration-news";
import { SPECS } from "../components/economy/specs";
import { CHARTS_WITHOUT_TOPIC, PAGE_CHARTS, PAGE_TOPICS } from "../pipeline/insights/news/topics";
import { foreignAidFaq } from "../components/foreign-aid/foreign-aid-news";
import { troopsFaq } from "../components/troops/troops-news";
import { executiveOrdersFaq } from "../components/executive-orders/executive-orders-news";
import { LAWS_CHARTS, lawsFaq, lawsNews } from "../components/laws/laws-news";
import { DECISIONS_CHARTS, decisionsFaq, decisionsNews } from "../components/decisions/decisions-news";

const h = (lean: Lean, outletId = lean.replace(/\s/g, "").toLowerCase()): NewsHeadline => ({ outletId, outlet: outletId, lean, title: `${lean} headline`, url: "https://example.com/a" });
const story = (id: string, date: string, headlines: NewsHeadline[]): NewsStory => ({ id, date, topic: "Topic", chartId: "chart-gas", headlines });

describe("hasEnoughOutlets", () => {
  it("needs two outlets, of any lean", () => {
    expect(hasEnoughOutlets([h("Lean Left"), h("Lean Right")])).toBe(true);
    expect(hasEnoughOutlets([h("Left"), h("Lean Left")])).toBe(true);
    expect(hasEnoughOutlets([h("Center"), h("Right")])).toBe(true);
    expect(hasEnoughOutlets([h("Right")])).toBe(false);
  });
  it("does not count a data release as an outlet", () => {
    expect(hasEnoughOutlets([h("Data"), h("Lean Right")])).toBe(false);
    expect(hasEnoughOutlets([h("Data"), h("Left"), h("Right")])).toBe(true);
  });
  it("allows at most three headlines", () => {
    expect(hasEnoughOutlets([h("Data"), h("Left"), h("Right"), h("Center")])).toBe(false);
  });
});

describe("orderHeadlines", () => {
  it("puts the data release first, then left to right, keeping file order for ties", () => {
    const out = orderHeadlines([h("Right", "a"), h("Left", "b"), h("Data", "c"), h("Right", "d")]);
    expect(out.map((x) => x.outletId)).toEqual(["c", "b", "a", "d"]);
  });
});

describe("selectStories", () => {
  it("drops stories with fewer than two outlets, sorts newest first and orders each story's headlines", () => {
    const out = selectStories([
      story("old", "2026-10-01", [h("Right"), h("Left")]),
      story("one-outlet", "2026-10-30", [h("Data"), h("Lean Left")]),
      story("new", "2026-10-24", [h("Lean Right"), h("Data"), h("Lean Left")]),
    ]);
    expect(out.map((s) => s.id)).toEqual(["new", "old"]);
    expect(out[0].headlines.map((x) => x.lean)).toEqual(["Data", "Lean Left", "Lean Right"]);
  });
  it("shows at most six", () => {
    const many = Array.from({ length: 9 }, (_, i) => story(`s${i}`, `2026-10-${String(10 + i)}`, [h("Left"), h("Right")]));
    const out = selectStories(many);
    expect(out).toHaveLength(MAX_STORIES);
    expect(out[0].id).toBe("s8");
  });
});

describe("formatting", () => {
  it("words an ISO date as month and day, whatever the time zone", () => {
    expect(formatStoryDate("2026-10-24")).toBe("Oct 24");
    expect(formatStoryDate("2026-01-05")).toBe("Jan 5");
    expect(updatedLabel("2026-10-27")).toBe("Oct 27");
    expect(updatedLabel("")).toBeUndefined();
  });
  it("makes initials for an outlet without an icon", () => {
    expect(outletInitials("Washington Examiner")).toBe("WE");
    expect(outletInitials("The Hill")).toBe("H");
    expect(outletInitials("U.S. Customs and Border Protection")).toBe("UCB");
  });
});

describe("toQuestionGroups and countsFor", () => {
  const file = faqFile.parse({
    asOf: "2026-10-27",
    groups: [{ row: "Costs", items: [
      { id: "a", q: "Q?", a: "A.", sources: [], chartIds: ["chart-gas", "chart-nope"] },
      { id: "b", q: "Q2?", a: "A2.", sources: [], chartIds: [] },
    ] }],
  });
  const groups = toQuestionGroups(file, (id) => (id === "chart-gas" ? { target: id, label: "Gas" } : null));
  it("drops unknown chart ids but keeps the question", () => {
    expect(groups[0].items.map((i) => i.charts.length)).toEqual([1, 0]);
    expect(toQuestionGroups(null, () => null)).toEqual([]);
  });
  it("counts what points at a chart", () => {
    expect(countsFor("chart-gas", [{ chart: { target: "chart-gas" } }, { chart: { target: "chart-un" } }], groups)).toEqual({ questions: 1, news: 1 });
    expect(countsFor("chart-un", [], groups)).toEqual({ questions: 0, news: 0 });
  });
});

describe("outlet icons", () => {
  it("lists exactly the icons in public/outlet-logos", () => {
    const files = readdirSync(join(process.cwd(), "public", "outlet-logos")).filter((f) => f.endsWith(".png")).map((f) => f.replace(/\.png$/, ""));
    expect([...OUTLET_LOGO_IDS].sort()).toEqual(files.sort());
  });
});

describe("shipped files", () => {
  const read = (dir: string, f: string) => JSON.parse(readFileSync(join(process.cwd(), dir, f), "utf8"));
  // The pipelines fill these files (an approved FAQ publish, the news watcher), so they may be empty or not; they must parse.
  it("the shipped files parse, and every shipped story has enough outlets", () => {
    for (const p of ["economy", "immigration"]) {
      for (const s of newsFile.parse(read("pipeline/output", `news_${p}.json`)).stories) expect(hasEnoughOutlets(s.headlines)).toBe(true);
      faqFile.parse(read("pipeline/output", `faq_${p}.json`));
    }
  });
  it("the fixtures parse, and every fixture story has enough outlets", () => {
    for (const p of ["economy", "immigration", "laws", "decisions"]) {
      const news = newsFile.parse(read("pipeline/fixtures", `news_${p}.json`));
      expect(news.stories.length).toBeGreaterThan(0);
      for (const s of news.stories) expect(hasEnoughOutlets(s.headlines)).toBe(true);
      expect(faqFile.parse(read("pipeline/fixtures", `faq_${p}.json`)).groups.length).toBeGreaterThan(0);
    }
  });
  it("the FAQ-only pages' fixtures parse, and every chart id is one of the page's cards", () => {
    for (const [p, resolve] of [["energy", energyFaq], ["trade", tradeFaq], ["foreign-aid", foreignAidFaq], ["troops-abroad", troopsFaq], ["executive-orders", executiveOrdersFaq], ["laws", lawsFaq], ["decisions", decisionsFaq]] as const) {
      const file = faqFile.parse(read("pipeline/fixtures", `faq_${p}.json`));
      const ids = file.groups.flatMap((g) => g.items.flatMap((it) => it.chartIds));
      expect(ids.length).toBeGreaterThan(0);
      expect(resolve(file).flatMap((g) => g.items.flatMap((it) => it.charts)).length).toBe(ids.length);
    }
  });
});

describe("energyNews", () => {
  const imp = Array.from({ length: 400 }, (_, i) => (i < 390 ? 5000 + i : null));
  const payload = { monthly: { imp } } as unknown as Parameters<typeof energyNews>[1];
  const file = { asOf: "2026-10-27", stories: [story("oil-1", "2026-10-27", [h("Lean Left"), h("Right")]), { ...story("methane-1", "2026-10-27", [h("Lean Left"), h("Right")]), chartId: undefined }] } as unknown as Parameters<typeof energyNews>[0];

  it("sparklines an oil-card story with its last 36 months of imports, labelled as what they are", () => {
    const [oil] = energyNews({ ...file!, stories: [{ ...file!.stories[0]!, chartId: "oil" }] }, payload);
    expect(oil!.chart).toMatchObject({ target: "oil", label: "Oil imports" });
    expect(oil!.chart!.pts).toHaveLength(36);
    expect(oil!.chart!.pts.at(-1)!.value).toBe(5389);
  });
  it("leaves a story with no chart, or another chart, as headlines over the wash", () => {
    const items = energyNews(file, payload);
    expect(items).toHaveLength(2);
    expect(items.every((i) => i.chart === undefined)).toBe(true);
  });
});

describe("the news catalog covers every chart on the page", () => {
  // The pages' real card ids, from the code that renders them, not a typed copy.
  const real: Record<string, string[]> = {
    economy: [...Object.keys(SPECS).map((k) => `chart-${k}`), "chart-diesel"],
    immigration: Object.keys(IMMIGRATION_CHARTS),
    trade: Object.keys(TRADE_CHARTS),
    energy: [...ENERGY_CHARTS],
    laws: Object.keys(LAWS_CHARTS),
    decisions: Object.keys(DECISIONS_CHARTS),
  };

  it("lists in PAGE_CHARTS exactly the charts each page has", () => {
    for (const page of Object.keys(real)) expect(PAGE_CHARTS[page as keyof typeof PAGE_CHARTS].map((c) => c.id).sort(), page).toEqual([...real[page]!].sort());
  });
  it("gives every chart a topic, or says in CHARTS_WITHOUT_TOPIC why not", () => {
    for (const [page, charts] of Object.entries(PAGE_CHARTS)) {
      for (const c of charts) {
        const hasTopic = PAGE_TOPICS.some((t) => t.page === page && t.chartId === c.id);
        expect(hasTopic || c.id in CHARTS_WITHOUT_TOPIC, `${page}/${c.id} has no news topic and is not in CHARTS_WITHOUT_TOPIC`).toBe(true);
      }
    }
  });
  it("keeps CHARTS_WITHOUT_TOPIC to charts that exist and have no topic", () => {
    const all = Object.values(PAGE_CHARTS).flat();
    for (const id of Object.keys(CHARTS_WITHOUT_TOPIC)) {
      expect(all.some((c) => c.id === id), `${id} is not a chart`).toBe(true);
      expect(PAGE_TOPICS.some((t) => t.chartId === id), `${id} has a topic now: remove it from CHARTS_WITHOUT_TOPIC`).toBe(false);
    }
  });
});

describe("lawsNews", () => {
  // Two Congresses, two topic groups (areas 0 and 1 in group "a", area 2 in group "b"), the second Congress still in progress.
  const payload = {
    congresses: [118, 119],
    partial: [false, true],
    groups: [{ id: "a", label: "Land, water & farming" }, { id: "b", label: "Energy & environment" }],
    areas: [{ group: "a" }, { group: "a" }, { group: "b" }],
    counts: [[10, 5, 7], [3, 4, 2]],
  } as unknown as Parameters<typeof lawsNews>[0];
  const file = { asOf: "2026-10-27", stories: [{ ...story("law.1-2026-10-21", "2026-10-21", [h("Lean Left"), h("Right")]), chartId: "how-many-laws-does-congress-pass", groupId: "a" }, { ...story("new_laws-2026-10-22", "2026-10-22", [h("Lean Left"), h("Right")]), chartId: "how-many-laws-does-congress-pass" }] };

  it("draws a law's story as bars of laws per Congress on its topic group, and any other as all laws", () => {
    const [all, law] = lawsNews(payload, file);
    expect(law!.chart).toMatchObject({ target: "how-many-laws-does-congress-pass", label: "Land, water & farming laws", value: "7", asOf: "119th Congress, so far", bars: true });
    expect(law!.chart!.pts).toEqual([{ x: 118, value: 15 }, { x: 119, value: 7 }]);
    expect(all!.chart).toMatchObject({ label: "Laws", value: "9" });
  });
  it("shows a story with no chart as headlines over a wash, and nothing without a file", () => {
    expect(lawsNews(payload, { ...file, stories: [{ ...file.stories[0]!, chartId: undefined }] })[0]!.chart).toBeUndefined();
    expect(lawsNews(payload, null)).toEqual([]);
  });
});

describe("decisionsNews", () => {
  const payload = {
    terms: [2024, 2025],
    areas: [{ id: "immigration", label: "Immigration" }, { id: "elections", label: "Elections & campaign money" }],
    all: [[1, 2, 3, 4, 5], [2, 2, 2, 2, 2]],
    by: [[[0, 1, 0, 0, 1], [1, 1, 1, 0, 1]], [[1, 0, 0, 0, 0], [0, 0, 0, 0, 1]]],
  } as unknown as Parameters<typeof decisionsNews>[0];
  const file = { asOf: "2026-10-27", stories: [{ ...story("case.1-2026-06-30", "2026-06-30", [h("Lean Left"), h("Right")]), chartId: "how-many-cases-does-the-court-decide", groupId: "immigration" }, { ...story("ruling-2026-06-29", "2026-06-29", [h("Lean Left"), h("Right")]), chartId: "how-many-cases-does-the-court-decide", groupId: "no-such-topic" }] };

  it("draws a ruling's story as bars of cases per term on its topic, and an unknown topic as all cases", () => {
    const [law, all] = decisionsNews(payload, file);
    expect(law!.chart).toMatchObject({ label: "Immigration cases", value: "4", asOf: "2025 term", bars: true });
    expect(law!.chart!.pts).toEqual([{ x: 2024, value: 2 }, { x: 2025, value: 4 }]);
    expect(all!.chart).toMatchObject({ label: "Cases", value: "10" });
  });
});

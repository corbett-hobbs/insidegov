import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MAX_STORIES, OUTLET_LOGO_IDS, countsFor, formatStoryDate, isBalanced, orderHeadlines, outletInitials, selectStories, toQuestionGroups, updatedLabel } from "./news-derive";
import { faqFile, newsFile, type Lean, type NewsHeadline, type NewsStory } from "./news-types";
import { energyFaq } from "../components/energy/energy-news";
import { tradeFaq } from "../components/trade/trade-news";
import { foreignAidFaq } from "../components/foreign-aid/foreign-aid-news";
import { troopsFaq } from "../components/troops/troops-news";
import { executiveOrdersFaq } from "../components/executive-orders/executive-orders-news";

const h = (lean: Lean, outletId = lean.replace(/\s/g, "").toLowerCase()): NewsHeadline => ({ outletId, outlet: outletId, lean, title: `${lean} headline`, url: "https://example.com/a" });
const story = (id: string, date: string, headlines: NewsHeadline[]): NewsStory => ({ id, date, topic: "Topic", chartId: "chart-gas", headlines });

describe("isBalanced", () => {
  it("needs a left-of-center and a right-of-center headline", () => {
    expect(isBalanced([h("Lean Left"), h("Lean Right")])).toBe(true);
    expect(isBalanced([h("Left"), h("Right")])).toBe(true);
    expect(isBalanced([h("Left"), h("Lean Left")])).toBe(false);
    expect(isBalanced([h("Right")])).toBe(false);
  });
  it("does not count a data release or a center outlet as a side", () => {
    expect(isBalanced([h("Data"), h("Center"), h("Lean Right")])).toBe(false);
    expect(isBalanced([h("Data"), h("Left"), h("Right")])).toBe(true);
    expect(isBalanced([h("Center"), h("Lean Left"), h("Lean Right")])).toBe(true);
  });
  it("allows at most three headlines", () => {
    expect(isBalanced([h("Data"), h("Left"), h("Right"), h("Center")])).toBe(false);
  });
});

describe("orderHeadlines", () => {
  it("puts the data release first, then left to right, keeping file order for ties", () => {
    const out = orderHeadlines([h("Right", "a"), h("Left", "b"), h("Data", "c"), h("Right", "d")]);
    expect(out.map((x) => x.outletId)).toEqual(["c", "b", "a", "d"]);
  });
});

describe("selectStories", () => {
  it("drops unbalanced stories, sorts newest first and orders each story's headlines", () => {
    const out = selectStories([
      story("old", "2026-10-01", [h("Right"), h("Left")]),
      story("one-sided", "2026-10-30", [h("Left"), h("Lean Left")]),
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
  it("the shipped files parse, and every shipped story is balanced", () => {
    for (const p of ["economy", "immigration"]) {
      for (const s of newsFile.parse(read("pipeline/output", `news_${p}.json`)).stories) expect(isBalanced(s.headlines)).toBe(true);
      faqFile.parse(read("pipeline/output", `faq_${p}.json`));
    }
  });
  it("the fixtures parse, and every fixture story is balanced", () => {
    for (const p of ["economy", "immigration"]) {
      const news = newsFile.parse(read("pipeline/fixtures", `news_${p}.json`));
      expect(news.stories.length).toBeGreaterThan(0);
      for (const s of news.stories) expect(isBalanced(s.headlines)).toBe(true);
      expect(faqFile.parse(read("pipeline/fixtures", `faq_${p}.json`)).groups.length).toBeGreaterThan(0);
    }
  });
  it("the FAQ-only pages' fixtures parse, and every chart id is one of the page's cards", () => {
    for (const [p, resolve] of [["energy", energyFaq], ["trade", tradeFaq], ["foreign-aid", foreignAidFaq], ["troops-abroad", troopsFaq], ["executive-orders", executiveOrdersFaq]] as const) {
      const file = faqFile.parse(read("pipeline/fixtures", `faq_${p}.json`));
      const ids = file.groups.flatMap((g) => g.items.flatMap((it) => it.chartIds));
      expect(ids.length).toBeGreaterThan(0);
      expect(resolve(file).flatMap((g) => g.items.flatMap((it) => it.charts)).length).toBe(ids.length);
    }
  });
});

import { describe, expect, it } from "vitest";
import { slidePlan } from "./carousel";
import { eventInsightsAt } from "./collect";
import { loadAdministrations, loadLaws } from "./datasets";
import { type ListedOrder, insightOrders, listFootnote, moreNote, orderingNote, ordersAlt, ordersHeading } from "./eo-list";
import { lawsInMonth, readLaws } from "./laws-list";
import { type LawNews, newsScore, pruneLawNews, recordLawNews } from "./news/law-news";
import { lawTopics } from "./news/subjects";
import { planThread } from "./thread";
import type { Headline } from "./types";

const law = (id: string, date: string, number: number): ListedOrder => ({ id, number, title: `Law ${number}`, date, topic: "Energy", summary: "Does a thing." });
const headline = (title: string, outletId: string): Headline => ({ title, source: outletId, url: `https://example.com/${outletId}/${title}`, published: "2026-10-21T10:00:00Z", feed: "f", outletId });

describe("law news score", () => {
  const topics = lawTopics(
    [
      { law_id: "119-pub-133", date: "2026-10-20", title: "Chiricahua National Park Act", area_id: "public-lands-and-natural-resources" },
      { law_id: "119-pub-134", date: "2026-10-20", title: "License to Drill Act", area_id: "energy" },
    ],
    new Map(),
    "2026-10-28T00:00:00Z",
  );

  it("records each roster outlet that headlined a law, once, and ignores outlets needing the check", () => {
    const heads = [headline("Trump signs Chiricahua National Park Act", "guardian"), headline("Chiricahua National Park Act becomes law", "guardian"), headline("Chiricahua National Park Act signed", "huffpost"), headline("Gas prices fall", "guardian")];
    const out = recordLawNews({}, topics, heads, "2026-10-21T12:00:00Z");
    expect(Object.keys(out)).toEqual(["119-pub-133"]);
    expect(out["119-pub-133"]).toEqual({ outlets: ["guardian"], first: "2026-10-21", last: "2026-10-21" });
  });

  it("adds to earlier runs, keeping the first day seen", () => {
    const first = recordLawNews({}, topics, [headline("Chiricahua National Park Act signed", "guardian")], "2026-10-21T12:00:00Z");
    const next = recordLawNews(first, topics, [headline("Chiricahua National Park Act explained", "nytimes")], "2026-10-22T12:00:00Z");
    expect(next["119-pub-133"]).toEqual({ outlets: ["guardian", "nytimes"], first: "2026-10-21", last: "2026-10-22" });
  });

  it("scores the sides first, then the outlets, and drops old entries", () => {
    const oneSide: LawNews = { outlets: ["guardian", "nytimes"], first: "2026-10-21", last: "2026-10-21" };
    const twoSides: LawNews = { outlets: ["guardian", "foxnews"], first: "2026-10-21", last: "2026-10-21" };
    expect(newsScore(undefined)).toBe(0);
    expect(newsScore(twoSides)).toBeGreaterThan(newsScore(oneSide));
    expect(Object.keys(pruneLawNews({ a: oneSide, b: { ...oneSide, last: "2026-07-01" } }, "2026-11-02T00:00:00Z"))).toEqual(["a"]);
  });
});

describe("laws list", () => {
  const all = [law("119-pub-135", "2026-10-22", 135), law("119-pub-134", "2026-10-20", 134), law("119-pub-133", "2026-10-20", 133), law("119-pub-100", "2026-09-30", 100)];
  const covered: Record<string, LawNews> = { "119-pub-133": { outlets: ["guardian", "foxnews"], first: "2026-10-21", last: "2026-10-22" } };

  it("lists only the month's laws, most-covered first, then newest", () => {
    expect(lawsInMonth(all, covered, "2026-10-01", 10).map((l) => l.number)).toEqual([133, 135, 134]);
    expect(lawsInMonth(all, {}, "2026-10-01", 10).map((l) => l.number)).toEqual([135, 134, 133]);
    expect(lawsInMonth(all, {}, "2026-10-01", 2)).toHaveLength(2);
  });

  it("says how the rows are ordered only when some law was covered", () => {
    expect(orderingNote(lawsInMonth(all, {}, "2026-10-01", 10), "laws")).toBe("Newest first");
    expect(orderingNote(lawsInMonth(all, covered, "2026-10-01", 10), "laws")).toMatch(/more outlets covered come first/);
    expect(listFootnote([], "laws")).toMatch(/Congressional Research Service/);
    expect(ordersHeading("2026-10-01", "laws")).toBe("Laws signed in October");
    expect(moreNote("2026-10-01", "insidegov.fyi/congress/laws", "laws")).toBe("To see all of October's laws, visit insidegov.fyi/congress/laws.");
    expect(ordersAlt(lawsInMonth(all, covered, "2026-10-01", 10), "2026-10-01", "laws")).toMatch(/^Laws signed in October, laws that more outlets covered/);
  });

  it("reads the committed file: a monthly laws insight lists that month's laws, none for other series", () => {
    const rows = readLaws();
    expect(rows.every((r, i) => i === 0 || r.date <= rows[i - 1]!.date)).toBe(true);
    const october = insightOrders({ seriesId: "laws.monthly", period: "2026-10-01" });
    expect(october.length).toBeGreaterThan(10);
    expect(october.every((l) => l.date.startsWith("2026-10"))).toBe(true);
    expect(october.every((l) => l.topic !== "")).toBe(true);
    expect(insightOrders({ seriesId: "laws", period: "2026-09-30" })).toEqual([]);
  });

  it("gives a laws post a slide and a thread card, with the see-all note exactly when some are left out", () => {
    const [insight] = eventInsightsAt(loadLaws(), loadAdministrations(), ["2026-10-31"]).filter((i) => i.seriesId === "laws.monthly");
    expect(insight).toBeDefined();
    const listed = slidePlan(insight!, insightOrders(insight!)).find((s) => s.kind === "orders")!;
    expect(listed.orders!.length).toBeGreaterThan(0);
    expect(listed.more).toBe(listed.orders!.length < insightOrders(insight!).length);
    const cards = planThread(insight!)?.replies.filter((r) => r.chart !== undefined) ?? [];
    expect(cards.length).toBeGreaterThan(0);
  });
});

describe("pinned why", () => {
  it("keeps October 2026's researched why when its draft is regenerated", async () => {
    const { withWhy } = await import("./why");
    const [insight] = eventInsightsAt(loadLaws(), loadAdministrations(), ["2026-10-31"]).filter((i) => i.seriesId === "laws.monthly");
    const withIt = withWhy({ ...insight!, id: "laws.monthly:latest:2026-10-01" });
    expect(withIt.why?.title).toBe("Why it rose from zero");
    expect(withIt.why?.sources).toHaveLength(4);
    // The new-high post is the one a month drafts for laws, so it carries the same text.
    expect(withWhy({ ...insight!, id: "laws.monthly:extreme_high:2026-10-01" }).why).toBe(withIt.why);
  });
});

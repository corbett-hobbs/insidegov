import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Headline } from "../types";
import { DISPATCH_MIN_MINUTES, MAX_DISPATCHES, NO_REFRESH, RELEASE_RECENT_HOURS, REFRESH_FOR_TOPIC, STORY_GRACE_HOURS, planRefreshes, recordDispatch } from "./refresh";
import { PAGE_TOPICS } from "./topics";

const NOW = "2026-10-28T16:00:00.000Z";
const hoursAgo = (h: number) => new Date(Date.parse(NOW) - h * 3_600_000).toISOString();
const release = (outletId: string, title: string, published = hoursAgo(3), url = `https://example.gov/${encodeURIComponent(title)}`): Headline => ({ title, source: outletId.toUpperCase(), url, published, feed: "data", outletId });
const topics = PAGE_TOPICS;
const TRADE = release("bea", "U.S. International Trade in Goods and Services, September 2026");
const plan = (over: Partial<Parameters<typeof planRefreshes>[0]> = {}) => planRefreshes({ topics, releases: [TRADE], now: NOW, updatedAt: () => hoursAgo(200), dispatched: {}, ...over });

describe("refreshing the data when an agency publishes", () => {
  it("covers every topic with an agency feed, or says why not", () => {
    for (const t of topics.filter((x) => x.release)) expect(Boolean(REFRESH_FOR_TOPIC[t.id]) !== Boolean(NO_REFRESH[t.id]), `${t.id}: in exactly one of REFRESH_FOR_TOPIC and NO_REFRESH`).toBe(true);
    for (const id of [...Object.keys(REFRESH_FOR_TOPIC), ...Object.keys(NO_REFRESH)]) expect(topics.find((t) => t.id === id)?.release, id).toBeTruthy();
  });

  it("points at real workflows that can be dispatched, and at real data files", () => {
    for (const r of Object.values(REFRESH_FOR_TOPIC)) {
      const path = `.github/workflows/${r.workflow}`;
      expect(existsSync(path), path).toBe(true);
      expect(readFileSync(path, "utf8"), path).toMatch(/workflow_dispatch/);
      expect(existsSync(r.file), r.file).toBe(true);
    }
  });

  it("lets the watcher dispatch them", () => {
    expect(readFileSync(".github/workflows/social-news.yml", "utf8")).toMatch(/permissions:[\s\S]*actions: write/);
  });

  it("calls the data behind when a recent release is newer than the file, and dispatches that workflow", () => {
    const p = plan();
    expect([...p.behind.keys()]).toEqual(["trade_deficit"]);
    expect(p.behind.get("trade_deficit")).toMatchObject({ workflow: "trade-freshness.yml", release: { kind: "agency", url: TRADE.url } });
    expect(p.dispatch).toMatchObject([{ workflow: "trade-freshness.yml", release: { url: TRADE.url } }]);
  });

  it("does nothing when the data is already newer, the file's age is unknown, or the release is old or from another agency", () => {
    expect(plan({ updatedAt: () => hoursAgo(1) }).behind.size).toBe(0);
    expect(plan({ updatedAt: () => null })).toEqual({ behind: new Map(), dispatch: [] });
    expect(plan({ releases: [release("bea", TRADE.title, hoursAgo(RELEASE_RECENT_HOURS + 1))] }).behind.size).toBe(0);
    expect(plan({ releases: [release("eia", TRADE.title)] }).behind.size).toBe(0);
  });

  it("dispatches a workflow once however many topics share it", () => {
    const jobs = release("bls", "Employment Situation Summary: payroll employment and the unemployment rate");
    const p = plan({ releases: [jobs, release("bls", "CPI for all items rises in September")] });
    expect([...p.behind.keys()].sort()).toEqual(["inflation", "jobs", "unemployment"]);
    expect(p.dispatch.map((d) => d.workflow)).toEqual(["indicators-freshness.yml"]);
  });

  it("keeps trying hourly while the data is behind, but not more than once in the throttle, and not forever", () => {
    const rec = (minutesAgo: number, count: number) => ({ "trade-freshness.yml": { release: TRADE.url, since: hoursAgo(10), at: new Date(Date.parse(NOW) - minutesAgo * 60_000).toISOString(), count } });
    // Still behind, but dispatched a few minutes ago: held, not dispatched again.
    const soon = plan({ dispatched: rec(DISPATCH_MIN_MINUTES - 5, 1) });
    expect(soon.behind.size).toBe(1);
    expect(soon.dispatch).toEqual([]);
    expect(plan({ dispatched: rec(DISPATCH_MIN_MINUTES + 5, 1) }).dispatch).toHaveLength(1);
    // Out of tries for this release: still held, no more runs.
    const spent = plan({ dispatched: rec(120, MAX_DISPATCHES) });
    expect(spent.behind.size).toBe(1);
    expect(spent.dispatch).toEqual([]);
    // A new release starts over.
    expect(plan({ dispatched: { "trade-freshness.yml": { release: "https://example.gov/other", since: hoursAgo(9), at: hoursAgo(5), count: MAX_DISPATCHES } } }).dispatch).toHaveLength(1);
  });

  it("counts dispatches per release", () => {
    expect(recordDispatch(undefined, TRADE, NOW)).toEqual({ release: TRADE.url, since: NOW, at: NOW, count: 1 });
    expect(recordDispatch({ release: TRADE.url, since: hoursAgo(2), at: hoursAgo(1), count: 2 }, TRADE, NOW)).toEqual({ release: TRADE.url, since: hoursAgo(2), at: NOW, count: 3 });
    expect(recordDispatch({ release: "https://example.gov/old", since: hoursAgo(30), at: hoursAgo(30), count: 8 }, TRADE, NOW)).toMatchObject({ since: NOW, count: 1 });
  });

  describe("from a news story, when the agency's feed has nothing", () => {
    const story = { topicId: "trade_deficit", title: "US Trade Gap Hits Widest Since March 2025 on Capital Goods", source: "Bloomberg", url: "https://example.com/trade", published: hoursAgo(3) };
    const alone = (over: Partial<Parameters<typeof planRefreshes>[0]> = {}) => plan({ releases: [], stories: [story], ...over });

    it("dispatches the refresh and holds the story, since the data is older than the first headline", () => {
      const p = alone();
      expect(p.behind.get("trade_deficit")).toMatchObject({ workflow: "trade-freshness.yml", release: { kind: "story", source: "Bloomberg" } });
      expect(p.dispatch).toHaveLength(1);
    });

    it("stops holding after the grace period, so a story that is not about a release still posts", () => {
      const rec = (sinceHoursAgo: number) => ({ "trade-freshness.yml": { release: story.url, since: hoursAgo(sinceHoursAgo), at: hoursAgo(1), count: 3 } });
      expect(alone({ dispatched: rec(STORY_GRACE_HOURS - 1) }).behind.size).toBe(1);
      expect(alone({ dispatched: rec(STORY_GRACE_HOURS + 1) }).behind.size).toBe(0);
    });

    it("does not hold or dispatch when the data is newer than the story, or for a topic with no refresh", () => {
      expect(alone({ updatedAt: () => hoursAgo(1) })).toEqual({ behind: new Map(), dispatch: [] });
      expect(alone({ stories: [{ ...story, topicId: "diesel" }] })).toEqual({ behind: new Map(), dispatch: [] });
    });

    it("prefers the agency's own release when the feed has it", () => {
      expect(plan({ stories: [story] }).behind.get("trade_deficit")!.release.kind).toBe("agency");
    });
  });
});

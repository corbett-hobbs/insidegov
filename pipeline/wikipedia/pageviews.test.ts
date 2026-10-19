import { describe, expect, it } from "vitest";
import { dailyViews, median, pageviewWindow, pageviewsUrl, sumDaily, summarize } from "./pageviews";

describe("pageviewWindow", () => {
  it("ends LAG days before today and spans `days` inclusive", () => {
    expect(pageviewWindow("2026-10-19", 90, 2)).toEqual({ start: "2026-07-20", end: "2026-10-17", days: 90 });
  });

  it("crosses a year boundary", () => {
    expect(pageviewWindow("2026-01-02", 3, 0)).toEqual({ start: "2025-12-31", end: "2026-01-02", days: 3 });
  });
});

describe("pageviewsUrl", () => {
  it("underscores spaces and percent-encodes the rest", () => {
    const w = { start: "2026-10-01", end: "2026-10-05", days: 5 };
    expect(pageviewsUrl("Bernie Sanders", w)).toBe(
      "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/Bernie_Sanders/daily/20261001/20261005",
    );
    expect(pageviewsUrl("Ben Ray Luján", w)).toContain("/Ben_Ray_Luj%C3%A1n/");
    expect(pageviewsUrl("Al Green (politician)", w)).toContain("/Al_Green_(politician)/");
  });
});

describe("dailyViews", () => {
  const w = { start: "2026-10-01", end: "2026-10-05", days: 5 };

  it("fills days the API left out with 0 and ignores days outside the window", () => {
    const items = [
      { timestamp: "2026093000", views: 999 },
      { timestamp: "2026100100", views: 10 },
      { timestamp: "2026100300", views: 30 },
      { timestamp: "2026100500", views: 50 },
      { timestamp: "2026100600", views: 999 },
    ];
    expect(dailyViews(items, w)).toEqual([10, 0, 30, 0, 50]);
  });
});

describe("median", () => {
  it("takes the middle value, or the rounded mean of the middle two", () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([1, 2, 3, 10])).toBe(3); // 2.5 rounds up
    expect(median([0, 0, 0, 1000])).toBe(0);
  });

  it("is not moved by a single-day spike the way a mean is", () => {
    const days = [...new Array(89).fill(100), 50_000];
    expect(summarize("x", days)).toEqual({ title: "x", median: 100, total: 89 * 100 + 50_000, redirects: 0 });
  });

  it("rejects an empty list", () => {
    expect(() => median([])).toThrow();
  });
});

describe("sumDaily", () => {
  it("adds an article's redirects day by day before the median is taken", () => {
    // Moved mid-window: the old title (now a redirect) holds the early views.
    const article = [0, 0, 0, 200, 220];
    const oldTitle = [180, 190, 210, 5, 0];
    const total = sumDaily([article, oldTitle], 5);
    expect(total).toEqual([180, 190, 210, 205, 220]);
    expect(median(total)).toBe(205);
    expect(median(article)).toBe(0);
  });
});

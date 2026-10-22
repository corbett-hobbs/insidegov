import { describe, expect, it } from "vitest";
import { graphemes, linkFacets, MAX_GRAPHEMES } from "./bluesky";
import { checkCaption } from "./caption";
import { detectExtremes } from "./detect";
import { addMonths } from "./format";
import { FRESH_DAYS, LAG_QUALIFIER_DAYS, isFresh, periodEnd, releaseFor, releaseNote, stampRelease } from "./freshness";
import { INTRO_THREAD } from "./intro";
import { BACKLOG_THRESHOLD, MAX_PER_DATASET_WEEK, MAX_PER_DAY, type Posted, type QueueItem, localDate, localTimeToUtc, pickNext, simulate, slotAt, slotLabel } from "./schedule";
import type { Series } from "./types";
import { fit, lengthSection, refreshCounts } from "./counts";
import { type DraftBlock, blockComment, parseDraftBlock } from "./issue";
import { X_MAX, oauthHeader, xLength } from "./x";

const item = (over: Partial<QueueItem> & { key: string }): QueueItem => ({
  id: over.key,
  kind: "extreme_high",
  dataset: "energy",
  seriesId: `s.${over.key}`,
  period: "2026-09-01",
  score: 10,
  frequency: "monthly",
  releasedOn: "2026-10-19",
  expiresOn: "2026-11-09",
  ...over,
});

describe("freshness", () => {
  it("ends periods where the data does", () => {
    expect(periodEnd("monthly", "2026-06-01")).toBe("2026-06-30");
    expect(periodEnd("monthly", "2026-02-01")).toBe("2026-02-28");
    expect(periodEnd("weekly", "2026-10-12")).toBe("2026-10-12");
    expect(periodEnd("fiscal_year", "2025-09-30")).toBe("2025-09-30");
  });

  it("flags data released more than two months after its period as lagged, and sets the freshness window", () => {
    expect(releaseFor("monthly", "2026-08-01", "2026-10-07", false).lagged).toBe(false); // trade: 37 days
    const june = releaseFor("monthly", "2026-06-01", "2026-10-21", false); // the "chart ending in June, posted in October" case
    expect(june.lagged).toBe(true);
    expect(june.expiresOn).toBe("2026-11-11");
    expect(LAG_QUALIFIER_DAYS).toBe(60);
    expect(releaseFor("weekly", "2026-10-12", "2026-10-13", false).expiresOn).toBe(`2026-10-${13 + FRESH_DAYS.weekly}`);
    expect(isFresh(june, "2026-11-11")).toBe(true);
    expect(isFresh(june, "2026-11-12")).toBe(false);
  });

  it("makes a lagged draft say it is newly released, on the chart and in the caption", () => {
    const values = Array.from({ length: 80 }, (_, i) => 100 + (i % 2 ? 0.2 : -0.2));
    const points = [...values, 150].map((value, i) => ({ date: addMonths("2000-01-01", i), value, cells: [] }));
    const series = { id: "t", dataset: "energy", name: "test output", axisLabel: "u", unit: { scale: 1, decimals: 1, suffix: " units" }, frequency: "monthly", seasonal: false, kind: "level", moveMode: "pct", points, url: "/x", source: "S", weight: 1, releaseLagDays: 30 } as Series;
    const ins = detectExtremes(series)[0]!; // period September 2006
    const late = stampRelease(ins, "2007-01-15", false);
    expect(late.release?.lagged).toBe(true);
    expect(releaseNote(late)).toBe("New data, released January 2007 · covers September 2006");
    expect(late.template).toMatch(/^Newly released data \(January 2007\)\. /);
    expect(checkCaption(late.template, late.facts, { lagged: true })).toEqual([]);
    expect(checkCaption(ins.template, late.facts, { lagged: true }).join()).toMatch(/released/);
    const prompt = stampRelease(ins, "2006-10-20", false);
    expect(prompt.release?.lagged).toBe(false);
    expect(releaseNote(prompt)).toBeNull();
    expect(prompt.template).toBe(ins.template);
  });
});

describe("pickNext", () => {
  const now = "2026-10-21T14:30:00Z";

  it("posts the intro first", () => {
    const d = pickNext([item({ key: "a", score: 99 }), item({ key: "intro", kind: "intro", dataset: "intro" })], [], now, "morning");
    expect(d.post?.key).toBe("intro");
  });

  it("expires stale drafts and older drafts of a series with a newer one approved", () => {
    const d = pickNext(
      [item({ key: "old", expiresOn: "2026-10-20" }), item({ key: "aug", seriesId: "s.x", period: "2026-08-01" }), item({ key: "sep", seriesId: "s.x", period: "2026-09-01", score: 1 })],
      [],
      now,
      "morning",
    );
    expect(d.expired.map((q) => q.key)).toEqual(["old"]);
    expect(d.superseded.map((q) => q.key)).toEqual(["aug"]);
    expect(d.post?.key).toBe("sep");
  });

  it("holds posts not yet released", () => {
    expect(pickNext([item({ key: "a", releasedOn: "2026-10-22" })], [], now, "morning").post).toBeNull();
  });

  it("caps posts per day and spaces them out", () => {
    const q = [item({ key: "a" }), item({ key: "b", dataset: "trade" }), item({ key: "c", dataset: "gas" })];
    const today = (h: number): Posted => ({ dataset: "laws", postedAt: `2026-10-21T1${h - 1}:00:00Z` }); // early morning Pacific
    expect(pickNext(q, Array.from({ length: MAX_PER_DAY }, (_, i) => today(i + 1)), now, "morning").reason).toMatch(/posts today/);
    expect(pickNext(q, [{ dataset: "laws", postedAt: "2026-10-21T12:00:00Z" }], now, "morning").reason).toMatch(/hours ago/);
  });

  it("runs the afternoon slot only with a backlog", () => {
    const q = [item({ key: "a" }), item({ key: "b", dataset: "trade" })];
    expect(pickNext(q, [], "2026-10-21T20:00:00Z", "afternoon").post).toBeNull();
    const more = [...q, ...Array.from({ length: BACKLOG_THRESHOLD }, (_, i) => item({ key: `m${i}`, dataset: "gas" }))];
    expect(pickNext(more, [], "2026-10-21T20:00:00Z", "afternoon").post).not.toBeNull();
  });

  it("rotates topics: a topic that just posted waits, and none posts more than the weekly cap", () => {
    const q = [item({ key: "energy", score: 50 }), item({ key: "trade", dataset: "trade", score: 5 })];
    expect(pickNext(q, [{ dataset: "energy", postedAt: "2026-10-20T14:30:00Z" }], now, "morning").post?.key).toBe("trade");
    // Only energy waiting: the morning slot lets it through after the cooldown would have held it...
    expect(pickNext([q[0]!], [{ dataset: "energy", postedAt: "2026-10-20T14:30:00Z" }], now, "morning").post?.key).toBe("energy");
    // ...but never past the weekly cap.
    const week = Array.from({ length: MAX_PER_DATASET_WEEK }, (_, i): Posted => ({ dataset: "energy", postedAt: `2026-10-1${5 + i}T14:30:00Z` }));
    expect(pickNext([q[0]!], week, now, "morning").post).toBeNull();
  });

  it("prefers a draft about to go stale over a slightly more notable one with time left", () => {
    const d = pickNext([item({ key: "fresh", score: 11, expiresOn: "2026-11-10" }), item({ key: "closing", dataset: "trade", score: 10, expiresOn: "2026-10-22" })], [], now, "morning");
    expect(d.post?.key).toBe("closing");
  });
});

describe("slots in Pacific time", () => {
  it("puts 9 a.m. Pacific at the right UTC hour on both sides of daylight saving", () => {
    expect(localTimeToUtc("2026-10-22", 9)).toBe("2026-10-22T16:00:00.000Z"); // PDT
    expect(localTimeToUtc("2026-12-01", 9)).toBe("2026-12-01T17:00:00.000Z"); // PST
    expect(slotLabel("2026-12-01T17:00:00.000Z")).toBe("Tue, Dec 1, 9:00 AM PT / 12:00 PM ET");
  });

  it("matches a run to its slot by Pacific time, so the off-season cron hour does nothing", () => {
    expect(slotAt("2026-10-22T16:00:00Z")).toBe("morning"); // 9:00 PDT
    expect(slotAt("2026-10-22T17:00:00Z")).toBe("morning"); // 10:00 PDT, inside the grace for a delayed run
    expect(slotAt("2026-12-01T16:00:00Z")).toBeNull(); // 8:00 PST: the other cron hour
    expect(slotAt("2026-12-01T17:20:00Z")).toBe("morning");
    expect(slotAt("2026-10-22T20:00:00Z")).toBe("afternoon");
    expect(slotAt("2026-10-24T16:00:00Z")).toBeNull(); // Saturday
  });

  it("counts days in Pacific time", () => {
    expect(localDate("2026-10-23T03:00:00Z")).toBe("2026-10-22");
  });
});

describe("simulate", () => {
  it("never posts on weekends or more than the daily cap, and posts each draft at most once", () => {
    const items = Array.from({ length: 30 }, (_, i) => item({ key: `k${i}`, dataset: ["energy", "gas", "trade", "laws", "encounters"][i % 5]!, releasedOn: "2026-10-01", expiresOn: "2026-10-31" }));
    const { posts } = simulate(items, "2026-10-01", 30);
    const days = new Map<string, number>();
    for (const p of posts) {
      const day = new Date(p.at).getUTCDay();
      expect(day === 0 || day === 6).toBe(false);
      days.set(p.at.slice(0, 10), (days.get(p.at.slice(0, 10)) ?? 0) + 1);
    }
    expect(Math.max(...days.values())).toBeLessThanOrEqual(MAX_PER_DAY);
    expect(new Set(posts.map((p) => p.item.key)).size).toBe(posts.length);
  });
});

describe("posters", () => {
  it("signs OAuth 1.0a requests (X's documented example)", () => {
    // https://docs.x.com/resources/fundamentals/authentication/oauth-1-0a/creating-a-signature
    const header = oauthHeader(
      "POST",
      "https://api.twitter.com/1.1/statuses/update.json",
      {
        consumerKey: "xvz1evFS4wEEPTGEFPHBog",
        consumerSecret: "kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw",
        token: "370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb",
        tokenSecret: "LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE",
      },
      { include_entities: "true", status: "Hello Ladies + Gentlemen, a signed OAuth request!" },
      "kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg",
      "1318622958",
    );
    expect(header).toContain('oauth_signature="hCtSmYh%2BiHYCEqBWrE7C7hYmtUk%3D"');
  });

  it("keeps the intro thread within each platform's limit", () => {
    for (const p of INTRO_THREAD.bluesky) expect(graphemes(p)).toBeLessThanOrEqual(MAX_GRAPHEMES);
    for (const p of INTRO_THREAD.x) expect(xLength(p)).toBeLessThanOrEqual(X_MAX);
  });

  it("finds link facets by UTF-8 byte offset", () => {
    const text = "Café data: insidegov.fyi";
    const [f] = linkFacets(text, [{ text: "insidegov.fyi", uri: "https://insidegov.fyi" }]);
    expect(Buffer.from(text).subarray(f!.index.byteStart, f!.index.byteEnd).toString()).toBe("insidegov.fyi");
  });
});

describe("length section", () => {
  const block = (over: Partial<DraftBlock> = {}): DraftBlock => ({
    id: "x",
    kind: "extreme_high",
    dataset: "energy",
    series_id: "s",
    period: "2026-07-01",
    score: 1,
    caption: "U.S. electricity generation was 453.7 billion kilowatthours in July 2026, the highest for any July.",
    link: "https://insidegov.fyi/presidency/energy",
    image_url: "https://example.org/x.png",
    alt: "",
    facts: [{ id: "latest_value", text: "453.7 billion kilowatthours" }, { id: "latest_date", text: "July 2026" }],
    release: null,
    ...over,
  });

  it("shows characters left on each platform and whether the caption check passes", () => {
    const section = lengthSection(block());
    expect(section).toMatch(/\*\*Bluesky\*\*.*\d+ \/ 300 \(\d+ left\)/);
    expect(section).toMatch(/\*\*X\*\*.*\/ 280/);
    expect(section).toContain("✅ Caption check passes");
    expect(fit(312, 300)).toBe("⚠ 312 / 300 (12 over)");
  });

  it("flags an edit that adds a number or runs past the limit", () => {
    const section = lengthSection(block({ caption: `${block().caption} That is 99% more than before.` }));
    expect(section).toContain("Caption check fails");
    expect(section).toMatch(/numbers not among the facts: 99%/);
  });

  it("counts each intro post per platform", () => {
    const section = lengthSection(block({ kind: "intro", thread: { bluesky: ["a".repeat(301)], x: ["b".repeat(100)] } }));
    expect(section).toContain("| 1 | ⚠ 301 / 300 (1 over) | 100 / 280 (180 left) |");
  });

  it("rewrites only the section when the caption is edited", () => {
    const original = block();
    const body = `intro\n\n${lengthSection(original)}\n\nafter ${blockComment(original)}`;
    const edited = { ...original, caption: `${original.caption} More.` };
    const next = refreshCounts(body, edited);
    expect(next).not.toBe(body);
    expect(next.startsWith("intro\n\n")).toBe(true);
    expect(next).toContain("after <!-- social-draft");
    expect(refreshCounts("no section here", edited)).toBe("no section here");
    expect(parseDraftBlock(blockComment(edited))?.caption).toBe(edited.caption);
  });
});

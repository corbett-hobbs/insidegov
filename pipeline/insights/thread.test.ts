import { describe, expect, it } from "vitest";
import { buildPartRecord } from "./bluesky";
import { lengthSection } from "./counts";
import type { DraftBlock } from "./issue";
import { parseDraftBlock, blockComment, threadSection } from "./issue";
import { REPLY_MAX, checkReplies, checkReply, givesReason, packParagraphs, partsOf, planThread, replyNumbers, threadFit } from "./thread";
import type { Insight } from "./types";

const fact = (id: string, text: string, value: number) => ({ id, text, value, format: { kind: "text" }, derivation: { op: "date", date: "2026-08-01" } }) as unknown as Insight["facts"][number];

const FACTS = [fact("latest_value", "449.4B kWh", 449.4), fact("brk_total_yoy", "29.2B kWh", 29.2), fact("brk_gas_yoy", "16.9B kWh", 16.9), fact("brk_coal_yoy", "1.2B kWh", 1.2), fact("brk_gas_year", "25.0B kWh", 25), fact("brk_coal_year", "18.7B kWh", -18.7), fact("brk_total_year", "132.2B kWh", 132.2)];

const WHY = {
  title: "Why it went up",
  captionLine: "EIA cites warmer weather.",
  paragraphs: ["Hot weather. EIA's monthly review says August was warmer than a year earlier across most of the country.", "Natural gas plants supplied most of the extra power. EIA reports gas generation rose in every region except Texas."],
  sources: [{ name: "EIA Electricity Monthly Update, October 2026", url: "https://www.eia.gov/electricity/monthly/update/" }],
};

function insight(over: Partial<Insight> = {}): Insight {
  return {
    id: "test:extreme_high:2026-08-01",
    dataset: "energy",
    seriesId: "test.series",
    kind: "extreme_high",
    period: "2026-08-01",
    frequency: "monthly",
    headline: "U.S. electricity generation: the highest for any August",
    title: "U.S. electricity generation",
    facts: FACTS,
    chart: { type: "line", points: [{ date: "2026-07-01", value: 1 }, { date: "2026-08-01", value: 2 }], marks: [], frequency: "monthly", unit: null, axisLabel: "", seriesName: "" },
    url: "/presidency/energy",
    source: "U.S. Energy Information Administration",
    why: WHY,
    breakdown: {
      title: "Where the extra power came from",
      blocks: [
        { label: "August 2026 vs. August 2025", rows: [{ name: "Natural gas", fact: "brk_gas_yoy" }, { name: "Coal", fact: "brk_coal_yoy" }], total: { name: "All sources", fact: "brk_total_yoy" } },
        { label: "12 months to August 2026 vs. the 12 before", rows: [{ name: "Natural gas", fact: "brk_gas_year" }, { name: "Coal", fact: "brk_coal_year" }], total: { name: "All sources", fact: "brk_total_year" } },
      ],
      note: "Change in generation.",
    },
    ...over,
  } as unknown as Insight;
}

describe("packParagraphs", () => {
  it("keeps two short paragraphs in one post, and adds the heading when it fits", () => {
    expect(packParagraphs(["One.", "Two."], 100, "Why.")).toEqual(["Why.\n\nOne.\n\nTwo."]);
  });
  it("starts a new post when the next paragraph does not fit", () => {
    const a = "a".repeat(150);
    expect(packParagraphs([a, a], 200)).toEqual([a, a]);
  });
  it("splits a long paragraph between sentences, and gives up on one sentence over the limit", () => {
    const p = `${"First sentence here. ".repeat(10)}`.trim();
    const posts = packParagraphs([p], 100)!;
    expect(posts.every((t) => t.length <= 100)).toBe(true);
    expect(posts.join(" ")).toBe(p);
    expect(packParagraphs(["x".repeat(300)], 280)).toBeNull();
  });
  it("does not split after U.S.", () => {
    expect(packParagraphs(["U.S. Energy officials say demand is up. More follows."], 45)).toEqual(["U.S. Energy officials say demand is up.", "More follows."]);
  });
});

describe("givesReason", () => {
  it("is false for a what-changed answer that states no reason", () => {
    expect(givesReason({ ...WHY, title: "What changed" })).toBe(false);
    expect(givesReason({ ...WHY, captionLine: "EIA's weekly report tracks stocks; no reason for the change was confirmed." })).toBe(false);
    expect(givesReason({ ...WHY, paragraphs: ["Neither source cited here states a reason for this week's level."] })).toBe(false);
    expect(givesReason(WHY)).toBe(true);
  });
});

describe("planThread", () => {
  it("builds reasons, a chart post per breakdown block, and a closing source post", () => {
    const plan = planThread(insight())!;
    const texts = plan.replies.map((r) => r.text);
    expect(texts[0]).toMatch(/^Why it went up\.\n\nHot weather\./);
    expect(texts[1]).toContain("Where the extra power came from");
    expect(texts[1]).toContain("Natural gas +16.9B kWh, Coal +1.2B kWh. All sources +29.2B kWh.");
    expect(texts[2]).toContain("Coal −18.7B kWh");
    expect(plan.replies.map((r) => r.chart)).toEqual([undefined, 0, 1, undefined]);
    expect(texts.at(-1)).toBe("Data: U.S. Energy Information Administration. Reasons: EIA Electricity Monthly Update, October 2026.");
    expect(texts.every((t) => t.length <= REPLY_MAX)).toBe(true);
    expect(checkReplies(plan.replies, FACTS, replyNumbers(plan.replies))).toEqual([]);
  });

  it("leaves a no-reason answer out and says so", () => {
    const plan = planThread(insight({ why: { ...WHY, title: "What changed" } }))!;
    expect(plan.replies[0]!.text).toContain("Where the extra power came from");
    expect(plan.notes[0]).toMatch(/no reason/);
    expect(plan.replies.at(-1)!.text).toBe("Data: U.S. Energy Information Administration.");
  });

  it("names a news source by its outlet, not its headline", () => {
    const sources = [...WHY.sources, { name: "Bloomberg, Imports Surge as Oil Climbs", url: "https://www.bloomberg.com/news/articles/a" }, { name: "Bloomberg, Another Story", url: "https://www.bloomberg.com/news/articles/b" }];
    const last = planThread(insight({ why: { ...WHY, sources } }))!.replies.at(-1)!.text;
    expect(last).toBe("Data: U.S. Energy Information Administration. Reasons: EIA Electricity Monthly Update, October 2026; Bloomberg.");
  });

  it("has no thread when there is nothing to add, and treats news like any other draft", () => {
    expect(planThread(insight({ why: undefined, breakdown: undefined }))).toBeNull();
    expect(planThread(insight({ kind: "news" }))?.replies.length).toBeGreaterThan(0);
  });

  it("drops the smallest rows of a breakdown line that is too long", () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({ name: `Partner number ${i} with a long name`.repeat(2), fact: "brk_gas_yoy" }));
    const plan = planThread(insight({ why: undefined, breakdown: { title: "T", blocks: [{ label: "L", rows }], note: "n" } }))!;
    expect(plan.replies[0]!.text.length).toBeLessThanOrEqual(REPLY_MAX);
    expect(plan.replies[0]!.text.match(/\+16\.9B kWh/g)!.length).toBeLessThan(5);
  });
});

describe("checkReply", () => {
  const ok = replyNumbers([{ text: "Where from 12 months" }]);
  it("holds an edited reply to the facts, years and the generated numbers", () => {
    expect(checkReply("Gas added 16.9B kWh over August 2025, in the 12 months.", FACTS, ok)).toEqual([]);
    expect(checkReply("Gas added 17.5B kWh over last August, EIA says.", FACTS, ok)[0]).toMatch(/numbers not among the facts: 17.5/);
  });
  it("rejects links, hashtags, loaded words and long text", () => {
    expect(checkReply("See https://insidegov.fyi for the data on gas generation.", FACTS)[0]).toMatch(/link/);
    expect(checkReply("Gas generation surged in August, EIA says #energy", FACTS).join(";")).toMatch(/hashtag|loaded/);
    expect(checkReply("x".repeat(281), FACTS).join(";")).toMatch(/281 characters/);
  });
});

describe("Bluesky thread parts", () => {
  const blob = { $type: "blob" as const, ref: { $link: "c" }, mimeType: "image/png", size: 1 };
  const ref = { uri: "at://did/app.bsky.feed.post/a", cid: "cid" };
  it("builds a reply with a chart and, on the last part, a link facet", () => {
    const r = buildPartRecord({ text: "Closing.", link: "https://insidegov.fyi/x", image: { blob, alt: "a" }, reply: { root: ref, parent: ref } }, "2026-10-28T00:00:00Z") as Record<string, unknown>;
    expect(r.text).toBe("Closing.\n\nhttps://insidegov.fyi/x");
    expect(r.reply).toEqual({ root: ref, parent: ref });
    expect(JSON.stringify(r.embed)).toContain("app.bsky.embed.images");
    expect(JSON.stringify(r.facets)).toContain("richtext.facet#link");
  });
  it("leaves out facets, embed and reply for a plain root", () => {
    const r = buildPartRecord({ text: "Plain text post." }, "2026-10-28T00:00:00Z");
    expect(Object.keys(r)).toEqual(["$type", "text", "createdAt", "langs"]);
  });
});

describe("the thread in the issue", () => {
  const block: DraftBlock = {
    id: "x",
    kind: "extreme_high",
    dataset: "energy",
    series_id: "test.series",
    period: "2026-08-01",
    score: 1,
    caption: "U.S. electricity generation reached 449.4B kWh in August 2026, the highest for any August.",
    link: "https://insidegov.fyi/presidency/energy#electricity",
    image_url: "https://example.test/a.png",
    alt: "alt",
    facts: [{ id: "latest_value", text: "449.4B kWh" }],
    release: null,
    replies: [{ text: "Why it went up.\n\nHot weather, EIA says." }, { text: "Gas +16.9B kWh.", image_url: "https://example.test/a-t-3.png", alt: "bars" }],
    reply_numbers: ["16.9B kWh"],
  };
  it("round-trips the replies through the hidden block", () => {
    expect(parseDraftBlock(blockComment(block))!.replies).toEqual(block.replies);
  });
  it("lists the replies with their charts, and their lengths against each limit", () => {
    const text = threadSection(block).join("\n");
    expect(text).toContain("2. Why it went up.");
    expect(text).toContain("![bars](https://example.test/a-t-3.png)");
    const len = lengthSection(block);
    expect(len).toContain("| 3 (last) |");
    expect(len).toContain("Thread check");
  });
  it("puts the link on the last post only, on X only when asked, and measures it against each limit", () => {
    const bsky = partsOf(block, "bluesky", false);
    expect(bsky.map((p) => p.link)).toEqual([undefined, undefined, block.link]);
    expect(bsky[0]).toMatchObject({ text: block.caption, imageUrl: "https://example.test/a.png" });
    expect(bsky[2]).toMatchObject({ imageUrl: "https://example.test/a-t-3.png", alt: "bars" });
    expect(partsOf(block, "x", false).map((p) => p.link)).toEqual([undefined, undefined, undefined]);
    expect(partsOf(block, "x", true).at(-1)!.link).toBe(block.link);
    expect(threadFit(block, true)).toEqual([]);
    const long = { ...block, replies: [{ text: "y".repeat(270) }] };
    // 270 characters fit X without its link, but Bluesky always carries the link (51 more characters).
    expect(threadFit(long, false)).toEqual(["post 2 is 323 characters on Bluesky; the limit is 300"]);
  });
  it("says a draft with notes but no thread posts as a single post", () => {
    expect(threadSection({}, ["no reason"]).join("\n")).toContain("posts as a single post");
  });
});

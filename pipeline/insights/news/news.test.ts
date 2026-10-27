import { describe, expect, it } from "vitest";
import { checkCaption, templateCaption } from "../caption";
import { loadDataset } from "../datasets";
import type { Draft } from "../drafts";
import { issueBody, parseDraftBlock } from "../issue";
import { MAX_PER_DAY, NEWS_MAX_PER_DAY, NEWS_MIN_MINUTES_BETWEEN, type Posted, type QueueItem, pickNews, pickNext } from "../schedule";
import { addMonths } from "../format";
import type { Headline, Series } from "../types";
import { CellIndex, verifyInsight } from "../verify";
import { seriesContext, tariffContext } from "./charts";
import { decodeEntities, parseRss } from "./feeds";
import { NEWS_LOOKBACK_HOURS, NEWS_RECHECK_HOURS, countriesIn, findStories, inCooldown, newsId, parseNewsId, partnersFor, pruneState, recentlyRejected } from "./match";
import { COUNTRY_ALIASES, NEWS_TOPICS } from "./topics";

const NOW = "2026-10-22T18:00:00.000Z";
const hoursAgo = (h: number) => new Date(Date.parse(NOW) - h * 3_600_000).toISOString();
const head = (title: string, source: string, over: Partial<Headline> = {}): Headline => ({ title, source, url: `https://example.com/${encodeURIComponent(title)}`, published: hoursAgo(1), feed: "outlets", ...over });
const PARTNERS = partnersFor(
  [
    { code: "CAN", name: "Canada" },
    { code: "CHN", name: "China" },
    { code: "MEX", name: "Mexico" },
    { code: "GBR", name: "United Kingdom" },
  ],
  COUNTRY_ALIASES,
);

describe("feeds", () => {
  it("parses an outlet's items under the outlet's own name, dropping undated items and non-web links", () => {
    const xml = `<rss><channel><item><title>Canada answers U.S. tariffs</title><link>https://apnews.com/article/abc</link>
      <pubDate>Thu, 22 Oct 2026 16:10:21 GMT</pubDate><source url="https://flipboard.com">Top Stories</source></item>
      <item><title>No date</title><link>https://x.com/a</link></item>
      <item><title>Not a web link</title><link>mailto:x@y.z</link><pubDate>Thu, 22 Oct 2026 16:10:21 GMT</pubDate></item></channel></rss>`;
    expect(parseRss(xml, "outlets", "Associated Press", "apnews")).toEqual([
      { title: "Canada answers U.S. tariffs", source: "Associated Press", url: "https://apnews.com/article/abc", published: "2026-10-22T16:10:21.000Z", feed: "outlets", outletId: "apnews" },
    ]);
  });

  it("parses Atom entries (BLS) with the link in an attribute", () => {
    const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>CPI for all items increases 0.6% in September; gasoline rises</title>
      <link href="https://www.bls.gov/news.release/archives/cpi_10142026.htm"/><id>cpi-1</id>
      <published>2026-10-14T07:50:31.2-04:00</published><updated>2026-10-14T07:50:31.2-04:00</updated></entry></feed>`;
    expect(parseRss(xml, "data", "Bureau of Labor Statistics", "bls")).toEqual([
      { title: "CPI for all items increases 0.6% in September; gasoline rises", source: "Bureau of Labor Statistics", url: "https://www.bls.gov/news.release/archives/cpi_10142026.htm", published: "2026-10-14T11:50:31.200Z", feed: "data", outletId: "bls" },
    ]);
  });

  it("still cuts an aggregator's ' - Publisher' suffix when the item names its source", () => {
    const xml = `<item><title>Diesel prices jump - Reuters</title><link>https://news.example/a</link><pubDate>Thu, 22 Oct 2026 16:10:21 GMT</pubDate><source url="https://www.reuters.com">Reuters</source></item>`;
    expect(parseRss(xml, "outlets", "Example")[0]).toMatchObject({ title: "Diesel prices jump", source: "Reuters" });
  });

  it("decodes entities and CDATA in White House titles", () => {
    expect(decodeEntities("Adjusting Imports of Steel &#8211; Canada &amp; Mexico")).toBe("Adjusting Imports of Steel – Canada & Mexico");
    const xml = `<item><title><![CDATA[Imposing Duties on Canada]]></title><link>https://www.whitehouse.gov/a</link><pubDate>Thu, 22 Oct 2026 15:00:00 +0000</pubDate></item>`;
    expect(parseRss(xml, "whitehouse", "The White House")[0]).toMatchObject({ title: "Imposing Duties on Canada", source: "The White House", feed: "whitehouse" });
  });
});

describe("matching headlines to stories", () => {
  it("recognises partners by name and demonym, case-sensitively", () => {
    expect(countriesIn("Canadian lumber faces new tariffs", PARTNERS).map((p) => p.code)).toEqual(["CAN"]);
    expect(countriesIn("Tariffs on UK steel", PARTNERS).map((p) => p.code)).toEqual(["GBR"]);
    expect(countriesIn("A china shop owner on tariffs", PARTNERS)).toEqual([]);
  });

  it("needs two publishers, or one official document", () => {
    const one = findStories([head("Diesel prices jump", "Reuters")], NEWS_TOPICS, PARTNERS, NOW);
    expect(one).toEqual([]);
    const two = findStories([head("Diesel prices jump", "Reuters"), head("Diesel deal announced", "AP")], NEWS_TOPICS, PARTNERS, NOW);
    expect(two.map((s) => s.key)).toEqual(["diesel"]);
    const official = findStories([head("Adjusting Imports of Steel Into the United States", "The White House", { feed: "whitehouse" })], NEWS_TOPICS, PARTNERS, NOW);
    expect(official.map((s) => [s.key, s.official])).toEqual([["tariff.all", true]]);
  });

  it("ignores old headlines and excluded senses of a word", () => {
    const old = findStories([head("Diesel prices jump", "Reuters", { published: hoursAgo(NEWS_LOOKBACK_HOURS + 1) }), head("Diesel deal", "AP")], NEWS_TOPICS, PARTNERS, NOW);
    expect(old).toEqual([]);
    const utility = findStories([head("Regulators delay electricity tariff case", "KATV"), head("Water tariff increase opposed", "Weekly")], NEWS_TOPICS, PARTNERS, NOW);
    expect(utility).toEqual([]);
  });

  it("makes a one-partner tariff story that partner's, and ranks it ahead of tariffs in general", () => {
    const stories = findStories(
      [
        head("U.S. raises tariffs on Canada", "Reuters"),
        head("Canadian officials respond to tariff hike", "CBC"),
        ...["A", "B", "C", "D", "E", "F"].map((s) => head(`How tariffs reshape trade, part ${s}`, s)),
        head("Tariffs on Canada and Mexico", "Bloomberg"),
      ],
      NEWS_TOPICS,
      PARTNERS,
      NOW,
    );
    expect(stories.map((s) => s.key)).toEqual(["tariff.CAN", "tariff.all"]);
    expect(stories[0]!.country).toEqual({ code: "CAN", name: "Canada" });
    // The two-partner headline counts toward the all-countries story, not either partner's.
    expect(stories[1]!.headlines.some((h) => h.title.includes("Canada and Mexico"))).toBe(true);
  });

  it("drafts a topic at most once in the cooldown, and remembers turned-down stories for a few hours", () => {
    expect(parseNewsId(newsId("tariff.CAN", "2026-10-20"))).toEqual({ key: "tariff.CAN", day: "2026-10-20" });
    expect(inCooldown("tariff.CAN", [newsId("tariff.CAN", "2026-10-20")], "2026-10-22")).toBe(true);
    expect(inCooldown("tariff.CAN", [newsId("tariff.CAN", "2026-10-19")], "2026-10-22")).toBe(false);
    expect(inCooldown("tariff.CAN", [newsId("tariff.MEX", "2026-10-22")], "2026-10-22")).toBe(false);
    const state = { rejected: { diesel: { at: hoursAgo(1), official: false, reason: "a recall" } } };
    expect(recentlyRejected({ key: "diesel", official: false }, state, NOW)).toBe(true);
    expect(recentlyRejected({ key: "diesel", official: true }, state, NOW)).toBe(false);
    expect(recentlyRejected({ key: "diesel", official: false }, state, new Date(Date.parse(NOW) + NEWS_RECHECK_HOURS * 3_600_000).toISOString())).toBe(false);
    expect(pruneState(state, new Date(Date.parse(NOW) + NEWS_RECHECK_HOURS * 3_600_000).toISOString())).toEqual({ rejected: {} });
  });
});

describe("news charts", () => {
  it("reads one month out of an array field", () => {
    const index = new CellIndex(undefined, { "f.json": [{ country_code: "CAN", year: 2026, rate: [0.03, null, 0.032] }] });
    expect(index.resolve({ file: "f.json", key: { country_code: "CAN", year: 2026 }, field: "rate", index: 2 })).toBe(0.032);
    expect(() => index.resolve({ file: "f.json", key: { country_code: "CAN", year: 2026 }, field: "rate", index: 1 })).toThrow(/rate\[1\] is not a number/);
  });

  // Against the committed outputs: every fact traces to its cells, and the template passes the caption check.
  it("builds a country-against-all tariff chart whose facts verify", () => {
    const lead = "Tariffs involving Canada are in the news.";
    const insight = tariffContext({ code: "CAN", name: "Canada" }, { lead, id: "news:tariff.CAN:2026-10-22" })!;
    expect(insight.kind).toBe("news");
    // The post links to the tariff card filtered to the country, not the bare page.
    expect(insight.anchor).toBe("?country=CAN#tariffs");
    expect(insight.chart.type === "line" && insight.chart.comparison?.mainLabel).toBe("Canada");
    expect(verifyInsight(insight, new CellIndex())).toEqual([]);
    expect(templateCaption(insight)).toMatchObject({ source: "template" });
    expect(insight.template.startsWith(lead)).toBe(true);
    // The comparison point is the peak (a year earlier only when the latest month is the peak).
    expect(insight.facts.slice(0, 3).map((f) => f.id)).toEqual(["latest_value", "latest_date", "all_countries_value"]);
    expect(insight.facts.some((f) => f.id === "peak_value") || insight.facts.some((f) => f.id === "year_ago_value")).toBe(true);
  });

  it("compares with the peak, and with a year earlier only when the latest value is the peak", () => {
    const file = "pipeline/output/test_news.json";
    const make = (values: number[]) => {
      const rows = values.map((value, i) => ({ series_id: "T", date: addMonths("2016-01-01", i), value }));
      const series: Series = {
        id: "t", dataset: "gas", name: "the test price", axisLabel: "dollars", unit: { scale: 1, decimals: 2, prefix: "$", suffix: "" },
        frequency: "monthly", seasonal: false, kind: "level", moveMode: "pct", url: "/x", source: "Test", weight: 1, releaseLagDays: 1,
        points: rows.map((r) => ({ date: r.date, value: r.value, cells: [{ file, key: { series_id: "T", date: r.date }, field: "value" }] })),
      };
      const insight = seriesContext(series, { years: 10, peak: true, lead: "Prices are in the news.", id: "news:t" })!;
      expect(verifyInsight(insight, new CellIndex(undefined, { [file]: rows }))).toEqual([]);
      return insight.template;
    };
    const rising = Array.from({ length: 40 }, (_, i) => 2 + i * 0.05);
    // Peak earlier (month 30): the caption names it and how far back it stands, and says nothing of a year earlier.
    const peaked = make([...rising.slice(0, 31), ...rising.slice(0, 9).map((v) => v + 0.5)]);
    expect(peaked).toMatch(/: \$[\d.]+ in April 2019, down from a peak of \$3\.50 in July 2018, the highest in data going back to 2016\.$/);
    expect(peaked).not.toContain("year earlier");
    // The latest value is the peak: a year earlier, plus how far back it stands.
    expect(make(rising)).toMatch(/up [\d.]+% from a year earlier \(\$[\d.]+\), the highest in data going back to 2016\.$/);
  });

  it("links every news topic's chart to its card on the page", () => {
    const all = (["gas", "energy", "trade", "encounters", "ice"] as const).flatMap((d) => loadDataset(d).series);
    for (const t of NEWS_TOPICS) {
      if (t.build.kind !== "series") continue;
      const id = t.build.seriesId;
      expect(all.find((s) => s.id === id)?.anchor, id).toMatch(/^#[a-z-]+$/);
    }
  });

  it("builds series context charts whose facts verify", () => {
    const diesel = loadDataset("gas").series.find((s) => s.id === "gas.diesel")!;
    const removals = loadDataset("ice").series.find((s) => s.id === "ice.removals")!;
    for (const [series, peak] of [[diesel, true], [removals, false]] as const) {
      const insight = seriesContext(series, { years: 10, peak, lead: "X is in the news.", id: `news:${series.id}:2026-10-22` })!;
      expect(verifyInsight(insight, new CellIndex())).toEqual([]);
      expect(templateCaption(insight)).toMatchObject({ source: "template" });
    }
  });

  it("holds the caption to its fixed opening", () => {
    const facts = [{ id: "latest_value", text: "$6.18 a gallon" }];
    expect(checkCaption("Diesel is in the news. The U.S. average price of diesel was $6.18 a gallon in the latest week.", facts, { lead: "Diesel is in the news." })).toEqual([]);
    expect(checkCaption("Diesel made headlines. The U.S. average price of diesel was $6.18 a gallon in the latest week.", facts, { lead: "Diesel is in the news." })).toContain('must begin with exactly "Diesel is in the news."');
  });

  it("puts the headlines, expiry and lead in the issue and its block", () => {
    const insight = tariffContext({ code: "CAN", name: "Canada" }, { lead: "Tariffs involving Canada are in the news.", id: "news:tariff.CAN:2026-10-22" })!;
    const news = { topic: "tariff", key: "tariff.CAN", seenAt: NOW, expiresAt: "2026-10-23T18:00:00.000Z", headlines: [head("U.S. raises tariffs on Canada", "Reuters")], reason: "2 publishers" };
    const draft = { ...insight, slug: "s", caption: insight.template, caption_source: "template", caption_model: null, link: "https://insidegov.fyi/presidency/trade", post_text: insight.template, image: "s.png", series_id: insight.seriesId, release: null, lead: insight.lead, news } as unknown as Draft;
    const body = issueBody(draft, "https://img/s.png");
    expect(body).toContain("**In the news**");
    expect(body).toContain("U.S. raises tariffs on Canada");
    expect(body).toContain("posts within a few minutes");
    expect(body).not.toContain("That queues it");
    expect(parseDraftBlock(body)).toMatchObject({ kind: "news", lead: insight.lead, news: { key: "tariff.CAN", expiresAt: news.expiresAt } });
  });
});

describe("the news lane", () => {
  const news = (over: Partial<QueueItem> & { key: string }): QueueItem => ({
    id: `news:${over.key}:2026-10-22`,
    kind: "news",
    dataset: "gas",
    seriesId: `s.${over.key}`,
    period: "2026-10-12",
    score: 10,
    frequency: "weekly",
    releasedOn: "2026-10-22",
    expiresOn: "2026-10-23",
    expiresAt: "2026-10-23T18:00:00.000Z",
    ...over,
  });
  const data = (key: string): QueueItem => ({ key, id: key, kind: "extreme_high", dataset: "energy", seriesId: `s.${key}`, period: "2026-09-01", score: 10, frequency: "monthly", releasedOn: "2026-10-19", expiresOn: "2026-11-09" });

  it("posts a fresh approved news draft at once, any day and hour", () => {
    // Saturday, 11 p.m. Pacific.
    const d = pickNews([news({ key: "1", expiresAt: "2026-10-25T12:00:00.000Z" })], [], "2026-10-25T06:00:00.000Z");
    expect(d.post?.key).toBe("1");
  });

  it("waits for the intro, spacing, and the daily cap; expires stale drafts", () => {
    expect(pickNews([news({ key: "1" }), { ...data("intro"), kind: "intro" }], [], NOW).post).toBeNull();
    const recent: Posted[] = [{ dataset: "energy", postedAt: new Date(Date.parse(NOW) - (NEWS_MIN_MINUTES_BETWEEN - 5) * 60_000).toISOString() }];
    expect(pickNews([news({ key: "1" })], recent, NOW).reason).toMatch(/minutes ago/);
    const capped: Posted[] = Array.from({ length: NEWS_MAX_PER_DAY }, (_, i) => ({ dataset: "gas", kind: "news", postedAt: hoursAgo(2 + i) }));
    expect(pickNews([news({ key: "1" })], capped, NOW).reason).toMatch(/news posts today/);
    const stale = pickNews([news({ key: "1", expiresAt: hoursAgo(1) })], [], NOW);
    expect(stale.post).toBeNull();
    expect(stale.expired.map((q) => q.key)).toEqual(["1"]);
  });

  it("leaves news drafts out of the data slots, and news posts out of their daily cap", () => {
    // 9:00 a.m. Pacific on a Thursday.
    const at = "2026-10-22T16:00:00.000Z";
    expect(pickNext([news({ key: "n" })], [], at, "morning").post).toBeNull();
    const newsToday: Posted[] = Array.from({ length: MAX_PER_DAY }, (_, i) => ({ dataset: `t${i}`, kind: "news", postedAt: new Date(Date.parse(at) - (4 + i) * 3_600_000).toISOString() }));
    expect(pickNext([data("d")], newsToday, at, "morning").post?.key).toBe("d");
    // A news post minutes before the slot holds it back.
    const justNow: Posted[] = [{ dataset: "gas", kind: "news", postedAt: new Date(Date.parse(at) - 10 * 60_000).toISOString() }];
    expect(pickNext([data("d")], justNow, at, "morning").post).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import type { Headline } from "../types";
import {
  type Candidate,
  LEAN_ORDER,
  MAX_PER_CHART,
  MAX_STORIES,
  type PageStory,
  STORY_TTL_DAYS,
  STORY_WINDOW_DAYS,
  addCompanions,
  groupCandidates,
  mergeStories,
  needsCheck,
  pageFile,
  parseStoryId,
  pickHeadlines,
  releaseFor,
  sameDevelopment,
  storyFor,
} from "./cards";
import { partnersFor } from "./match";
import { ALLSIDES_READ_ON, DATA_SOURCES, OUTLETS, isOpinion, outletById } from "./outlets";
import { COUNTRY_ALIASES, NEWS_PAGES, PAGE_TOPICS } from "./topics";

const NOW = "2026-10-27T18:00:00.000Z";
const hoursAgo = (h: number) => new Date(Date.parse(NOW) - h * 3_600_000).toISOString();
const daysAgo = (d: number) => hoursAgo(d * 24);
let n = 0;
/** An outlet headline: the outlet's name from the roster, a unique URL. */
const h = (outletId: string, title: string, published = hoursAgo(2)): Headline => ({
  title,
  source: outletById.get(outletId)?.name ?? outletId,
  url: `https://example.com/${outletId}/${++n}`,
  published,
  feed: "outlets",
  outletId,
});
const rel = (outletId: string, title: string, published = hoursAgo(3)): Headline => ({ ...h(outletId, title, published), feed: "data", source: outletId.toUpperCase() });
const PARTNERS = partnersFor([{ code: "CAN", name: "Canada" }, { code: "MEX", name: "Mexico" }], COUNTRY_ALIASES);
const topic = (id: string) => PAGE_TOPICS.find((t) => t.id === id)!;
const cand = (id: string, headlines: Headline[]): Candidate => ({ topic: topic(id), key: id, headlines });

describe("outlets and opinion filtering", () => {
  it("keeps every lean in AllSides' scale, one table with its date, ids the UI can use", () => {
    expect(ALLSIDES_READ_ON).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const o of OUTLETS) {
      expect(o.id).toMatch(/^[a-z0-9]+$/);
      expect(LEAN_ORDER).toContain(o.lean);
      for (const f of o.feeds) expect(f).toMatch(/^https:\/\//);
    }
    for (const d of DATA_SOURCES) expect(d.id).toMatch(/^[a-z0-9]+$/);
    expect(new Set([...OUTLETS, ...DATA_SOURCES].map((o) => o.id)).size).toBe(OUTLETS.length + DATA_SOURCES.length);
    // Both sides have roster outlets (reserves aside), or no card could ever be balanced.
    expect(OUTLETS.filter((o) => !o.reserve && (o.lean === "Left" || o.lean === "Lean Left")).length).toBeGreaterThan(1);
    expect(OUTLETS.filter((o) => !o.reserve && (o.lean === "Right" || o.lean === "Lean Right")).length).toBeGreaterThan(1);
    // No opinion feeds: Fox's opinion feed, the Guardian's comment section.
    expect(OUTLETS.flatMap((o) => o.feeds).filter((f) => /opinion|commentisfree/.test(f))).toEqual([]);
  });

  it("drops opinion by URL, show blogs by the outlet's own paths, and marked titles", () => {
    expect(isOpinion({ title: "The tariff mistake", url: "https://www.nytimes.com/2026/10/27/opinion/tariffs.html" })).toBe(true);
    expect(isOpinion({ title: "Tariffs again", url: "https://www.theguardian.com/commentisfree/2026/oct/27/tariffs" })).toBe(true);
    expect(isOpinion({ title: "Border talks", url: "https://www.nbcnews.com/meet-the-press/border-talks-n1" }, outletById.get("nbcnews"))).toBe(true);
    expect(isOpinion({ title: "Opinion | Why inflation is back", url: "https://example.com/news/1" })).toBe(true);
    expect(isOpinion({ title: "Analysis: What the jobs report means", url: "https://example.com/news/2" })).toBe(true);
    expect(isOpinion({ title: "Live updates: Supreme Court rules on tariffs", url: "https://example.com/news/3" })).toBe(true);
    expect(isOpinion({ title: "Supreme Court allows Texas deportation deal", url: "https://www.nytimes.com/2026/10/27/us/politics/supreme-court.html" }, outletById.get("nytimes"))).toBe(false);
    // The same /meet-the-press/ path is not a show blog at another outlet.
    expect(isOpinion({ title: "x", url: "https://example.com/meet-the-press/x" }, outletById.get("foxnews"))).toBe(false);
  });

  it("leaves outlets with no opinion signal to the Claude check", () => {
    expect(needsCheck(h("huffpost", "Inflation climbs"))).toBe(true);
    expect(needsCheck(h("nytimes", "Inflation climbs"))).toBe(false);
    const without = groupCandidates([h("huffpost", "Inflation climbs to 3.7%"), h("foxnews", "Inflation climbs again")], PAGE_TOPICS, PARTNERS, NOW, (x) => !needsCheck(x));
    expect(without.flatMap((c) => c.headlines.map((x) => x.outletId))).toEqual(["foxnews"]);
  });
});

describe("grouping headlines into stories", () => {
  it("maps each headline to the first topic it matches, one chart on one page", () => {
    const cs = groupCandidates(
      [h("nytimes", "Diesel and gas prices climb"), h("foxnews", "Gas prices fall for a third week"), h("nypost", "Mortgage rates jump"), h("cbsnews", "A story about nothing we chart")],
      PAGE_TOPICS,
      PARTNERS,
      NOW,
    );
    expect(cs.map((c) => [c.key, c.topic.page, c.topic.chartId, c.headlines.length])).toEqual([
      ["diesel", "economy", "chart-diesel", 1],
      ["gasoline", "economy", "chart-gas", 1],
      ["mortgage", "economy", "chart-mort", 1],
    ]);
  });

  it("keys tariff stories by the one partner named, and drops utility tariffs", () => {
    const cs = groupCandidates(
      [h("nbcnews", "U.S. cancels some Canada tariffs"), h("foxnews", "Trump drops tariffs on Canadian lumber"), h("wsj", "Tariffs on Canada and Mexico"), h("thehill", "Regulators delay electricity tariff case")],
      PAGE_TOPICS,
      PARTNERS,
      NOW,
    );
    expect(cs.map((c) => [c.key, c.headlines.length, c.topic.label(c.country?.name)])).toEqual([
      ["tariff.CAN", 2, "Tariffs involving Canada"],
      ["tariff.all", 1, "Tariffs"],
    ]);
  });

  it("cuts a topic into stories of STORY_WINDOW_DAYS, and ignores headlines past STORY_TTL_DAYS", () => {
    const cs = groupCandidates(
      [
        h("nytimes", "Inflation rises", daysAgo(10)),
        h("foxnews", "Inflation rises again", daysAgo(10 - STORY_WINDOW_DAYS + 0.5)),
        h("nbcnews", "Inflation eases", daysAgo(2)),
        h("nypost", "Inflation from long ago", daysAgo(STORY_TTL_DAYS + 1)),
      ],
      PAGE_TOPICS,
      PARTNERS,
      NOW,
    );
    expect(cs.map((c) => c.headlines.map((x) => x.outletId))).toEqual([["nytimes", "foxnews"], ["nbcnews"]]);
  });

  it("without the check, keeps headlines that share detail words with another outlet's, unless the topic is periodic", () => {
    const court = cand("removals", [
      h("nytimes", "Supreme Court allows Texas deal on deportation proceedings"),
      h("washingtonexaminer", "Supreme Court backs Texas deportation deal"),
      h("foxnews", "Prosecutors tailored plea deals to shield immigrants from deportation"),
    ]);
    expect(sameDevelopment(court).map((x) => x.outletId)).toEqual(["nytimes", "washingtonexaminer"]);
    const cpi = cand("inflation", [h("nytimes", "Higher energy prices pushed inflation to 3.7%"), h("foxnews", "Consumer inflation rose faster than expected")]);
    expect(sameDevelopment(cpi)).toHaveLength(2);
  });

  it("joins headlines that tell the story without the topic's words", () => {
    const c = groupCandidates([h("nytimes", "Supreme Court allows Texas deal with Justice Dept. on deportation proceedings")], PAGE_TOPICS, PARTNERS, NOW);
    const joined = addCompanions(
      c,
      [...c[0]!.headlines, h("washingtonexaminer", "Supreme Court declines to halt DOJ deal ending Biden-era immigration rule"), h("foxnews", "Supreme Court hears a voting case")],
      PAGE_TOPICS,
      PARTNERS,
      NOW,
    );
    expect(joined[0]!.headlines.map((x) => x.outletId)).toEqual(["nytimes", "washingtonexaminer"]);
  });
});

describe("the outlet rule", () => {
  it("needs two outlets, of any lean, and shows both sides when both ran the story", () => {
    expect(pickHeadlines([h("nytimes", "Jobs report")])).toBeNull();
    expect(pickHeadlines([h("nytimes", "Jobs report a"), h("wsj", "Jobs report b")])?.map((x) => x.outletId)).toEqual(["nytimes", "wsj"]);
    expect(pickHeadlines([h("foxnews", "Jobs report a"), h("bbc", "Jobs report b")])).toHaveLength(2);
    expect(pickHeadlines([h("nytimes", "Jobs report a"), h("foxnews", "Jobs report b")])?.map((x) => x.lean)).toEqual(["Lean Left", "Right"]);
  });

  it("fills the places with other outlets when a side is missing, one headline per outlet", () => {
    const hs = [h("nytimes", "Tariffs a"), h("nbcnews", "Tariffs b"), h("nytimes", "Tariffs c"), h("wsj", "Tariffs d")];
    expect(pickHeadlines(hs)?.map((x) => x.outletId).sort()).toEqual(["nbcnews", "nytimes", "wsj"]);
  });

  it("shows at most three: the data release ahead of a Center outlet, then left to right", () => {
    const hs = [h("foxnews", "Inflation climbs"), h("wsj", "Inflation rises"), h("nytimes", "Inflation up"), h("nbcnews", "Prices rise"), h("nypost", "Inflation bites")];
    expect(pickHeadlines(hs)?.map((x) => x.outletId)).toEqual(["nytimes", "wsj", "foxnews"]);
    const withData = pickHeadlines(hs, rel("bls", "CPI for all items increases 0.6% in September"));
    expect(withData?.map((x) => [x.outletId, x.lean])).toEqual([["bls", "Data"], ["nytimes", "Lean Left"], ["foxnews", "Right"]]);
    expect(withData).toHaveLength(3);
  });

  it("prefers the outlet that covered the story most, then the stronger roster outlet; reserves only to fill a side", () => {
    const most = pickHeadlines([h("nytimes", "Border a"), h("guardian", "Border b"), h("guardian", "Border c"), h("foxnews", "Border d")]);
    expect(most?.[0]).toMatchObject({ outletId: "guardian", title: "Border b" });
    expect(pickHeadlines([h("cbsnews", "Border a"), h("nytimes", "Border b"), h("foxnews", "Border c")])?.[0]?.outletId).toBe("nytimes");
    expect(pickHeadlines([h("apnews", "Border a"), h("apnews", "Border b"), h("nbcnews", "Border c"), h("foxnews", "Border d")])?.[0]?.outletId).toBe("nbcnews");
    expect(pickHeadlines([h("apnews", "Border a"), h("foxnews", "Border d")])?.[0]?.outletId).toBe("apnews");
  });

  it("never shows the same wire headline on both sides", () => {
    const wire = "US consumer confidence recovers in October as gas prices eased a bit";
    expect(pickHeadlines([h("apnews", wire), h("washingtontimes", wire)])).toBeNull(); // the same copy twice shows nothing about framing
    expect(pickHeadlines([h("apnews", wire), h("washingtontimes", wire), h("foxnews", "Gas prices ease")])?.map((x) => x.outletId)).toEqual(["apnews", "foxnews"]);
  });

  it("gives a partner's tariff card only a release that names the partner", () => {
    const heads = [h("nbcnews", "Trump administration cancels some Canada tariffs", hoursAgo(5)), h("pbsnewshour", "Trump exempts some Canadian imports from his 50% tariffs", hoursAgo(4))];
    const c = groupCandidates(heads, PAGE_TOPICS, PARTNERS, NOW).find((x) => x.key === "tariff.CAN")!;
    const turbines = rel("federalregister", "Adjusting Imports of Wind Turbines and Their Parts and Components Into the United States", hoursAgo(6));
    const canada = rel("federalregister", "Adjusting Imports of Softwood Lumber From Canada", hoursAgo(7));
    expect(releaseFor(c, [turbines])).toBeUndefined();
    expect(releaseFor(c, [turbines, canada])).toBe(canada);
    // A story about tariffs in general still takes the general proclamation.
    const all = { ...c, key: "tariff.all", country: undefined };
    expect(releaseFor(all, [turbines])).toBe(turbines);
  });

  it("attaches the agency's release from around the story's dates, and dates the story by its earliest headline", () => {
    const c = cand("inflation", [h("nytimes", "Inflation rises to 3.7%", hoursAgo(5)), h("foxnews", "Inflation rose faster than expected", hoursAgo(4))]);
    const cpi = rel("bls", "CPI for all items increases 0.6% in September", daysAgo(1));
    expect(releaseFor(c, [rel("bls", "Payroll employment rises"), cpi, rel("bls", "CPI from last month", daysAgo(30))])).toBe(cpi);
    expect(releaseFor(cand("removals", c.headlines), [cpi])).toBeUndefined();
    const story = storyFor(c, c.headlines, [cpi])!;
    expect(story).toMatchObject({ id: "inflation-2026-10-27", date: "2026-10-26", topic: "Inflation", chartId: "chart-infl" });
    expect(story.headlines[0]).toMatchObject({ lean: "Data", outletId: "bls" });
    expect(storyFor(c, [c.headlines[0]!], [cpi])).toBeNull();
  });
});

describe("the page file", () => {
  const story = (id: string, date: string, chartId = `chart-${id}`): PageStory => ({ id: `${id}-${date}`, date, topic: id, chartId, headlines: [] });

  it("limits chartless cards per topic, like charted ones per chart", () => {
    const chartless = (id: string, date: string): PageStory => ({ id: `${id}-${date}`, date, topic: id, headlines: [] });
    const merged = mergeStories([], [chartless("drilling", "2026-10-27"), chartless("drilling", "2026-10-20"), chartless("drilling", "2026-10-13"), chartless("visas", "2026-10-26")], NOW);
    expect(merged.map((s) => s.id)).toEqual(["drilling-2026-10-27", "visas-2026-10-26", "drilling-2026-10-20"]);
  });

  it("gives a chartless topic a card without a chart id", () => {
    const methane = [h("nbcnews", "Trump says he'll roll back Biden-era methane rules for oil and gas"), h("washingtonexaminer", "Trump unveils plan to loosen methane rules for oil and gas industry")];
    const c = groupCandidates(methane, PAGE_TOPICS, PARTNERS, NOW)[0]!;
    expect(c.topic.id).toBe("emissions_rules");
    const story = storyFor(c, c.headlines, [])!;
    expect(story.topic).toBe("Emissions rules");
    expect("chartId" in story).toBe(false);
  });

  it("expires cards after STORY_TTL_DAYS and lists the newest first", () => {
    const merged = mergeStories([story("infl", "2026-10-10"), story("gas", "2026-10-25"), story("mort", "2026-10-13")], [story("jobs", "2026-10-27")], NOW);
    expect(merged.map((s) => s.id)).toEqual(["jobs-2026-10-27", "gas-2026-10-25", "mort-2026-10-13"]);
  });

  it("refreshes a card with the same id, and keeps the first card of a story that is still running", () => {
    const old = { ...story("infl", "2026-10-20"), topic: "old" };
    expect(mergeStories([old], [{ ...story("infl", "2026-10-20"), topic: "new" }], NOW)[0]!.topic).toBe("new");
    expect(mergeStories([old], [story("infl", "2026-10-22")], NOW).map((s) => s.id)).toEqual(["infl-2026-10-20"]);
    expect(mergeStories([old], [story("infl", "2026-10-25")], NOW).map((s) => s.id)).toEqual(["infl-2026-10-25", "infl-2026-10-20"]);
    expect(parseStoryId("tariff.CAN-2026-10-24")).toEqual({ key: "tariff.CAN", day: "2026-10-24" });
  });

  it("caps the cards per chart and per page", () => {
    const many = Array.from({ length: 9 }, (_, i) => story(`t${i}`, `2026-10-${String(26 - i).padStart(2, "0")}`, i < 4 ? "chart-gas" : `chart-${i}`));
    const merged = mergeStories([], many, NOW);
    expect(merged).toHaveLength(MAX_STORIES);
    expect(merged.filter((s) => s.chartId === "chart-gas")).toHaveLength(MAX_PER_CHART);
  });

  it("moves asOf only when the stories change", () => {
    const stories = [story("gas", "2026-10-25")];
    expect(pageFile({ asOf: "2026-10-25", stories }, stories, NOW).asOf).toBe("2026-10-25");
    expect(pageFile({ asOf: "2026-10-25", stories: [] }, stories, NOW).asOf).toBe("2026-10-27");
    expect(pageFile(null, [], NOW).asOf).toBe("2026-10-27");
  });

  it("points every topic at a chart its page has", () => {
    const CHARTS: Record<string, string[]> = {
      economy: ["chart-gas", "chart-diesel", "chart-infl", "chart-jobs", "chart-un", "chart-wage", "chart-gdp", "chart-mort", "chart-def", "chart-debt", "chart-inc", "chart-ff", "chart-ten"],
      immigration: ["chart-encounters", "chart-removals", "chart-green-cards", "chart-refugees"],
      trade: ["tariffs", "trade-balance"],
      energy: ["spr", "supply", "oil", "lng", "electricity"],
      laws: ["how-many-laws-does-congress-pass"],
      decisions: ["how-many-cases-does-the-court-decide"],
    };
    expect(Object.keys(CHARTS)).toEqual([...NEWS_PAGES]);
    for (const t of PAGE_TOPICS) {
      if (t.chartId) expect(CHARTS[t.page], t.id).toContain(t.chartId);
      if (t.release) expect(DATA_SOURCES.map((d) => d.id)).toContain(t.release.source);
    }
  });
});

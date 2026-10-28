import type { Headline } from "../types";
import { type Candidate, pickHeadlines } from "./cards";
import { NEWS_FRESH_HOURS } from "./match";
import { outletById } from "./outlets";
import { type ChartBuild, NEWS_TOPICS, PAGE_CHARTS, PAGE_TOPICS, type PageTopic } from "./topics";

/**
 * From the page's "In the news" stories to social drafts, pure (tested in social.test.ts). The page cards and the social
 * news lane share one story detector (cards.ts: topics, 3-day story windows, the Claude check that keeps one
 * development, the chart pick, the two-outlet rule); this file decides which of those stories become a context-chart
 * draft, and which chart and opening line each gets.
 *
 * A story becomes a draft only when the site has a series to chart for it (`socialBuild`). The story's headlines never
 * reach the post: they are listed in the issue for the reviewer.
 */

/** A story's first headline must be this recent (hours): a chart is context for today's news, not last week's. */
export const NEWS_STORY_MAX_AGE_HOURS = NEWS_FRESH_HOURS;

export type SocialBuild = {
  /** The caption's fixed first sentence: names the topic, never describes the news. */
  lead: (country?: string) => string;
  build: ChartBuild;
  /** Ranking weight when several stories are in the news at once. */
  weight: number;
  /** Printed on the chart after the source: what the chart is not. */
  note?: string;
  /** The same, as a sentence for the caption writer. */
  context?: string;
  /** Dedupe key: one draft per key in the cooldown. Defaults to the story's own key. */
  key?: string;
};

/** Topics with a chart the original social topics (topics.ts NEWS_TOPICS) do not have. */
const EXTRA: Record<string, SocialBuild> = {
  venezuela_oil: {
    lead: () => "Venezuelan oil is in the news.",
    build: { kind: "series", seriesId: "energy.petroleum_imports", years: 10, peak: true },
    weight: 1.2,
    note: "All countries, not Venezuela alone",
    context: "The chart shows total U.S. petroleum imports from all countries, not imports from Venezuela; the caption must not suggest otherwise.",
  },
  electricity: {
    lead: () => "U.S. electricity is in the news.",
    build: { kind: "series", seriesId: "energy.power_total", years: 10, peak: true },
    weight: 0.9,
  },
  mortgage: {
    lead: () => "Mortgage rates are in the news.",
    build: { kind: "series", seriesId: "economy.mortgage_rate", years: 10, peak: true },
    weight: 1.2,
  },
  fed_rates: {
    lead: () => "The Federal Reserve and interest rates are in the news.",
    build: { kind: "series", seriesId: "economy.fed_funds", years: 10, peak: true },
    weight: 1.2,
  },
  treasury_yields: {
    lead: () => "Treasury yields are in the news.",
    build: { kind: "series", seriesId: "economy.treasury_10y", years: 10, peak: true },
    weight: 1.0,
  },
  unemployment: {
    lead: () => "Unemployment is in the news.",
    build: { kind: "series", seriesId: "economy.unemployment", years: 10, peak: true },
    weight: 1.2,
  },
  inflation: {
    lead: () => "Inflation is in the news.",
    build: { kind: "series", seriesId: "economy.inflation", years: 10, peak: true },
    weight: 1.4,
  },
  // A monthly change has no meaningful "peak" (the biggest gain ever was a pandemic rebound): it reads against a year earlier.
  // Five years, so April 2020's loss of 20 million jobs does not flatten the line.
  jobs: {
    lead: () => "The jobs report is in the news.",
    build: { kind: "series", seriesId: "economy.jobs_added", years: 5, peak: false },
    weight: 1.4,
  },
  gdp: {
    lead: () => "Economic growth is in the news.",
    build: { kind: "series", seriesId: "economy.gdp_growth", years: 10, peak: true },
    weight: 1.2,
  },
  wages: {
    lead: () => "Wages are in the news.",
    build: { kind: "series", seriesId: "economy.real_earnings", years: 10, peak: true },
    weight: 1.0,
  },
  income: {
    lead: () => "Household income is in the news.",
    build: { kind: "series", seriesId: "economy.household_income", years: 20, peak: true },
    weight: 1.0,
  },
  deficit: {
    lead: () => "The federal deficit is in the news.",
    build: { kind: "series", seriesId: "economy.deficit", years: 20, peak: true },
    weight: 1.2,
  },
  // Debt only grows, so its peak is always the latest: it reads against a year earlier.
  debt: {
    lead: () => "The national debt is in the news.",
    build: { kind: "series", seriesId: "economy.debt", years: 10, peak: false },
    weight: 1.1,
  },
};

/** The single generation sources: a story about one gets that source's chart; they never post from a data release. */
const POWER_SOURCES = [
  { name: "nuclear", label: "Nuclear power", seriesId: "energy.power_nuclear", words: /\bnuclear\b/i },
  { name: "coal", label: "Coal power", seriesId: "energy.power_coal", words: /\bcoal\b/i },
  { name: "solar", label: "Solar power", seriesId: "energy.power_solar", words: /\bsolar\b/i },
  { name: "wind", label: "Wind power", seriesId: "energy.power_wind", words: /\b(offshore )?wind\b/i },
];

/**
 * The generation source a "power sources" story is about: the one most of its headlines name, strictly more than any
 * other. A story about several sources at once (or none by name, "renewable energy") has no single chart.
 */
export function powerSource(headlines: Pick<Headline, "title">[]): SocialBuild | null {
  const counts = POWER_SOURCES.map((s) => ({ s, n: headlines.filter((h) => s.words.test(h.title)).length })).sort((a, b) => b.n - a.n);
  const [best, next] = counts;
  if (!best || best.n === 0 || (next && next.n === best.n)) return null;
  return {
    lead: () => `${best.s.label} is in the news.`,
    build: { kind: "series", seriesId: best.s.seriesId, years: 10, peak: true },
    weight: 0.9,
    key: `power_sources.${best.s.name}`,
  };
}

/** The chart for a topic on its own: the social topics' (diesel, gas, tariffs ...) and the extras above. */
function buildOf(topicId: string): SocialBuild | null {
  const extra = EXTRA[topicId];
  if (extra) return extra;
  const t = NEWS_TOPICS.find((n) => n.id === topicId);
  return t ? { lead: t.lead, build: t.build, weight: t.weight } : null;
}

/**
 * The charts the Claude check may pick from for a chartless story: the page's charts that have a social build. The oil
 * card is left out: it shows imports and exports, so a story about one can be linked to the wrong chart.
 */
export function postableCharts(page: PageTopic["page"]) {
  return PAGE_CHARTS[page].filter((c) => c.id !== "oil" && chartTopic(c.id));
}

/** Whether a candidate story of this topic could become a draft at all (so a check is not spent on one that cannot). */
export function couldDraft(topic: PageTopic): boolean {
  return topic.id === "power_sources" || Boolean(buildOf(topic.id)) || (!topic.chartId && postableCharts(topic.page).length > 0);
}

/** The topic whose chart a chart id is, when it has a social build and its chart is just that one. */
function chartTopic(chartId: string): PageTopic | undefined {
  return PAGE_TOPICS.find((t) => t.chartId === chartId && t.id !== "venezuela_oil" && t.id !== "power_sources" && buildOf(t.id));
}

/**
 * The chart and opening for a story: its topic's own, else (a chartless topic) the chart the check picked, else none and
 * the story is not drafted. A story reached through a picked chart is keyed by that chart's topic, so the same chart is
 * not drafted twice in the cooldown under two stories.
 */
export function socialBuild(c: Pick<Candidate, "topic" | "key">, headlines: Pick<Headline, "title">[], pickedChart?: string): SocialBuild | null {
  if (c.topic.id === "power_sources") return powerSource(headlines);
  const own = buildOf(c.topic.id);
  if (own) return { ...own, key: own.key ?? c.key };
  const t = pickedChart ? chartTopic(pickedChart) : undefined;
  const picked = t && buildOf(t.id);
  return picked ? { ...picked, key: t.id } : null;
}

export type SocialStory = {
  /** The dedupe key: "diesel", "tariff.CAN", "power_sources.solar". */
  key: string;
  topic: PageTopic;
  country?: { code: string; name: string };
  /** The headlines the check kept, newest first. */
  headlines: Headline[];
  /** Distinct outlets among them. */
  outlets: number;
  /** The earliest kept headline (ISO). */
  firstSeen: string;
  build: SocialBuild;
  score: number;
  /** The Claude check's one-sentence reason, for the reviewer. */
  reason?: string;
};

/** A story is current when its first kept headline is within NEWS_STORY_MAX_AGE_HOURS of `now`. */
export function isCurrent(headlines: Pick<Headline, "published">[], now: string): boolean {
  const first = headlines.map((h) => Date.parse(h.published)).sort((a, b) => a - b)[0];
  return first !== undefined && (Date.parse(now) - first) / 3_600_000 <= NEWS_STORY_MAX_AGE_HOURS;
}

/**
 * The stories to draft, most notable first. A story needs the page cards' outlet rule (at least two outlets, so the same
 * story the "In the news" row would show), a chart, and a first headline from the last day. One story per chart key:
 * tariffs naming one partner outrank tariffs in general, which would otherwise draft the same chart twice.
 */
export function socialStories(kept: { candidate: Candidate; headlines: Headline[]; chart?: string; reason?: string }[], now: string): SocialStory[] {
  const out = new Map<string, SocialStory>();
  for (const { candidate: c, headlines, chart, reason } of kept) {
    if (!pickHeadlines(headlines) || !isCurrent(headlines, now)) continue;
    const build = socialBuild(c, headlines, chart);
    if (!build) continue;
    const outlets = new Set(headlines.map((h) => h.outletId)).size;
    const sorted = [...headlines].sort((a, b) => b.published.localeCompare(a.published));
    const story: SocialStory = {
      key: build.key ?? c.key,
      topic: c.topic,
      country: c.country,
      headlines: sorted,
      outlets,
      firstSeen: sorted.at(-1)!.published,
      build,
      score: build.weight * (1 + Math.log2(outlets)) * (c.country ? 1.2 : 1),
      reason,
    };
    const chartKey = build.build.kind === "tariff" ? "tariff" : build.build.seriesId;
    // Tariffs: a story naming one partner is the specific one and wins over tariffs in general, whatever the outlet count.
    const prior = out.get(chartKey);
    if (!prior || (Boolean(story.country) !== Boolean(prior.country) ? Boolean(story.country) : story.score > prior.score)) out.set(chartKey, story);
  }
  return [...out.values()].sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
}

/** "Lean Left NBC News, Center Wall Street Journal": who covered it, for the reviewer (the leans are AllSides'). */
export function coverageLine(headlines: Headline[]): string {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const h of headlines) {
    if (!h.outletId || seen.has(h.outletId)) continue;
    seen.add(h.outletId);
    parts.push(`${outletById.get(h.outletId)?.lean ?? "Unrated"} ${h.source}`);
  }
  return parts.join(", ");
}

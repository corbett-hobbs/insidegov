import { formatStoryDate, selectStories, toQuestionGroups } from "../../lib/news-derive";
import { ordinal } from "../../lib/laws-entities";
import type { LawsPayload } from "../../lib/laws-types";
import type { FaqFile, NewsFile } from "../../lib/news-types";
import type { NewsItem } from "../news/NewsSections";
import { LAWS_TAKEAWAYS } from "./takeaways";

/**
 * The Laws page's FAQ, from `faq_laws.json` (`lib/news-types.ts`). A `chartId` is the DOM id of one of the three chart
 * cards, fixed in the markup to the ids the share icon used to derive from their titles (rule 7e); the chip is the card's
 * title. The list of every law takes no questions. Its "In the news" row, from `news_laws.json`, points at the first card: a story about a law
 * draws laws per Congress on that law's topic group as bars (`groupId`), any other story all laws. Relative imports, so `lib/news-derive.test.ts`
 * can load it.
 */

export const LAWS_CHARTS = {
  "how-many-laws-does-congress-pass": "count",
  "how-broadly-are-laws-supported": "support",
  "which-kinds-of-laws-pass-and-how": "groups",
} as const satisfies Record<string, keyof typeof LAWS_TAKEAWAYS>;

type ChartKey = keyof typeof LAWS_CHARTS;
const isChart = (id: string): id is ChartKey => id in LAWS_CHARTS;

export const lawsFaq = (file: FaqFile | null) => toQuestionGroups(file, (id) => (isChart(id) ? { target: id, label: LAWS_TAKEAWAYS[LAWS_CHARTS[id]].title } : null));

/** The chart a story points at: laws per Congress, in the card's own DOM id. */
const COUNT_CHART = "how-many-laws-does-congress-pass";
/** Congresses a story's bars show (about twenty years). */
const BARS = 10;

/** "Oct 20 · Chiricahua National Park Act" cards, each with bars of the laws per Congress on the law's topic group. */
export function lawsNews(data: LawsPayload, file: NewsFile | null): NewsItem[] {
  if (!file) return [];
  const last = data.congresses.length - 1;
  const items: NewsItem[] = [];
  for (const story of selectStories(file.stories)) {
    const item: NewsItem = { id: story.id, date: formatStoryDate(story.date), topic: story.topic, headlines: story.headlines };
    if (story.chartId !== COUNT_CHART) {
      items.push(item);
      continue;
    }
    const group = data.groups.find((g) => g.id === story.groupId);
    const pts = data.congresses.slice(-BARS).map((c, k) => {
      const ci = last - (Math.min(BARS, data.congresses.length) - 1) + k;
      return { x: c, value: data.counts[ci]!.reduce((sum, n, ai) => sum + (!group || data.areas[ai]!.group === group.id ? n : 0), 0) };
    });
    const now = pts[pts.length - 1]!;
    items.push({ ...item, chart: { target: COUNT_CHART, label: group ? `${group.label} laws` : "Laws", value: String(now.value), asOf: `${ordinal(now.x)} Congress${data.partial[last] ? ", so far" : ""}`, pts, bars: true } });
  }
  return items;
}

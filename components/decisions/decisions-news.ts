import { formatStoryDate, selectStories, toQuestionGroups } from "../../lib/news-derive";
import type { DecisionsPayload } from "../../lib/decisions-types";
import type { FaqFile, NewsFile } from "../../lib/news-types";
import type { NewsItem } from "../news/NewsSections";
import { DECISIONS_TAKEAWAYS } from "./takeaways";

/**
 * The Decisions page's FAQ, from `faq_decisions.json` (`lib/news-types.ts`). A `chartId` is the DOM id of one of the three
 * chart cards, fixed in the markup to the ids the share icon used to derive from their titles (rule 7e); the chip is the
 * card's title. The case list takes no questions. Its "In the news" row, from `news_decisions.json`, points at the first card: a ruling's
 * story draws cases per term on the ruling's topic (`groupId`) as bars, any other story all cases. Relative imports, so `lib/news-derive.test.ts`
 * can load it.
 */

export const DECISIONS_CHARTS = {
  "how-many-cases-does-the-court-decide": "cases",
  "how-divided-is-the-court": "split",
  "which-kinds-of-cases-split-the-court": "areas",
} as const satisfies Record<string, keyof typeof DECISIONS_TAKEAWAYS>;

type ChartKey = keyof typeof DECISIONS_CHARTS;
const isChart = (id: string): id is ChartKey => id in DECISIONS_CHARTS;

export const decisionsFaq = (file: FaqFile | null) => toQuestionGroups(file, (id) => (isChart(id) ? { target: id, label: DECISIONS_TAKEAWAYS[DECISIONS_CHARTS[id]].title } : null));

const COUNT_CHART = "how-many-cases-does-the-court-decide";
/** Terms a story's bars show. */
const BARS = 12;

/** "Jun 30 · Trump v. Barbara" cards, each with bars of the cases decided per term on the ruling's topic. */
export function decisionsNews(data: DecisionsPayload, file: NewsFile | null): NewsItem[] {
  if (!file) return [];
  const items: NewsItem[] = [];
  for (const story of selectStories(file.stories)) {
    const item: NewsItem = { id: story.id, date: formatStoryDate(story.date), topic: story.topic, headlines: story.headlines };
    if (story.chartId !== COUNT_CHART) {
      items.push(item);
      continue;
    }
    const ai = data.areas.findIndex((a) => a.id === story.groupId);
    const cells = ai >= 0 ? data.by[ai]! : data.all;
    const from = Math.max(0, data.terms.length - BARS);
    const pts = data.terms.slice(from).map((term, k) => ({ x: term, value: cells[from + k]!.reduce((a, b) => a + b, 0) }));
    const now = pts[pts.length - 1]!;
    items.push({ ...item, chart: { target: COUNT_CHART, label: ai >= 0 ? `${data.areas[ai]!.label} cases` : "Cases", value: String(now.value), asOf: `${now.x} term`, pts, bars: true } });
  }
  return items;
}

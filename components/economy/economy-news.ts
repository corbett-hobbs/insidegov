import { readAll, type EconomyKey } from "@/lib/indicator-lookup";
import type { EconomyData } from "@/lib/indicator-payload";
import { weeklyPoints } from "@/lib/economy-series";
import { formatStoryDate, selectStories, toQuestionGroups, type QuestionChart } from "@/lib/news-derive";
import type { FaqFile, NewsFile } from "@/lib/news-types";
import type { NewsItem } from "@/components/news/NewsSections";
import { chartPoints } from "./EconomyChart";
import { SPECS, type ChartSpec } from "./specs";

/**
 * The Economy page's "In the news" stories and FAQ, from `news_economy.json` / `faq_economy.json` (`lib/news-types.ts`).
 * A `chartId` is a card's DOM id, `chart-<key>`; `chart-diesel` is the gas card with its diesel line drawn as the sparkline.
 */

/** A card's DOM id, which the jump links and chips scroll to. */
export const cardId = (k: EconomyKey) => `chart-${k}`;

const DIESEL_ID = "chart-diesel";

/** The card and (for diesel) line a story or question `chartId` stands for; null when the page has no such chart. */
function parseChartId(id: string): { k: EconomyKey; diesel: boolean } | null {
  if (id === DIESEL_ID) return { k: "gas", diesel: true };
  const k = id.startsWith("chart-") ? id.slice(6) : "";
  return k in SPECS ? { k: k as EconomyKey, diesel: false } : null;
}

/** The FAQ's chart chips, titled as the cards are. */
export function economyFaq(file: FaqFile | null, specs: Record<EconomyKey, ChartSpec> = SPECS) {
  return toQuestionGroups(file, (id): QuestionChart | null => {
    const c = parseChartId(id);
    return c && { target: cardId(c.k), label: c.diesel ? "Diesel" : specs[c.k].title };
  });
}

/** The stories with their sparklines: the last three years of weekly and monthly series, twelve of fiscal and quarterly. */
export function economyNews(data: EconomyData, specs: Record<EconomyKey, ChartSpec>, file: NewsFile | null): NewsItem[] {
  if (!file) return [];
  // The latest readings, captioned exactly as the chart cards caption their own headline number.
  const latest = readAll(data, null);
  const items: NewsItem[] = [];
  for (const story of selectStories(file.stories)) {
    if (story.chartId === undefined) {
      items.push({ id: story.id, date: formatStoryDate(story.date), topic: story.topic, headlines: story.headlines });
      continue;
    }
    const chart = parseChartId(story.chartId);
    if (!chart) continue;
    const all = chart.diesel ? weeklyPoints(data.diesel) : chartPoints(data, chart.k);
    const known = all.filter((p) => p.value !== null).map((p) => ({ x: p.day, value: p.value! }));
    const last = known[known.length - 1];
    if (!last) continue;
    const years = chart.k === "def" || chart.k === "debt" ? 12 : 3;
    items.push({
      id: story.id,
      date: formatStoryDate(story.date),
      topic: story.topic,
      headlines: story.headlines,
      chart: {
        target: cardId(chart.k),
        label: chart.diesel ? "Diesel" : specs[chart.k].title,
        value: specs[chart.k].head(last.value),
        asOf: latest[chart.k].caption,
        pts: known.filter((p) => p.x >= last.x - years * 365.25),
        bars: chart.k === "def",
      },
    });
  }
  return items;
}

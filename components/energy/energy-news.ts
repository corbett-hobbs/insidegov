import { formatStoryDate, selectStories, toQuestionGroups } from "../../lib/news-derive";
import type { FaqFile, NewsFile } from "../../lib/news-types";
import type { NewsItem } from "../news/NewsSections";
import { ENERGY_TAKEAWAYS } from "./takeaways";

/**
 * The Energy page's FAQ, from `faq_energy.json` (`lib/news-types.ts`). A `chartId` is the DOM id of one of the five cards
 * (`EnergyCardShell`'s `id`), and the chip is named after that card's title. The "In the news" row shows
 * every story as a card with no sparkline (`energyNews`): the page has no sparkline data for its cards yet.
 * Relative imports, so `lib/news-derive.test.ts` can load it.
 */

export const ENERGY_CHARTS = ["electricity", "supply", "oil", "lng", "spr"] as const;

type ChartKey = (typeof ENERGY_CHARTS)[number];
const isChart = (id: string): id is ChartKey => (ENERGY_CHARTS as readonly string[]).includes(id);

export const energyFaq = (file: FaqFile | null) => toQuestionGroups(file, (id) => (isChart(id) ? { target: id, label: ENERGY_TAKEAWAYS[id].title } : null));

/** The page's "In the news" cards: headlines over the plain wash, whatever chart the story is about. */
export const energyNews = (file: NewsFile | null): NewsItem[] =>
  file ? selectStories(file.stories).map((s) => ({ id: s.id, date: formatStoryDate(s.date), topic: s.topic, headlines: s.headlines })) : [];

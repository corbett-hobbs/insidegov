import { formatStoryDate, selectStories, toQuestionGroups } from "../../lib/news-derive";
import type { FaqFile, NewsFile } from "../../lib/news-types";
import type { NewsItem } from "../news/NewsSections";
import { TRADE_TAKEAWAYS } from "./takeaways";

/**
 * The Trade page's FAQ, from `faq_trade.json` (`lib/news-types.ts`). A `chartId` is the DOM id of one of the five cards,
 * and the chip is named after that card's all-countries title. The partners, products and scatter cards keep the ids the
 * share icon gave them from their titles (rule 7e), so links copied before the ids were fixed still land. The "In the news" row shows
 * every story as a card with no sparkline (`tradeNews`): the page has no sparkline data for its cards yet. Relative imports, so `lib/news-derive.test.ts` can load it.
 */

export const TRADE_CHARTS = {
  "trade-balance": "balance",
  tariffs: "tariff",
  "who-the-u-s-trades-with": "partners",
  "what-the-u-s-trades": "products",
  "did-tariffs-shift-trade": "scatter",
} as const satisfies Record<string, keyof typeof TRADE_TAKEAWAYS>;

type ChartKey = keyof typeof TRADE_CHARTS;
const isChart = (id: string): id is ChartKey => id in TRADE_CHARTS;

export const tradeFaq = (file: FaqFile | null) => toQuestionGroups(file, (id) => (isChart(id) ? { target: id, label: TRADE_TAKEAWAYS[TRADE_CHARTS[id]].title } : null));

/** The page's "In the news" cards: headlines over the plain wash, whatever chart the story is about. */
export const tradeNews = (file: NewsFile | null): NewsItem[] =>
  file ? selectStories(file.stories).map((s) => ({ id: s.id, date: formatStoryDate(s.date), topic: s.topic, headlines: s.headlines })) : [];

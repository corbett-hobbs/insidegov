import { fmtMonthIndex } from "../../lib/indicator-time";
import { formatStoryDate, selectStories, toQuestionGroups } from "../../lib/news-derive";
import type { FaqFile, NewsFile } from "../../lib/news-types";
import { fmtMoney, fmtPercent, ratePercentSeries, storyCountryCode } from "../../lib/trade-chart";
import { balanceSeries } from "../../lib/trade-derive";
import type { StoryCountryRates } from "../../lib/trade-data";
import type { TradeNationalPayload } from "../../lib/trade-types";
import type { NewsChart, NewsItem, SparkPoint } from "../news/NewsSections";
import { TRADE_TAKEAWAYS } from "./takeaways";

/**
 * The Trade page's FAQ, from `faq_trade.json` (`lib/news-types.ts`). A `chartId` is the DOM id of one of the five cards,
 * and the chip is named after that card's all-countries title. The partners, products and scatter cards keep the ids the
 * share icon gave them from their titles (rule 7e), so links copied before the ids were fixed still land. In the "In the news" row
 * (`tradeNews`) a story on the balance or tariffs card has that card's national series as its sparkline; a story on a card with
 * no single headline series (partners, products, scatter), or none, is headlines over a plain wash. Relative imports, so
 * `lib/news-derive.test.ts` can load it.
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

/** The last three years of a monthly series as sparkline points (x = month index since Jan 1991), and its latest month. */
function recent(series: readonly (number | null)[]): { pts: SparkPoint[]; last: number; value: number } | null {
  let last = series.length - 1;
  while (last >= 0 && series[last] == null) last--;
  if (last < 0) return null;
  const pts = series.slice(Math.max(0, last - 35), last + 1).flatMap((v, i, a) => (v == null ? [] : [{ x: last - a.length + 1 + i, value: v }]));
  return pts.length > 1 ? { pts, last, value: series[last]! } : null;
}

/**
 * The page's "In the news" cards. A story on the balance card sparklines the national seasonally adjusted goods balance; one
 * on the tariffs card the calculated duty rate: the partner's own when the story names one and `rates` (read on the server,
 * `getStoryCountryRates`) has a year of it, else all countries. Both are the cards' own headline series, captioned as the
 * cards caption them. "See chart ↑" on a partner's story picks that partner on the chart (`pickCountry`), so the chart the
 * reader lands on is the line the card showed. Every other story is headlines over the plain wash.
 */
/** Fewest months of a partner's rate for its own sparkline (fewer reads as a stub; the all-countries line stands in). */
export const MIN_COUNTRY_MONTHS = 12;

export function tradeNews(file: NewsFile | null, national?: Pick<TradeNationalPayload, "sa" | "duties" | "dutyImports">, rates: StoryCountryRates = {}, pickCountry?: (code: string) => void): NewsItem[] {
  if (!file) return [];
  const charts: Record<string, NewsChart | undefined> = {};
  const bal = national && recent(balanceSeries(national.sa.exports, national.sa.imports));
  if (bal) charts["trade-balance"] = { target: "trade-balance", label: "Goods trade balance", value: fmtMoney(bal.value, { signed: true }), asOf: fmtMonthIndex(bal.last), pts: bal.pts };
  const rate = national && recent(ratePercentSeries(national.duties, national.dutyImports));
  if (rate) charts.tariffs = { target: "tariffs", label: "Tariff rate, all countries", value: fmtPercent(rate.value), asOf: fmtMonthIndex(rate.last), pts: rate.pts };
  return selectStories(file.stories).map((s) => {
    let chart = s.chartId ? charts[s.chartId] : undefined;
    const code = s.chartId === "tariffs" ? storyCountryCode(s.id) : null;
    const own = code ? recent(rates[code]?.rates ?? []) : null;
    if (code && own && own.pts.length >= MIN_COUNTRY_MONTHS) {
      const from = rates[code]!.from;
      chart = { target: "tariffs", label: `Tariff rate, ${rates[code]!.name}`, value: fmtPercent(own.value), asOf: fmtMonthIndex(from + own.last), pts: own.pts.map((p) => ({ x: from + p.x, value: p.value })), ...(pickCountry ? { onSee: () => pickCountry(code) } : {}) };
    }
    return { id: s.id, date: formatStoryDate(s.date), topic: s.topic, headlines: s.headlines, ...(chart ? { chart } : {}) };
  });
}

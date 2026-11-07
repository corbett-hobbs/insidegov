import { fmtMbdShort, monthLabel } from "../../lib/energy-derive";
import type { EnergyPayload } from "../../lib/energy-types";
import { formatStoryDate, selectStories, toQuestionGroups } from "../../lib/news-derive";
import type { FaqFile, NewsFile } from "../../lib/news-types";
import type { NewsItem } from "../news/NewsSections";
import { ENERGY_TAKEAWAYS } from "./takeaways";

/**
 * The Energy page's FAQ, from `faq_energy.json` (`lib/news-types.ts`). A `chartId` is the DOM id of one of the five cards
 * (`EnergyCardShell`'s `id`), and the chip is named after that card's title. The "In the news" row shows
 * a story about oil imports sparklines the imports series; every other story is headlines over a plain wash (`energyNews`).
 * Relative imports, so `lib/news-derive.test.ts` can load it.
 */

export const ENERGY_CHARTS = ["electricity", "supply", "oil", "lng", "spr"] as const;

type ChartKey = (typeof ENERGY_CHARTS)[number];
const isChart = (id: string): id is ChartKey => (ENERGY_CHARTS as readonly string[]).includes(id);

export const energyFaq = (file: FaqFile | null) => toQuestionGroups(file, (id) => (isChart(id) ? { target: id, label: ENERGY_TAKEAWAYS[id].title } : null));

/**
 * The page's "In the news" cards. A story on the oil card (`chartId` "oil") has the last three years of monthly total
 * petroleum imports as its sparkline, labelled as what it is, "Oil imports", whatever the story's country; every other
 * story is headlines over the plain wash.
 */
export function energyNews(file: NewsFile | null, payload: Pick<EnergyPayload, "monthly">): NewsItem[] {
  if (!file) return [];
  const imp = payload.monthly.imp;
  let last = imp.length - 1;
  while (last >= 0 && imp[last] === null) last--;
  const pts = last < 0 ? [] : imp.slice(Math.max(0, last - 35), last + 1).flatMap((v, i, a) => (v === null ? [] : [{ x: last - a.length + 1 + i, value: v }]));
  return selectStories(file.stories).map((s) => ({
    id: s.id,
    date: formatStoryDate(s.date),
    topic: s.topic,
    headlines: s.headlines,
    ...(s.chartId === "oil" && pts.length > 1 ? { chart: { target: "oil", label: "Oil imports", value: fmtMbdShort(imp[last]!), asOf: monthLabel(last), pts } } : {}),
  }));
}

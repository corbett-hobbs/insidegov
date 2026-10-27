import type { ImmigrationPageData } from "@/lib/immigration-derive";
import type { EncountersPayload } from "@/lib/encounters-types";
import type { LprPayload } from "@/lib/lpr-types";
import type { RefugeePayload } from "@/lib/refugee-types";
import { formatStoryDate, selectStories, toQuestionGroups } from "@/lib/news-derive";
import type { FaqFile, NewsFile } from "@/lib/news-types";
import type { NewsItem, SparkPoint } from "@/components/news/NewsSections";

/**
 * The Immigration page's "In the news" stories and FAQ, from `news_immigration.json` / `faq_immigration.json`
 * (`lib/news-types.ts`). A `chartId` is the DOM id of one of the four cards below (wrappers in the page and its sections).
 */

export const IMMIGRATION_CHARTS = {
  "chart-green-cards": { target: "chart-green-cards", label: "Green cards" },
  "chart-refugees": { target: "chart-refugees", label: "Refugee admissions" },
  "chart-encounters": { target: "chart-encounters", label: "Border encounters" },
  "chart-removals": { target: "chart-removals", label: "ICE removals" },
} as const;

type ChartKey = keyof typeof IMMIGRATION_CHARTS;
const isChart = (id: string): id is ChartKey => id in IMMIGRATION_CHARTS;

export const immigrationFaq = (file: FaqFile | null) => toQuestionGroups(file, (id) => (isChart(id) ? IMMIGRATION_CHARTS[id] : null));

/** Counts of 10,000 or more in compact form (rule 2g): "1.2M", "442.6K". */
const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${(n / 1e3).toFixed(1)}K` : n.toLocaleString("en-US"));

/** The last twelve fiscal years of a series. */
const recent = (pts: SparkPoint[]) => pts.filter((p) => p.x > pts[pts.length - 1].x - 12);

/** The stories with their sparklines and each series' newest fiscal-year figure. */
export function immigrationNews(data: ImmigrationPageData, lpr: LprPayload, refugees: RefugeePayload, encounters: EncountersPayload, file: NewsFile | null): NewsItem[] {
  if (!file) return [];
  const series: Record<ChartKey, SparkPoint[]> = {
    "chart-green-cards": recent(lpr.years.map((y) => ({ x: y.fy, value: y.lpr }))),
    "chart-refugees": recent(refugees.years.map((y) => ({ x: y.fy, value: y.admissions }))),
    "chart-encounters": recent(encounters.years.map((y) => ({ x: y.fy, value: y.nationwide.total }))),
    "chart-removals": recent(data.years.map((y) => ({ x: y.fy, value: y.value }))),
  };
  const items: NewsItem[] = [];
  for (const story of selectStories(file.stories)) {
    if (!isChart(story.chartId) || series[story.chartId].length === 0) continue;
    const pts = series[story.chartId];
    const last = pts[pts.length - 1];
    items.push({
      id: story.id,
      date: formatStoryDate(story.date),
      topic: story.topic,
      headlines: story.headlines,
      chart: { ...IMMIGRATION_CHARTS[story.chartId], value: compact(last.value), asOf: `FY${last.x}`, pts },
    });
  }
  return items;
}

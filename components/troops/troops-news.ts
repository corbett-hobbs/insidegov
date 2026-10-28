import { toQuestionGroups } from "../../lib/news-derive";
import type { FaqFile } from "../../lib/news-types";
import { TROOPS_TAKEAWAYS } from "./takeaways";

/**
 * The Troops abroad page's FAQ, from `faq_troops-abroad.json` (`lib/news-types.ts`). A `chartId` is the DOM id of one of
 * the three cards, fixed in the markup to the ids the share icon used to derive from their titles (rule 7e); the chip is
 * the card's title. The page has no "In the news" row. Relative imports, so `lib/news-derive.test.ts` can load it.
 */

export const TROOPS_CHARTS = {
  "how-many-troops-are-stationed-abroad": "abroad",
  "where-they-are-and-who-hosts-the-most": "map",
  "who-s-hosted-the-most": "firstPlace",
} as const satisfies Record<string, keyof typeof TROOPS_TAKEAWAYS>;

type ChartKey = keyof typeof TROOPS_CHARTS;
const isChart = (id: string): id is ChartKey => id in TROOPS_CHARTS;

export const troopsFaq = (file: FaqFile | null) => toQuestionGroups(file, (id) => (isChart(id) ? { target: id, label: TROOPS_TAKEAWAYS[TROOPS_CHARTS[id]].title } : null));

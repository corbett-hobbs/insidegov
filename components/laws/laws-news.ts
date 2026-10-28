import { toQuestionGroups } from "../../lib/news-derive";
import type { FaqFile } from "../../lib/news-types";
import { LAWS_TAKEAWAYS } from "./takeaways";

/**
 * The Laws page's FAQ, from `faq_laws.json` (`lib/news-types.ts`). A `chartId` is the DOM id of one of the three chart
 * cards, fixed in the markup to the ids the share icon used to derive from their titles (rule 7e); the chip is the card's
 * title. The list of every law takes no questions. No "In the news" row. Relative imports, so `lib/news-derive.test.ts`
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

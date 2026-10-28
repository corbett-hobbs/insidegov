import { toQuestionGroups } from "../../lib/news-derive";
import type { FaqFile } from "../../lib/news-types";
import { DECISIONS_TAKEAWAYS } from "./takeaways";

/**
 * The Decisions page's FAQ, from `faq_decisions.json` (`lib/news-types.ts`). A `chartId` is the DOM id of one of the three
 * chart cards, fixed in the markup to the ids the share icon used to derive from their titles (rule 7e); the chip is the
 * card's title. The case list takes no questions. No "In the news" row. Relative imports, so `lib/news-derive.test.ts`
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

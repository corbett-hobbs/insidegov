import { toQuestionGroups } from "../../lib/news-derive";
import type { FaqFile } from "../../lib/news-types";

/**
 * The Foreign aid page's FAQ, from `faq_foreign-aid.json` (`lib/news-types.ts`). A `chartId` is the DOM id of one of the
 * three cards, fixed in the markup to the ids the share icon used to derive from their titles (rule 7e), so links copied
 * before keep landing; the chip is the card's title. The page has no "In the news" row. Relative imports, so
 * `lib/news-derive.test.ts` can load it.
 */

export const AID_CHARTS = {
  "how-much-the-u-s-spends": "How much the U.S. spends",
  "where-it-goes-and-who-receives-the-most": "Where it goes, and who receives the most",
  "who-s-been-no-1": "Who’s been No. 1",
} as const;

type ChartKey = keyof typeof AID_CHARTS;
const isChart = (id: string): id is ChartKey => id in AID_CHARTS;

export const foreignAidFaq = (file: FaqFile | null) => toQuestionGroups(file, (id) => (isChart(id) ? { target: id, label: AID_CHARTS[id] } : null));

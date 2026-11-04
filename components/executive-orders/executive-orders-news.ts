import { toQuestionGroups } from "../../lib/news-derive";
import type { FaqFile } from "../../lib/news-types";
import { CLEMENCY_TAKEAWAYS } from "../clemency/takeaways";
import { EO_TAKEAWAYS } from "./takeaways";

/**
 * The Executive orders page's FAQ, from `faq_executive-orders.json` (`lib/news-types.ts`). The page has one card, whose DOM
 * id is fixed to the one the share icon used to derive from its title (rule 7e); the chip is its title. No "In the news"
 * row. Relative imports, so `lib/news-derive.test.ts` can load it.
 */

export const EO_CHART = "executive-orders-signed-per-year-by-topic";

const CARD_LABEL: Record<string, string> = {
  [EO_CHART]: EO_TAKEAWAYS.perYear.title,
  "clemency-grants-per-fiscal-year": CLEMENCY_TAKEAWAYS.hero.title,
  "grants-by-president": CLEMENCY_TAKEAWAYS.presidents.title,
};

export const executiveOrdersFaq = (file: FaqFile | null) => toQuestionGroups(file, (id) => (CARD_LABEL[id] ? { target: id, label: CARD_LABEL[id] } : null));

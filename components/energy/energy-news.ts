import { toQuestionGroups } from "../../lib/news-derive";
import type { FaqFile } from "../../lib/news-types";
import { ENERGY_TAKEAWAYS } from "./takeaways";

/**
 * The Energy page's FAQ, from `faq_energy.json` (`lib/news-types.ts`). A `chartId` is the DOM id of one of the five cards
 * (`EnergyCardShell`'s `id`), and the chip is named after that card's title. The page has no "In the news" row yet.
 * Relative imports, so `lib/news-derive.test.ts` can load it.
 */

export const ENERGY_CHARTS = ["electricity", "supply", "oil", "lng", "spr"] as const;

type ChartKey = (typeof ENERGY_CHARTS)[number];
const isChart = (id: string): id is ChartKey => (ENERGY_CHARTS as readonly string[]).includes(id);

export const energyFaq = (file: FaqFile | null) => toQuestionGroups(file, (id) => (isChart(id) ? { target: id, label: ENERGY_TAKEAWAYS[id].title } : null));

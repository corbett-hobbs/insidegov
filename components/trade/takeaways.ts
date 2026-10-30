import type { ContextEntry } from "@/lib/chart-context";

/**
 * The takeaway under each Trade chart title (ARCHITECTURE_MAP rule 7c): what the
 * chart shows over its full default window (all countries, every year), in at most
 * two sentences. Every figure here is checked against pipeline/output in
 * lib/trade-takeaways.test.ts; a refresh that makes one untrue fails CI.
 *
 * The balance and tariff cards draw theirs only in the all-countries view: picking a
 * country redraws them for that country, and these sentences are not about it. The
 * partners and scatter cards keep theirs, since the Country filter only highlights. The products
 * card, like the balance card, draws its takeaway only for all countries.
 * Two take their dates from the data: the partners card shows the latest year so far
 * (`through` is its last month's name), and the scatter compares two moving
 * windows (`windowText` of each).
 */
export const TRADE_TAKEAWAYS = {
  balance: {
    title: "The goods trade balance",
    takeaway:
      "The U.S. ran a goods deficit every month from January 1991 through August 2026. The monthly deficit hit a record $158.7B in March 2025 and narrowed to $61.4B in October 2025, after $76B in July 2008 and $35.4B in May 2009.",
  },
  tariff: {
    title: "Tariffs on imports",
    takeaway:
      "In 2025 calculated duties reached a record 10.8% of imports in October, more than double their February 1994 high of 4.7%. They had fallen to 1.1% in March 2008 and rose to 3.2% by September 2019.",
  },
  partners: {
    title: "Who the U.S. trades with",
    takeaway: (through: string) =>
      `Mexico was the largest U.S. goods trading partner each year from 2023 through 2025 and again in 2026 through ${through}, ahead of Canada. China had the largest deficit every year from 2000 through 2025; in 2026 through ${through}, Vietnam did.`,
  },
  products: {
    title: "What the U.S. trades",
    takeaway: (through: string) =>
      `Oil, gas and coal overtook machinery and computers as the largest U.S. goods export in 2021 and led each year through ${through} 2026. By use, computers became the largest goods import in 2026 through ${through}, passing pharmaceuticals.`,
  },
  scatter: {
    title: "Did tariffs shift trade?",
    takeaway: (baseline: string, latest: string) =>
      `From ${baseline} to ${latest}, duty rates rose on goods from most countries. Of the five largest partners, China's rate rose the most and only imports from China fell; imports from Taiwan and Vietnam grew the most.`,
  },
} as const;

/**
 * Context lines (ARCHITECTURE_MAP rule 7d): dated tariff actions, from their Federal Register documents or ruling, next to what
 * the chart does at those dates. Timing only, never a cause. Every date and rate is checked against pipeline/output/tariff_actions.json in
 * lib/trade-takeaways.test.ts. The balance and partners cards have none: what moves the deficit and which country leads it are
 * multi-factor questions economists dispute, and no cited document states them.
 */
export const TRADE_CONTEXT = {
  tariff: {
    text: "Section 301 tariffs on China began July 2018; the rate doubled to 3.2% by September 2019. It jumped to 7.2% when 10% IEEPA tariffs on all partners began in April 2025 and fell to 6.8% after the Supreme Court ruled against them in February 2026.",
    sources: [
      { id: "fr-301-china-2018", label: "USTR, 2018" },
      { id: "fr-eo-14257", label: "EO 14257" },
      { id: "scotus-learning-resources", label: "Supreme Court" },
      { id: "fr-eo-14389", label: "EO 14389" },
    ],
  },
  scatter: {
    text: "Between the two windows, USTR raised Section 301 duties on some Chinese goods (September 2024), a 10% Section 122 surcharge began (February 2026), and Section 301 tariffs began on 60 economies, China among them (July 2026). China's duty rate went from 11.3% to 22.2%.",
    sources: [
      { id: "fr-301-china-2024", label: "USTR, 2024" },
      { id: "fr-section-122-2026", label: "Proclamation 11012" },
      { id: "fr-301-forced-labor-2026", label: "USTR, 2026" },
    ],
  },
} as const satisfies Partial<Record<keyof typeof TRADE_TAKEAWAYS, ContextEntry>>;

export const contextFor = (card: keyof typeof TRADE_TAKEAWAYS): ContextEntry | null =>
  (TRADE_CONTEXT as Partial<Record<keyof typeof TRADE_TAKEAWAYS, ContextEntry>>)[card] ?? null;

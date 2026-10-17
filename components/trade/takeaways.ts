import type { ContextEntry } from "@/lib/chart-context";

/**
 * The takeaway under each Trade chart title (ARCHITECTURE_MAP rule 7c): what the
 * chart shows over its full default window (all countries, every year), in at most
 * two sentences. Every figure here is checked against pipeline/output in
 * lib/trade-takeaways.test.ts; a refresh that makes one untrue fails CI.
 *
 * The balance and tariff cards draw theirs only in the all-countries view: picking a
 * country redraws them for that country, and these sentences are not about it. The
 * partners and scatter cards keep theirs, since the Country filter only highlights.
 * Two take their dates from the data: the partners card shows the latest year so far
 * (`through` is its last month's name), and the scatter compares two moving
 * windows (`windowText` of each).
 */
export const TRADE_TAKEAWAYS = {
  balance: {
    title: "The goods trade balance",
    takeaway:
      "The U.S. imported more goods than it exported in every month from January 1991 through August 2026. The monthly deficit reached $76 billion in July 2008, shrank to $35 billion in May 2009, and hit a record $158.7 billion in March 2025.",
  },
  tariff: {
    title: "Tariffs on imports",
    takeaway:
      "Calculated duties fell from 4.7% of imports in February 1994 to 1.1% in March 2008, then rose to 3.2% by September 2019. In 2025 they reached a record 10.8% in October, more than double the 1994 high.",
  },
  partners: {
    title: "Who the U.S. trades with",
    takeaway: (through: string) =>
      `Mexico was the largest U.S. goods trading partner each year from 2023 through 2025 and again in 2026 through ${through}, ahead of Canada. China had the largest deficit every year from 2000 through 2025; in 2026 through ${through}, Vietnam did.`,
  },
  scatter: {
    title: "Did tariffs shift trade?",
    takeaway: (baseline: string, latest: string) =>
      `From ${baseline} to ${latest}, duty rates rose on goods from most countries. Of the five largest partners, China's rate rose the most and only imports from China fell; imports from Taiwan and Vietnam grew the most.`,
  },
} as const;

/**
 * Context lines (ARCHITECTURE_MAP rule 7d): what a dated tariff action did, from its Federal Register document or ruling, next to
 * the chart's highlight. Timing only, never a cause. Every date and rate is checked against pipeline/output/tariff_actions.json in
 * lib/trade-takeaways.test.ts. The balance and partners cards have none: what moves the deficit and which country leads it are
 * multi-factor questions economists dispute, and no cited document states them.
 */
export const TRADE_CONTEXT = {
  tariff: {
    text: "Section 301 tariffs on goods from China began July 6, 2018, and reached a fourth list September 1, 2019. A 10% IEEPA tariff on all partners began April 5, 2025; IEEPA tariffs ended February 24, 2026, after the Supreme Court ruled.",
    sources: [
      { id: "fr-301-china-2018", label: "USTR, 2018" },
      { id: "fr-301-china-list-4a", label: "USTR, 2019" },
      { id: "fr-eo-14257", label: "EO 14257" },
      { id: "scotus-learning-resources", label: "Supreme Court" },
      { id: "fr-eo-14389", label: "EO 14389" },
    ],
  },
  scatter: {
    text: "USTR raised Section 301 duties on selected goods from China on September 27, 2024. A 10% Section 122 surcharge began February 24, 2026, and Section 301 tariffs of 10% or 12.5% began July 24 on 60 economies, China among them.",
    sources: [
      { id: "fr-301-china-2024", label: "USTR, 2024" },
      { id: "fr-section-122-2026", label: "Proclamation 11012" },
      { id: "fr-301-forced-labor-2026", label: "USTR, 2026" },
    ],
  },
} as const satisfies Partial<Record<keyof typeof TRADE_TAKEAWAYS, ContextEntry>>;

export const contextFor = (card: keyof typeof TRADE_TAKEAWAYS): ContextEntry | null =>
  (TRADE_CONTEXT as Partial<Record<keyof typeof TRADE_TAKEAWAYS, ContextEntry>>)[card] ?? null;

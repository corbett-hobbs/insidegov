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

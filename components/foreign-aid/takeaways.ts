import type { ContextEntry } from "@/lib/chart-context";

/**
 * The takeaway under each Foreign aid chart title (ARCHITECTURE_MAP rule 7c): what the chart
 * shows in its default view (all countries, all sectors, FY2001 through the latest year, the
 * map on the default year), in at most two sentences. Dollars are nominal, as the source
 * publishes them. Every figure here is checked against pipeline/output in
 * lib/foreign-aid-takeaways.test.ts; a refresh that makes one untrue fails CI.
 */
export const AID_TAKEAWAYS = {
  spending:
    "In nominal dollars, disbursements rose from $15.0 billion in FY2001 to between $42 billion and $49 billion a year from FY2010 through FY2021, then peaked at $80.5 billion in FY2023. Peace and security was the largest sector every year through FY2020.",
  map: "In FY2025, Ukraine received the most, $6.8 billion, followed by Israel at $3.3 billion, nearly all of it military. About a third of that year’s dollars went to global and regional programs rather than one country, so the map leaves them out.",
  firstPlace:
    "Afghanistan was the largest recipient for 13 straight years, FY2008 through FY2020, and Ukraine from FY2022 through FY2025. Ukraine’s $24.8 billion in FY2023 was 42% of the dollars tied to a single country, the largest share any No. 1 took.",
} as const;

/**
 * Context lines (ARCHITECTURE_MAP rule 7d): which enacted law or executive order fell next to the chart's highlight, by public
 * law number or EO number and date. Timing only, never why a country got more or whether aid worked; no dollar amounts, because
 * the laws' totals span defense and other accounts the disbursement data does not count. Pinned in
 * lib/foreign-aid-takeaways.test.ts. "Who's been No. 1" has none: which country leads is not something any cited document states.
 */
export const AID_CONTEXT = {
  spending: {
    text: "Congress enacted emergency Ukraine appropriations in four laws: P.L. 117-103 (March 15, 2022), P.L. 117-128 (May 21, 2022), P.L. 117-180 (September 30, 2022) and P.L. 117-328 (December 29, 2022).",
    sources: [
      { id: "plaw-117-103", label: "P.L. 117-103" },
      { id: "plaw-117-128", label: "P.L. 117-128" },
      { id: "plaw-117-180", label: "P.L. 117-180" },
      { id: "plaw-117-328", label: "P.L. 117-328" },
    ],
  },
  map: {
    text: "The Ukraine and Israel security supplemental appropriations became law April 24, 2024 (P.L. 118-50). Executive Order 14169 paused new foreign development aid for a 90-day review on January 20, 2025.",
    sources: [
      { id: "plaw-118-50", label: "P.L. 118-50" },
      { id: "fr-eo-14169", label: "EO 14169" },
    ],
  },
} as const satisfies Partial<Record<keyof typeof AID_TAKEAWAYS, ContextEntry>>;

export const contextFor = (card: keyof typeof AID_TAKEAWAYS): ContextEntry | null =>
  (AID_CONTEXT as Partial<Record<keyof typeof AID_TAKEAWAYS, ContextEntry>>)[card] ?? null;

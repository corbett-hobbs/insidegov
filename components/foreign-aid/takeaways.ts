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
    "In nominal dollars, disbursements peaked at $80.5B in FY2023, after $41.8B to $49.4B a year from FY2010 through FY2021 and $15B in FY2001. Peace and security was the largest sector every year from FY2001 through FY2020.",
  map: "In FY2025, Ukraine received the most, $6.8B, followed by Israel at $3.3B, nearly all of it military. About a third of that year’s dollars went to global and regional programs rather than one country, so the map leaves them out.",
  firstPlace:
    "Ukraine was the largest recipient every year from FY2022 through FY2025, after Afghanistan’s 13 straight years, FY2008 through FY2020. Its $24.8B in FY2023 was 42% of the dollars tied to a single country, the largest share any No. 1 took.",
} as const;

/**
 * Context lines (ARCHITECTURE_MAP rule 7d): the enacted laws or executive order that sit next to what each chart shows, and the
 * feature they line up with. Timing only, never why a country got more or whether aid worked; no law's own dollar totals, because
 * they span defense and other accounts the disbursement data does not count. Figures are nominal, like the takeaways. Pinned in
 * lib/foreign-aid-takeaways.test.ts.
 */
// Labels after the first drop "P.L." so the bracketed list fits one line at phone width.
const UKRAINE_LAWS = [
  { id: "plaw-117-103", label: "P.L. 117-103" },
  { id: "plaw-117-128", label: "117-128" },
  { id: "plaw-117-180", label: "117-180" },
  { id: "plaw-117-328", label: "117-328" },
] as const;

export const AID_CONTEXT = {
  spending: {
    text: "Congress passed four laws adding emergency Ukraine aid from March to December 2022. Disbursements jumped from $49.4B in FY2021 to $74.3B in FY2022 (nominal); Ukraine’s share of the $24.9B rise was $15.9B.",
    sources: UKRAINE_LAWS,
  },
  map: {
    text: "Executive Order 14169 told agencies on January 20, 2025, the fourth month of FY2025, to pause new obligations and disbursements of development aid for a 90-day review. Disbursements to single countries that year were $31.5B (nominal), down from $46.6B in FY2024.",
    sources: [{ id: "fr-eo-14169", label: "EO 14169" }],
  },
  firstPlace: {
    text: "Ukraine went from 17th place and $613.5M in FY2021 to No. 1 and $16.5B in FY2022 (nominal), the fiscal year Congress passed three of the four 2022 laws adding emergency Ukraine aid.",
    sources: UKRAINE_LAWS,
  },
} as const satisfies Partial<Record<keyof typeof AID_TAKEAWAYS, ContextEntry>>;

export const contextFor = (card: keyof typeof AID_TAKEAWAYS): ContextEntry | null =>
  (AID_CONTEXT as Partial<Record<keyof typeof AID_TAKEAWAYS, ContextEntry>>)[card] ?? null;

import type { ContextEntry } from "@/lib/chart-context";

/**
 * The takeaway under each Energy chart title (ARCHITECTURE_MAP rule 7c): what the chart shows over its full
 * default window (and, for the two cards with a toggle, its default view: shares, and the balance), in at most
 * two sentences. Every figure here is checked against pipeline/output in lib/energy-takeaways.test.ts; a refresh
 * that makes one untrue fails CI.
 */
export const ENERGY_TAKEAWAYS = {
  electricity: {
    title: "Where U.S. electricity comes from",
    takeaway:
      "Coal supplied 48% to 53% of utility-scale electricity every year from 1991 through 2008. Natural gas led every year from 2016 through 2025, peaking at 43% in 2024, while wind and solar grew from under 1% through 2007 to 17% in 2025.",
  },
  supply: {
    title: "Oil supply and demand",
    takeaway:
      "Production averaged 6.8 million barrels a day in 2008, its lowest year, and 21.2 million in 2025, the first year in records back to 1973 that it topped products supplied. Products supplied ranged between 14.5 million (April 2020) and 21.7 million (August 2005).",
  },
  oil: {
    title: "Oil imports and exports",
    takeaway:
      "Net petroleum imports peaked at 13.4 million barrels a day in August 2006. In October 2019 exports topped imports for the first time in monthly records back to 1973, and the U.S. was a net exporter every year from 2020 through 2025.",
  },
  lng: {
    title: "Liquefied natural gas exports",
    takeaway:
      "Exports stayed under 16 billion cubic feet a month from 1997 through 2015. After Sabine Pass’s first cargo sailed in February 2016, the yearly total rose each year through 2025, and March 2026 set the monthly record of 573 billion.",
  },
  spr: {
    title: "The Strategic Petroleum Reserve",
    takeaway:
      "The reserve peaked at 727 million barrels in January 2010 and fell to a low of 347 million in July 2023. It was refilled to 415 million by March 2026, when an emergency exchange was authorized, and fell below the 2023 low in June 2026.",
  },
} as const;

/**
 * Context lines behind the takeaways (ARCHITECTURE_MAP rule 7d): only what a cited document or EIA/DOE itself says, never a
 * cause in the page's voice and never a price move pinned on a policy. Electricity has none: the coal-to-gas and wind/solar
 * shifts are multi-factor, and the two dated statutes (2022, 2025) come after most of the change the takeaway describes.
 * Every figure is checked in lib/energy-takeaways.test.ts.
 */
export const ENERGY_CONTEXT = {
  supply: {
    text: "EIA estimates that about 64% of U.S. crude oil production in 2023, about 8.32M barrels a day, came directly from tight-oil (shale) resources.",
    sources: [{ id: "eia-tight-oil-faq", label: "EIA FAQ" }],
  },
  oil: {
    text: "Public Law 114-113, signed December 18, 2015, repealed the federal restriction on crude oil exports.",
    sources: [{ id: "plaw-114-113", label: "Public Law 114-113" }],
  },
  lng: {
    text: "DOE gave Sabine Pass final approval to export to countries without a free trade agreement on August 7, 2012. EIA cites abundant natural gas, flexible contract terms and relatively low feedgas costs among the reasons exports grew.",
    sources: [
      { id: "doe-sabine-pass-docket", label: "DOE docket" },
      { id: "eia-sabine-pass-ten-years", label: "EIA" },
    ],
  },
  spr: {
    text: "DOE lists a 180M-barrel emergency sale in 2022, coordinated through the IEA, plus 38M barrels of congressionally mandated sales delivered that year. The March 11, 2026 exchange of 172M barrels is the U.S. share of a 400M-barrel IEA action, to be returned.",
    sources: [
      { id: "doe-spr-history", label: "DOE release history" },
      { id: "doe-spr-172m-exchange-2026", label: "DOE, March 2026" },
    ],
  },
} as const satisfies Partial<Record<keyof typeof ENERGY_TAKEAWAYS, ContextEntry>>;

export const contextFor = (card: keyof typeof ENERGY_TAKEAWAYS): ContextEntry | null =>
  (ENERGY_CONTEXT as Partial<Record<keyof typeof ENERGY_TAKEAWAYS, ContextEntry>>)[card] ?? null;

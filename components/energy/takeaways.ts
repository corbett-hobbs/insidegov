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
 * Context lines behind the takeaways (ARCHITECTURE_MAP rule 7d): a dated political action from energy_actions.json, the chart
 * feature it lines up with, and only what the cited document says about it; never a cause in the page's voice and never a
 * price move pinned on a policy. Electricity has none: the coal-to-gas and wind/solar shifts are multi-factor, and the two
 * dated statutes (2022, 2025) come after most of the change the takeaway describes. Supply has none: no dated action sits
 * behind its production low, its 2025 record or its demand extremes. Every figure is checked in lib/energy-takeaways.test.ts.
 */
export const ENERGY_CONTEXT = {
  oil: {
    text: "Public Law 114-113, signed December 18, 2015, repealed the federal restriction on crude oil exports. Crude exports, the dashed line under Exports & imports, rose from 0.5M barrels a day in 2015 to 3.0M in 2019, when total exports first topped imports.",
    sources: [{ id: "plaw-114-113", label: "Public Law 114-113" }],
  },
  lng: {
    text: "DOE paused decisions on pending applications to export LNG to countries without a free trade agreement on January 26, 2024, saying already-authorized exports were unaffected, and ended the pause January 20, 2025. Yearly exports rose in both 2024 and 2025.",
    sources: [
      { id: "doe-lng-pause-2024", label: "DOE, January 2024" },
      { id: "doe-lng-pause-ended-2025", label: "DOE, January 2025" },
    ],
  },
  spr: {
    text: "Biden authorized selling up to 180M barrels on March 31, 2022; with 38M of mandated sales, the reserve fell from 568M barrels that month to 372M by December. The 172M-barrel exchange authorized March 11, 2026 drew it below the 2023 low by June.",
    sources: [
      { id: "doe-spr-history", label: "DOE release history" },
      { id: "doe-spr-172m-exchange-2026", label: "DOE, March 2026" },
    ],
  },
} as const satisfies Partial<Record<keyof typeof ENERGY_TAKEAWAYS, ContextEntry>>;

export const contextFor = (card: keyof typeof ENERGY_TAKEAWAYS): ContextEntry | null =>
  (ENERGY_CONTEXT as Partial<Record<keyof typeof ENERGY_TAKEAWAYS, ContextEntry>>)[card] ?? null;

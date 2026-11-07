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
      "Production averaged 6.8M barrels a day in 2008, its lowest year, and 21.2M in 2025, the first year in records back to 1973 that it topped products supplied. Products supplied ranged between 14.5M (April 2020) and 21.7M (August 2005).",
  },
  oil: {
    title: "Oil imports and exports",
    takeaway:
      "Exports first topped imports in October 2019, in monthly records back to 1973, and the U.S. was a net exporter every year from 2020 through 2025. Net exports peaked at 5.9M barrels a day in May 2026, against a 13.4M net-import high in August 2006.",
  },
  lng: {
    title: "Liquefied natural gas exports",
    takeaway:
      "Exports stayed under 16B cubic feet a month from 1997 through 2015. After Sabine Pass’s first cargo sailed in February 2016, the yearly total rose each year through 2025, and March 2026 set the monthly record of 573.1B.",
  },
  spr: {
    title: "The Strategic Petroleum Reserve",
    takeaway:
      "The reserve fell from 638.1M barrels in January 2021 to a low of 346.8M in July 2023, after peaking at 726.6M in January 2010. Refilled to 415.4M by March 2026, when an emergency exchange was authorized, it fell below that low by June 2026.",
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
    text: "Public Law 114-113, signed December 18, 2015, repealed the federal restriction on crude oil exports. Crude exports, the dashed line under Exports & imports, rose from 464.6K barrels a day in 2015 to 3M in 2019, when total exports first topped imports.",
    sources: [{ id: "plaw-114-113", label: "Public Law 114-113" }],
  },
  lng: {
    text: "On August 7, 2012, DOE made final Sabine Pass’s approval to export LNG to countries without a free trade agreement, the first for lower-48 gas. Yearly exports rose from 28B cubic feet in 2015, before Sabine Pass’s first cargo, to 5.5 trillion in 2025.",
    sources: [
      { id: "doe-sabine-pass-docket", label: "DOE docket" },
      { id: "doe-lng-order-3357", label: "DOE Order 3357" },
    ],
  },
  spr: {
    text: "Biden authorized selling up to 180M barrels on March 31, 2022; with 38M of mandated sales, the reserve fell from 568.3M barrels that month to 372.4M by December. The 172M-barrel exchange authorized March 11, 2026 drew it below the 2023 low by June.",
    sources: [
      { id: "doe-spr-history", label: "DOE release history" },
      { id: "doe-spr-172m-exchange-2026", label: "DOE, March 2026" },
    ],
  },
} as const satisfies Partial<Record<keyof typeof ENERGY_TAKEAWAYS, ContextEntry>>;

export const contextFor = (card: keyof typeof ENERGY_TAKEAWAYS): ContextEntry | null =>
  (ENERGY_CONTEXT as Partial<Record<keyof typeof ENERGY_TAKEAWAYS, ContextEntry>>)[card] ?? null;

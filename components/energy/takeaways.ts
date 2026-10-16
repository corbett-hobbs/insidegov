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

import type { ContextEntry } from "@/lib/chart-context";

/**
 * The takeaway under each National security chart title (ARCHITECTURE_MAP rule 7c): what the chart shows over its
 * full default window (every year, all countries, all branches), in at most two sentences. The year's own figures stay
 * in the muted readout line beneath. Every figure here is checked against pipeline/output in
 * lib/national-security-takeaways.test.ts; a refresh that makes one untrue fails CI.
 */
export const TROOPS_TAKEAWAYS = {
  abroad: {
    title: "How many troops are stationed abroad",
    takeaway:
      "Troops abroad were highest in 1953, at about 1.08 million, and peaked again at 1.04 million in 1968; most were in East Asia and the Pacific. From 2018 through 2025, counting only permanent assignments, the total stayed between about 160,000 and 169,000.",
  },
  map: {
    title: "Where they are, and who hosts the most",
    takeaway:
      "From 2018 through 2025, Japan, Germany and South Korea were the three largest hosts every year, with 72% to 74% of troops at foreign hosts. No more than 12 of the 154 to 168 host countries had 1,000 or more.",
  },
  firstPlace: {
    title: "Who’s hosted the most",
    takeaway:
      "Germany was the largest host every year from 1954 through 2002 except 1966 to 1971, when Vietnam led, with a peak of about 537,000 in 1968. Iraq led from 2003 to 2009, Afghanistan from 2010 to 2012, and Japan from 2013 through 2025.",
  },
} as const;

/**
 * Context lines behind the takeaways (ARCHITECTURE_MAP rule 7d): only what DMDC's tables or a dated official document say,
 * never why troop levels moved. The map has none: its 2018-2025 ranking is steady, with no dated change behind it.
 * Every figure is checked in lib/national-security-takeaways.test.ts.
 */
export const TROOPS_CONTEXT = {
  abroad: {
    text: "From December 2017, DMDC’s tables count only permanently assigned personnel, leaving out temporary duty and contingency deployments; overseas active duty went from 215.2k in September to 161.9k in December. Afghanistan, Iraq and Syria went unreported from December 2017 through September 2021.",
    sources: [{ id: "dmdc", label: "DMDC" }],
  },
  firstPlace: {
    text: "Public Law 88-408 (August 10, 1964) authorized force in Southeast Asia, and Public Law 107-243 (October 16, 2002) against Iraq. On December 1, 2009, the President announced 30,000 more troops for Afghanistan, to deploy in the first part of 2010.",
    sources: [
      { id: "plaw-88-408", label: "Public Law 88-408" },
      { id: "plaw-107-243", label: "Public Law 107-243" },
      { id: "obama-west-point-2009", label: "White House, 2009" },
    ],
  },
} as const satisfies Partial<Record<keyof typeof TROOPS_TAKEAWAYS, ContextEntry>>;

export const contextFor = (card: keyof typeof TROOPS_TAKEAWAYS): ContextEntry | null =>
  (TROOPS_CONTEXT as Partial<Record<keyof typeof TROOPS_TAKEAWAYS, ContextEntry>>)[card] ?? null;

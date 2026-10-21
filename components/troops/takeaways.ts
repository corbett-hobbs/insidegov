import type { ContextEntry } from "@/lib/chart-context";

/**
 * The takeaway under each Troops abroad chart title (ARCHITECTURE_MAP rule 7c): what the chart shows over its
 * full default window (every year, all countries, all branches), in at most two sentences. The year's own figures stay
 * in the muted readout line beneath. Every figure here is checked against pipeline/output in
 * lib/troops-takeaways.test.ts; a refresh that makes one untrue fails CI.
 */
export const TROOPS_TAKEAWAYS = {
  abroad: {
    title: "How many troops are stationed abroad",
    takeaway:
      "Troops abroad reached 503.1K in 2005, the most since 1972, and from 2018 through 2025, counting only permanent assignments, stayed between 159.6K and 168.5K. The chart’s highs, mostly in East Asia and the Pacific, were 1.1M in 1953 and 1M in 1968.",
  },
  map: {
    title: "Where they are, and who hosts the most",
    takeaway:
      "From 2018 through 2025, Japan, Germany and South Korea were the three largest hosts every year, with 72% to 74% of troops at foreign hosts. No more than 12 of the 154 to 168 host countries had 1,000 or more.",
  },
  firstPlace: {
    title: "Who’s hosted the most",
    takeaway:
      "Japan was the largest host every year from 2013 through 2025, after Iraq (2003 to 2009) and Afghanistan (2010 to 2012). Germany led every year from 1954 through 2002 except 1966 to 1971, when Vietnam did, peaking at 537.4K in 1968.",
  },
} as const;

/**
 * The abroad card's Data note on the December 2017 counting change (rule 7: method goes in Data notes, never in Context).
 * Its figures are read from troops_location_meta.json's `break` in lib/troops-takeaways.test.ts.
 */
export const TROOPS_BREAK_NOTE =
  "The dashed line before 2018 marks a change in what DMDC counts: from the Dec 2017 table, only personnel permanently assigned to a location, leaving out temporary duty and contingency deployments. Overseas active duty went from 215,249 in Sep to 161,927 in Dec 2017 while the U.S. total rose, a reallocation, not a withdrawal; Afghanistan, Iraq and Syria print blank, not zero, from Dec 2017 through Sep 2021.";

/**
 * Context lines behind the takeaways (ARCHITECTURE_MAP rule 7d): the dated political event behind what each chart shows,
 * placed next to what the chart did, never why troop levels moved. The abroad and first-place lines name the events behind
 * the peaks and hand-offs their takeaways cite; the map's is the 2020 Germany plan, which its steady 2018-2025 ranking
 * outlasted. The Doha agreement, the 2021 withdrawal and the 2022 Europe deployments show nowhere: DMDC left Afghanistan,
 * Iraq and Syria unreported from December 2017 through September 2021, and its permanent-assignment counts leave out
 * rotational forces.
 * Every figure is checked in lib/troops-takeaways.test.ts.
 */
export const TROOPS_CONTEXT = {
  abroad: {
    text: "The Korean War armistice was signed July 27, 1953, after the June 1953 high; troops abroad fell to 740.4K by 1955. Public Law 88-408 (August 10, 1964) authorized force in Southeast Asia; troops abroad rose from 594.6K that year to the 1M peak in 1968.",
    sources: [
      { id: "korea-armistice-1953", label: "National Archives" },
      { id: "plaw-88-408", label: "Public Law 88-408" },
    ],
  },
  map: {
    text: "On July 29, 2020, the Defense Department said about 11.9K troops would be moved out of Germany; on February 4, 2021, President Biden said planned withdrawals would stop. Germany stayed the second-largest host, with 34K to 36.3K troops every year from 2018 through 2025.",
    sources: [
      { id: "dod-eucom-posture-2020", label: "Defense Department" },
      { id: "biden-state-dept-2021", label: "White House" },
    ],
  },
  firstPlace: {
    text: "Public Law 107-243 (October 16, 2002) authorized force against Iraq, the largest host from 2003. President Obama’s February 12, 2013 State of the Union said 34K more troops would leave Afghanistan within a year; Afghanistan fell to 48.8K in 2013, below Japan’s 53K.",
    sources: [
      { id: "plaw-107-243", label: "Public Law 107-243" },
      { id: "obama-sotu-2013", label: "White House" },
    ],
  },
} as const satisfies Partial<Record<keyof typeof TROOPS_TAKEAWAYS, ContextEntry>>;

export const contextFor = (card: keyof typeof TROOPS_TAKEAWAYS): ContextEntry | null =>
  (TROOPS_CONTEXT as Partial<Record<keyof typeof TROOPS_TAKEAWAYS, ContextEntry>>)[card] ?? null;

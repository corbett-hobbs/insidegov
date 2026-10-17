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
 * The abroad card's Data note on the December 2017 counting change (rule 7: method goes in Data notes, never in Context).
 * Its figures are read from troops_location_meta.json's `break` in lib/national-security-takeaways.test.ts.
 */
export const TROOPS_BREAK_NOTE =
  "The dashed line before 2018 marks a change in what DMDC counts: from the Dec 2017 table, only personnel permanently assigned to a location, leaving out temporary duty and contingency deployments. Overseas active duty went from 215,249 in Sep to 161,927 in Dec 2017 while the U.S. total rose, a reallocation, not a withdrawal; Afghanistan, Iraq and Syria print blank, not zero, from Dec 2017 through Sep 2021.";

/**
 * Context lines behind the takeaways (ARCHITECTURE_MAP rule 7d): the dated political event behind what each chart shows,
 * placed next to what the chart did, never why troop levels moved. The map's line is the 2020 Germany plan, which its
 * steady 2018-2025 ranking outlasted. The abroad and first-place lines reach back further because their takeaways' features
 * are older and nothing recent shows: DMDC left Afghanistan, Iraq and Syria unreported from December 2017 through September
 * 2021, and the 2022 deployments to Europe were rotational, which the permanent-assignment counts leave out.
 * Every figure is checked in lib/national-security-takeaways.test.ts.
 */
export const TROOPS_CONTEXT = {
  abroad: {
    text: "The Korean War armistice was signed July 27, 1953, after the June 1953 high; troops abroad fell to 740.4k by 1955. President Nixon ordered about 25,000 troops out of Vietnam on June 8, 1969; the total fell from 1.04M that year to 522.0k by 1972.",
    sources: [
      { id: "korea-armistice-1953", label: "National Archives" },
      { id: "nixon-midway-1969", label: "American Presidency Project" },
    ],
  },
  map: {
    text: "On July 29, 2020, the Defense Department said about 11,900 troops would be moved out of Germany; on February 4, 2021, President Biden said planned withdrawals would stop. Germany stayed the second-largest host, with 34.0k to 36.3k troops every year from 2018 through 2025.",
    sources: [
      { id: "dod-eucom-posture-2020", label: "Defense Department" },
      { id: "biden-state-dept-2021", label: "White House" },
    ],
  },
  firstPlace: {
    text: "In his February 12, 2013 State of the Union, President Obama said another 34,000 troops would come home from Afghanistan over the next year. Afghanistan fell from 63.2k in 2012 to 48.8k in 2013, below Japan’s 53.0k, and Japan has led since.",
    sources: [{ id: "obama-sotu-2013", label: "White House" }],
  },
} as const satisfies Partial<Record<keyof typeof TROOPS_TAKEAWAYS, ContextEntry>>;

export const contextFor = (card: keyof typeof TROOPS_TAKEAWAYS): ContextEntry | null =>
  (TROOPS_CONTEXT as Partial<Record<keyof typeof TROOPS_TAKEAWAYS, ContextEntry>>)[card] ?? null;

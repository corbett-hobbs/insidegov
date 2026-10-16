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

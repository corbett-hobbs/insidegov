/**
 * The takeaway under each Executive orders chart title (ARCHITECTURE_MAP rule 7c):
 * what the chart shows over its full default window, in at most two sentences.
 * Every figure here is checked against pipeline/output in
 * lib/executive-orders-takeaways.test.ts; a refresh that makes one untrue fails CI.
 */
export const EO_TAKEAWAYS = {
  perYear: {
    title: "Executive orders signed per year, by topic",
    takeaway:
      "From 1994 through 2024, presidents signed 19 to 91 executive orders a year. In 2025, the year Trump returned, there were 238; 34 were on trade, a topic that had never passed 5 in a year.",
  },
} as const;

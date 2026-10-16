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
      "Presidents signed 19 to 91 orders a year from 1994 through 2024, then 238 in 2025, the most of any year. Trump signed 225 of them, more than Biden’s 162 in his whole term, including 34 on trade, which had never topped 5 a year.",
  },
} as const;

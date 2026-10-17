import type { ContextEntry } from "@/lib/chart-context";

/**
 * The takeaway under each Supreme Court ideology chart title (ARCHITECTURE_MAP
 * rule 7c): what the chart shows over the full term range with both appointing
 * parties, in at most two sentences. Every figure here is checked against
 * pipeline/output/court in lib/court-ideology-takeaways.test.ts; a refresh that
 * makes one untrue fails CI. Martin–Quinn scores are estimates, and the median
 * justice is the one most likely to hold the middle seat, so the copy says that.
 */
export const COURT_TAKEAWAYS = {
  strip: {
    title: "Where the justices stand",
    takeaway:
      "From the 1990 term through the 2024 term, the justice most likely to be the Court’s median, its middle vote, was a Republican appointee every term. From 1937 through 1989 it was a Democratic appointee in 44 of 53 terms.",
  },
  presidents: {
    title: "Who each president appointed",
    takeaway:
      "Nine Democratic appointees, most recently White in 1962, have conservative career averages, and six Republican appointees, most recently Souter in 1990, liberal ones. All 11 justices appointed from 1991 through 2022 average on their appointing party’s side: Republican conservative, Democratic liberal.",
  },
  trajectory: {
    title: "How each justice moved",
    takeaway:
      "The Court median was lowest in the 1963 term (−1.13) and highest in 1988 (1.10); from 1969 through 2024 it fell below zero only in 2014, 2015 and 2016. Blackmun went from 1.63 in the 1971 term to −1.93 in 1993.",
  },
} as const;

/**
 * The context lines (ARCHITECTURE_MAP rule 7d), both from the last ten years. The strip's line dates Barrett's confirmation to
 * Ginsburg's seat at the 2020 move in the likeliest median, from the FJC service dates and votes in pipeline/output/court. The
 * trajectory's line dates Gorsuch's confirmation, a day after the Senate let a simple majority end debate on Supreme Court
 * nominees, at the end of the only run since 1969 in which, the takeaway says, the median sat below zero. Timing only: neither
 * says why a justice votes as they do. The presidents card has none: no cited source says what lies behind its highlight.
 * Pinned in lib/court-ideology-takeaways.test.ts.
 */
export const COURT_CONTEXT = {
  strip: {
    text: "Ginsburg died on September 18, 2020, and the Senate confirmed Barrett, a Donald J. Trump nominee, 52–48 on October 26, giving Republican appointees six of the nine seats. In the 2020 term the likeliest median moved from Chief Justice Roberts to Kavanaugh.",
    sources: [{ id: "fjc", label: "Federal Judicial Center" }, { id: "martin-quinn", label: "Martin–Quinn" }],
  },
  trajectory: {
    text: "On April 7, 2017, a day after letting a simple majority end debate on Supreme Court nominees, the Senate confirmed Gorsuch, a Donald J. Trump nominee, 54–45 to Scalia’s seat. In 2017, his first full term, the median went from −0.06 to 0.29.",
    sources: [
      { id: "senate-vote-gorsuch-cloture", label: "U.S. Senate roll call" },
      { id: "senate-scotus-nominations", label: "U.S. Senate" },
      { id: "martin-quinn", label: "Martin–Quinn" },
    ],
  },
} as const satisfies Partial<Record<keyof typeof COURT_TAKEAWAYS, ContextEntry>>;

export const contextFor = (card: keyof typeof COURT_TAKEAWAYS): ContextEntry | null =>
  (COURT_CONTEXT as Partial<Record<keyof typeof COURT_TAKEAWAYS, ContextEntry>>)[card] ?? null;

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
      "All 11 justices appointed from 1991 through 2022 average on their appointing party’s side: Republican conservative, Democratic liberal. Before them, nine Democratic appointees, most recently White in 1962, have conservative career averages, and six Republican appointees, most recently Souter in 1990, liberal ones.",
  },
  trajectory: {
    title: "How each justice moved",
    takeaway:
      "From 1969 through 2024 the Court median fell below zero only in 2014, 2015 and 2016; its low was −1.13, in the 1963 term, and its high 1.10, in 1988. Blackmun went from 1.63 in the 1971 term to −1.93 in 1993.",
  },
} as const;

/**
 * The context lines (ARCHITECTURE_MAP rule 7d). The strip's line dates Barrett's confirmation to Ginsburg's seat at the 2020
 * move in the likeliest median, from the FJC service dates and votes in pipeline/output/court. The trajectory's line is the
 * older exception rule 7d allows, because it sits behind the chart's main shape: John F. Kennedy's Goldberg taking
 * Frankfurter's seat the term the median first fell below −1, and Richard M. Nixon's four appointees taking the seats of
 * Warren, Fortas, Black and Harlan from 1969 to 1971, the swing from the Warren Court's lows to the run above zero the takeaway
 * names. Timing only: neither says why a justice votes as they do. The presidents card has none: no cited source says what
 * lies behind its highlight. Pinned in lib/court-ideology-takeaways.test.ts.
 */
export const COURT_CONTEXT = {
  strip: {
    text: "Ginsburg died on September 18, 2020, and the Senate confirmed Barrett, a Donald J. Trump nominee, 52–48 on October 26, giving Republican appointees six of the nine seats. In the 2020 term the likeliest median moved from Chief Justice Roberts to Kavanaugh.",
    sources: [{ id: "fjc", label: "Federal Judicial Center" }, { id: "martin-quinn", label: "Martin–Quinn" }],
  },
  trajectory: {
    text: "John F. Kennedy’s 1962 appointee Goldberg replaced Frankfurter, and the median fell from −0.04 to −1.07 that term. Richard M. Nixon’s four appointees joined from 1969 to 1971, replacing Warren, Fortas, Black and Harlan; the median rose from −0.89 in 1968 to 0.94 in 1972.",
    sources: [{ id: "fjc", label: "Federal Judicial Center" }, { id: "martin-quinn", label: "Martin–Quinn" }],
  },
} as const satisfies Partial<Record<keyof typeof COURT_TAKEAWAYS, ContextEntry>>;

export const contextFor = (card: keyof typeof COURT_TAKEAWAYS): ContextEntry | null =>
  (COURT_CONTEXT as Partial<Record<keyof typeof COURT_TAKEAWAYS, ContextEntry>>)[card] ?? null;

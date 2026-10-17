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
 * The context lines (ARCHITECTURE_MAP rule 7d). The strip's line dates the one membership change at the 1990 switch in the
 * likeliest median's appointing party, from the FJC service dates in pipeline/output/court; timing only, it never says why a
 * justice votes as they do. The trajectory's line says what Martin and Quinn say their scores are. The presidents card has
 * none: no cited source says what lies behind its highlight. Pinned in lib/court-ideology-takeaways.test.ts.
 */
export const COURT_CONTEXT = {
  strip: {
    text: "Brennan left the Court on July 20, 1990, and Souter joined on October 3, 1990. In the 1990 term the likeliest median moved from White, a Kennedy appointee, to Souter, a Bush appointee.",
    sources: [{ id: "fjc", label: "Federal Judicial Center" }, { id: "martin-quinn", label: "Martin–Quinn" }],
  },
  trajectory: {
    text: "Martin and Quinn estimate each justice’s score for each term from votes in non-unanimous cases, with a model that lets scores drift from term to term. Each score is an estimate with uncertainty, not a measured position.",
    sources: [{ id: "martin-quinn", label: "Martin–Quinn, Measures" }],
  },
} as const satisfies Partial<Record<keyof typeof COURT_TAKEAWAYS, ContextEntry>>;

export const contextFor = (card: keyof typeof COURT_TAKEAWAYS): ContextEntry | null =>
  (COURT_CONTEXT as Partial<Record<keyof typeof COURT_TAKEAWAYS, ContextEntry>>)[card] ?? null;

import type { ContextEntry } from "@/lib/chart-context";

/**
 * The takeaway under each Supreme Court decisions chart title (ARCHITECTURE_MAP rule 7c): what the chart shows over its
 * full default window (every topic, landmark filter off, the 1946 through 2025 terms), in at most two sentences.
 * Terms are the page's own: a case's term as the Supreme Court Database numbers it, "the 1972 term".
 * Every figure here is checked against pipeline/output in lib/decisions-takeaways.test.ts; a refresh that makes one untrue fails CI.
 */
export const DECISIONS_TAKEAWAYS = {
  cases: {
    title: "How many cases does the Court decide?",
    takeaway:
      "The Court decided at least 129 argued cases every term from 1970 through 1989, with a high of 156 in the 1972 and 1983 terms. From 1993 through 2025 no term topped 94; four had 57, the fewest.",
  },
  split: {
    title: "How divided is the Court?",
    takeaway:
      "From the 1946 through 2025 terms, 38% of argued cases were unanimous and 18% split 5–4. The 5–4 share ranged from 2% in the 1969 term to 34% in 2006; the unanimous share peaked at 61% in 2013.",
  },
  areas: {
    title: "Which kinds of cases split the Court?",
    takeaway:
      "Over the 1946 through 2025 terms, abortion, privacy and LGBTQ cases split 5–4 most often, 31% of the time, followed by speech, religion and guns at 24%. Courts and procedure cases were the most often unanimous, at 50%.",
  },
} as const;

/**
 * Context lines (ARCHITECTURE_MAP rule 7d): a dated statute or a dated change in who sat on the Court, the chart feature it lines
 * up with, and the mechanism where the law or the record states it. Never that the Act caused the docket to shrink, nor that a
 * new majority caused a vote split. The cases line is the older exception rule 7d allows: the 1988 Act sits behind the chart's
 * main drop and nothing recent explains it. The split line is Barrett's 2020 confirmation next to the 6–3 band's three highest
 * shares. Pinned in lib/decisions-takeaways.test.ts (the statute to its own text, the seat to the Senate's nominations table, the
 * justices' dates, votes and appointing parties to pipeline/output/court/justices.json, which the Federal Judicial Center
 * supplies). "Which kinds of cases split the Court?" has none: no cited document says what lies behind a topic's split rate.
 */
export const DECISIONS_CONTEXT = {
  cases: {
    text: "The Supreme Court Case Selections Act (P.L. 100-352, June 27, 1988) ended most appeals the Court had to hear, so nearly all its cases became ones it chose. It decided at least 129 cases every term from 1970 through 1989; none topped 94 from 1993.",
    sources: [{ id: "plaw-100-352", label: "P.L. 100-352" }],
  },
  split: {
    text: "The Senate confirmed Amy Coney Barrett, a Donald J. Trump nominee, 52\u201348 on October 26, 2020, to Ginsburg\u2019s seat, giving Republican appointees six of nine. The three highest 6\u20133 shares since 1946 followed: 32% in the 2021 term, 36% in 2023 and 30% in 2025.",
    sources: [
      { id: "senate-scotus-nominations", label: "U.S. Senate" },
      { id: "fjc", label: "Federal Judicial Center" },
    ],
  },
} as const satisfies Partial<Record<keyof typeof DECISIONS_TAKEAWAYS, ContextEntry>>;

export const contextFor = (card: keyof typeof DECISIONS_TAKEAWAYS): ContextEntry | null =>
  (DECISIONS_CONTEXT as Partial<Record<keyof typeof DECISIONS_TAKEAWAYS, ContextEntry>>)[card] ?? null;

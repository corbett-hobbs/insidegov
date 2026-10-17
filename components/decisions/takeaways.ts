/**
 * The takeaway under each Supreme Court decisions chart title (ARCHITECTURE_MAP rule 7c): what the chart shows over its
 * full default window (every issue area, landmark filter off, the 1946 through 2025 terms), in at most two sentences.
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
      "Over the 1946 through 2025 terms, First Amendment cases split 5–4 most often, 25% of the time, followed by criminal procedure at 23%. Judicial power cases were the most often unanimous, at 51%.",
  },
} as const;

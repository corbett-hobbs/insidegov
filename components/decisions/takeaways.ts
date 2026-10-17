import type { ContextEntry } from "@/lib/chart-context";

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

/**
 * Context lines (ARCHITECTURE_MAP rule 7d): a dated statute or a dated change in who sat on the Court, the chart feature it lines
 * up with, and the mechanism where the law or the record states it. Never that the Act caused the docket to shrink. Pinned in lib/decisions-takeaways.test.ts
 * (the statute to its own text, the justices' dates to pipeline/output/court/justices.json, which the Federal Judicial Center
 * supplies). "Which kinds of cases split the Court?" has none: no cited document says what lies behind an issue area's split rate.
 */
export const DECISIONS_CONTEXT = {
  cases: {
    text: "The Supreme Court Case Selections Act (P.L. 100-352, June 27, 1988) ended most appeals the Court had to hear, so nearly all its cases became ones it chose. It decided at least 129 cases every term from 1970 through 1989; none topped 94 from 1993.",
    sources: [{ id: "plaw-100-352", label: "P.L. 100-352" }],
  },
  split: {
    text: "After Abe Fortas resigned May 14, 1969, the Senate rejected Clement Haynsworth and G. Harrold Carswell, then confirmed Harry Blackmun May 12, 1970. Eight justices can\u2019t split 5\u20134; the 1969 term\u2019s two cases in that band, the chart\u2019s low, were 4\u20134 ties.",
    sources: [
      { id: "senate-scotus-nominations", label: "U.S. Senate" },
      { id: "fjc", label: "Federal Judicial Center" },
    ],
  },
} as const satisfies Partial<Record<keyof typeof DECISIONS_TAKEAWAYS, ContextEntry>>;

export const contextFor = (card: keyof typeof DECISIONS_TAKEAWAYS): ContextEntry | null =>
  (DECISIONS_CONTEXT as Partial<Record<keyof typeof DECISIONS_TAKEAWAYS, ContextEntry>>)[card] ?? null;

import type { ContextEntry } from "@/lib/chart-context";

/**
 * The takeaway under each Laws chart title (ARCHITECTURE_MAP rule 7c): what the chart shows over its full default window
 * (every Congress, all policy areas, any vote, any sponsor), in at most two sentences. Every figure here is checked against
 * pipeline/output in lib/laws-takeaways.test.ts; a refresh that makes one untrue fails CI.
 */
export const LAWS_TAKEAWAYS = {
  count: {
    title: "How many laws does Congress pass?",
    takeaway:
      "From 1973 through 2024, Congress enacted the most laws in 1987–88 (713) and the fewest in 2023–24 (274). Commemorations peaked at 40% of laws in 1985–86; without them, the most was 596, in 1973–74.",
  },
  support: {
    title: "How broadly are laws supported?",
    takeaway:
      "Most of each Congress’s laws passed by voice vote or consent from 1981 through 2024, peaking at 89% in 1985–86; the one exception was 2021–22, at 48%. Through 2024, laws passed with under 60% yes never reached 6% of a Congress’s laws.",
  },
  groups: {
    title: "Which kinds of laws pass, and how?",
    takeaway:
      "Commemorations are the largest group, a quarter of all laws; their 1,066 in the 1980s are the most of any group in a decade. Economy, taxes & trade laws had the most close votes: 9% passed with under 60% yes, against 2% of all laws.",
  },
} as const;

/**
 * Context lines (rule 7d), behind a "Context" toggle after the takeaway. The count card's: the House rule that barred
 * commemorative bills, dated by CRS, next to what commemorations did in the two Congresses around it. Timing only: the
 * line never says the rule moved the count, and nothing explains why a Congress passed more or fewer laws. The support and
 * groups cards have none: no cited document states what lies behind their highlights. Pinned in lib/laws-takeaways.test.ts.
 */
export const LAWS_CONTEXT = {
  count: {
    text: "On January 4, 1995, the House adopted a rule barring bills that designate a period of time to commemorate anything. Laws commemorating something went from 135 in 1993–94 to 42 in 1995–96.",
    sources: [{ id: "crs-commemorative-legislation", label: "CRS, Commemorative Legislation" }],
  },
} as const satisfies Partial<Record<keyof typeof LAWS_TAKEAWAYS, ContextEntry>>;

export const contextFor = (card: keyof typeof LAWS_TAKEAWAYS): ContextEntry | null =>
  (LAWS_CONTEXT as Partial<Record<keyof typeof LAWS_TAKEAWAYS, ContextEntry>>)[card] ?? null;

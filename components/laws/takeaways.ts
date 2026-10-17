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
 * Context lines (rule 7d), behind a "Context" toggle after the takeaway. Timing only: no line says an event moved a count.
 * - count: the 118th Congress's two Speaker fights (the January 2023 election that took 15 ballots, by law before any member
 *   could be sworn in, and the October 2023 vote removing Speaker McCarthy, 22 days before a successor), set next to the chart's
 *   record low, 2023–24. Dated by House History and the Clerk; the swearing-in rule is 2 U.S.C. 25.
 * - groups: the January 1995 House rule barring commemorative bills, dated by CRS, next to the commemorations row's fall from its
 *   1980s peak. An older event on purpose (rule 7d): that peak is the feature the takeaway names, and nothing recent explains it.
 * The support card has none: its 2021–22 exception has no dated political event behind it in any cited record. Pinned in
 * lib/laws-takeaways.test.ts.
 */
export const LAWS_CONTEXT = {
  count: {
    text: "The 2023–24 low came in a Congress whose House took 15 ballots to elect a Speaker in January 2023, and by law no member could be sworn in before then. In October it voted 216–210 to remove Speaker McCarthy and went 22 days without one.",
    sources: [
      { id: "house-speaker-ballots", label: "House History" },
      { id: "house-roll-call-2023-519", label: "House roll call 519" },
      { id: "usc-2-25", label: "2 U.S.C. 25" },
    ],
  },
  groups: {
    text: "On January 4, 1995, the House adopted a rule barring bills that designate a period of time to commemorate anything. Commemorations fell from 1,066 laws in the 1980s to 551 in the 1990s, and from 135 in 1993–94 to 42 in 1995–96.",
    sources: [{ id: "crs-commemorative-legislation", label: "CRS, Commemorative Legislation" }],
  },
} as const satisfies Partial<Record<keyof typeof LAWS_TAKEAWAYS, ContextEntry>>;

export const contextFor = (card: keyof typeof LAWS_TAKEAWAYS): ContextEntry | null =>
  (LAWS_CONTEXT as Partial<Record<keyof typeof LAWS_TAKEAWAYS, ContextEntry>>)[card] ?? null;

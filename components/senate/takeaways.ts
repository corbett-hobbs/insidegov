import type { ChamberView } from "@/lib/chamber";
import type { ContextEntry } from "@/lib/chart-context";

/**
 * The takeaway under each Congress ideology card title (ARCHITECTURE_MAP rule 7c):
 * what the chart shows in its default view (the 119th Congress, or every
 * Congress for the trend), in at most two sentences. Each card has one per
 * chamber view, picked at render, so a Senate fact never sits under the House
 * chart. Every figure here is checked against pipeline/output in
 * lib/congress-ideology-takeaways.test.ts; a refresh that makes one untrue fails CI.
 */
export const IDEOLOGY_TAKEAWAYS: Record<
  "members" | "states" | "committees" | "committeeSpread" | "trend",
  { title: string; byView: Record<ChamberView, string> }
> = {
  members: {
    title: "Where members stand",
    byView: {
      both: "In the 119th Congress, every Democrat scores left of the center line and every Republican right of it, so the parties don't overlap at all. Republicans spread across a wider range than Democrats.",
      senate: "In the 119th Congress, every Democratic senator scores left of the center line and every Republican right of it, so the parties don't overlap at all. Republicans spread across a wider range than Democrats.",
      house: "In the 119th Congress, every House Democrat scores left of the center line and every Republican right of it, so the parties don't overlap at all. Republicans spread across a wider range than Democrats.",
    },
  },
  states: {
    title: "How each state votes",
    byView: {
      both: "In the 119th Congress, 30 states send members of both parties to Congress, and each of those delegations spans a wider range than any one-party delegation. Texas's spans the widest.",
      senate: "In the 119th Congress, 47 states have two senators who caucus with the same party. Only Maine, Pennsylvania and Wisconsin split, and Wisconsin's pair sits farthest apart of any state.",
      house: "In the 119th Congress, 29 states send House delegations with members of both parties, and each spans a wider range than any one-party delegation. Texas's spans the widest.",
    },
  },
  committees: {
    title: "Where committees stand",
    byView: {
      both: "In the 119th Congress, every committee's members average out right of the center line. Senate Environment and Public Works sits closest to center; the House's January 6 select subcommittee sits farthest right.",
      senate: "In the 119th Congress, every Senate committee's members average out right of the center line. Environment and Public Works sits closest to center; Homeland Security and Governmental Affairs sits farthest right.",
      house: "In the 119th Congress, every House committee's members average out right of the center line. Ethics, split evenly between the parties, sits closest to center; the January 6 select subcommittee sits farthest right.",
    },
  },
  committeeSpread: {
    title: "How each committee votes",
    byView: {
      both: "On every committee in the 119th Congress, each Republican member sits to the right of each Democrat. Senate Armed Services and Aging span the widest range, end to end; the Commission on Security and Cooperation in Europe spans the narrowest.",
      senate: "On every Senate committee in the 119th Congress, each Republican member sits to the right of each Democrat. Armed Services and Aging span the widest range, end to end; Ethics spans the narrowest.",
      house: "On every House committee in the 119th Congress, each Republican member sits to the right of each Democrat. Budget spans the widest range, end to end; House Administration spans the narrowest.",
    },
  },
  trend: {
    title: "How far apart are the parties?",
    byView: {
      both: "The gap between the party lines was narrowest in 1947 and stayed near that low through the 1970s. It widened in most Congresses after that, coming within 0.01 of its 1903 peak in 2025.",
      senate: "In the Senate, the gap between the party lines was narrowest in 1939 and stayed near that low through the 1950s. It widened in most Congresses after that; its two widest gaps came in 2023 and 2025.",
      house: "In the House, the gap between the party lines was narrowest in 1967, close to where it sat from the late 1930s through the 1970s. It widened in most Congresses after that; only 1903's gap was wider than 2025's.",
    },
  },
};

/**
 * Context lines (rule 7d), behind a "Context" toggle after the takeaway: only the trend card has one, per chamber view. It sets two
 * dated events, the 1964–65 civil rights statutes and the 1994 election, next to how far the Democratic share of the former
 * Confederate states' members fell over the same years. Timing only: it never says either event moved the gap, since what drove
 * polarization is disputed. The members, states and committee cards have none: no dated political event sits behind a 119th
 * Congress snapshot that the reader doesn't already see. Pinned in lib/congress-ideology-takeaways.test.ts.
 */
const CIVIL_RIGHTS = [
  { id: "civil-rights-act-1964", label: "Civil Rights Act" },
  { id: "voting-rights-act-1965", label: "Voting Rights Act" },
  { id: "house-party-division", label: "House party divisions" },
] as const;
const southShare = (from: number, to: number, where: string) =>
  `Congress passed the Civil Rights Act in 1964 and the Voting Rights Act in 1965. Democrats were ${from}% of the 11 former Confederate states' ${where} in 1963 and ${to}% in 1995, after Republicans won the House in 1994 for the first time since 1952.`;
export const IDEOLOGY_CONTEXT = {
  trend: {
    both: { text: southShare(90, 48, "lawmakers"), sources: CIVIL_RIGHTS },
    senate: { text: southShare(96, 41, "senators"), sources: CIVIL_RIGHTS },
    house: { text: southShare(89, 49, "House members"), sources: CIVIL_RIGHTS },
  },
} as const satisfies Partial<Record<keyof typeof IDEOLOGY_TAKEAWAYS, Record<ChamberView, ContextEntry>>>;

export const contextFor = (card: keyof typeof IDEOLOGY_TAKEAWAYS, view: ChamberView): ContextEntry | null =>
  (IDEOLOGY_CONTEXT as Partial<Record<keyof typeof IDEOLOGY_TAKEAWAYS, Record<ChamberView, ContextEntry>>>)[card]?.[view] ?? null;

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
 * Context lines (rule 7d), behind a "Context" toggle after the takeaway, one per chamber view where a view has one. Timing only:
 * none says an event moved the gap, since what drove polarization is disputed.
 * - committees (House view only): the November 2024 election that kept Republicans in the House majority (House History's
 *   party divisions, 220–215), next to the chart's every-committee-right-of-center pattern: Republicans outnumber Democrats on
 *   every House committee here but Ethics, the only standing committee split evenly (the Ethics Committee's own history page).
 *   The Senate and both-chambers views have none: committee_memberships.json has no seats for two Republican senators, so three
 *   Senate committees count evenly on this chart and a "majority on every committee" line would not match it.
 * - trend: the 1964–65 civil rights statutes and the 1994 election that gave Republicans both chambers, next to how far the
 *   Democratic share of the former Confederate states' members fell and how wide the gap had grown by 1995. An older exception on
 *   purpose (rule 7d): the narrow mid-century gap and its widening are what the takeaway names, and nothing recent explains them.
 * The members, states and committee-spread cards have none: no dated political event sits behind a 119th Congress snapshot that
 * the reader doesn't already see. Pinned in lib/congress-ideology-takeaways.test.ts.
 */
// Short labels: the panel keeps its source list on one unbroken line, and the full names overflow a phone-width card.
const CIVIL_RIGHTS = [
  { id: "civil-rights-act-1964", label: "1964 Act" },
  { id: "voting-rights-act-1965", label: "1965 Act" },
  { id: "house-party-division", label: "House seats" },
  { id: "senate-party-division", label: "Senate seats" },
] as const;
const southShare = (from: number, to: number, where: string, since: number) =>
  `Congress passed the Civil Rights Act in 1964 and the Voting Rights Act in 1965; Republicans won both chambers in 1994. Democrats were ${from}% of the former Confederate states' ${where} in 1963 and ${to}% in 1995, when the gap was its widest since ${since}.`;
export const IDEOLOGY_CONTEXT = {
  committees: {
    house: {
      text: "Republicans kept the House 220–215 in the November 2024 election, and they outnumber Democrats on every House committee here except Ethics, the only standing committee split evenly. A Republican majority on a committee puts its average right of the center line.",
      sources: [
        { id: "house-party-division", label: "House party divisions" },
        { id: "house-ethics-history", label: "House Ethics Committee" },
      ],
    },
  },
  trend: {
    both: { text: southShare(90, 48, "lawmakers", 1923), sources: CIVIL_RIGHTS },
    senate: { text: southShare(96, 41, "senators", 1929), sources: CIVIL_RIGHTS },
    house: { text: southShare(89, 49, "House members", 1911), sources: CIVIL_RIGHTS },
  },
} as const satisfies Partial<Record<keyof typeof IDEOLOGY_TAKEAWAYS, Partial<Record<ChamberView, ContextEntry>>>>;

export const contextFor = (card: keyof typeof IDEOLOGY_TAKEAWAYS, view: ChamberView): ContextEntry | null =>
  (IDEOLOGY_CONTEXT as Partial<Record<keyof typeof IDEOLOGY_TAKEAWAYS, Partial<Record<ChamberView, ContextEntry>>>>)[card]?.[view] ?? null;

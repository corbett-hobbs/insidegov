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
 * Context lines (rule 7d), behind a "Context" toggle after the takeaway. Both are about the measure, in Voteview's own words, and
 * true in every chamber view: what the map's distances mean, and that the per-Congress (Nokken–Poole) scores the cards plot treat
 * each Congress separately. Nothing here explains polarization or calls anyone extreme. The states, committees and committee-spread
 * cards have none: no cited source states what lies behind their highlights (committee averages would need a chamber-control line,
 * which reads as a cause). Pinned in lib/congress-ideology-takeaways.test.ts.
 */
export const IDEOLOGY_CONTEXT = {
  members: {
    text: "Voteview places members by their roll-call votes: the closer two dots, the more similar their voting records. Each Congress is estimated separately, so a score compares a member only with others voting on that Congress's roll calls.",
    sources: [
      { id: "voteview-about", label: "Voteview, About" },
      { id: "voteview-member-data", label: "Voteview, member data" },
    ],
  },
  trend: {
    text: "Each point uses scores Voteview estimates as if every Congress were completely separate, so it rests only on that Congress's roll-call votes. Voteview's first dimension has been liberal versus conservative through most of American history.",
    sources: [
      { id: "voteview-member-data", label: "Voteview, member data" },
      { id: "voteview-about", label: "Voteview, About" },
    ],
  },
} as const satisfies Partial<Record<keyof typeof IDEOLOGY_TAKEAWAYS, ContextEntry>>;

export const contextFor = (card: keyof typeof IDEOLOGY_TAKEAWAYS): ContextEntry | null =>
  (IDEOLOGY_CONTEXT as Partial<Record<keyof typeof IDEOLOGY_TAKEAWAYS, ContextEntry>>)[card] ?? null;

/**
 * Pure filter / sort logic for the Members directory (`/congress/members`).
 * Client-safe: the rows are built at build time by `lib/members-directory-data.ts`
 * and every filter and sort runs in the browser on this module.
 */
import type { Chamber, ChamberView } from "./chamber";
import type { PartyGroup } from "./congress-types";
import { stateName } from "./states";

export type LeaderRole = "speaker" | "majority_leader" | "minority_leader";

/** One sitting member of Congress, as the directory shows them. */
export interface DirectoryMember {
  bioguideId: string;
  chamber: Chamber;
  name: string;
  lastName: string;
  state: string;
  /** House numbered district; `null` for at-large seats and every senator. */
  district: number | null;
  /** Registration: "Democrat", "Republican", "Independent". */
  party: string;
  /** Caucus colour group (Sanders and King caucus with the Democrats). */
  group: PartyGroup;
  hasPhoto: boolean;
  /** ISO date the member was first sworn into their current chamber; `null` if unrecorded. */
  since: string | null;
  /** Left-right score in the current Congress (DW-NOMINATE first dimension, −1 to 1); `null` with too few votes. */
  ideology: number | null;
  /** Latest estimated net worth (midpoint) from a 2023-or-later filing; `null` without one. */
  netWorth: number | null;
  /** True when the latest filing has an open-ended top band ("$50M or more"). */
  netWorthOpenEnded: boolean;
  /** Median daily Wikipedia views over the trailing window; `null` with no article. */
  views: number | null;
  leaderRole: LeaderRole | null;
}

export type DirectoryParty = "Democrat" | "Republican" | "Independent";

export interface DirectoryFilters {
  query: string;
  chamber: ChamberView;
  party: DirectoryParty | null;
  state: string | null;
}

export const NO_FILTERS: DirectoryFilters = { query: "", chamber: "both", party: null, state: null };

export type DirectorySort =
  | "interest"
  | "name"
  | "state"
  | "ideology-left"
  | "ideology-right"
  | "seniority"
  | "net-worth";

export const SORTS: readonly { id: DirectorySort; label: string }[] = [
  { id: "interest", label: "Most looked up (Wikipedia)" },
  { id: "name", label: "Name (A–Z)" },
  { id: "state", label: "State" },
  { id: "ideology-left", label: "Ideology: left to right" },
  { id: "ideology-right", label: "Ideology: right to left" },
  { id: "seniority", label: "Longest serving" },
  { id: "net-worth", label: "Highest net worth" },
];

/** Lower-case, accents stripped, so "lujan" finds "Luján". */
export function foldText(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** Every word of the query appears somewhere in the name ("chuck schumer", "schum"). */
export function nameMatches(name: string, query: string): boolean {
  const words = foldText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = foldText(name);
  return words.every((w) => hay.includes(w));
}

export function filterMembers(members: readonly DirectoryMember[], f: DirectoryFilters): DirectoryMember[] {
  return members.filter(
    (m) =>
      (f.chamber === "both" || m.chamber === f.chamber) &&
      (!f.party || m.party === f.party) &&
      (!f.state || m.state === f.state) &&
      nameMatches(m.name, f.query),
  );
}

const byLastName = (a: DirectoryMember, b: DirectoryMember) =>
  a.lastName.localeCompare(b.lastName) || a.name.localeCompare(b.name);

/** Present values first, by `cmp`; members with no value go last, A–Z. */
function nullsLast<T>(get: (m: DirectoryMember) => T | null, cmp: (a: T, b: T) => number) {
  return (a: DirectoryMember, b: DirectoryMember) => {
    const av = get(a);
    const bv = get(b);
    if (av === null && bv === null) return byLastName(a, b);
    if (av === null) return 1;
    if (bv === null) return -1;
    return cmp(av, bv) || byLastName(a, b);
  };
}

/** Senators first within a state, then House districts in order (at-large as 0). */
function byPlace(a: DirectoryMember, b: DirectoryMember): number {
  return (
    stateName(a.state).localeCompare(stateName(b.state)) ||
    (a.chamber === b.chamber ? 0 : a.chamber === "senate" ? -1 : 1) ||
    (a.district ?? 0) - (b.district ?? 0) ||
    byLastName(a, b)
  );
}

const COMPARATORS: Record<DirectorySort, (a: DirectoryMember, b: DirectoryMember) => number> = {
  interest: nullsLast((m) => m.views, (a, b) => b - a),
  name: byLastName,
  state: byPlace,
  "ideology-left": nullsLast((m) => m.ideology, (a, b) => a - b),
  "ideology-right": nullsLast((m) => m.ideology, (a, b) => b - a),
  seniority: nullsLast((m) => m.since, (a, b) => a.localeCompare(b)),
  "net-worth": nullsLast((m) => m.netWorth, (a, b) => b - a),
};

export function sortMembers(members: readonly DirectoryMember[], sort: DirectorySort): DirectoryMember[] {
  return [...members].sort(COMPARATORS[sort]);
}

/** The value a sort orders by; `null` rows trail the list and get no rank number. */
export function sortValue(m: DirectoryMember, sort: DirectorySort): number | string | null {
  switch (sort) {
    case "interest":
      return m.views;
    case "ideology-left":
    case "ideology-right":
      return m.ideology;
    case "seniority":
      return m.since;
    case "net-worth":
      return m.netWorth;
    default:
      return m.name;
  }
}

/** Whether a sort is a ranking (numbered rows) rather than an index (A–Z, by state). */
export function isRanking(sort: DirectorySort): boolean {
  return sort !== "name" && sort !== "state";
}

/** Speaker, then each chamber's floor leaders: the order the pinned Leadership group shows. */
const LEADER_ORDER: readonly { chamber: Chamber; role: LeaderRole }[] = [
  { chamber: "house", role: "speaker" },
  { chamber: "house", role: "majority_leader" },
  { chamber: "house", role: "minority_leader" },
  { chamber: "senate", role: "majority_leader" },
  { chamber: "senate", role: "minority_leader" },
];

export function leaderTitle(chamber: Chamber, role: LeaderRole): string {
  if (role === "speaker") return "Speaker of the House";
  return `${chamber === "house" ? "House" : "Senate"} ${role === "majority_leader" ? "Majority" : "Minority"} Leader`;
}

/** The leaders among `members`, in the fixed order above. */
export function pickLeaders(members: readonly DirectoryMember[]): DirectoryMember[] {
  return LEADER_ORDER.flatMap(({ chamber, role }) =>
    members.filter((m) => m.chamber === chamber && m.leaderRole === role),
  );
}

/** "NY", "TX-12", "AK-AL" (at-large). */
export function seatLabel(m: Pick<DirectoryMember, "chamber" | "state" | "district">): string {
  if (m.chamber === "senate") return m.state;
  return `${m.state}-${m.district === null || m.district === 0 ? "AL" : m.district}`;
}

/** "D" / "R" / "I". */
export function partyLetter(party: string): string {
  return party === "Democrat" ? "D" : party === "Republican" ? "R" : party.charAt(0).toUpperCase();
}

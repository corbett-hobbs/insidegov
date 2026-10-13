import { LAW_ACTION_TYPES, type LawAction, type LawActionVote } from "./law-details-entities";
import type { ChamberTally } from "./laws-types";
import type { AmendmentStatus } from "./law-details-types";

/** Pure shaping for a law page (no file I/O): action labels, vote wording, the cosponsor party split. */

export type ActionKind = "introduced" | "committee" | "calendar" | "floor" | "conference" | "president" | "law" | "veto" | "other";

const KIND_BY_TYPE: Record<(typeof LAW_ACTION_TYPES)[number], ActionKind> = {
  Floor: "floor",
  ResolvingDifferences: "conference",
  President: "president",
  BecameLaw: "law",
  Veto: "veto",
  NotUsed: "other",
  Committee: "committee",
  Introduced: "introduced",
  IntroReferral: "committee",
  Calendars: "calendar",
  Discharge: "committee",
};

export const ACTION_KIND_LABEL: Record<ActionKind, string> = {
  introduced: "Introduced",
  committee: "Committee",
  calendar: "Calendar",
  floor: "Floor",
  conference: "Resolving differences",
  president: "President",
  law: "Became law",
  veto: "Veto",
  other: "Other",
};

export interface TimelineAction {
  date: string;
  kind: ActionKind;
  text: string;
  /** "House roll call 442" style labels for the roll calls the action cites. */
  rolls: string[];
}

export const rollLabel = (v: LawActionVote): string => `${v[0] === 0 ? "House" : "Senate"} roll call ${v[1]}`;

/** How far along a kind is, for ordering actions that share a date: the later step of the process comes first in a newest-first list. */
const KIND_RANK: Record<ActionKind, number> = { other: 0, introduced: 1, committee: 2, calendar: 3, floor: 4, conference: 5, president: 6, veto: 7, law: 8 };

/**
 * The stored action tuples as the timeline shows them, **newest first** (the site's rule for dated lists). Actions on one date
 * run latest step first (signed before passed before reported before introduced), then in the source's own order. A signing entry
 * (type President) reads as "Became law" when it says so.
 */
export function timeline(actions: readonly LawAction[]): TimelineAction[] {
  return actions
    .map((a, i) => {
      const kind = KIND_BY_TYPE[LAW_ACTION_TYPES[a[1]]!];
      const text = a[2];
      // The source types both "Introduced in House" and "Referred to ..." as IntroReferral; the first is the introduction.
      const k: ActionKind = kind === "president" && /^(?:became public law|signed by president)/i.test(text) ? "law" : LAW_ACTION_TYPES[a[1]] === "IntroReferral" && /^introduced\b/i.test(text) ? "introduced" : kind;
      return { i, a: { date: a[0], kind: k, text, rolls: (a[3] ?? []).map(rollLabel) } satisfies TimelineAction };
    })
    .sort((x, y) => y.a.date.localeCompare(x.a.date) || KIND_RANK[y.a.kind] - KIND_RANK[x.a.kind] || x.i - y.i)
    .map((x) => x.a);
}

/** Vote method wording for one chamber's final passage. */
export function methodText(t: ChamberTally): string {
  if (t[0] === 0 && t[1] !== null && t[2] !== null) return "Recorded vote";
  if (t[0] === 1) return "Voice vote";
  if (t[0] === 2) return "Unanimous consent";
  return "Method not stated";
}

/** Share of votes cast that were yea, 0-1; null where the vote was not a counted roll call. */
export function yeaShare(yea: number | null, nay: number | null): number | null {
  if (yea === null || nay === null || yea + nay === 0) return null;
  return yea / (yea + nay);
}

export type PartyLetter = "D" | "R" | "I";

/** Counts of cosponsors per party, in D / R / I order, dropping a party with none. */
export function partySplit(parties: readonly PartyLetter[]): { party: PartyLetter; n: number }[] {
  return (["D", "R", "I"] as const).map((party) => ({ party, n: parties.filter((p) => p === party).length })).filter((x) => x.n > 0);
}

/** "Democrats" / "Republicans" / "Independents and others". */
export const PARTY_NAME: Record<PartyLetter, string> = { D: "Democrats", R: "Republicans", I: "Independents and others" };

/** "Sep 30, 2024" from an ISO date, the format the Laws list uses. */
export const longDate = (iso: string): string => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });

/** Display order and wording of the amendment statuses: the commonest, "offered", first and the one outcome that changed the bill, "agreed", last. */
export const AMENDMENT_STATUSES: readonly { value: AmendmentStatus; label: string }[] = [
  { value: "offered", label: "Offered, no vote recorded" },
  { value: "other", label: "Other" },
  { value: "fell", label: "Fell" },
  { value: "out_of_order", label: "Ruled out of order" },
  { value: "withdrawn", label: "Withdrawn" },
  { value: "rejected", label: "Rejected" },
  { value: "agreed", label: "Agreed to" },
];

/** An amendment's status from the text of its last recorded action (the source gives no status field). */
export function amendmentStatus(text: string | null | undefined): AmendmentStatus {
  if (!text) return "offered";
  const s = text.toLowerCase();
  if (/ruled (out of order|non-germane)|not germane|point of order (was )?sustained/.test(s)) return "out_of_order";
  if (/\bfell\b/.test(s)) return "fell";
  if (/withdrawn|withdrew/.test(s)) return "withdrawn";
  // A motion to table that carried kills the amendment; a failed vote or one that missed its threshold does too.
  if (/not agreed to|failed|rejected|not adopted|motion to table amendment.*agreed|not having achieved/.test(s)) return "rejected";
  if (/agreed to|adopted|having achieved/.test(s)) return "agreed";
  if (/^senate amendment submitted|^house amendment offered|^amendment sa \d+ proposed|^amendment .*proposed by/.test(s)) return "offered";
  return "other";
}

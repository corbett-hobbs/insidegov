/**
 * A member's voting record on enacted laws, and how often they voted with their party. Pure logic (no I/O); the build-time reader is
 * `lib/member-votes-data.ts`.
 *
 * The record is each law's final-passage roll call in the member's chamber (the `law_votes` shards), so it covers bills that became
 * law, not amendments, motions or bills that failed. "With party" means the member's yea or nay matched the way a majority of their
 * party's members voting yea or nay went on that roll call. Independents who caucus with a party count with it; other independents
 * have no party stat.
 */

import type { MemberLaws } from "./laws-types";

/** Cast characters in a `law_votes` shard. */
export const YEA = "1";
export const NAY = "2";

export type PartyLetter = "D" | "R" | "I";

/** `[yea, nay]` among one party's members voting yea or nay. */
export type PartySplit = [number, number];

/** Each member's cast on one roll call (a member holding two roster slots keeps the slot that voted). */
export function castsById(roster: readonly string[], casts: string): Map<string, string> {
  const out = new Map<string, string>();
  roster.forEach((id, i) => {
    const c = casts[i] ?? "0";
    if (id !== "" && (c !== "0" || !out.has(id))) out.set(id, c);
  });
  return out;
}

/** Yea and nay counts for the Democrats and the Republicans on one roll call. */
export function partySplits(cast: ReadonlyMap<string, string>, partyOf: (id: string) => PartyLetter): { D: PartySplit; R: PartySplit } {
  const out = { D: [0, 0] as PartySplit, R: [0, 0] as PartySplit };
  for (const [id, c] of cast) {
    const p = partyOf(id);
    if (p === "I") continue;
    if (c === YEA) out[p][0]++;
    else if (c === NAY) out[p][1]++;
  }
  return out;
}

/** The way a party's yea/nay majority went: 1 yea, 2 nay, null when it split evenly or cast no votes. */
export const majorityOf = ([yea, nay]: PartySplit): "1" | "2" | null => (yea > nay ? YEA : nay > yea ? NAY : null);

/**
 * `1` the member voted with their party's majority, `0` against it, `2` not counted (did not vote yea or nay, no party, or the
 * party split evenly).
 */
export type WithParty = 0 | 1 | 2;

export function withParty(cast: string, party: PartyLetter, splits: { D: PartySplit; R: PartySplit }): WithParty {
  if (party === "I" || (cast !== YEA && cast !== NAY)) return 2;
  const m = majorityOf(splits[party]);
  return m === null ? 2 : m === cast ? 1 : 0;
}

/** True when the two parties' majorities opposed each other: the votes where party loyalty is a real choice. */
export function isPartySplit(splits: { D: PartySplit; R: PartySplit }): boolean {
  const d = majorityOf(splits.D);
  const r = majorityOf(splits.R);
  return d !== null && r !== null && d !== r;
}

/**
 * One law in a member's record: `[law id, chamber 0 House / 1 Senate, cast 1 yea / 2 nay / 3 present / 4 did not vote,
 * with party (see WithParty), 1 if the parties' majorities opposed, own-party yea, own-party nay]`.
 */
export type MemberVoteRow = [string, 0 | 1, 1 | 2 | 3 | 4, WithParty, 0 | 1, number, number];

/** A member's record, served at `/data/members/[id]/votes`: `list` holds the Laws list's own tuples for the laws voted on, which the rows' law ids look up. */
export interface MemberVotesPayload extends MemberVotes {
  list: MemberLaws;
}

export interface MemberVotes {
  party: PartyLetter;
  /** Newest first. */
  rows: MemberVoteRow[];
  /** Votes with / against the party, over all counted votes and over the party-split ones only. */
  all: { with: number; against: number };
  split: { with: number; against: number };
}

/** Share of counted votes cast with the party, as a whole percent; null with none counted. */
export const pctWith = (t: { with: number; against: number }): number | null => {
  const n = t.with + t.against;
  return n === 0 ? null : Math.round((100 * t.with) / n);
};

/** Sums a member's rows into the two tallies. */
export function tallyRows(rows: readonly MemberVoteRow[]): Pick<MemberVotes, "all" | "split"> {
  const out = { all: { with: 0, against: 0 }, split: { with: 0, against: 0 } };
  for (const r of rows) {
    if (r[3] === 2) continue;
    const k = r[3] === 1 ? "with" : "against";
    out.all[k]++;
    if (r[4] === 1) out.split[k]++;
  }
  return out;
}

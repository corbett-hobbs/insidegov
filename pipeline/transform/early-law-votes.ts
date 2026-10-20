import type { EarlyChamberVote, EarlyLawVotes, EarlyLawVotesRef, RawEarlyLawVotesFile, RawEarlyRoll } from "../../lib/early-law-votes-entities";
import { COUNT_TOLERANCE, foldCast, tally } from "./law-votes";

/**
 * Passage votes for laws before 1973 (pure; no file I/O). Joins the hand-picked roll calls (`reference/early-law-votes.json`) to the
 * fetched Voteview rows and member votes, and splits each by party with Voteview's own party codes (100 Democrat, 200 Republican;
 * Farmer-Labor, Progressive and other members count in the totals only).
 *
 * Gates, each a thrown error: a picked roll call is missing from the raw file; its member votes do not add up to Voteview's yea and
 * nay counts (within `COUNT_TOLERANCE`, read as `chamberVotes` reads them); a passage pick did not carry a majority, or an override
 * pick two thirds.
 */

/** `congress|chamber|icpsr` -> Voteview party code. */
export type PartyCodes = ReadonlyMap<string, number>;

const PARTY: Record<number, "D" | "R"> = { 100: "D", 200: "R" };

export function chamberVote(raw: RawEarlyLawVotesFile, congress: number, chamber: "H" | "S", roll: number, parties: PartyCodes, presidents: ReadonlySet<number>, override: boolean, label: string): EarlyChamberVote {
  const block = raw.congresses[String(congress)];
  const row: RawEarlyRoll | undefined = block?.rolls.find((r) => r[0] === chamber && r[1] === roll);
  if (!block || !row) throw new Error(`${label}: ${congress} ${chamber} roll call ${roll} is not in early_law_votes.json; run pnpm fetch:voteview-early-votes`);
  const [, , date, yea, nay, , , casts] = row;
  const roster = block.rosters[chamber];
  if (casts.length !== roster.length) throw new Error(`${label}: ${chamber} roll ${roll} has ${casts.length} casts for a roster of ${roster.length}`);
  const kept = [...casts].map((c, i) => (presidents.has(roster[i]!) ? "0" : c));
  // Voteview's counts are cast code 1 and 6 alone (votes cast) on most roll calls and 1-3 and 4-6 (with paired and announced
  // positions) on others: accept a match under either reading, and split by party under the one that matches, so the parties add up
  // to the tally shown.
  const t = tally(kept.map(foldCast).join(""));
  const cast = { yea: kept.filter((c) => c === "1").length, nay: kept.filter((c) => c === "6").length };
  const offCast = Math.abs(cast.yea - yea) + Math.abs(cast.nay - nay);
  const offAll = Math.abs(t.yea - yea) + Math.abs(t.nay - nay);
  if (Math.min(offCast, offAll) > COUNT_TOLERANCE) throw new Error(`${label}: ${chamber} roll ${roll} member votes add up to ${cast.yea}-${cast.nay} (${t.yea}-${t.nay} with pairs), Voteview's roll call says ${yea}-${nay}`);
  const side = offCast <= offAll ? (c: string) => (c === "1" ? 0 : c === "6" ? 1 : null) : (c: string) => (c === "0" ? null : foldCast(c) === "1" ? 0 : foldCast(c) === "2" ? 1 : null);
  const out: EarlyChamberVote = { roll, date, yea, nay, D: [0, 0], R: [0, 0] };
  kept.forEach((c, i) => {
    const s = side(c);
    const p = PARTY[parties.get(`${congress}|${chamber}|${roster[i]}`) ?? 0];
    if (s !== null && p) out[p][s]++;
  });
  if (override ? yea * 3 < (yea + nay) * 2 : yea <= nay) throw new Error(`${label}: ${chamber} roll ${roll} (${yea}-${nay}) did not carry${override ? " two thirds" : ""}; check the pick`);
  return out;
}

export function buildEarlyLawVotes(ref: EarlyLawVotesRef, raw: RawEarlyLawVotesFile, parties: PartyCodes, presidents: ReadonlySet<number>): EarlyLawVotes[] {
  return ref.laws.map((e) => {
    const label = e.timeline ?? e.mayhew!;
    const vote = (ch: "H" | "S", roll: number | undefined, override = false) => (roll === undefined ? null : chamberVote(raw, e.congress, ch, roll, parties, presidents, override, label));
    const ho = vote("H", e.house_override, true);
    const so = vote("S", e.senate_override, true);
    return {
      ...(e.timeline ? { timeline: e.timeline } : {}),
      ...(e.mayhew ? { mayhew: e.mayhew } : {}),
      congress: e.congress,
      house: vote("H", e.house),
      senate: vote("S", e.senate),
      ...(ho ? { house_override: ho } : {}),
      ...(so ? { senate_override: so } : {}),
    };
  });
}

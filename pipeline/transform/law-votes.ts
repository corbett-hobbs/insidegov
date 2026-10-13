import type { LawChamberVotes, RawLawVotesFile } from "../../lib/law-votes-entities";
import type { RollcallTuple } from "../fetch/voteview-rollcalls-lib";

/** Voteview `cast_code` -> the page's one-character code: 1-3 yea (with paired and announced), 4-6 nay, 7-8 present, 9 did not vote, 0 not a member then. */
export function foldCast(code: string): "0" | "1" | "2" | "3" | "4" {
  const n = Number(code);
  if (n === 0) return "0";
  if (n <= 3) return "1";
  if (n <= 6) return "2";
  if (n <= 8) return "3";
  return "4";
}

/** Voteview's own yea and nay counts treat paired and announced votes inconsistently from roll call to roll call, so a member list agrees with them when it is within this many votes in total. */
export const COUNT_TOLERANCE = 2;

/** Count yea and nay in a folded vote string. */
export function tally(votes: string): { yea: number; nay: number } {
  let yea = 0;
  let nay = 0;
  for (const c of votes) {
    if (c === "1") yea++;
    else if (c === "2") nay++;
  }
  return { yea, nay };
}

/**
 * One chamber's recorded vote on a law's passage, from the raw file's roll call: folded, and checked against the roll-call row the Laws
 * transform joined (`rollcalls_93on.json`): the member list must add up to Voteview's own yea and nay counts. Throws on a miss.
 */
export function chamberVotes(raw: RawLawVotesFile, chamber: "H" | "S", row: RollcallTuple, lawId: string, presidents: ReadonlySet<number> = new Set()): LawChamberVotes {
  const hit = raw.rolls.find((r) => r[0] === chamber && r[1] === row[2]);
  if (!hit) throw new Error(`${lawId}: no member votes for ${chamber} roll call ${row[2]} of Congress ${raw.congress}`);
  // Voteview files the President's position on a bill under the chamber; it is not a member's vote.
  const casts = [...hit[2]].map((c, i) => (presidents.has(raw.rosters[chamber][i]!) ? "0" : c));
  const folded = casts.map(foldCast).join("");
  const t = tally(folded);
  // Voteview's counts are cast code 1 and 6 alone on some roll calls and 1-3 and 4-6 on others: accept a match under any of the readings.
  let y1 = 0;
  let n6 = 0;
  for (const c of casts) {
    if (c === "1") y1++;
    else if (c === "6") n6++;
  }
  const off = Math.min(Math.abs(y1 - row[6]) + Math.abs(n6 - row[7]), Math.abs(t.yea - row[6]) + Math.abs(t.nay - row[7]), Math.abs(y1 - row[6]) + Math.abs(t.nay - row[7]));
  if (folded.length !== raw.rosters[chamber].length) throw new Error(`${lawId}: ${chamber} roll ${row[2]} has ${folded.length} casts for a roster of ${raw.rosters[chamber].length}`);
  if (off > COUNT_TOLERANCE) throw new Error(`${lawId}: ${chamber} roll ${row[2]} member votes add up to ${t.yea}-${t.nay}, Voteview's roll call says ${row[6]}-${row[7]}`);
  return [row[2], folded];
}

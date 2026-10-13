import "server-only";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { getCurrentMemberIndex } from "./congress-data";
import { ideologyScore, type IdeologyScore } from "./entities";
import { lawVotesShard } from "./law-votes-entities";
import type { LawChamberVotesView, LawVoter, VoteCast } from "./law-votes-types";
import { getLawSponsorResolver } from "./laws-data";

/**
 * Build-time reader for the "who voted" section of a law page: one Congress's `law_votes` shard (the roster and each passage roll call's
 * casts), joined to the member's DW-NOMINATE position (`ideology_scores.json`, the same per-Congress Nokken-Poole coordinates the compass plots),
 * name, party and profile path. Nothing is stored twice: the shard holds casts only.
 */
const OUT = join(process.cwd(), "pipeline", "output");
const read = (file: string): unknown => JSON.parse(readFileSync(join(OUT, file), "utf8"));

const shards = new Map<number, z.infer<typeof lawVotesShard> | null>();
function shardFor(congress: number) {
  if (!shards.has(congress)) shards.set(congress, existsSync(join(OUT, "law_votes", `${congress}.json`)) ? lawVotesShard.parse(read(`law_votes/${congress}.json`)) : null);
  return shards.get(congress)!;
}

let scores: Map<string, IdeologyScore[]> | null = null;
function scoresFor(congress: number, chamber: "house" | "senate"): IdeologyScore[] {
  if (!scores) {
    scores = new Map();
    for (const s of z.array(ideologyScore).parse(read("ideology_scores.json"))) {
      const k = `${s.congress_number}|${s.chamber}`;
      scores.set(k, [...(scores.get(k) ?? []), s]);
    }
  }
  return scores.get(`${congress}|${chamber}`) ?? [];
}

const CAST: Record<string, VoteCast> = { "1": "yea", "2": "nay", "3": "present", "4": "absent", "0": "none" };

const sideOf = (letter: string): "D" | "R" | "O" => (letter === "D" || letter === "R" ? letter : "O");

/** The member lists and positions for each chamber whose final passage has a recorded, checked member vote; empty when none does. */
export function getLawVotes(lawId: string, congress: number, origin: "House" | "Senate" | null): LawChamberVotesView[] {
  const shard = shardFor(congress);
  const rec = shard?.laws[lawId];
  if (!shard || !rec) return [];
  const resolve = getLawSponsorResolver();
  const current = getCurrentMemberIndex();
  const out: LawChamberVotesView[] = [];
  for (const [key, chamber] of [["H", "House"], ["S", "Senate"]] as const) {
    const votes = rec[key];
    if (!votes) continue;
    const roster = shard.rosters[key];
    const cast = new Map<string, VoteCast>();
    // A member can hold two ICPSR numbers in one Congress (a party or chamber change): the slot that recorded a vote wins.
    roster.forEach((id, i) => {
      const c = CAST[votes[1][i]!] ?? "none";
      if (id !== "" && (c !== "none" || !cast.has(id))) cast.set(id, c);
    });
    const byId = new Map(scoresFor(congress, chamber === "House" ? "house" : "senate").map((s) => [s.bioguide_id, s]));
    const ids = new Set([...byId.keys(), ...[...cast].filter(([, c]) => c !== "none").map(([id]) => id)]);
    const voters: LawVoter[] = [];
    for (const id of ids) {
      const s = byId.get(id);
      const person = resolve(id, congress, chamber);
      const letter = person?.[2] ?? "I";
      voters.push({
        id,
        name: person?.[0] ?? id,
        label: person?.[1] ?? "",
        side: s?.party_code === 100 ? "D" : s?.party_code === 200 ? "R" : sideOf(letter),
        partyCode: s?.party_code ?? null,
        dim1: s?.nokken_poole_dim1 ?? null,
        dim2: s?.nokken_poole_dim2 ?? null,
        cast: cast.get(id) ?? "none",
        hasPhoto: current.get(id)?.hasPhoto ?? false,
        path: person?.[3] ?? null,
      });
    }
    voters.sort((a, b) => (a.dim1 ?? 0) - (b.dim1 ?? 0) || a.name.localeCompare(b.name));
    out.push({ chamber, roll: votes[0], voters });
  }
  // The chamber the bill began in first.
  return out.sort((a, b) => (a.chamber === origin ? -1 : b.chamber === origin ? 1 : 0));
}

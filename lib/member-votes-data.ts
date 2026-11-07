import "server-only";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { sponsorPartyFromTerms } from "./laws-derive";
import { lawRow, lawsMeta } from "./laws-entities";
import { lawVotesShard } from "./law-votes-entities";
import { castsById, isPartySplit, partySplits, tallyRows, withParty, type MemberVoteRow, type MemberVotes } from "./member-votes";
import { term } from "./entities";

/**
 * Build-time reader for the voting record on a member's page: every `law_votes` shard (final-passage roll calls on enacted laws,
 * 93rd Congress on) folded once into one record per member. Served at `/data/members/[bioguide_id]/votes`. Rules: `lib/member-votes.ts`.
 */
const OUT = join(process.cwd(), "pipeline", "output");
const read = (file: string): unknown => JSON.parse(readFileSync(join(OUT, file), "utf8"));

let all: Map<string, MemberVotes> | null = null;

function build(): Map<string, MemberVotes> {
  const first = lawsMeta.parse(read("laws_meta.json")).first_congress;
  const partyOf = sponsorPartyFromTerms(z.array(term).parse(read("terms.json")).filter((t) => t.congress_number >= first));
  const laws = new Map(z.array(lawRow).parse(read("laws.json")).map((l) => [l.law_id, l]));
  const rows = new Map<string, MemberVoteRow[]>();
  const used = new Map<string, Set<string>>();
  const parties = new Map<string, MemberVotes["party"]>();

  const files = readdirSync(join(OUT, "law_votes")).filter((f) => /^\d+\.json$/.test(f)).sort((a, b) => parseInt(a) - parseInt(b));
  for (const f of files) {
    const shard = lawVotesShard.parse(read(`law_votes/${f}`));
    for (const [lawId, rec] of Object.entries(shard.laws)) {
      const law = laws.get(lawId);
      if (!law) continue;
      for (const [key, chamber, origin] of [["H", 0, "House"], ["S", 1, "Senate"]] as const) {
        const votes = rec[key];
        if (!votes) continue;
        const cast = castsById(shard.rosters[key], votes[1]);
        const party = (id: string) => partyOf(id, shard.congress, origin) ?? "I";
        const splits = partySplits(cast, party);
        const split = isPartySplit(splits) ? 1 : 0;
        for (const [id, c] of cast) {
          if (c === "0") continue;
          const p = party(id);
          const mine = p === "I" ? ([0, 0] as const) : splits[p];
          const r: MemberVoteRow = [lawId, chamber, Number(c) as 1 | 2 | 3 | 4, withParty(c, p, splits), split, mine[0], mine[1]];
          rows.set(id, [...(rows.get(id) ?? []), r]);
          if (!used.has(id)) used.set(id, new Set());
          used.get(id)!.add(lawId);
          parties.set(id, p); // shards are read oldest first, so the latest Congress wins
        }
      }
    }
  }

  const out = new Map<string, MemberVotes>();
  for (const [id, list] of rows) {
    list.sort((a, b) => (laws.get(b[0])!.date < laws.get(a[0])!.date ? -1 : laws.get(b[0])!.date > laws.get(a[0])!.date ? 1 : b[0].localeCompare(a[0], undefined, { numeric: true })));
    const recorded: MemberVotes["laws"] = {};
    for (const lawId of used.get(id)!) recorded[lawId] = [laws.get(lawId)!.title, laws.get(lawId)!.date];
    out.set(id, { party: parties.get(id) ?? "I", rows: list, laws: recorded, ...tallyRows(list) });
  }
  return out;
}

export function getMemberVotes(bioguideId: string): MemberVotes | null {
  all ??= build();
  return all.get(bioguideId) ?? null;
}

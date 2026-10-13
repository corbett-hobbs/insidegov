import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { parse as parseCsv } from "csv-parse/sync";
import { z } from "zod";
import { idCrosswalkEntry } from "../../lib/entities";
import { lawVotesShard, rawLawVotesFile, type LawVotesShard, type RawLawVotesFile } from "../../lib/law-votes-entities";
import { LawsDataError } from "../../lib/laws-entities";
import { RAW_DIR } from "../fetch/lib";
import { chamberVotes } from "./law-votes";
import { loadLawRollJoins } from "./law-votes-join";

/**
 * Who voted on each law's final passage -> `pipeline/output/law_votes/<congress>.json`. Run after `laws-run.ts`. The raw member votes are
 * `pipeline/raw/voteview/law_votes/` (`pnpm fetch:voteview-votes`); which roll call belongs to which law is the Laws transform's own join.
 * Gate: every chamber vote's member list adds up to Voteview's yea and nay counts for that roll call; a missing roll call stops the build.
 */
const OUT = "pipeline/output";
const readJson = async (path: string) => JSON.parse(await readFile(path, "utf8")) as unknown;

/** One law per line, so a refresh diffs law by law. */
function format(s: LawVotesShard): string {
  const lines = Object.entries(s.laws).map(([id, d]) => `${JSON.stringify(id)}:${JSON.stringify(d)}`);
  return `{\n"congress":${s.congress},\n"rosters":${JSON.stringify(s.rosters)},\n"laws":{\n${lines.join(",\n")}\n}\n}\n`;
}

async function main() {
  console.log("transform:law-votes");
  const crosswalk = new Map(z.array(idCrosswalkEntry).parse(await readJson(`${OUT}/id_crosswalk.json`)).map((r) => [r.icpsr, r.bioguide_id]));
  // Voteview lists each President under the chamber on every vote (his signature is not a member's vote): leave those ICPSR numbers out.
  const presidents = new Set((parseCsv(await readFile(`${RAW_DIR}/voteview/HSall_members.csv`, "utf8"), { columns: true, bom: true }) as Record<string, string>[]).filter((r) => r.chamber === "President").map((r) => Number(r.icpsr)));
  const { joins } = await loadLawRollJoins();
  const raws = new Map<number, RawLawVotesFile>();
  for (const c of new Set(joins.flatMap((j) => [j.House?.[0], j.Senate?.[0]]).filter((x): x is number => x !== undefined))) {
    const path = `${RAW_DIR}/voteview/law_votes/${c}.json`;
    if (!existsSync(path)) throw new LawsDataError(`${path} is missing: run pnpm fetch:voteview-votes`);
    raws.set(c, rawLawVotesFile.parse(await readJson(path)));
  }
  await rm(`${OUT}/law_votes`, { recursive: true, force: true });
  await mkdir(`${OUT}/law_votes`, { recursive: true });
  let votes = 0;
  let unmapped = 0;
  const lawsWith = new Set<string>();
  for (const [congress, raw] of [...raws].sort((a, b) => a[0] - b[0])) {
    const laws: LawVotesShard["laws"] = {};
    for (const j of joins.filter((x) => x.law.congress === congress)) {
      const entry: LawVotesShard["laws"][string] = {};
      if (j.House) entry.H = chamberVotes(raw, "H", j.House, j.law.law_id, presidents);
      if (j.Senate) entry.S = chamberVotes(raw, "S", j.Senate, j.law.law_id, presidents);
      laws[j.law.law_id] = entry;
      votes += (entry.H ? 1 : 0) + (entry.S ? 1 : 0);
      lawsWith.add(j.law.law_id);
    }
    const roster = (ids: number[]) => ids.map((i) => (presidents.has(i) ? "" : (crosswalk.get(i) ?? "")));
    const rosters = { H: roster(raw.rosters.H), S: roster(raw.rosters.S) };
    unmapped += [...raw.rosters.H, ...raw.rosters.S].filter((i) => !presidents.has(i) && !crosswalk.has(i)).length;
    await writeFile(`${OUT}/law_votes/${congress}.json`, format(lawVotesShard.parse({ congress, rosters, laws })));
  }
  console.log(`  ${lawsWith.size} laws with a member list (${votes} chamber votes) in ${raws.size} Congresses; ${unmapped} members with no bioguide id (the Presidents are left out)`);
}

main().catch((err) => {
  console.error("transform:law-votes failed");
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});

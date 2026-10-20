import { readFile, writeFile } from "node:fs/promises";
import { parse as parseCsv } from "csv-parse/sync";
import { earlyLawVotesFile, earlyLawVotesRef, rawEarlyLawVotesFile } from "../../lib/early-law-votes-entities";
import { RAW_DIR } from "../fetch/lib";
import { buildEarlyLawVotes } from "./early-law-votes";

/**
 * Passage votes for laws before 1973 -> `pipeline/output/early_law_votes.json`, read by the Timeline and president pages. Inputs: the
 * hand-picked roll calls (`pipeline/reference/early-law-votes.json`), their Voteview rows and member votes (`pnpm fetch:voteview-early-votes`)
 * and Voteview's members file for party. Gates are in `early-law-votes.ts`.
 */
const readJson = async (path: string) => JSON.parse(await readFile(path, "utf8")) as unknown;

async function main() {
  console.log("transform:early-law-votes");
  const ref = earlyLawVotesRef.parse(await readJson("pipeline/reference/early-law-votes.json"));
  const raw = rawEarlyLawVotesFile.parse(await readJson(`${RAW_DIR}/voteview/early_law_votes.json`));
  const members = parseCsv(await readFile(`${RAW_DIR}/voteview/HSall_members.csv`, "utf8"), { columns: true, bom: true }) as Record<string, string>[];
  const parties = new Map<string, number>();
  const presidents = new Set<number>();
  for (const m of members) {
    if (m.chamber === "President") presidents.add(Number(m.icpsr));
    else if (Number(m.congress) < 93) parties.set(`${m.congress}|${m.chamber === "House" ? "H" : "S"}|${m.icpsr}`, Number(m.party_code));
  }
  const laws = buildEarlyLawVotes(ref, raw, parties, presidents);
  const out = earlyLawVotesFile.parse({ laws });
  await writeFile("pipeline/output/early_law_votes.json", `{\n"laws":[\n${out.laws.map((l) => JSON.stringify(l)).join(",\n")}\n]\n}\n`);
  const chambers = laws.reduce((s, l) => s + (l.house ? 1 : 0) + (l.senate ? 1 : 0), 0);
  console.log(`  ${laws.length} laws, ${chambers} chamber votes (${laws.filter((l) => !l.house && !l.senate).length} laws with no recorded vote in either chamber)`);
}

main().catch((err) => {
  console.error("transform:early-law-votes failed");
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});

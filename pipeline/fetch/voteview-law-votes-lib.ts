import { rawLawVotesFile, type RawLawVotesFile } from "../../lib/law-votes-entities";

/** Voteview's member-by-member vote files: one per chamber per Congress (`H119_votes.csv` is 7 MB, the whole set about 300 MB). */
export const VOTES_BASE = "https://voteview.com/static/data/out/votes";
export const votesUrl = (congress: number, chamber: "H" | "S") => `${VOTES_BASE}/${chamber}${String(congress).padStart(3, "0")}_votes.csv`;
export const votesName = (congress: number, chamber: "H" | "S") => `${chamber}${String(congress).padStart(3, "0")}_votes.csv`;

/**
 * Pick the wanted roll calls out of one `*_votes.csv` (header `congress,chamber,rollnumber,icpsr,cast_code,prob`) and return
 * `rollnumber -> (icpsr -> cast_code)`. A row for a roll call we do not want is skipped without being parsed further.
 */
export function readVotes(csv: string, wanted: ReadonlySet<number>): Map<number, Map<number, number>> {
  const out = new Map<number, Map<number, number>>();
  const lines = csv.split("\n");
  if (!lines[0]!.startsWith("congress,chamber,rollnumber,icpsr,cast_code")) throw new Error(`unexpected vote file header: ${lines[0]}`);
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (line === "") continue;
    const f = line.split(",");
    const roll = Number(f[2]);
    if (!wanted.has(roll)) continue;
    const icpsr = Number(f[3]);
    const cast = Number(f[4]);
    if (!Number.isInteger(roll) || !Number.isInteger(icpsr) || !Number.isInteger(cast) || cast < 0 || cast > 9) throw new Error(`vote file line ${i + 1} is not a vote: ${line.slice(0, 80)}`);
    let m = out.get(roll);
    if (!m) out.set(roll, (m = new Map()));
    m.set(icpsr, cast);
  }
  return out;
}

/** One Congress's raw file from the wanted roll calls of each chamber. The roster is every member who appears in a kept roll call, by ICPSR. */
export function buildLawVotesFile(congress: number, fetched: string, byChamber: { H: Map<number, Map<number, number>>; S: Map<number, Map<number, number>> }): RawLawVotesFile {
  const rosters = { H: [] as number[], S: [] as number[] };
  const rolls: RawLawVotesFile["rolls"] = [];
  for (const c of ["H", "S"] as const) {
    const ids = new Set<number>();
    for (const m of byChamber[c].values()) for (const id of m.keys()) ids.add(id);
    rosters[c] = [...ids].sort((a, b) => a - b);
    for (const [roll, m] of [...byChamber[c]].sort((a, b) => a[0] - b[0])) rolls.push([c, roll, rosters[c].map((id) => String(m.get(id) ?? 0)).join("")]);
  }
  return rawLawVotesFile.parse({ congress, fetched, rosters, rolls });
}

/** One roll call per line, so a weekly refresh diffs vote by vote. */
export function formatLawVotesFile(f: RawLawVotesFile): string {
  return `{\n"congress":${f.congress},\n"fetched":${JSON.stringify(f.fetched)},\n"rosters":${JSON.stringify(f.rosters)},\n"rolls":[\n${f.rolls.map((r) => JSON.stringify(r)).join(",\n")}\n]\n}\n`;
}

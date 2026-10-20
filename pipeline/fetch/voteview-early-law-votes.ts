import { existsSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { parse as parseCsv } from "csv-parse/sync";
import { earlyLawVotesRef, rawEarlyLawVotesFile, type RawEarlyLawVotesFile, type RawEarlyRoll } from "../../lib/early-law-votes-entities";
import { RAW_DIR, download, run } from "./lib";
import { ROLLCALLS_URL } from "./voteview-rollcalls-lib";
import { readVotes, votesName, votesUrl } from "./voteview-law-votes-lib";

/**
 * The passage roll calls picked in `pipeline/reference/early-law-votes.json` (laws before 1973) -> `pipeline/raw/voteview/early_law_votes.json`:
 * each roll call's row from `HSall_rollcalls.csv` (date, Voteview's yea and nay counts, bill number, description) and its member votes from
 * the Congress's `H###_votes.csv` / `S###_votes.csv`. Keyless; about 30 MB for the roll-call file plus 2-7 MB per chamber per Congress,
 * cached under `pipeline/raw/_scratch/voteview-votes/` (gitignored, shared with `fetch:voteview-votes`). Re-run after editing the reference
 * file. Not part of `fetch:all`.
 */
const OUT = `${RAW_DIR}/voteview/early_law_votes.json`;
const CACHE = `${RAW_DIR}/_scratch/voteview-votes`;

/** One roll call per line, so a re-fetch diffs vote by vote. */
function format(f: RawEarlyLawVotesFile): string {
  const blocks = Object.entries(f.congresses).map(
    ([c, d]) => `${JSON.stringify(c)}:{\n"rosters":${JSON.stringify(d.rosters)},\n"rolls":[\n${d.rolls.map((r) => JSON.stringify(r)).join(",\n")}\n]}`,
  );
  return `{\n"fetched":${JSON.stringify(f.fetched)},\n"congresses":{\n${blocks.join(",\n")}\n}\n}\n`;
}

await run("voteview-early-votes", async () => {
  const ref = earlyLawVotesRef.parse(JSON.parse(await readFile("pipeline/reference/early-law-votes.json", "utf8")));
  const wanted = new Map<number, { H: Set<number>; S: Set<number> }>();
  for (const e of ref.laws) {
    const w = wanted.get(e.congress) ?? { H: new Set<number>(), S: new Set<number>() };
    for (const r of [e.house, e.house_override]) if (r) w.H.add(r);
    for (const r of [e.senate, e.senate_override]) if (r) w.S.add(r);
    wanted.set(e.congress, w);
  }

  await mkdir(CACHE, { recursive: true });
  const rollcallsPath = `${CACHE}/HSall_rollcalls.csv`;
  console.log(`  downloading ${ROLLCALLS_URL}`);
  await download(ROLLCALLS_URL, rollcallsPath);
  const rows = new Map<string, Record<string, string>>();
  for (const r of parseCsv(await readFile(rollcallsPath, "utf8"), { columns: true, skip_empty_lines: true, bom: true }) as Record<string, string>[]) {
    const c = Number(r.congress);
    const ch = r.chamber === "House" ? "H" : r.chamber === "Senate" ? "S" : null;
    if (ch && wanted.get(c)?.[ch].has(Number(r.rollnumber))) rows.set(`${c}|${ch}|${r.rollnumber}`, r);
  }

  const congresses: RawEarlyLawVotesFile["congresses"] = {};
  for (const [c, w] of [...wanted].sort((a, b) => a[0] - b[0])) {
    const rosters = { H: [] as number[], S: [] as number[] };
    const rolls: RawEarlyRoll[] = [];
    for (const ch of ["H", "S"] as const) {
      if (w[ch].size === 0) continue;
      const file = `${CACHE}/${votesName(c, ch)}`;
      if (!existsSync(file) || statSync(file).size === 0) {
        console.log(`  downloading ${votesName(c, ch)}`);
        await download(votesUrl(c, ch), file);
      }
      const votes = readVotes(await readFile(file, "utf8"), w[ch]);
      const ids = new Set<number>();
      for (const m of votes.values()) for (const id of m.keys()) ids.add(id);
      rosters[ch] = [...ids].sort((a, b) => a - b);
      for (const n of [...w[ch]].sort((a, b) => a - b)) {
        const row = rows.get(`${c}|${ch}|${n}`);
        const m = votes.get(n);
        if (!row || !m) throw new Error(`${c} ${ch} roll call ${n} is not in Voteview's ${row ? votesName(c, ch) : "HSall_rollcalls.csv"}`);
        const desc = `${row.vote_desc} ${row.dtl_desc}`.replace(/\s+/g, " ").trim().slice(0, 240);
        rolls.push([ch, n, row.date, Number(row.yea_count), Number(row.nay_count), row.bill_number.trim(), desc, rosters[ch].map((id) => String(m.get(id) ?? 0)).join("")]);
      }
    }
    congresses[String(c)] = { rosters, rolls };
  }
  const file = rawEarlyLawVotesFile.parse({ fetched: new Date().toISOString().slice(0, 10), congresses });
  await writeFile(OUT, format(file));
  const n = Object.values(congresses).reduce((s, d) => s + d.rolls.length, 0);
  console.log(`  ${n} roll calls for ${ref.laws.length} laws in ${wanted.size} Congresses -> ${OUT}`);
});

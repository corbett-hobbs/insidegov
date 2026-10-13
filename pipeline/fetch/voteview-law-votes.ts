import { existsSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { lawVotesManifest, rawLawVotesFile, type LawVotesManifest } from "../../lib/law-votes-entities";
import { LawsDataError } from "../../lib/laws-entities";
import { loadLawRollJoins } from "../transform/law-votes-join";
import { RAW_DIR, download, run } from "./lib";
import { VOTES_BASE, buildLawVotesFile, formatLawVotesFile, readVotes, votesName, votesUrl } from "./voteview-law-votes-lib";

/**
 * Who voted on each law's final passage -> `pipeline/raw/voteview/law_votes/<congress>.json` (+ `law_votes_manifest.json`). Keyless.
 *
 *   pnpm fetch:voteview-votes                every Congress whose Voteview vote files changed, or whose set of wanted roll calls changed
 *   pnpm fetch:voteview-votes -- 118         one Congress
 *   pnpm fetch:voteview-votes -- --rebuild   re-read the cached CSVs (no download)
 *   pnpm fetch:voteview-votes -- --yes       allow a download above 150 MB (the first full run is about 300 MB)
 *
 * Which roll calls are wanted comes from the Laws transform's own join of each law's final passage to Voteview (`loadLawRollJoins`), so only the
 * votes a law page shows are kept. The CSVs are cached under `pipeline/raw/_scratch/voteview-votes/` (gitignored). Voteview trails the live
 * record (see rollcalls_manifest.json), so the newest laws have no member list until it catches up. Not part of `fetch:all`.
 */
const DIR = `${RAW_DIR}/voteview/law_votes`;
const MANIFEST = `${RAW_DIR}/voteview/law_votes_manifest.json`;
const CACHE = `${RAW_DIR}/_scratch/voteview-votes`;
const BIG = 150 * 1024 * 1024;
const USER_AGENT = "InsideGov-pipeline/0.1 (+https://github.com/corbett-hobbs/insidegov; weekly data check)";

async function head(url: string): Promise<{ bytes: number; lastModified: string }> {
  const res = await fetch(url, { method: "HEAD", headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new LawsDataError(`HEAD ${url} -> ${res.status}`);
  return { bytes: Number(res.headers.get("content-length") ?? 0), lastModified: res.headers.get("last-modified") ?? "" };
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const rebuildAll = args.includes("--rebuild");
  const yes = args.includes("--yes");
  const only = args.filter((a) => /^\d+$/.test(a)).map(Number);
  const { joins } = await loadLawRollJoins();
  const wanted = new Map<number, { H: Set<number>; S: Set<number> }>();
  for (const j of joins) {
    for (const [c, row] of [["H", j.House], ["S", j.Senate]] as const) {
      if (!row) continue;
      const w = wanted.get(row[0]) ?? { H: new Set<number>(), S: new Set<number>() };
      w[c].add(row[2]);
      wanted.set(row[0], w);
    }
  }
  const manifest: LawVotesManifest = existsSync(MANIFEST) ? lawVotesManifest.parse(JSON.parse(await readFile(MANIFEST, "utf8"))) : { base_url: VOTES_BASE, files: [] };
  const known = new Map(manifest.files.map((f) => [`${f.congress}|${f.chamber}`, f]));
  const congresses = [...wanted.keys()].filter((c) => only.length === 0 || only.includes(c)).sort((a, b) => a - b);
  const plan: { congress: number; chamber: "H" | "S"; bytes: number; lastModified: string }[] = [];
  const stale = new Set<number>();
  for (const congress of congresses) {
    const w = wanted.get(congress)!;
    const stored = existsSync(`${DIR}/${congress}.json`) ? rawLawVotesFile.parse(JSON.parse(await readFile(`${DIR}/${congress}.json`, "utf8"))) : null;
    for (const chamber of ["H", "S"] as const) {
      const h = await head(votesUrl(congress, chamber));
      plan.push({ congress, chamber, ...h });
      const k = known.get(`${congress}|${chamber}`);
      const have = new Set(stored?.rolls.filter((r) => r[0] === chamber).map((r) => r[1]) ?? []);
      const same = have.size === w[chamber].size && [...w[chamber]].every((r) => have.has(r));
      if (rebuildAll || !stored || !k || k.bytes !== h.bytes || k.last_modified !== h.lastModified || !same) stale.add(congress);
    }
  }
  const mb = (n: number) => (n / 1024 / 1024).toFixed(1);
  const cached = (p: (typeof plan)[number]) => existsSync(`${CACHE}/${votesName(p.congress, p.chamber)}`) && statSync(`${CACHE}/${votesName(p.congress, p.chamber)}`).size === p.bytes;
  const todo = plan.filter((p) => stale.has(p.congress));
  const total = todo.filter((p) => !cached(p)).reduce((s, p) => s + p.bytes, 0);
  console.log(`  ${stale.size} of ${congresses.length} Congresses to read (${todo.length} files), ${mb(total)} MB to download`);
  if (stale.size === 0) return;
  if (total > BIG && !yes) throw new LawsDataError(`${mb(total)} MB is above the 150 MB guard; re-run with --yes once the download has been approved`);
  await mkdir(CACHE, { recursive: true });
  await mkdir(DIR, { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  for (const congress of [...stale].sort((a, b) => a - b)) {
    const by = { H: new Map<number, Map<number, number>>(), S: new Map<number, Map<number, number>>() };
    for (const p of plan.filter((x) => x.congress === congress)) {
      const file = `${CACHE}/${votesName(p.congress, p.chamber)}`;
      if (!cached(p)) {
        process.stdout.write(`  downloading ${votesName(p.congress, p.chamber)} (${mb(p.bytes)} MB)\n`);
        await download(votesUrl(p.congress, p.chamber), file);
      }
      by[p.chamber] = readVotes(await readFile(file, "utf8"), wanted.get(congress)![p.chamber]);
      const missing = [...wanted.get(congress)![p.chamber]].filter((r) => !by[p.chamber].has(r));
      if (missing.length > 0) throw new LawsDataError(`${votesName(p.congress, p.chamber)} has no votes for roll call(s) ${missing.slice(0, 8).join(", ")}`);
      known.set(`${congress}|${p.chamber}`, { congress, chamber: p.chamber, bytes: p.bytes, last_modified: p.lastModified });
    }
    const f = buildLawVotesFile(congress, today, by);
    await writeFile(`${DIR}/${congress}.json`, formatLawVotesFile(f));
    console.log(`  ${congress}: ${f.rolls.length} roll calls, rosters ${f.rosters.H.length} House / ${f.rosters.S.length} Senate`);
  }
  const out: LawVotesManifest = { base_url: VOTES_BASE, files: [...known.values()].sort((a, b) => a.congress - b.congress || a.chamber.localeCompare(b.chamber)) };
  await writeFile(MANIFEST, JSON.stringify(lawVotesManifest.parse(out), null, 2) + "\n");
}

run("voteview-votes", main);

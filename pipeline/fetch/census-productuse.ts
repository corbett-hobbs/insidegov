import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { run } from "./lib";
import {
  CONCORDANCE_BASE,
  FLOWS,
  FLOW_VARS,
  PRODUCTUSE_CACHE_DIR,
  PRODUCTUSE_FIRST_YEAR,
  concordanceExt,
  concordanceName,
  joinHs10,
  parseConcordance,
  parseRawProductUse,
  productUseRawPath,
  serializeRawProductUse,
  type Flow,
  type Hs10Line,
} from "./census-productuse-lib";

/**
 * Every HS10 line (all countries) joined to its Census end-use category, summed to (HS4 heading, end use), into
 * `pipeline/raw/census-trade/product-use/<flow>/<year>.json` (committed). 2010 through the latest published month.
 *
 *   pnpm fetch:census-productuse             # every year from 2010
 *   pnpm fetch:census-productuse --recent    # the year in progress and the year before (weekly refresh)
 *   pnpm fetch:census-productuse --since 2023
 *
 * Per (flow, year), two downloads (see docs/TRADE_METHODOLOGY.md, "Goods by product and use"):
 * - the HS10 values: `timeseries/intltrade/{exports,imports}/hs`, `COMM_LVL=HS10&CTY_CODE=-&time=<year>-12` (the year
 *   in progress: its latest month, year to date), one call returning every line (about 9,400 export and 18,800 import
 *   lines, 0.5-1.3 MB, 5-17 s);
 * - Census's yearly HS10 -> end-use concordance (`expconcord<YY>` / `impconcord<YY>`), which has a row per code in
 *   force that year, so each year is joined with its own file.
 * A line the own year's file lacks is looked up in the next year's, then the previous year's, then the hand maps
 * (`census-productuse-lib.ts`), and the source of each is recorded in the raw file's `assigned` list.
 * Both are cached under `_cache/` (git-ignored) so an interrupted run resumes and the join can be re-run offline;
 * `--recent` downloads the years it covers again. Only the joined (HS4, end use) sums are committed.
 *
 * Needs `CENSUS_API_KEY` (environment or `.env.local`). The key is never logged: error messages carry the flow and
 * year, never the request URL.
 */
const API = (flow: Flow) => `https://api.census.gov/data/timeseries/intltrade/${flow}/hs`;
const CONCURRENCY = 2;

try {
  process.loadEnvFile(".env.local");
} catch {
  /* no .env.local (CI passes the secret as an env var) */
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const mm = (m: number) => String(m).padStart(2, "0");

class NoData extends Error {}

/** One API call. Returns the header and rows, or throws `NoData` on 204. */
async function call(flow: Flow, params: [string, string][], label: string): Promise<string[][]> {
  const key = process.env.CENSUS_API_KEY;
  if (!key) throw new Error("CENSUS_API_KEY is not set (put it in the environment or .env.local)");
  const q = new URLSearchParams([...params, ["key", key]]);
  for (let attempt = 1; ; attempt++) {
    let status = 0;
    let statusText = "";
    try {
      const res = await fetch(`${API(flow)}?${q.toString()}`, { signal: AbortSignal.timeout(240_000) });
      status = res.status;
      statusText = res.statusText;
      if (res.status === 204) throw new NoData(`${flow} ${label}: 204 no data`);
      if (res.ok) return (await res.json()) as string[][];
    } catch (e) {
      if (e instanceof NoData) throw e;
      statusText = e instanceof Error ? e.name : "fetch error"; // never the message: it can echo the URL
    }
    if (attempt >= 3 || (status >= 400 && status < 500 && status !== 429)) {
      throw new Error(`Census ${flow}/hs ${label} -> ${status || "no response"} ${statusText}`);
    }
    await sleep(5000 * attempt);
  }
}

/** Newest month the API has published for both flows (probing back from this month). */
async function latestMonth(): Promise<{ year: number; month: number }> {
  const now = new Date();
  let y = now.getUTCFullYear();
  let m = now.getUTCMonth() + 1;
  for (let i = 0; i < 8; i++) {
    let ok = true;
    for (const flow of FLOWS) {
      const { commodity, values } = FLOW_VARS[flow];
      try {
        // (the commodity column must be in `get`, or the API answers 204 for any month)
        await call(flow, [["get", `CTY_CODE,${commodity},${values[0]}`], ["COMM_LVL", "HS2"], [commodity, "27"], ["CTY_CODE", "-"], ["time", `${y}-${mm(m)}`]], `latest-month probe ${y}-${mm(m)}`);
      } catch (e) {
        if (!(e instanceof NoData)) throw e;
        ok = false;
      }
    }
    if (ok) return { year: y, month: m };
    if (--m === 0) [y, m] = [y - 1, 12];
  }
  throw new Error("Census intltrade: no published month in the last 8 months");
}

async function writeAtomic(path: string, body: string | Buffer) {
  await mkdir(path.replace(/\/[^/]+$/, ""), { recursive: true });
  await writeFile(`${path}.download`, body);
  await rename(`${path}.download`, path);
}

/** Every HS10 line for the year (December) or the year in progress (latest month), cached by query. */
async function hs10Lines(flow: Flow, year: number, month: number, refresh: boolean): Promise<Hs10Line[]> {
  const { commodity, values } = FLOW_VARS[flow];
  const params: [string, string][] = [["get", [commodity, ...values].join(",")], ["COMM_LVL", "HS10"], ["CTY_CODE", "-"], ["time", `${year}-${mm(month)}`]];
  const hash = createHash("sha1").update(JSON.stringify([flow, params])).digest("hex").slice(0, 12);
  const path = `${PRODUCTUSE_CACHE_DIR}/hs10/${flow}/${year}-${mm(month)}-${hash}.json`;
  let data: string[][];
  if (!refresh && existsSync(path)) data = JSON.parse(await readFile(path, "utf8")) as string[][];
  else {
    const t0 = Date.now();
    data = await call(flow, params, `HS10 ${year}-${mm(month)}`);
    await writeAtomic(path, JSON.stringify(data));
    console.log(`  ${flow} ${year} HS10 ${year}-${mm(month)}: ${data.length - 1} rows, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }
  const [header, ...rows] = data;
  const cols = [commodity, ...values].map((n) => header.indexOf(n));
  if (cols.some((i) => i < 0) || header.indexOf("CTY_CODE") < 0) throw new Error(`Census ${flow}/hs HS10 ${year}: unexpected columns ${header.join(",")}`);
  const ic = header.indexOf("CTY_CODE");
  const lines: Hs10Line[] = [];
  for (const r of rows) {
    if (r[ic] !== "-") throw new Error(`Census ${flow}/hs HS10 ${year}: a row for partner ${r[ic]} in an all-countries call`);
    const vals = cols.slice(1).map((i) => {
      if (!/^\d+$/.test(r[i])) throw new Error(`Census ${flow}/hs HS10 ${year}: value "${r[i]}" for ${r[cols[0]]} is not whole dollars`);
      return Number(r[i]);
    });
    lines.push([r[cols[0]], ...vals]);
  }
  return lines;
}

/** The year's concordance file, downloaded once and kept in the cache. `null` when Census has not published it (404) and `optional`. */
async function concordance(flow: Flow, year: number, refresh: boolean, optional = false): Promise<{ year: number; map: Map<string, string> } | null> {
  const name = concordanceName(flow, year);
  const path = `${PRODUCTUSE_CACHE_DIR}/concordance/${name}`;
  if (refresh || !existsSync(path)) {
    const res = await fetch(`${CONCORDANCE_BASE}/${name}`, { signal: AbortSignal.timeout(240_000) });
    if (optional && res.status === 404) return null;
    if (!res.ok) throw new Error(`concordance ${name} -> ${res.status} ${res.statusText} (Census has not published ${flow} codes for ${year}?)`);
    await writeAtomic(path, Buffer.from(await res.arrayBuffer()));
  }
  return { year, map: parseConcordance(await readFile(path), concordanceExt(year)) };
}

async function pool<T>(tasks: (() => Promise<T>)[], n: number): Promise<T[]> {
  const out: T[] = new Array(tasks.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (next < tasks.length) {
        const i = next++;
        out[i] = await tasks[i]();
      }
    }),
  );
  return out;
}

await run("census-productuse", async () => {
  const args = process.argv.slice(2);
  const latest = await latestMonth();
  const sinceArg = args.indexOf("--since");
  const recent = args.includes("--recent");
  const since = Math.max(PRODUCTUSE_FIRST_YEAR, recent ? latest.year - 1 : sinceArg >= 0 ? Number(args[sinceArg + 1]) : PRODUCTUSE_FIRST_YEAR);
  if (!Number.isInteger(since)) throw new Error("--since needs a year");
  console.log(`  ${since}..${latest.year} (December of each full year, year to date through ${mm(latest.month)} for ${latest.year})`);

  const jobs: (() => Promise<void>)[] = [];
  for (const flow of FLOWS) {
    for (let year = since; year <= latest.year; year++) {
      jobs.push(async () => {
        const month = year === latest.year ? latest.month : 12;
        const lines = await hs10Lines(flow, year, month, recent);
        const own = (await concordance(flow, year, recent))!;
        let joined = joinHs10(flow, year, lines, [own]);
        // Census builds each year's file before the codes added during the year: look in the next year's, then the previous year's.
        if (joined.unmatched.length || joined.assigned.length) {
          const adjacent = (await Promise.all([year + 1, year - 1].map((y) => (y >= PRODUCTUSE_FIRST_YEAR ? concordance(flow, y, recent, true) : null)))).filter((c) => c !== null);
          joined = joinHs10(flow, year, lines, [own, ...adjacent]);
        }
        const { rows, assigned, unmatched } = joined;
        const fresh = parseRawProductUse({ fetched_at: new Date().toISOString(), flow, year, through_month: month, rows, assigned, unmatched });
        const dest = productUseRawPath(flow, year);
        if (existsSync(dest)) {
          const prev = parseRawProductUse(JSON.parse(await readFile(dest, "utf8")));
          // Carry `fetched_at` over while nothing changed, so an idle week yields no diff.
          if (JSON.stringify({ ...prev, fetched_at: "" }) === JSON.stringify({ ...fresh, fetched_at: "" })) fresh.fetched_at = prev.fetched_at;
        }
        await writeAtomic(dest, serializeRawProductUse(fresh));
        const adj = assigned.filter((a) => a[2] !== "map");
        const hand = assigned.filter((a) => a[2] === "map");
        const note = [
          adj.length ? `${adj.length} from an adjacent year's concordance ($${(adj.reduce((t, a) => t + a[3], 0) / 1e9).toFixed(2)}B: ${adj.slice(0, 3).map((a) => `${a[0]}<-${a[2]}`).join(", ")}${adj.length > 3 ? ", ..." : ""})` : "",
          hand.length ? `${hand.length} hand-mapped (${hand.map((a) => a[0]).join(", ")})` : "",
          unmatched.length ? `${unmatched.length} UNMATCHED (the transform will fail: ${unmatched.slice(0, 3).map((u) => u[0]).join(", ")})` : ""].filter(Boolean).join("; ");
        console.log(`  ${flow} ${year} (through ${mm(month)}): ${lines.length} HS10 lines -> ${rows.length} rows${note ? `; ${note}` : ""}`);
      });
    }
  }
  await pool(jobs, CONCURRENCY);
});

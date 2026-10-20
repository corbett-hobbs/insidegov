import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { run } from "./lib";
import {
  ENDUSE_CACHE_DIR,
  ENDUSE_FIRST_YEAR,
  ENDUSE_FLOW_VARS,
  FLOWS,
  enduseDescPath,
  enduseRawPath,
  parseRawEnduse,
  parseRawEnduseDescriptions,
  serializeRawEnduse,
  sortEnduseRows,
  type Flow,
  type RawEnduseDescriptions,
  type RawEnduseRow,
} from "./census-enduse-lib";

/**
 * Goods by Census end-use category and country, from the Census international trade API, into
 * `pipeline/raw/census-trade/enduse/<flow>/<year>.json` (committed) and `descriptions.json`. Annual values per
 * country x 5-digit end-use category (COMM_LVL=EU5), 2010 through the latest published month.
 *
 *   pnpm fetch:census-enduse              # every year from 2010
 *   pnpm fetch:census-enduse --recent     # the year in progress and the three before it (weekly refresh)
 *   pnpm fetch:census-enduse --since 2023
 *
 * Query shape (measured 2026-10-20; see docs/TRADE_METHODOLOGY.md):
 * - One call per CATEGORY returns every partner for every year: `time=from <since>-01 to <latest>` with
 *   `MONTH=12&MONTH=<latest month>` and the `_YR` (year-to-date) variables, so December rows are calendar years and
 *   the latest month is the year in progress. About 1.5 s each, ~140 categories per flow, ~280 calls in all. (A call
 *   per partner works too but needs the partner list first; the per-category call finds new partners by itself.)
 * - The all-countries call (`CTY_CODE=-`, no category) names every category with trade in the window and its
 *   description.
 * - Each response is cached under `_cache/` (git-ignored), keyed by its query, so an interrupted run resumes.
 *
 * Needs `CENSUS_API_KEY` (environment or `.env.local`). The key is never logged: error messages carry the flow
 * and category, never the request URL.
 */
const API = (flow: Flow) => `https://api.census.gov/data/timeseries/intltrade/${flow}/enduse`;
const CONCURRENCY = 3;
/** Real partners only: the API's country groupings (`00xx`) and the unallocated `1XXX` are dropped. */
const KEEP_CTY = /^(-|[1-9]\d{3})$/;

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
      throw new Error(`Census ${flow}/enduse ${label} -> ${status || "no response"} ${statusText}`);
    }
    await sleep(5000 * attempt);
  }
}

interface Window {
  since: number;
  year: number; // latest published year
  month: number; // latest published month
}

/** `[CTY_CODE, code, "YYYY-MM", ...values]` rows for the window's December and latest-month points. */
type CallRow = string[];

/** One cached call: every partner for `code`, or (code null) the all-countries rows of every category. */
async function cached(flow: Flow, code: string | null, w: Window): Promise<{ rows: CallRow[]; desc: Map<string, string> }> {
  const v = ENDUSE_FLOW_VARS[flow];
  const get = ["CTY_CODE", v.code, ...(code ? [] : [v.desc]), ...v.values].join(",");
  const params: [string, string][] = [
    ["get", get],
    ["COMM_LVL", "EU5"],
    ["time", `from ${w.since}-01 to ${w.year}-${mm(w.month)}`],
    ["MONTH", "12"],
  ];
  if (w.month !== 12) params.push(["MONTH", mm(w.month)]);
  if (code) params.push([v.code, code]);
  else params.push(["CTY_CODE", "-"]);
  const hash = createHash("sha1").update(JSON.stringify([flow, params])).digest("hex").slice(0, 16);
  const path = `${ENDUSE_CACHE_DIR}/${flow}/${hash}.json`;
  const label = code ? `category ${code}` : "all-countries";
  if (existsSync(path)) {
    const c = JSON.parse(await readFile(path, "utf8")) as { rows: CallRow[]; desc: [string, string][] };
    return { rows: c.rows, desc: new Map(c.desc) };
  }
  const t0 = Date.now();
  const [header, ...data] = await call(flow, params, label);
  const col = (n: string) => header.indexOf(n);
  const [ic, ik, it, id] = ["CTY_CODE", v.code, "time", v.desc].map(col);
  const iv = v.values.map(col);
  if ([ic, ik, it, ...iv].some((i) => i < 0) || (!code && id < 0)) throw new Error(`Census ${flow}/enduse ${label}: unexpected columns ${header.join(",")}`);
  const latest = `${w.year}-${mm(w.month)}`;
  const rows: CallRow[] = [];
  const desc = new Map<string, { time: string; text: string }>();
  for (const r of data) {
    if (!KEEP_CTY.test(r[ic])) continue;
    if (!(r[it].endsWith("-12") || r[it] === latest)) continue;
    if (Number(r[it].slice(0, 4)) === w.year && r[it] !== latest) continue; // December of the year in progress cannot exist; guard anyway
    rows.push([r[ic], r[ik], r[it], ...iv.map((i) => r[i])]);
    if (!code) {
      const prev = desc.get(r[ik]);
      if (!prev || r[it] > prev.time) desc.set(r[ik], { time: r[it], text: r[id] });
    }
  }
  const descOut = new Map([...desc].map(([k, x]) => [k, x.text]));
  await mkdir(`${ENDUSE_CACHE_DIR}/${flow}`, { recursive: true });
  await writeFile(`${path}.download`, JSON.stringify({ flow, params: params.filter(([k]) => k !== "key"), rows, desc: [...descOut] }));
  await rename(`${path}.download`, path);
  console.log(`  ${flow} ${label}: ${rows.length} rows, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return { rows, desc: descOut };
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

/** Newest month the API has published for both flows (probing back from this month). */
async function latestMonth(): Promise<{ year: number; month: number }> {
  const now = new Date();
  let y = now.getUTCFullYear();
  let m = now.getUTCMonth() + 1;
  for (let i = 0; i < 8; i++) {
    let ok = true;
    for (const flow of FLOWS) {
      const v = ENDUSE_FLOW_VARS[flow];
      try {
        await call(flow, [["get", `CTY_CODE,${v.code},${v.values[0]}`], ["COMM_LVL", "EU5"], [v.code, "21320"], ["CTY_CODE", "-"], ["time", `${y}-${mm(m)}`]], `latest-month probe ${y}-${mm(m)}`);
      } catch (e) {
        if (!(e instanceof NoData)) throw e;
        ok = false; // (the category column must be in `get`, or the API answers 204 for any month)
      }
    }
    if (ok) return { year: y, month: m };
    if (--m === 0) [y, m] = [y - 1, 12];
  }
  throw new Error("Census intltrade: no published month in the last 8 months");
}

await run("census-enduse", async () => {
  const args = process.argv.slice(2);
  const latest = await latestMonth();
  const sinceArg = args.indexOf("--since");
  const since = Math.max(ENDUSE_FIRST_YEAR, args.includes("--recent") ? latest.year - 3 : sinceArg >= 0 ? Number(args[sinceArg + 1]) : ENDUSE_FIRST_YEAR);
  if (!Number.isInteger(since)) throw new Error("--since needs a year");
  const w: Window = { since, ...latest };
  console.log(`  window ${since}-01 .. ${latest.year}-${mm(latest.month)} (December of each full year, year to date for ${latest.year})`);

  const descriptions: RawEnduseDescriptions = { fetched_at: new Date().toISOString(), exports: {}, imports: {} };
  if (existsSync(enduseDescPath)) Object.assign(descriptions, parseRawEnduseDescriptions(JSON.parse(await readFile(enduseDescPath, "utf8"))));

  for (const flow of FLOWS) {
    // The all-countries rows name every category with trade in the window.
    const nat = await cached(flow, null, w);
    const codes = [...new Set(nat.rows.map((r) => r[1]))].sort();
    console.log(`  ${flow}: ${codes.length} categories`);
    const perCode = await pool(codes.map((c) => () => cached(flow, c, w)), CONCURRENCY);
    const rows = perCode.flatMap((p) => p.rows);

    // Completeness: the all-countries rows of the category calls equal the all-countries call, to the dollar.
    const natKey = (r: CallRow) => `${r[1]}|${r[2]}`;
    const fromNat = new Map(nat.rows.map((r) => [natKey(r), r.slice(3).join(",")]));
    const fromCalls = new Map(rows.filter((r) => r[0] === "-").map((r) => [natKey(r), r.slice(3).join(",")]));
    for (const [k, val] of fromNat) if (fromCalls.get(k) !== val) throw new Error(`${flow}: category call ${k} all-countries values ${fromCalls.get(k)} differ from the all-countries call (${val})`);

    for (const [k, v] of nat.desc) descriptions[flow][k] = v;

    const years = [...new Set(rows.map((r) => Number(r[2].slice(0, 4))))].sort((a, b) => a - b);
    for (const year of years) {
      const of = rows
        .filter((r) => Number(r[2].slice(0, 4)) === year)
        .map((r) => [r[0], r[1], ...r.slice(3).map(Number)] as RawEnduseRow)
        .filter((r) => r.slice(2).some((x) => x !== 0));
      const through_month = year === w.year ? w.month : 12;
      const fresh = parseRawEnduse({ fetched_at: new Date().toISOString(), flow, year, through_month, rows: sortEnduseRows(of) });
      const dest = enduseRawPath(flow, year);
      if (existsSync(dest)) {
        const prev = parseRawEnduse(JSON.parse(await readFile(dest, "utf8")));
        // Carry `fetched_at` over while nothing changed, so an idle week yields no diff.
        if (JSON.stringify({ ...prev, fetched_at: "" }) === JSON.stringify({ ...fresh, fetched_at: "" })) fresh.fetched_at = prev.fetched_at;
      }
      await mkdir(dest.replace(/\/[^/]+$/, ""), { recursive: true });
      await writeFile(`${dest}.download`, serializeRawEnduse(fresh));
      await rename(`${dest}.download`, dest);
      console.log(`  ${flow} ${year} (through ${mm(through_month)}): ${fresh.rows.length} rows`);
    }
  }
  const sorted = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
  const body = (d: RawEnduseDescriptions) => JSON.stringify({ exports: sorted(d.exports), imports: sorted(d.imports) }, null, 1);
  if (existsSync(enduseDescPath)) {
    const prev = JSON.parse(await readFile(enduseDescPath, "utf8")) as RawEnduseDescriptions;
    if (body(prev) === body(descriptions)) descriptions.fetched_at = prev.fetched_at;
  }
  await writeFile(enduseDescPath, JSON.stringify({ fetched_at: descriptions.fetched_at, ...JSON.parse(body(descriptions)) }, null, 1) + "\n");
});

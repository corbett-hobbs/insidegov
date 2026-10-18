import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { run } from "./lib";
import {
  FLOWS,
  FLOW_VARS,
  PRODUCTS_CACHE_DIR,
  PRODUCTS_FIRST_YEAR,
  RAW_HEADINGS_K,
  isSpecialHs,
  parseRawProducts,
  productsDescPath,
  productsRawPath,
  pruneHeadings,
  serializeRawProducts,
  sortRows,
  type Flow,
  type RawDescriptions,
  type RawProductRow,
} from "./census-products-lib";

/**
 * Goods by product and country from the Census international trade API, into
 * `pipeline/raw/census-trade/products/<flow>/<year>.json` (committed) and
 * `descriptions.json`. Annual values per country x HS chapter (HS2), and each
 * country's top HS4 headings, 2010 through the latest published month.
 *
 *   pnpm fetch:census-products              # every year from 2010
 *   pnpm fetch:census-products --recent     # the year in progress and the three before it (weekly refresh)
 *   pnpm fetch:census-products --since 2023
 *
 * Query shape (measured 2026-10-18; see docs/TRADE_METHODOLOGY.md):
 * - One call covers every year: `time=from <since>-01 to <latest>` with
 *   `MONTH=12&MONTH=<latest month>` and the `_YR` (year-to-date) variables, so
 *   December rows are calendar years and the latest month is the year in progress.
 * - All chapters x all countries in one call fails at the API (a server error
 *   after about 2.5 min), and so does an `85*` wildcard at HS4. An explicit,
 *   SORTED list of codes works (an unsorted list returns 204, i.e. "no data").
 *   So codes are batched: 8 chapters or 24 headings per call, about 4-12 s each.
 *   A batch that still fails is split in half and retried.
 * - About 130 calls in all. Each response is cached under `_cache/` (git-ignored),
 *   keyed by its query, so an interrupted run resumes where it stopped.
 *
 * Needs `CENSUS_API_KEY` (environment or `.env.local`). The key is never logged:
 * error messages carry the flow, level and codes, never the request URL.
 */
const API = (flow: Flow) => `https://api.census.gov/data/timeseries/intltrade/${flow}/hs`;
const CHAPTERS_PER_CALL = 8;
const HEADINGS_PER_CALL = 24;
const CONCURRENCY = 3;
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
      throw new Error(`Census ${flow}/hs ${label} -> ${status || "no response"} ${statusText}`);
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

async function cached(flow: Flow, level: "HS2" | "HS4", codes: string[] | null, cty: string | null, w: Window, withDesc: boolean): Promise<{ rows: CallRow[]; desc: Map<string, string> }> {
  const { commodity, values } = FLOW_VARS[flow];
  const get = ["CTY_CODE", commodity, ...(withDesc ? [`${commodity}_SDESC`] : []), ...values].join(",");
  const params: [string, string][] = [
    ["get", get],
    ["COMM_LVL", level],
    ["time", `from ${w.since}-01 to ${w.year}-${mm(w.month)}`],
    ["MONTH", "12"],
  ];
  if (w.month !== 12) params.push(["MONTH", mm(w.month)]);
  if (cty) params.push(["CTY_CODE", cty]);
  for (const c of codes ?? []) params.push([commodity, c]);
  const hash = createHash("sha1").update(JSON.stringify([flow, params])).digest("hex").slice(0, 16);
  const path = `${PRODUCTS_CACHE_DIR}/${flow}/${hash}.json`;
  const label = `${level} ${cty === "-" ? "all-countries" : "by country"} ${codes ? `${codes[0]}..${codes[codes.length - 1]} (${codes.length})` : "every code"}`;
  if (existsSync(path)) {
    const c = JSON.parse(await readFile(path, "utf8")) as { rows: CallRow[]; desc: [string, string][] };
    return { rows: c.rows, desc: new Map(c.desc) };
  }
  const t0 = Date.now();
  const body = await call(flow, params, label);
  const [header, ...data] = body;
  const col = (n: string) => header.indexOf(n);
  const [ic, ik, it, id] = ["CTY_CODE", commodity, "time", `${commodity}_SDESC`].map(col);
  const iv = values.map(col);
  if ([ic, ik, it, ...iv].some((i) => i < 0)) throw new Error(`Census ${flow}/hs ${label}: unexpected columns ${header.join(",")}`);
  const keepTime = (t: string) => t.endsWith("-12") || t === `${w.year}-${mm(w.month)}`;
  const rows: CallRow[] = [];
  const desc = new Map<string, string>();
  for (const r of data) {
    if (!KEEP_CTY.test(r[ic]) || !keepTime(r[it])) continue;
    if (Number(r[it].slice(0, 4)) === w.year && r[it] !== `${w.year}-${mm(w.month)}`) continue; // Dec of the year in progress cannot exist; guard anyway
    rows.push([r[ic], r[ik], r[it], ...iv.map((i) => r[i])]);
    if (withDesc && id >= 0) {
      const prev = desc.get(r[ik]);
      if (!prev || r[it] > prev.split("\u0000")[0]) desc.set(r[ik], `${r[it]}\u0000${r[id]}`);
    }
  }
  const descOut = new Map([...desc].map(([k, v]) => [k, v.split("\u0000")[1]]));
  await mkdir(`${PRODUCTS_CACHE_DIR}/${flow}`, { recursive: true });
  await writeFile(`${path}.download`, JSON.stringify({ flow, params: params.filter(([k]) => k !== "key"), rows, desc: [...descOut] }));
  await rename(`${path}.download`, path);
  console.log(`  ${flow} ${label}: ${rows.length} rows, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return { rows, desc: descOut };
}

/** A batch of codes for all countries; on failure, split it in half (down to one code). */
async function batch(flow: Flow, level: "HS2" | "HS4", codes: string[], w: Window): Promise<CallRow[]> {
  try {
    return (await cached(flow, level, codes, null, w, false)).rows;
  } catch (e) {
    if (codes.length === 1) throw e;
    console.log(`  ${flow} ${level} ${codes[0]}..${codes[codes.length - 1]}: ${e instanceof Error ? e.message : e}; splitting`);
    const half = Math.ceil(codes.length / 2);
    return [...(await batch(flow, level, codes.slice(0, half), w)), ...(await batch(flow, level, codes.slice(half), w))];
  }
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

const chunk = <T>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

/** Newest month the API has published for both flows (probing back from this month). */
async function latestMonth(): Promise<{ year: number; month: number }> {
  const now = new Date();
  let y = now.getUTCFullYear();
  let m = now.getUTCMonth() + 1;
  for (let i = 0; i < 8; i++) {
    let ok = true;
    for (const flow of FLOWS) {
      const { commodity } = FLOW_VARS[flow];
      try {
        await call(flow, [["get", `CTY_CODE,${FLOW_VARS[flow].values[0]}`], ["COMM_LVL", "HS2"], [commodity, "27"], ["CTY_CODE", "-"], ["time", `${y}-${mm(m)}`]], `latest-month probe ${y}-${mm(m)}`);
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

const sumRows = (rows: CallRow[], i: number) => rows.reduce((s, r) => s + Number(r[i]), 0);

await run("census-products", async () => {
  const args = process.argv.slice(2);
  const latest = await latestMonth();
  const sinceArg = args.indexOf("--since");
  const since = Math.max(PRODUCTS_FIRST_YEAR, args.includes("--recent") ? latest.year - 3 : sinceArg >= 0 ? Number(args[sinceArg + 1]) : PRODUCTS_FIRST_YEAR);
  if (!Number.isInteger(since)) throw new Error("--since needs a year");
  const w: Window = { since, ...latest };
  console.log(`  window ${since}-01 .. ${latest.year}-${mm(latest.month)} (December of each full year, year to date for ${latest.year})`);

  const descriptions: RawDescriptions = { fetched_at: new Date().toISOString(), exports: { hs2: {}, hs4: {} }, imports: { hs2: {}, hs4: {} } };
  if (existsSync(productsDescPath)) Object.assign(descriptions, JSON.parse(await readFile(productsDescPath, "utf8")));

  for (const flow of FLOWS) {
    // The all-countries rows name every code with trade in the window.
    const nat2 = await cached(flow, "HS2", null, "-", w, true);
    const nat4 = await cached(flow, "HS4", null, "-", w, true);
    const chapters = [...new Set(nat2.rows.map((r) => r[1]))].sort();
    const headings = [...new Set(nat4.rows.map((r) => r[1]))].sort();
    console.log(`  ${flow}: ${chapters.length} chapters, ${headings.length} headings`);

    const hs2 = (await pool(chunk(chapters, CHAPTERS_PER_CALL).map((c) => () => batch(flow, "HS2", c, w)), CONCURRENCY)).flat();
    const hs4 = (await pool(chunk(headings, HEADINGS_PER_CALL).map((c) => () => batch(flow, "HS4", c, w)), CONCURRENCY)).flat();

    // Completeness: for every (country, time, chapter), the headings sum to the chapter, and the batched
    // all-countries rows equal the all-countries call. A silently empty batch fails here.
    const key = (r: CallRow, ch: string) => `${r[0]}|${r[2]}|${ch}`;
    const chapterVal = new Map(hs2.map((r) => [key(r, r[1]), Number(r[3])]));
    const headingSum = new Map<string, number>();
    for (const r of hs4) headingSum.set(key(r, r[1].slice(0, 2)), (headingSum.get(key(r, r[1].slice(0, 2))) ?? 0) + Number(r[3]));
    let worst = { key: "", gap: 0 };
    for (const k of new Set([...chapterVal.keys(), ...headingSum.keys()])) {
      const gap = Math.abs((chapterVal.get(k) ?? 0) - (headingSum.get(k) ?? 0));
      if (gap > worst.gap) worst = { key: k, gap };
    }
    console.log(`  ${flow}: worst heading-sum vs chapter gap $${worst.gap} (${worst.key || "none"})`);
    if (worst.gap > 1000) throw new Error(`${flow}: HS4 headings do not sum to the HS2 chapter for ${worst.key} (gap $${worst.gap}); a batch came back incomplete`);
    const natFromBatch = sumRows(hs2.filter((r) => r[0] === "-"), 3);
    if (natFromBatch !== sumRows(nat2.rows, 3)) throw new Error(`${flow}: batched all-countries chapters ($${natFromBatch}) differ from the all-countries call ($${sumRows(nat2.rows, 3)})`);

    for (const [k, v] of nat2.desc) descriptions[flow].hs2[k] = v;
    for (const [k, v] of nat4.desc) descriptions[flow].hs4[k] = v;

    const years = [...new Set(hs2.map((r) => Number(r[2].slice(0, 4))))].sort((a, b) => a - b);
    for (const year of years) {
      const of = (rows: CallRow[]) => rows.filter((r) => Number(r[2].slice(0, 4)) === year).map((r) => [r[0], r[1], ...r.slice(3)] as RawProductRow);
      const through_month = year === w.year ? w.month : 12;
      const fresh = parseRawProducts({
        fetched_at: new Date().toISOString(),
        flow,
        year,
        through_month,
        heading_k: RAW_HEADINGS_K,
        chapters: sortRows(of(hs2)),
        headings: pruneHeadings(of(hs4), RAW_HEADINGS_K),
      });
      const dest = productsRawPath(flow, year);
      if (existsSync(dest)) {
        const prev = parseRawProducts(JSON.parse(await readFile(dest, "utf8")));
        // Carry `fetched_at` over while nothing changed, so an idle week yields no diff.
        if (JSON.stringify({ ...prev, fetched_at: "" }) === JSON.stringify({ ...fresh, fetched_at: "" })) fresh.fetched_at = prev.fetched_at;
      }
      await mkdir(`${productsRawPath(flow, year).replace(/\/[^/]+$/, "")}`, { recursive: true });
      await writeFile(`${dest}.download`, serializeRawProducts(fresh));
      await rename(`${dest}.download`, dest);
      const special = fresh.headings.filter((r) => isSpecialHs(r[1])).length;
      console.log(`  ${flow} ${year} (through ${mm(through_month)}): ${fresh.chapters.length} chapter rows, ${fresh.headings.length} heading rows (${special} special)`);
    }
  }
  const prevDesc = existsSync(productsDescPath) ? await readFile(productsDescPath, "utf8") : "";
  const sorted = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
  const body = (d: RawDescriptions) =>
    JSON.stringify({ exports: { hs2: sorted(d.exports.hs2), hs4: sorted(d.exports.hs4) }, imports: { hs2: sorted(d.imports.hs2), hs4: sorted(d.imports.hs4) } }, null, 1);
  if (prevDesc && body(JSON.parse(prevDesc)) === body(descriptions)) descriptions.fetched_at = JSON.parse(prevDesc).fetched_at;
  await writeFile(productsDescPath, JSON.stringify({ fetched_at: descriptions.fetched_at, ...JSON.parse(body(descriptions)) }, null, 1) + "\n");
});

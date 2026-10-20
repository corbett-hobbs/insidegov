import { z } from "zod";
import { readXls } from "../transform/xls";
import { readXlsx } from "../transform/xlsx";
import { CENSUS_RAW_DIR } from "./census-trade-lib";
import { FLOWS, FLOW_VARS, PRODUCTS_FIRST_YEAR, type Flow } from "./census-products-lib";

/**
 * Goods by product and use: every HS10 line (all countries) joined to the end-use category Census files it under, then
 * summed to (HS4 heading, end use). Fetched by `census-productuse.ts`; read by `pipeline/transform/trade-productuse.ts`.
 * See docs/TRADE_METHODOLOGY.md ("Goods by product and use").
 */
export const PRODUCTUSE_RAW_DIR = `${CENSUS_RAW_DIR}/product-use`;
/** HS10 responses and concordance files (git-ignored): what makes a fetch resumable and the join reproducible. */
export const PRODUCTUSE_CACHE_DIR = `${PRODUCTUSE_RAW_DIR}/_cache`;
export const PRODUCTUSE_FIRST_YEAR = PRODUCTS_FIRST_YEAR;

export { FLOWS, FLOW_VARS };
export type { Flow };

export const productUseRawPath = (flow: Flow, year: number) => `${PRODUCTUSE_RAW_DIR}/${flow}/${year}.json`;

/**
 * Census's yearly HS10 -> end-use concordance, one file per year and flow: `expconcord<YY>` (Schedule B) and
 * `impconcord<YY>` (HTS). 2010-2019 are old binary `.xls`, 2020 on `.xlsx`. Codes change every year, so each year
 * is joined with its own file. (The index page lists only up to 2022; later years exist at the same pattern.)
 */
export const CONCORDANCE_BASE = "https://www.census.gov/foreign-trade/reference/codes/concordance";
export const concordanceExt = (year: number) => (year >= 2020 ? "xlsx" : "xls");
export const concordanceName = (flow: Flow, year: number) => `${flow === "exports" ? "exp" : "imp"}concord${String(year % 100).padStart(2, "0")}.${concordanceExt(year)}`;

/**
 * Export statistical codes that are not in Schedule B, so some years' concordance has no row for them. Each is a
 * special transaction and maps one to one to a special end-use entry (`ENDUSE_SPECIAL` exports); the mapping was
 * checked in 2025 against `trade_enduse_national.json`, to the dollar. A code that does appear in the concordance
 * keeps the concordance's end use (9880006000 is listed in the 2019 file, for one). Imports need no map.
 *  - 9880002000, 9880004000: the low-value-shipments estimate ($54.7B in 2025)  -> 60000 Minimum-value shipments
 *  - 9880006000: estimated late receipts / corrections from Canada (2024 on)  -> 60040 Undocumented exports to Canada
 *  - 9870003000, 9870005000, 9870007000: special Canadian classifications ($0.15B) -> 60010 Miscellaneous domestic exports & special transactions
 */
export const EXPORT_CHAPTER_98_USE: Record<string, string> = {
  "9880002000": "60000",
  "9880004000": "60000",
  "9880006000": "60040",
  "9870003000": "60010",
  "9870005000": "60010",
  "9870007000": "60010",
};

/**
 * Import lines that no concordance carries: Census's yearly file is built before codes added during the year, so a
 * line missing from its own year's file is looked up in the next year's, then the previous year's (`joinHs10`). Seventeen
 * lines are in none of the three. Each is assigned the end use of its numerically nearest HS10 neighbours, which
 * all agree (the HS6 siblings in the same file), and the assignment was checked against `trade_enduse_national.json`:
 * the end-use totals move toward the published ones. Keyed `<year>|<HS10>`; an entry the concordances now cover is
 * ignored, and a new unmatched line fails the transform, naming the code.
 *  - 2017: 9403200022, 9403200024 (metal furniture; neighbours 0021 and 0025 are household furniture)
 *  - 2021: 2931390020, 2931390030, 2903392036, 2903392038, 2903392040 (organic chemicals)
 *  - 2022: seven fresh vegetable lines (07xx; 00130) and two beverage lines (2206009010/20; 00190)
 */
export const IMPORT_RESIDUAL_USE: Record<string, string> = {
  "2017|9403200022": "41000",
  "2017|9403200024": "41000",
  "2021|2931390020": "12540",
  "2021|2931390030": "12540",
  "2021|2903392036": "12540",
  "2021|2903392038": "12540",
  "2021|2903392040": "12540",
  "2022|0701905040": "00130",
  "2022|0704904050": "00130",
  "2022|0707002010": "00130",
  "2022|0707002020": "00130",
  "2022|0707004020": "00130",
  "2022|0707005040": "00130",
  "2022|0707006020": "00130",
  "2022|0709932040": "00130",
  "2022|2206009010": "00190",
  "2022|2206009020": "00190",
};

const hs4 = z.string().regex(/^\d{4}$/);
const hs10 = z.string().regex(/^\d{10}$/);
const useCode = z.string().regex(/^\d{5}$/);
const amount = z.number().int().nonnegative();
const row = z.union([z.tuple([hs4, useCode, amount]), z.tuple([hs4, useCode, amount, amount, amount])]);
/** `[HS10, end use, source, value]`: a line given its end use by something other than its own year's concordance. */
const assignedRow = z.tuple([hs10, useCode, z.string().regex(/^(map|\d{4})$/), amount]);
const unmatchedRow = z.union([z.tuple([hs10, amount]), z.tuple([hs10, amount, amount, amount])]);

/**
 * One (flow, year) of the committed raw snapshot, all countries. `rows` are `[HS4, end-use code, ...values]`, whole
 * dollars, summed over the HS10 lines that map to that pair: exports `[ALL_VAL]`, imports `[GEN_VAL, CON_VAL,
 * CAL_DUT]`. `assigned` lists every HS10 line whose own year's concordance had no row (value: the first column): source `map` = the
 * hand maps above, a year = that year's concordance (the next, else the previous). `unmatched` lists the lines still without a row; they are not in
 * `rows`, and a non-empty list fails the transform. `through_month` is 12 for a full year; for the year in progress it
 * is the latest published month, year to date.
 */
const rawProductUse = z
  .object({
    fetched_at: z.string(),
    flow: z.enum(FLOWS),
    year: z.number().int(),
    through_month: z.number().int().min(1).max(12),
    rows: z.array(row),
    assigned: z.array(assignedRow),
    unmatched: z.array(unmatchedRow),
  })
  .strict();
export type RawProductUse = z.infer<typeof rawProductUse>;

export function parseRawProductUse(value: unknown): RawProductUse {
  const r = rawProductUse.parse(value);
  const width = r.flow === "exports" ? 3 : 5;
  for (const x of r.rows) if (x.length !== width) throw new Error(`product-use raw ${r.flow} ${r.year}: row ${JSON.stringify(x)} has ${x.length} cells, expected ${width}`);
  for (const x of r.unmatched) if (x.length !== width - 1) throw new Error(`product-use raw ${r.flow} ${r.year}: unmatched ${JSON.stringify(x)} has ${x.length} cells, expected ${width - 1}`);
  return r;
}

/** One row per line inside a small object, so a refresh diffs by row in git. */
export function serializeRawProductUse(r: RawProductUse): string {
  const head = { fetched_at: r.fetched_at, flow: r.flow, year: r.year, through_month: r.through_month };
  const list = (a: unknown[]) => (a.length ? `[\n${a.map((x) => JSON.stringify(x)).join(",\n")}\n]` : "[]");
  return `${JSON.stringify(head).slice(0, -1)},\n"assigned": ${list(r.assigned)},\n"unmatched": ${list(r.unmatched)},\n"rows": ${list(r.rows)}\n}\n`;
}

/** A concordance cell as a zero-padded digit string (the `.xls` files may store codes as numbers). */
function code(v: string | undefined, width: number): string {
  const s = (v ?? "").trim();
  if (!/^\d+$/.test(s) || s.length > width) throw new Error(`concordance cell "${s}" is not a ${width}-digit code`);
  return s.padStart(width, "0");
}

/** HS10 -> end-use code from a concordance file's bytes. Columns are found by header name: their order differs by year. */
export function parseConcordance(file: Buffer, ext: "xls" | "xlsx"): Map<string, string> {
  const table: string[][] =
    ext === "xls"
      ? readXls(file)
      : readXlsx(file).map((r) => {
          const out: string[] = [];
          for (const [letter, v] of Object.entries(r.cells)) out[[...letter].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1] = v;
          return out;
        });
  const header = (table[0] ?? []).map((c) => (c ?? "").trim().toLowerCase());
  const ic = header.indexOf("commodity");
  const ie = header.indexOf("end_use");
  if (ic < 0 || ie < 0) throw new Error(`concordance: expected "commodity" and "end_use" columns, found ${JSON.stringify(header)}`);
  const out = new Map<string, string>();
  for (const r of table.slice(1)) {
    if (!r || !r[ic]) continue;
    const c = code(r[ic], 10);
    if (!(r[ie] ?? "").trim()) continue; // a row with no end use (two in the 2016 imports file, neither with trade) is no row
    const u = code(r[ie], 5);
    if (out.has(c) && out.get(c) !== u) throw new Error(`concordance: ${c} has two end uses (${out.get(c)}, ${u})`);
    out.set(c, u);
  }
  if (out.size < 5000) throw new Error(`concordance: only ${out.size} codes, the file looks truncated`);
  return out;
}

/** An HS10 line from the API: the code and its values (exports `[ALL_VAL]`, imports `[GEN_VAL, CON_VAL, CAL_DUT]`). */
export type Hs10Line = readonly [string, ...number[]];

/**
 * Sum HS10 lines to (HS4, end use). A line takes its own year's concordance (`concordances[0]`); failing that the
 * adjacent years' in the order given (next, then previous), then the hand maps (`EXPORT_CHAPTER_98_USE` for exports,
 * `IMPORT_RESIDUAL_USE` for imports). What is still unmatched is returned in `unmatched`, not dropped. Zero lines are skipped.
 * `concordances` carry their year so `assigned` can say where each line's end use came from.
 */
export function joinHs10(
  flow: Flow,
  year: number,
  lines: readonly Hs10Line[],
  concordances: readonly { year: number; map: ReadonlyMap<string, string> }[],
): Pick<RawProductUse, "rows" | "assigned" | "unmatched"> {
  const sums = new Map<string, number[]>();
  const unmatched: RawProductUse["unmatched"] = [];
  const assigned: RawProductUse["assigned"] = [];
  for (const [c, ...vals] of lines) {
    if (!/^\d{10}$/.test(c)) throw new Error(`product-use ${flow}: "${c}" is not an HS10 code`);
    if (vals.every((v) => v === 0)) continue;
    let use = concordances[0]?.map.get(c);
    if (use === undefined) {
      for (const cc of concordances.slice(1)) {
        use = cc.map.get(c);
        if (use !== undefined) {
          assigned.push([c, use, String(cc.year), vals[0]]);
          break;
        }
      }
    }
    if (use === undefined) {
      use = flow === "exports" ? EXPORT_CHAPTER_98_USE[c] : IMPORT_RESIDUAL_USE[`${year}|${c}`];
      if (use !== undefined) assigned.push([c, use, "map", vals[0]]);
    }
    if (use === undefined) {
      unmatched.push(vals.length === 1 ? [c, vals[0]] : [c, vals[0], vals[1], vals[2]]);
      continue;
    }
    const k = `${c.slice(0, 4)}|${use}`;
    const have = sums.get(k);
    if (have) vals.forEach((v, i) => (have[i] += v));
    else sums.set(k, [...vals]);
  }
  const rows = [...sums]
    .map(([k, v]) => [...k.split("|"), ...v] as RawProductUse["rows"][number])
    .sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
  unmatched.sort((a, b) => a[0].localeCompare(b[0]));
  assigned.sort((a, b) => a[0].localeCompare(b[0]));
  return { rows, assigned, unmatched };
}

import { enduseLabel, isSpecialEnduse, type EnduseFlow } from "../../lib/trade-enduse-labels";
import { PRODUCT_USE_START_YEAR, type TradeProductUseRow } from "../../lib/trade-product-use-entities";
import type { TradeEnduseNationalRow } from "../../lib/trade-enduse-entities";
import type { TradeProductsNationalRow } from "../../lib/trade-products-entities";
import { TradeDataError } from "../../lib/trade-entities";
import { isSpecialHs } from "../fetch/census-products-lib";
import type { RawProductUse } from "../fetch/census-productuse-lib";

/**
 * Goods by product and use (pure; file I/O is in trade-run.ts). Source:
 * `pipeline/raw/census-trade/product-use/<flow>/<year>.json` (every HS10 line, all countries, joined to its Census
 * end-use category and summed to HS4 x end use). See docs/TRADE_METHODOLOGY.md ("Goods by product and use").
 */

/**
 * Reconciliation tolerances, in dollars unless noted. Tripping one fails the build; measured values in
 * docs/TRADE_METHODOLOGY.md and `trade_report.json` (`product_use`).
 */
export const PRODUCT_USE_TOL = {
  /** The triples' grand total vs the all-countries total of `trade_enduse_national.json` (the same API, a different classification of the same lines). */
  totalAbs: 1,
  /** Triples summed by chapter vs `trade_products_national.json` (the same HS10 lines, summed by the API itself). */
  chapterAbs: 1,
  /** Triples summed by heading vs the same file's headings (its top 25 and every special heading). */
  headingAbs: 1,
  /**
   * Triples summed by end use vs `trade_enduse_national.json`. Not exact: the concordance is the end-of-year file, so a
   * line whose end use changed during the year sits in its final category here and is split between the old and the new in
   * the API's end-use series. Some years carry more such lines than others (imports 2010-11 and 2022-23, exports 2010-11 and 2020-21).
   * Measured over 2010-2026 (`trade_report.json`, `product_use`): the dollars filed under a different category are at most
   * 0.25% of a flow (imports 2010), and no single category is off by more than 0.15% of the flow ($2.9B, imports 2022,
   * category 20005). 2013-14 and 2025-26 (exports) match to the dollar. Tolerances sit a little above those.
   */
  useShareOfFlow: 0.003,
  /** The same, as the dollars moved between categories (half the sum of all categories' gaps) over the flow's value. */
  useMovedShare: 0.005,
};

type Values = number[];

export interface ProductUseBuild {
  /** One row per (year, flow), exports before imports within a year. */
  rows: TradeProductUseRow[];
  /** Per (year, flow): HS10 lines whose end use came from another year's concordance (`adjacent`) or a hand map (`mapped`), and the value of the former. */
  assigned: { year: number; flow: "exports" | "imports"; adjacent: number; adjacent_value: number; mapped: number }[];
  firstYear: number;
  lastYear: number;
  lastMonth: number;
}

const byHeading = (a: readonly [string, string, ...number[]], b: readonly [string, string, ...number[]]) => a[0].localeCompare(b[0]) || b[2] - a[2] || a[1].localeCompare(b[1]);

export function buildProductUse(raws: RawProductUse[]): ProductUseBuild {
  const seen = new Set<string>();
  const monthsOfYear = new Map<number, number>();
  const rows: TradeProductUseRow[] = [];
  const assigned: ProductUseBuild["assigned"] = [];
  let firstYear = Infinity;
  let lastYear = 0;

  for (const raw of [...raws].sort((a, b) => a.year - b.year || a.flow.localeCompare(b.flow))) {
    const who = `product-use ${raw.flow} ${raw.year}`;
    if (raw.year < PRODUCT_USE_START_YEAR) throw new TradeDataError(`${who}: before ${PRODUCT_USE_START_YEAR}`);
    if (seen.has(`${raw.flow}|${raw.year}`)) throw new TradeDataError(`${who}: two raw files`);
    seen.add(`${raw.flow}|${raw.year}`);
    const m = monthsOfYear.get(raw.year);
    if (m !== undefined && m !== raw.through_month) throw new TradeDataError(`product-use ${raw.year}: exports cover ${m} months but imports ${raw.through_month}; re-run the fetch`);
    monthsOfYear.set(raw.year, raw.through_month);
    firstYear = Math.min(firstYear, raw.year);
    lastYear = Math.max(lastYear, raw.year);

    if (raw.unmatched.length) {
      const total = raw.unmatched.reduce((s, u) => s + u[1], 0);
      throw new TradeDataError(
        `${who}: ${raw.unmatched.length} HS10 line(s) have no row in Census's ${raw.year} concordance ($${total}): ${raw.unmatched.slice(0, 8).map((u) => `${u[0]} ($${u[1]})`).join(", ")}. ` +
          `Add an export code to EXPORT_CHAPTER_98_USE (pipeline/fetch/census-productuse-lib.ts) or re-run pnpm fetch:census-productuse.`,
      );
    }
    const adj = raw.assigned.filter((a) => a[2] !== "map");
    assigned.push({ year: raw.year, flow: raw.flow, adjacent: adj.length, adjacent_value: adj.reduce((t, a) => t + a[3], 0), mapped: raw.assigned.length - adj.length });
    const flow = raw.flow as EnduseFlow;
    const ranked: (readonly [string, string, ...number[]])[] = [];
    const special: (readonly [string, string, ...number[]])[] = [];
    const keys = new Set<string>();
    for (const t of raw.rows) {
      const k = `${t[0]}|${t[1]}`;
      if (keys.has(k)) throw new TradeDataError(`${who}: duplicate row ${t[0]} ${t[1]}`);
      keys.add(k);
      if (!enduseLabel(flow, t[1])) throw new TradeDataError(`${who}: end use ${t[1]} (heading ${t[0]}) has no label in lib/trade-enduse-labels.ts — name it deliberately`);
      // Special: a special end use (minimum-value shipments, returned goods...) or a chapter 98/99 heading. Both stay in every sum.
      (isSpecialEnduse(flow, t[1]) || isSpecialHs(t[0]) ? special : ranked).push(t);
    }
    ranked.sort(byHeading);
    special.sort(byHeading);
    const all = [...ranked, ...special];
    const sum = (i: number) => all.reduce((s, t) => s + (t[i] as number), 0);
    if (raw.flow === "exports") rows.push({ year: raw.year, months: raw.through_month, flow: "exports", value: sum(2), rows: ranked, special } as Extract<TradeProductUseRow, { flow: "exports" }>);
    else rows.push({ year: raw.year, months: raw.through_month, flow: "imports", value: sum(2), con_value: sum(3), duties: sum(4), rows: ranked, special } as Extract<TradeProductUseRow, { flow: "imports" }>);
  }
  if (!rows.length) throw new TradeDataError("product-use: no raw files — run pnpm fetch:census-productuse");
  return { rows, assigned, firstYear, lastYear, lastMonth: monthsOfYear.get(lastYear) ?? 0 };
}

// -------------------------------------------------------------- validation

export interface Gap {
  key: string;
  got: number;
  want: number;
  gap: number;
}

export interface ProductUseValidation {
  /** Largest dollar gap of each kind over every (year, flow); `values` = value, imports for consumption and duties are checked alike. */
  worstTotal: Gap | null;
  worstChapter: Gap | null;
  worstHeading: Gap | null;
  worstUse: Gap | null;
  /** Dollars filed under a different end use than in the API's end-use series, over the flow's value: the worst (year, flow). */
  worstMoved: (Gap & { share: number }) | null;
  /** Every category-year-flow with a use gap above $1M (mostly lines whose end use changed during the year). */
  useGaps: Gap[];
  /** Number of (year, flow) pairs checked and of chapter / heading / use comparisons made. */
  checked: { yearFlows: number; chapters: number; headings: number; uses: number };
}

const gapOf = (key: string, got: number, want: number): Gap => ({ key, got, want, gap: Math.abs(got - want) });
const worse = (a: Gap | null, b: Gap) => (!a || b.gap > a.gap ? b : a);

export function validateProductUse(args: {
  build: ProductUseBuild;
  productsNational: TradeProductsNationalRow[];
  enduseNational: TradeEnduseNationalRow[];
  /** False only for a trial over a few years (the fetch's `--since`); the build always requires 2010 on. */
  requireFullHistory?: boolean;
}): ProductUseValidation {
  const { build } = args;
  const fail = (m: string): never => {
    throw new TradeDataError(`product-use validation: ${m}`);
  };
  if ((args.requireFullHistory ?? true) && build.firstYear !== PRODUCT_USE_START_YEAR) fail(`raw files start in ${build.firstYear}, not ${PRODUCT_USE_START_YEAR} (run pnpm fetch:census-productuse)`);
  for (let y = build.firstYear; y <= build.lastYear; y++) for (const f of ["exports", "imports"]) if (!build.rows.some((r) => r.year === y && r.flow === f)) fail(`no ${f} for ${y}`);
  const products = new Map(args.productsNational.map((r) => [`${r.year}|${r.flow}`, r]));
  const enduse = new Map(args.enduseNational.map((r) => [`${r.year}|${r.flow}`, r]));

  const out: ProductUseValidation = { worstTotal: null, worstChapter: null, worstHeading: null, worstUse: null, worstMoved: null, useGaps: [], checked: { yearFlows: 0, chapters: 0, headings: 0, uses: 0 } };
  for (const r of build.rows) {
    const k = `${r.year}|${r.flow}`;
    const label = `${r.year} ${r.flow}`;
    const p = products.get(k);
    const e = enduse.get(k);
    if (!p) fail(`${label}: no all-countries row in trade_products_national.json`);
    if (!e) fail(`${label}: no all-countries row in trade_enduse_national.json`);
    if (p!.months !== r.months || e!.months !== r.months) fail(`${label}: covers ${r.months} months but the HS-chapter file has ${p!.months} and the end-use file ${e!.months} (re-run the fetches)`);
    out.checked.yearFlows++;

    const width = r.flow === "exports" ? 1 : 3; // value[, con_value, duties]
    const names = ["value", "imports for consumption", "duties"];
    const all = [...r.rows, ...r.special] as (readonly [string, string, ...number[]])[];
    const by = (key: (t: readonly [string, string, ...number[]]) => string) => {
      const m = new Map<string, Values>();
      for (const t of all) {
        const have = m.get(key(t));
        const v = t.slice(2) as number[];
        m.set(key(t), have ? have.map((x, i) => x + v[i]) : [...v]);
      }
      return m;
    };
    const wantOf = (row: { value: number; con_value?: number; duties?: number }) => [row.value, row.con_value ?? 0, row.duties ?? 0];

    // Grand total, against the end-use file's all-countries row.
    const sums = Array.from({ length: width }, (_, i) => all.reduce((s, t) => s + (t[2 + i] as number), 0));
    const wantTotal = wantOf(e as { value: number; con_value?: number; duties?: number });
    for (let i = 0; i < width; i++) {
      const g = gapOf(`${label} ${names[i]}`, sums[i], wantTotal[i]);
      out.worstTotal = worse(out.worstTotal, g);
      if (g.gap > PRODUCT_USE_TOL.totalAbs) fail(`${label}: triples sum to $${g.got} ${names[i]} but trade_enduse_national.json says $${g.want}`);
    }

    // By chapter (all of them, 98/99 included) against the HS-chapter file.
    const chapters = by((t) => t[0].slice(0, 2));
    const pchap = new Map(p!.chapters.map((t) => [t[0], t.slice(1) as number[]]));
    for (const c of new Set([...chapters.keys(), ...pchap.keys()])) {
      const got = chapters.get(c) ?? Array(width).fill(0);
      const want = pchap.get(c) ?? Array(width).fill(0);
      out.checked.chapters++;
      for (let i = 0; i < width; i++) {
        const g = gapOf(`${label} chapter ${c} ${names[i]}`, got[i], want[i]);
        out.worstChapter = worse(out.worstChapter, g);
        if (g.gap > PRODUCT_USE_TOL.chapterAbs) fail(`${g.key}: triples sum to $${g.got} but trade_products_national.json says $${g.want}`);
      }
    }

    // By heading: the file keeps the top 25 goods headings and every special heading.
    const headings = by((t) => t[0]);
    for (const t of [...p!.headings, ...p!.special]) {
      const got = headings.get(t[0]) ?? Array(width).fill(0);
      out.checked.headings++;
      for (let i = 0; i < width; i++) {
        const g = gapOf(`${label} heading ${t[0]} ${names[i]}`, got[i], t[1 + i] as number);
        out.worstHeading = worse(out.worstHeading, g);
        if (g.gap > PRODUCT_USE_TOL.headingAbs) fail(`${g.key}: triples sum to $${g.got} but trade_products_national.json says $${g.want}`);
      }
    }

    // By end use against the end-use file: the one place the two classifications can drift (see PRODUCT_USE_TOL.useAbs).
    const uses = by((t) => t[1]);
    const eu = new Map([...e!.categories, ...e!.special].map((t) => [t[0], t.slice(1) as number[]]));
    let moved = 0;
    for (const c of new Set([...uses.keys(), ...eu.keys()])) {
      const got = uses.get(c) ?? Array(width).fill(0);
      const want = eu.get(c) ?? Array(width).fill(0);
      out.checked.uses++;
      const g = gapOf(`${label} end use ${c} value`, got[0], want[0]);
      out.worstUse = worse(out.worstUse, g);
      moved += g.gap;
      if (g.gap > 1e6) out.useGaps.push(g);
      if (g.gap > PRODUCT_USE_TOL.useShareOfFlow * wantTotal[0]) fail(`${g.key}: triples sum to $${g.got} but trade_enduse_national.json says $${g.want}`);
    }
    moved /= 2; // each moved dollar shows as a gap in two categories
    const share = moved / (wantTotal[0] || 1);
    if (!out.worstMoved || share > out.worstMoved.share) out.worstMoved = { key: label, got: moved, want: wantTotal[0], gap: moved, share };
    if (share > PRODUCT_USE_TOL.useMovedShare) fail(`${label}: $${moved} sits under a different end use than in trade_enduse_national.json (${(share * 100).toFixed(3)}% of the flow)`);
  }
  return out;
}

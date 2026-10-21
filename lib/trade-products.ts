import { HS_CHAPTERS, SPECIAL_HEADINGS } from "./trade-hs-chapters";
import type { TradeProductsNationalRow, TradeProductsPartnersRow } from "./trade-products-entities";

/**
 * Pure model for the chapter list of the "What the U.S. trades" card: one
 * partner's (or all countries') goods by Harmonized System chapter, for one year
 * and flow. Values are whole dollars, as in `trade_products_*`. Chapters 98 and
 * 99 and the special headings (returned goods, low-value estimates) are never
 * ranked as chapters: they are summed into `special` for a footnote. A chapter's
 * collected rate is calculated duty over imports for consumption (tuple index 3
 * over index 2), never over general imports. See docs/TRADE_METHODOLOGY.md
 * ("Goods by product").
 */

/** The route segment and payload key for all countries together (country codes are upper case, so it cannot collide). */
export const ALL_PRODUCTS = "all";

export type ProductsFlow = "exports" | "imports";
/** `Omit` for each member of a union (a plain `Omit` collapses exports and imports rows into their common fields). */
type OmitEach<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** A products row without its top headings: the card ranks chapters only, so the routes drop them. */
export type ProductsRow = OmitEach<TradeProductsNationalRow, "headings">;

/** What `/data/trade/products/[code]` serves. */
export interface TradeProductsPayload {
  /** Partner `country_code`, or null for all countries. */
  code: string | null;
  /** One row per (year, flow), 2010 on; the year in progress has `months` < 12. */
  rows: ProductsRow[];
}

/** What `/data/trade/product-partners/[year]` serves: the top countries behind each chapter in one year (both flows). */
export interface ProductPartnersPayload {
  rows: OmitEach<TradeProductsPartnersRow, "headings">[];
  /** Display name for every partner code the rows list. */
  names: Record<string, string>;
}

/** One country in a product's top list. */
export interface PartnerLine {
  code: string;
  name: string;
  /** Exports, or general imports, whole $: the same basis as the product line it sits under. */
  value: number;
  /** Share of the product line's value (the line's all-countries total). */
  share: number;
  /** Imports only: calculated duty / imports for consumption from this country in this product. Null for exports or none for consumption. */
  rate: number | null;
}

export interface ProductLine {
  code: string;
  name: string;
  /** Exports, or general imports (the goods file's basis), whole $. */
  value: number;
  /** Share of the flow's total goods value (special entries included, as in the published total). */
  share: number;
  /** Imports only: calculated duty / imports for consumption. Null for exports or no imports for consumption. */
  rate: number | null;
}

export interface ProductsView {
  year: number;
  months: number;
  flow: ProductsFlow;
  /** All goods, special entries included: the partner's published total for the flow. */
  total: number;
  /** Imports only: overall collected rate (duties / imports for consumption). */
  rate: number | null;
  /** Ordinary chapters (01-97) with trade, largest first. */
  chapters: ProductLine[];
  /** Special headings with trade, largest first, with their labels for this flow. */
  special: { code: string; label: string; value: number }[];
  /** Chapters 98 + 99. */
  specialTotal: number;
}

export const rateOf = (con: number, duties: number) => (con > 0 ? duties / con : null);

/** The view for one year and flow, or null when the payload has no such row. */
export function productsView(payload: TradeProductsPayload, year: number, flow: ProductsFlow): ProductsView | null {
  const r = payload.rows.find((x) => x.year === year && x.flow === flow);
  if (!r) return null;
  const total = r.value;
  const share = (v: number) => (total > 0 ? v / total : 0);
  const line = (t: readonly (string | number)[], name: string): ProductLine => {
    const value = t[1] as number;
    return { code: t[0] as string, name, value, share: share(value), rate: r.flow === "imports" ? rateOf(t[2] as number, t[3] as number) : null };
  };
  const isSpecial = (code: string) => HS_CHAPTERS[code]?.kind === "special";
  const chapters = r.chapters
    .filter((t) => !isSpecial(t[0]) && t[1] > 0)
    .map((t) => line(t, HS_CHAPTERS[t[0]]?.name ?? `Chapter ${t[0]}`))
    .sort((a, b) => b.value - a.value);
  const special = r.special
    .filter((t) => t[1] > 0)
    .map((t) => ({ code: t[0], label: SPECIAL_HEADINGS[t[0]]?.[r.flow] ?? `Special heading ${t[0]}`, value: t[1] }))
    .sort((a, b) => b.value - a.value);
  const specialTotal = r.chapters.filter((t) => isSpecial(t[0])).reduce((a, t) => a + t[1], 0);
  return {
    year: r.year,
    months: r.months,
    flow: r.flow,
    total,
    rate: r.flow === "imports" ? rateOf(r.con_value, r.duties) : null,
    chapters,
    special,
    specialTotal,
  };
}

/**
 * The countries behind one chapter in one year and flow, largest first (at most 5), or null when the payload has no
 * such list (a year or chapter it does not carry). `lineValue` is the chapter's all-countries value.
 */
export function partnersOf(payload: ProductPartnersPayload, year: number, flow: ProductsFlow, code: string, lineValue: number): PartnerLine[] | null {
  const r = payload.rows.find((x) => x.year === year && x.flow === flow);
  const list = r?.chapters[code] as readonly (readonly (string | number)[])[] | undefined;
  return list ? partnerLines(list, payload.names, flow, lineValue) : null;
}

/**
 * One line's top-countries tuples (`[country_code, value]` exports, `[country_code, value, con_value, duties]` imports) as
 * `PartnerLine`s. Shared with the "By use" view (`lib/trade-enduse.ts`), whose partner file uses the same tuples.
 */
export function partnerLines(list: readonly (readonly (string | number)[])[], names: Record<string, string>, flow: ProductsFlow, lineValue: number): PartnerLine[] {
  return list.map((t) => ({
    code: t[0] as string,
    name: names[t[0] as string] ?? (t[0] as string),
    value: t[1] as number,
    share: lineValue > 0 ? (t[1] as number) / lineValue : 0,
    rate: flow === "imports" ? rateOf(t[2] as number, t[3] as number) : null,
  }));
}

/** Whole dollars, compact: "$2.42T", "$412B", "$12.3B", "$450M", "$4.5M", "$12K", "$850". */
export function fmtDollars(v: number): string {
  const a = Math.abs(v);
  const s = v < 0 ? "−" : "";
  if (a >= 1e12) return `${s}$${(a / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${s}$${(a / 1e9).toFixed(a >= 1e11 ? 0 : 1)}B`;
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(a >= 1e8 ? 0 : 1)}M`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(0)}K`;
  return `${s}$${a.toFixed(0)}`;
}

/** A share or rate as a percent: one decimal under 10%, "<0.1%" for a tiny nonzero value, "0%" for none. */
export function fmtPct(r: number): string {
  if (r === 0) return "0%";
  if (r < 0.0005) return "<0.1%";
  const p = r * 100;
  return `${p.toFixed(p < 9.95 ? 1 : 0)}%`; // 9.98% is "10%", not "10.0%"
}

/**
 * The footnote for what a ranking leaves out: "Plus $30.4B in special entries, not ranked as chapters: returned
 * American goods $24.1B, estimated low-value shipments $7.9B, other $0.5B." Names the two largest special entries;
 * null when there are none. `ranked` names what the list ranks ("chapters", or "uses" for the end-use list).
 */
export function specialNote(view: Pick<ProductsView, "special" | "specialTotal">, ranked = "chapters"): string | null {
  if (view.specialTotal <= 0 || view.special.length === 0) return null;
  const named = view.special.slice(0, 2);
  const rest = view.specialTotal - named.reduce((a, s) => a + s.value, 0);
  const parts = named.map((s) => `${lowerFirst(s.label)} ${fmtDollars(s.value)}`);
  if (rest >= 0.005 * view.specialTotal) parts.push(`other ${fmtDollars(rest)}`);
  return `Plus ${fmtDollars(view.specialTotal)} in special entries, not ranked as ${ranked}: ${parts.join(", ")}.`;
}

// "U.S. government imports" keeps its capitals; ordinary labels read mid-sentence in lower case.
const lowerFirst = (s: string) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);

/**
 * A partner whose product data for the year in progress trails the goods file (Census revises the goods file's
 * earlier months before the HS-level API catches up; exports to Canada, 0.76% in 2026 through August). Full years
 * match. `gap` is (product total - goods file) / goods file, so a shortfall is negative.
 */
export interface ProductsLag {
  code: string;
  flow: ProductsFlow;
  year: number;
  gap: number;
}

/** Gaps smaller than this, or on less than $1B of goods, are rounding and go unmentioned. */
export const LAG_MIN = 0.005;
export const LAG_MIN_GOODS = 1e9;

/** The lag for one partner-year-flow, or null when it is within rounding. `goodsMillions` is the goods file's year to date, $M. */
export function lagOf(code: string, row: Pick<ProductsRow, "year" | "months" | "flow" | "value">, goodsMillions: number): ProductsLag | null {
  const goods = goodsMillions * 1e6;
  if (row.months >= 12 || goods < LAG_MIN_GOODS) return null;
  const gap = (row.value - goods) / goods;
  return Math.abs(gap) >= LAG_MIN ? { code, flow: row.flow, year: row.year, gap } : null;
}

/** "January to August 2026" for a year in progress, else the bare year. */
export function periodText(year: number, months: number, monthNames: readonly string[]): string {
  return months < 12 ? `${monthNames[0]} to ${monthNames[months - 1]} ${year}` : String(year);
}

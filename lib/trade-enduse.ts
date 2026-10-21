import type { TradeEnduseNationalRow, TradeEndusePartnersRow } from "./trade-enduse-entities";
import { ENDUSE_LABELS, ENDUSE_SPECIAL } from "./trade-enduse-labels";
import { partnerLines, rateOf, type PartnerLine, type ProductLine, type ProductsFlow, type ProductsView } from "./trade-products";

/**
 * Pure model for the "By use" view of the "What the U.S. trades" card: one partner's (or all countries') goods by
 * Census end-use category (aircraft, computers, semiconductors, cell phones...), for one year and flow. Same shapes
 * as the product view (`lib/trade-products.ts`), so the card draws both with the same rows, panel, table and footnote:
 * the categories are `ProductLine`s, the special entries (minimum-value shipments, returned goods...) are never ranked
 * and go in `special` for the footnote. See docs/TRADE_METHODOLOGY.md ("Goods by use").
 */

/** What `/data/trade/enduse/[code]` serves (`all` for every country together, as for products). */
export interface TradeEndusePayload {
  /** Partner `country_code`, or null for all countries. */
  code: string | null;
  /** One row per (year, flow), 2010 on; the year in progress has `months` < 12. */
  rows: TradeEnduseNationalRow[];
}

/** What `/data/trade/enduse-partners/[year]` serves: the top countries behind each category in one year (both flows). */
export interface EndusePartnersPayload {
  rows: TradeEndusePartnersRow[];
  /** Display name for every partner code the rows list. */
  names: Record<string, string>;
}

export type EnduseView = Pick<ProductsView, "year" | "months" | "flow" | "total" | "rate" | "special" | "specialTotal"> & {
  /** Ranked categories with trade, largest first. `chapter` is the code itself (there is no grouping to highlight). */
  categories: ProductLine[];
};

/** The view for one year and flow, or null when the payload has no such row. */
export function enduseView(payload: TradeEndusePayload, year: number, flow: ProductsFlow): EnduseView | null {
  const r = payload.rows.find((x) => x.year === year && x.flow === flow);
  if (!r) return null;
  const total = r.value;
  const categories = r.categories
    .filter((t) => t[1] > 0)
    .map((t): ProductLine => {
      const t4 = t as readonly (string | number)[];
      return {
        code: t[0],
        name: ENDUSE_LABELS[flow][t[0]] ?? `Category ${t[0]}`,
        value: t[1],
        share: total > 0 ? t[1] / total : 0,
        rate: flow === "imports" ? rateOf(t4[2] as number, t4[3] as number) : null,
        chapter: t[0],
      };
    })
    .sort((a, b) => b.value - a.value);
  const special = r.special
    .filter((t) => t[1] > 0)
    .map((t) => ({ code: t[0], label: ENDUSE_SPECIAL[flow][t[0]] ?? `Special entry ${t[0]}`, value: t[1] }))
    .sort((a, b) => b.value - a.value);
  return {
    year: r.year,
    months: r.months,
    flow: r.flow,
    total,
    rate: r.flow === "imports" ? rateOf(r.con_value, r.duties) : null,
    categories,
    special,
    specialTotal: special.reduce((a, s) => a + s.value, 0),
  };
}

/** The countries behind one category in one year and flow, largest first (at most 5), or null when the payload has no such list. */
export function endusePartnersOf(payload: EndusePartnersPayload, year: number, flow: ProductsFlow, code: string, lineValue: number): PartnerLine[] | null {
  const list = payload.rows.find((x) => x.year === year && x.flow === flow)?.categories[code] as readonly (readonly (string | number)[])[] | undefined;
  return list ? partnerLines(list, payload.names, flow, lineValue) : null;
}

/**
 * Census's five principal end-use groups, the first digit of every end-use code (0 foods ... 4 consumer goods). Group 5
 * ("other goods", 1% of exports or less) and the special entries are not one of them: the chart calls them "other".
 */
export const ENDUSE_GROUPS: readonly { code: string; name: string }[] = [
  { code: "0", name: "Foods, feeds & beverages" },
  { code: "1", name: "Industrial supplies & materials" },
  { code: "2", name: "Capital goods (not cars)" },
  { code: "3", name: "Autos, parts & engines" },
  { code: "4", name: "Consumer goods" },
];

/** The index in `ENDUSE_GROUPS` of a category's group, or -1 for "other goods". */
export const enduseGroupIndex = (code: string) => ENDUSE_GROUPS.findIndex((g) => g.code === code[0]);

/** One column of the by-year chart: the year's flow total split into the five groups, then everything else. */
export interface EnduseYearColumn {
  year: number;
  months: number;
  /** The published flow total for the year, special entries included (the headline above the card). */
  total: number;
  /** Dollars for each of `ENDUSE_GROUPS`, in that order. */
  parts: number[];
  /** Other goods plus the special entries (minimum-value shipments, returned goods). */
  other: number;
}

export interface EnduseSeries {
  years: EnduseYearColumn[];
}

/** The "By use" list over time: for one flow, every year's total split into the five end-use groups and an "other" remainder. */
export function enduseSeries(payload: TradeEndusePayload, flow: ProductsFlow): EnduseSeries {
  const rows = payload.rows.filter((r) => r.flow === flow).sort((a, b) => a.year - b.year);
  return {
    years: rows.map((r) => {
      const parts = ENDUSE_GROUPS.map(() => 0);
      for (const t of r.categories) {
        const g = enduseGroupIndex(t[0]);
        if (g >= 0 && t[1] > 0) parts[g] += t[1];
      }
      return { year: r.year, months: r.months, total: r.value, parts, other: Math.max(0, r.value - parts.reduce((a, v) => a + v, 0)) };
    }),
  };
}

/** One category's dollars for each year of `series` (0 where it has none). */
export function enduseCategoryByYear(payload: TradeEndusePayload, flow: ProductsFlow, series: EnduseSeries, code: string): number[] {
  return series.years.map((y) => payload.rows.find((r) => r.year === y.year && r.flow === flow)?.categories.find((t) => t[0] === code)?.[1] ?? 0);
}

/** The colour of the i-th group; `OTHER_COLOR` is everything else. */
export const enduseColor = (i: number) => `var(--enduse-${i + 1})`;
export const OTHER_COLOR = "color-mix(in oklab, var(--ink-muted) 45%, var(--surface))";

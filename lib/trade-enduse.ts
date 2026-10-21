import type { TradeEnduseNationalRow, TradeEndusePartnersRow } from "./trade-enduse-entities";
import { ENDUSE_LABELS, ENDUSE_SPECIAL } from "./trade-enduse-labels";
import { partnerLines, rateOf, type PartnerLine, type ProductLine, type ProductsFlow, type ProductsView } from "./trade-products";

/**
 * Pure model for the use list of the "What the U.S. trades" card: one partner's (or all countries') goods by Census
 * end-use category (aircraft, computers, semiconductors, cell phones...), for one year and flow. Same shapes as the
 * chapter list (`lib/trade-products.ts`), so the card draws both with the same rows, panel, table and footnote:
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
  /** Ranked categories with trade, largest first. */
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

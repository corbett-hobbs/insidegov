import "server-only";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tradeEnduseNationalRow, tradeEndusePartnersRow, tradeEnduseRow, type TradeEndusePartnersRow } from "./trade-enduse-entities";
import type { TradeEndusePayload } from "./trade-enduse";
import { ALL_PRODUCTS } from "./trade-products";

/**
 * Build-time reader for the goods-by-use files (`pipeline/output/trade_enduse/`, `trade_enduse_national.json`,
 * `trade_enduse_partners.json`), the sibling of `lib/trade-products-data.ts`. Only the static `/data/trade/enduse/[code]`
 * and `/data/trade/enduse-partners/[year]` routes and the page build call it, so the files never ride in a server
 * function (`outputFileTracingExcludes` in next.config.ts). Category names live in `lib/trade-enduse-labels.ts`
 * (about 280 short names, small enough for the client), so the payload carries only codes.
 */

const OUT = join(process.cwd(), "pipeline", "output");
const DIR = join(OUT, "trade_enduse");

/** Partners with an end-use file (the route's static params and the card's "no data" check). */
export function getEnduseCodes(): string[] {
  return readdirSync(DIR)
    .filter((f) => /^[A-Z][A-Z0-9_]{2,15}\.json$/.test(f))
    .map((f) => f.slice(0, -5))
    .sort();
}

/** One partner's rows (or every partner together, for `ALL_PRODUCTS`). Null for an unknown code. */
export function getEndusePayload(code: string): TradeEndusePayload | null {
  if (code === ALL_PRODUCTS) {
    return { code: null, rows: (JSON.parse(readFileSync(join(OUT, "trade_enduse_national.json"), "utf8")) as unknown[]).map((r) => tradeEnduseNationalRow.parse(r)) };
  }
  if (!getEnduseCodes().includes(code)) return null;
  const rows = (JSON.parse(readFileSync(join(DIR, `${code}.json`), "utf8")) as unknown[]).map((r) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { country_code, ...rest } = tradeEnduseRow.parse(r);
    return rest;
  });
  return { code, rows };
}

/** The top countries behind each category, every (year, flow): `trade_enduse_partners.json`. Country names are added by the route. */
export function getEndusePartnerRows(): TradeEndusePartnersRow[] {
  return (JSON.parse(readFileSync(join(OUT, "trade_enduse_partners.json"), "utf8")) as unknown[]).map((r) => tradeEndusePartnersRow.parse(r));
}

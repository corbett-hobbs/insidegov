import "server-only";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tradeProductsNationalRow, tradeProductsPartnersRow, tradeProductsRow } from "./trade-products-entities";
import { ALL_PRODUCTS, type ProductPartnersPayload, type TradeProductsPayload } from "./trade-products";

/**
 * Build-time reader for the goods-by-product files (`pipeline/output/trade_products/`,
 * `trade_products_national.json`). Only the static `/data/trade/products/[code]` route and
 * the page build call it, so the files never ride in a server function
 * (`outputFileTracingExcludes` in next.config.ts keeps them out). The card ranks chapters
 * only, so each row's top headings (still in the files) are dropped here.
 */

const OUT = join(process.cwd(), "pipeline", "output");
const DIR = join(OUT, "trade_products");

/** Partners with a product file (the route's static params and the card's "no data" check), plus `all`. */
export function getProductsCodes(): string[] {
  return readdirSync(DIR)
    .filter((f) => /^[A-Z][A-Z0-9_]{2,15}\.json$/.test(f))
    .map((f) => f.slice(0, -5))
    .sort();
}

/** One partner's rows (or every partner together, for `ALL_PRODUCTS`), chapters only. Null for an unknown code. */
export function getProductsPayload(code: string): TradeProductsPayload | null {
  let rows: TradeProductsPayload["rows"];
  if (code === ALL_PRODUCTS) {
    rows = (JSON.parse(readFileSync(join(OUT, "trade_products_national.json"), "utf8")) as unknown[]).map((r) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { headings, ...rest } = tradeProductsNationalRow.parse(r);
      return rest;
    });
  } else {
    if (!getProductsCodes().includes(code)) return null;
    rows = (JSON.parse(readFileSync(join(DIR, `${code}.json`), "utf8")) as unknown[]).map((r) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { country_code, headings, ...rest } = tradeProductsRow.parse(r);
      return rest;
    });
  }
  return { code: code === ALL_PRODUCTS ? null : code, rows };
}

/** The top countries behind each chapter, every (year, flow): `trade_products_partners.json` without its heading lists. Country names are added by the route. */
export function getProductPartnerRows(): ProductPartnersPayload["rows"] {
  return (JSON.parse(readFileSync(join(OUT, "trade_products_partners.json"), "utf8")) as unknown[]).map((r) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { headings, ...rest } = tradeProductsPartnersRow.parse(r);
    return rest;
  });
}

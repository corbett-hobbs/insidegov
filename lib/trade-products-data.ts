import "server-only";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tradeProductsHeading, tradeProductsNationalRow, tradeProductsPartnersRow, tradeProductsRow, type TradeProductsPartnersRow } from "./trade-products-entities";
import { headingName } from "./trade-hs-headings";
import { ALL_PRODUCTS, type TradeProductsPayload } from "./trade-products";

/**
 * Build-time reader for the goods-by-product files (`pipeline/output/trade_products/`,
 * `trade_products_national.json`, `trade_products_headings.json`). Only the static
 * `/data/trade/products/[code]` route and the page build call it, so the files never
 * ride in a server function (`outputFileTracingExcludes` in next.config.ts keeps them out).
 * Each payload carries the plain-English name of every heading it ranks, so the
 * 1,000-entry names table (`lib/trade-hs-headings.ts`) stays on the server.
 */

const OUT = join(process.cwd(), "pipeline", "output");
const DIR = join(OUT, "trade_products");

let descs: Map<string, string> | null = null;
const censusDescs = () =>
  (descs ??= new Map(
    (JSON.parse(readFileSync(join(OUT, "trade_products_headings.json"), "utf8")) as unknown[]).map((r) => {
      const h = tradeProductsHeading.parse(r);
      return [h.hs, h.census_desc];
    }),
  ));

/** Partners with a product file (the route's static params and the card's "no data" check), plus `all`. */
export function getProductsCodes(): string[] {
  return readdirSync(DIR)
    .filter((f) => /^[A-Z][A-Z0-9_]{2,15}\.json$/.test(f))
    .map((f) => f.slice(0, -5))
    .sort();
}

/** One partner's rows (or every partner together, for `ALL_PRODUCTS`), with heading names. Null for an unknown code. */
export function getProductsPayload(code: string): TradeProductsPayload | null {
  let rows: TradeProductsPayload["rows"];
  if (code === ALL_PRODUCTS) {
    rows = (JSON.parse(readFileSync(join(OUT, "trade_products_national.json"), "utf8")) as unknown[]).map((r) => tradeProductsNationalRow.parse(r));
  } else {
    if (!getProductsCodes().includes(code)) return null;
    rows = (JSON.parse(readFileSync(join(DIR, `${code}.json`), "utf8")) as unknown[]).map((r) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { country_code, ...rest } = tradeProductsRow.parse(r);
      return rest;
    });
  }
  const d = censusDescs();
  const names: Record<string, string> = {};
  for (const r of rows) for (const h of r.headings) names[h[0]] ??= headingName(h[0], d.get(h[0]));
  return { code: code === ALL_PRODUCTS ? null : code, rows, names };
}

/** The top countries behind each chapter and top heading, every (year, flow): `trade_products_partners.json`. Country names are added by the route. */
export function getProductPartnerRows(): TradeProductsPartnersRow[] {
  return (JSON.parse(readFileSync(join(OUT, "trade_products_partners.json"), "utf8")) as unknown[]).map((r) => tradeProductsPartnersRow.parse(r));
}

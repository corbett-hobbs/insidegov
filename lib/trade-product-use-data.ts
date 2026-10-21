import "server-only";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tradeProductsHeading } from "./trade-products-entities";
import { tradeProductUseRow } from "./trade-product-use-entities";
import { headingName } from "./trade-hs-headings";
import type { ProductUsePayload, ProductUseTriple } from "./trade-sankey";

/**
 * Build-time reader for the goods-by-product-and-use files (`pipeline/output/trade_product_use/<year>.json`). Only the
 * static `/data/trade/product-use/[year]` route calls it, so the files never ride in a server function
 * (`outputFileTracingExcludes` in next.config.ts keeps them out). The payload keeps `[hs4, use, value]` only (the
 * card draws no duties) and names every ordinary heading it carries, so the names table stays on the server.
 */

const OUT = join(process.cwd(), "pipeline", "output");
const DIR = join(OUT, "trade_product_use");

/** Years with a file (the route's static params). */
export function getProductUseYears(): number[] {
  return readdirSync(DIR)
    .filter((f) => /^\d{4}\.json$/.test(f))
    .map((f) => Number(f.slice(0, 4)))
    .sort((a, b) => a - b);
}

/** One year's payload, or null for a year with no file. */
export function getProductUsePayload(year: number): ProductUsePayload | null {
  if (!getProductUseYears().includes(year)) return null;
  const rows = (JSON.parse(readFileSync(join(DIR, `${year}.json`), "utf8")) as unknown[]).map((r) => tradeProductUseRow.parse(r));
  const descs = new Map(
    (JSON.parse(readFileSync(join(OUT, "trade_products_headings.json"), "utf8")) as unknown[]).map((r) => {
      const h = tradeProductsHeading.parse(r);
      return [h.hs, h.census_desc];
    }),
  );
  const triple = (t: readonly [string, string, number, ...number[]]): ProductUseTriple => [t[0], t[1], t[2]];
  const flows = {} as ProductUsePayload["flows"];
  const names: Record<string, string> = {};
  let months = 12;
  for (const r of rows) {
    flows[r.flow] = { rows: r.rows.map(triple), special: r.special.map(triple) };
    months = r.months;
    for (const t of r.rows) names[t[0]] ??= headingName(t[0], descs.get(t[0]));
  }
  if (!flows.exports || !flows.imports) return null;
  return { year, months, flows, names };
}

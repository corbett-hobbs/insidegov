import { z } from "zod";

/**
 * Schema for goods trade by product AND use: every Harmonized System heading (HS4) split by the Census end-use
 * category its HS10 lines are filed under, all countries, one file per year. The data behind a chapter -> product ->
 * use Sankey. See docs/TRADE_METHODOLOGY.md ("Goods by product and use"). Same conventions as
 * `lib/trade-products-entities.ts` and `lib/trade-enduse-entities.ts`: whole dollars, tuples to keep the file small.
 *
 * Each row is a tuple, `[hs4, use, ...values]`; the chapter is `hs4.slice(0, 2)`:
 * - exports `[hs4, use, value]`: total exports (domestic + foreign), the goods file's basis.
 * - imports `[hs4, use, value, con_value, duties]`: general imports (the goods file's basis), imports for
 *   consumption and calculated duty (the duties file's basis), so a collected rate is `duties / con_value`.
 *
 * `use` is a 5-digit end-use code, read together with the flow (the same code means different things on exports
 * and imports; names in `lib/trade-enduse-labels.ts`). Heading names: `lib/trade-hs-headings.ts`, chapters
 * `lib/trade-hs-chapters.ts`.
 */

/** First year of the series (the Census API has nothing earlier). */
export const PRODUCT_USE_START_YEAR = 2010;

const year = z.number().int().min(PRODUCT_USE_START_YEAR).max(2100);
const dollars = z.number().int().nonnegative();
const hs4 = z.string().regex(/^\d{4}$/);
const use = z.string().regex(/^\d{5}$/);

const exportsItem = z.tuple([hs4, use, dollars]);
const importsItem = z.tuple([hs4, use, dollars, dollars, dollars]);

const common = {
  year,
  /** 12 = the calendar year. Fewer = the year in progress, and every value is year to date through this month. */
  months: z.number().int().min(1).max(12),
};

const exportsFields = {
  ...common,
  flow: z.literal("exports"),
  /** Sum of `rows` and `special`: all-countries goods exports. */
  value: dollars,
  /** Every ranked (heading, use) pair with trade, ordered by heading, then largest first. */
  rows: z.array(exportsItem),
  /** The special pairs: a special end use (`ENDUSE_SPECIAL`) or a chapter 98/99 heading. Kept in every sum, never ranked. Same order. */
  special: z.array(exportsItem),
};

const importsFields = {
  ...common,
  flow: z.literal("imports"),
  /** Sum of `rows` and `special`: all-countries general imports. */
  value: dollars,
  /** Sum of `rows` and `special`: imports for consumption (customs value). */
  con_value: dollars,
  /** Sum of `rows` and `special`: calculated duty. */
  duties: dollars,
  rows: z.array(importsItem),
  special: z.array(importsItem),
};

/** One (year, flow): `trade_product_use/<year>.json` holds both flows of the year, exports first. */
export const tradeProductUseRow = z.discriminatedUnion("flow", [z.object(exportsFields).strict(), z.object(importsFields).strict()]);
export type TradeProductUseRow = z.infer<typeof tradeProductUseRow>;

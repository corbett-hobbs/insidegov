import { z } from "zod";

/**
 * Schemas for goods trade by product (Harmonized System chapter and heading),
 * by partner and year, from the Census international trade API. See
 * docs/TRADE_METHODOLOGY.md ("Goods by product"). Same track and join key as
 * `lib/trade-entities.ts`: `country_code` from `countries.json`. Chapter names:
 * `lib/trade-hs-chapters.ts`.
 *
 * Values are whole dollars. Each list item is a tuple, to keep the per-country
 * files small:
 * - exports `[code, value]`: total exports (domestic + foreign), the goods file's basis.
 * - imports `[code, value, con_value, duties]`: general imports (the goods file's
 *   basis), imports for consumption and calculated duty (the duties file's basis),
 *   so a collected rate is `duties / con_value`, never `duties / value`.
 */

/** First year of the product series (the Census API has nothing earlier). */
export const PRODUCTS_START_YEAR = 2010;

const year = z.number().int().min(PRODUCTS_START_YEAR).max(2100);
const dollars = z.number().int().nonnegative();
const hs2 = z.string().regex(/^\d{2}$/);
const hs4 = z.string().regex(/^\d{4}$/);

const exportsItem = <T extends z.ZodString>(code: T) => z.tuple([code, dollars]);
const importsItem = <T extends z.ZodString>(code: T) => z.tuple([code, dollars, dollars, dollars]);

const common = {
  year,
  /** 12 = the calendar year. Fewer = the year in progress, and every value is year to date through this month. */
  months: z.number().int().min(1).max(12),
};

const exportsFields = {
  ...common,
  flow: z.literal("exports"),
  /** Sum of `chapters` (every chapter, special ones included): the partner's goods exports. */
  value: dollars,
  /** Every chapter with trade, largest first. Chapters 98 and 99 are special (see `lib/trade-hs-chapters.ts`). */
  chapters: z.array(exportsItem(hs2)),
  /** The top goods headings (chapters 01-97 only), largest first; at most `HEADINGS_PER_ROW`. */
  headings: z.array(exportsItem(hs4)),
  /** Every special heading (chapters 98-99) with trade, largest first: returned goods, low-value estimates. */
  special: z.array(exportsItem(hs4)),
};

const importsFields = {
  ...common,
  flow: z.literal("imports"),
  /** Sum of `chapters`: the partner's general imports. */
  value: dollars,
  /** Sum of `chapters`: imports for consumption (customs value). */
  con_value: dollars,
  /** Sum of `chapters`: calculated duty. */
  duties: dollars,
  chapters: z.array(importsItem(hs2)),
  headings: z.array(importsItem(hs4)),
  special: z.array(importsItem(hs4)),
};

const country_code = z.string().regex(/^[A-Z][A-Z0-9_]{2,15}$/);

/** One (partner, year, flow). Sharded by partner: `trade_products/<country_code>.json`. */
export const tradeProductsRow = z.discriminatedUnion("flow", [
  z.object({ country_code, ...exportsFields }).strict(),
  z.object({ country_code, ...importsFields }).strict(),
]);
export type TradeProductsRow = z.infer<typeof tradeProductsRow>;

/** One (year, flow) for all countries together, from the API's own all-countries row: `trade_products_national.json`. */
export const tradeProductsNationalRow = z.discriminatedUnion("flow", [z.object(exportsFields).strict(), z.object(importsFields).strict()]);
export type TradeProductsNationalRow = z.infer<typeof tradeProductsNationalRow>;

/** Every heading that appears in an output file, with Census's own short description: `trade_products_headings.json`. */
export const tradeProductsHeading = z
  .object({
    hs: hs4,
    chapter: hs2,
    /** Census's short description (upper case, abbreviated; the import schedule's wording where it has one). */
    census_desc: z.string(),
    /** Plain-English labels by flow, for the special headings only (`SPECIAL_HEADINGS` in `lib/trade-hs-chapters.ts`); null otherwise. */
    special_label: z.object({ exports: z.string().nullable(), imports: z.string().nullable() }).strict().nullable(),
  })
  .strict();
export type TradeProductsHeading = z.infer<typeof tradeProductsHeading>;

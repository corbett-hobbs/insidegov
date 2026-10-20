import { z } from "zod";

/**
 * Schemas for goods trade by Census end-use category (aircraft, computers, semiconductors, cell phones...), by
 * partner and year, from the Census international trade API. See docs/TRADE_METHODOLOGY.md ("Goods by use").
 * Same track, join key and value conventions as `lib/trade-products-entities.ts` (the HS chapters and headings):
 * `country_code` from `countries.json`, whole dollars, tuples to keep the per-country files small.
 * Category names: `lib/trade-enduse-labels.ts`.
 *
 * Each list item is a tuple:
 * - exports `[code, value]`: total exports (domestic + foreign), the goods file's basis.
 * - imports `[code, value, con_value, duties]`: general imports (the goods file's basis), imports for
 *   consumption and calculated duty (the duties file's basis), so a collected rate is `duties / con_value`.
 *
 * Codes are 5 digits and mean different things by flow, so a code is only ever read together with its flow.
 */

/** First year of the series (the Census API has nothing earlier). */
export const ENDUSE_START_YEAR = 2010;

const year = z.number().int().min(ENDUSE_START_YEAR).max(2100);
const dollars = z.number().int().nonnegative();
const code = z.string().regex(/^\d{5}$/);

const exportsItem = <T extends z.ZodString>(c: T) => z.tuple([c, dollars]);
const importsItem = <T extends z.ZodString>(c: T) => z.tuple([c, dollars, dollars, dollars]);

const common = {
  year,
  /** 12 = the calendar year. Fewer = the year in progress, and every value is year to date through this month. */
  months: z.number().int().min(1).max(12),
};

const exportsFields = {
  ...common,
  flow: z.literal("exports"),
  /** Sum of `categories` and `special`: the partner's goods exports. */
  value: dollars,
  /** Every ranked category with trade, largest first. */
  categories: z.array(exportsItem(code)),
  /** Every special entry with trade (`ENDUSE_SPECIAL`: minimum-value shipments, returned goods...), largest first. */
  special: z.array(exportsItem(code)),
};

const importsFields = {
  ...common,
  flow: z.literal("imports"),
  /** Sum of `categories` and `special`: the partner's general imports. */
  value: dollars,
  /** Sum of `categories` and `special`: imports for consumption (customs value). */
  con_value: dollars,
  /** Sum of `categories` and `special`: calculated duty. */
  duties: dollars,
  categories: z.array(importsItem(code)),
  special: z.array(importsItem(code)),
};

const country_code = z.string().regex(/^[A-Z][A-Z0-9_]{2,15}$/);

/** One (partner, year, flow). Sharded by partner: `trade_enduse/<country_code>.json`. */
export const tradeEnduseRow = z.discriminatedUnion("flow", [
  z.object({ country_code, ...exportsFields }).strict(),
  z.object({ country_code, ...importsFields }).strict(),
]);
export type TradeEnduseRow = z.infer<typeof tradeEnduseRow>;

/** One (year, flow) for all countries together, from the API's own all-countries row: `trade_enduse_national.json`. */
export const tradeEnduseNationalRow = z.discriminatedUnion("flow", [z.object(exportsFields).strict(), z.object(importsFields).strict()]);
export type TradeEnduseNationalRow = z.infer<typeof tradeEnduseNationalRow>;

/** Every (flow, category) that appears in an output file, with the plain name and Census's own: `trade_enduse_labels.json`. */
export const tradeEnduseLabel = z
  .object({
    flow: z.enum(["exports", "imports"]),
    code,
    /** The hand-written plain name (`lib/trade-enduse-labels.ts`). */
    label: z.string().min(1),
    /** Census's own long description (upper case), from the latest year that carries the code. */
    census_desc: z.string().min(1),
    /** True for the special entries: kept in every sum, never ranked. */
    special: z.boolean(),
  })
  .strict();
export type TradeEnduseLabel = z.infer<typeof tradeEnduseLabel>;

/**
 * The partners behind each category: for one (year, flow), the five countries that sent or took the most of each
 * ranked category, largest first, in the same tuples as the lists above. Exact: every partner's row carries every
 * category it trades, so the ranking is derived from the per-partner rows, not sampled.
 * `trade_enduse_partners.json`, one row per (year, flow).
 */
export const tradeEndusePartnersRow = z.discriminatedUnion("flow", [
  z.object({ ...common, flow: z.literal("exports"), categories: z.record(code, z.array(exportsItem(country_code))) }).strict(),
  z.object({ ...common, flow: z.literal("imports"), categories: z.record(code, z.array(importsItem(country_code))) }).strict(),
]);
export type TradeEndusePartnersRow = z.infer<typeof tradeEndusePartnersRow>;

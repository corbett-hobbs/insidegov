import { z } from "zod";
import { CENSUS_RAW_DIR } from "./census-trade-lib";
import { FLOWS, PRODUCTS_FIRST_YEAR, type Flow } from "./census-products-lib";

/**
 * Goods by Census end-use category by country (`timeseries/intltrade/{exports,imports}/enduse`, COMM_LVL=EU5).
 * Fetched by `census-enduse.ts`; read by `pipeline/transform/trade-enduse.ts`. See docs/TRADE_METHODOLOGY.md
 * ("Goods by use").
 */
export const ENDUSE_RAW_DIR = `${CENSUS_RAW_DIR}/enduse`;
/** Per-call response cache (git-ignored) that makes a fetch resumable. */
export const ENDUSE_CACHE_DIR = `${ENDUSE_RAW_DIR}/_cache`;
/** The end-use data starts in January 2010, like the HS data (2009 returns 204). */
export const ENDUSE_FIRST_YEAR = PRODUCTS_FIRST_YEAR;

export { FLOWS };
export type { Flow };

export const enduseRawPath = (flow: Flow, year: number) => `${ENDUSE_RAW_DIR}/${flow}/${year}.json`;
export const enduseDescPath = `${ENDUSE_RAW_DIR}/descriptions.json`;

/**
 * API variables per flow, the same bases as the HS products files: exports are total exports (domestic +
 * foreign); imports are general imports, imports for consumption and calculated duty. `_YR` is year to date at
 * the month queried, so month 12 is the calendar year.
 */
export const ENDUSE_FLOW_VARS: Record<Flow, { code: string; desc: string; values: string[] }> = {
  exports: { code: "E_ENDUSE", desc: "E_ENDUSE_LDESC", values: ["ALL_VAL_YR"] },
  imports: { code: "I_ENDUSE", desc: "I_ENDUSE_LDESC", values: ["GEN_VAL_YR", "CON_VAL_YR", "CAL_DUT_YR"] },
};

const cty = z.string().regex(/^(-|[1-9]\d{3})$/);
const code = z.string().regex(/^\d{5}$/);
const amount = z.number().int().nonnegative();
const row = z.union([z.tuple([cty, code, amount]), z.tuple([cty, code, amount, amount, amount])]);

/**
 * One (flow, year) of the committed raw snapshot. Rows are `[CTY_CODE, end-use code, ...values]`, whole dollars:
 * exports `[ALL_VAL]`, imports `[GEN_VAL, CON_VAL, CAL_DUT]`. `CTY_CODE` "-" is the API's all-countries row; the API's
 * country groupings (`00xx`) and the unallocated code `1XXX` are not kept. A row with every value zero is omitted.
 * `through_month` is 12 for a full year; for the year in progress it is the latest published month, year to date.
 */
const rawEnduse = z
  .object({
    fetched_at: z.string(),
    flow: z.enum(FLOWS),
    year: z.number().int(),
    through_month: z.number().int().min(1).max(12),
    rows: z.array(row),
  })
  .strict();
export type RawEnduse = z.infer<typeof rawEnduse>;
export type RawEnduseRow = RawEnduse["rows"][number];

export function parseRawEnduse(value: unknown): RawEnduse {
  const r = rawEnduse.parse(value);
  const width = r.flow === "exports" ? 3 : 5;
  for (const x of r.rows) if (x.length !== width) throw new Error(`enduse raw ${r.flow} ${r.year}: row ${JSON.stringify(x)} has ${x.length} cells, expected ${width}`);
  return r;
}

/** Census's own long descriptions (latest year that carries the code), for reference and the labels lookup. */
const rawEnduseDescriptions = z
  .object({
    fetched_at: z.string(),
    exports: z.record(z.string(), z.string()),
    imports: z.record(z.string(), z.string()),
  })
  .strict();
export type RawEnduseDescriptions = z.infer<typeof rawEnduseDescriptions>;

export function parseRawEnduseDescriptions(value: unknown): RawEnduseDescriptions {
  return rawEnduseDescriptions.parse(value);
}

export const sortEnduseRows = (rows: RawEnduseRow[]) =>
  rows.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0] === "-" ? -1 : b[0] === "-" ? 1 : a[0].localeCompare(b[0])));

/** One row per line inside a small object, so a refresh diffs by row in git. */
export function serializeRawEnduse(r: RawEnduse): string {
  const head = { fetched_at: r.fetched_at, flow: r.flow, year: r.year, through_month: r.through_month };
  return `${JSON.stringify(head).slice(0, -1)},\n"rows": ${r.rows.length ? `[\n${r.rows.map((x) => JSON.stringify(x)).join(",\n")}\n]` : "[]"}\n}\n`;
}

import { z } from "zod";
import { CENSUS_RAW_DIR } from "./census-trade-lib";

/**
 * Goods by product (HS chapter and heading) by country, from the Census
 * international trade API (`timeseries/intltrade/{exports,imports}/hs`).
 * Fetched by `census-products.ts`; read by `pipeline/transform/trade-products.ts`.
 */
export const PRODUCTS_RAW_DIR = `${CENSUS_RAW_DIR}/products`;
/** Per-call response cache (git-ignored) that makes a fetch resumable. */
export const PRODUCTS_CACHE_DIR = `${PRODUCTS_RAW_DIR}/_cache`;
/** The API has no HS data before January 2010 (same as duties). */
export const PRODUCTS_FIRST_YEAR = 2010;
/**
 * Goods headings kept per (country, year, flow) in the committed raw files: the
 * top K by value. Full HS4 detail is about 1,240 headings x 230 partners x 17
 * years per flow (over 100 MB), too big to commit; the output keeps fewer
 * (`HEADINGS_PER_ROW` in the transform), so K leaves room to raise that without
 * a refetch. Special headings (chapters 98-99) are always kept, all of them.
 */
export const RAW_HEADINGS_K = 25;
/**
 * The all-countries top goods headings that get a partner ranking (the products card's "Top products" list), and how
 * many partners are kept for each: the API returns every partner for a heading, so these rankings are exact, which
 * the per-partner top-`RAW_HEADINGS_K` lists above cannot give for the lower-ranked headings.
 */
export const RAW_PARTNER_HEADINGS = 25;
export const RAW_PARTNERS_K = 10;

export const FLOWS = ["exports", "imports"] as const;
export type Flow = (typeof FLOWS)[number];

export const productsRawPath = (flow: Flow, year: number) => `${PRODUCTS_RAW_DIR}/${flow}/${year}.json`;
export const productsDescPath = `${PRODUCTS_RAW_DIR}/descriptions.json`;

/** Chapters 98 and 99: U.S. special classification provisions, not a kind of product. */
export const isSpecialHs = (code: string) => code.startsWith("98") || code.startsWith("99");

/**
 * API variables per flow. Exports: total exports (domestic + foreign), the
 * goods file's basis. Imports: general imports (the goods file's basis), plus
 * imports for consumption and calculated duty (the duties file's basis), so a
 * per-chapter collected rate can be derived. `_YR` = year to date at the month
 * queried: month 12 is the calendar year.
 */
export const FLOW_VARS: Record<Flow, { commodity: string; values: string[] }> = {
  exports: { commodity: "E_COMMODITY", values: ["ALL_VAL_YR"] },
  imports: { commodity: "I_COMMODITY", values: ["GEN_VAL_YR", "CON_VAL_YR", "CAL_DUT_YR"] },
};

const cty = z.string().regex(/^(-|[1-9]\d{3})$/);
const amount = z.string().regex(/^\d+$/);
const row = z.union([z.tuple([cty, z.string(), amount]), z.tuple([cty, z.string(), amount, amount, amount])]);

/**
 * One (flow, year) of the committed raw snapshot. Rows are
 * `[CTY_CODE, HS code, ...values]` with the API's own strings, whole dollars:
 * exports `[ALL_VAL]`, imports `[GEN_VAL, CON_VAL, CAL_DUT]`. `CTY_CODE` "-" is
 * the API's all-countries row; the API's aggregate codes (`00xx`, a different
 * numbering from country.xlsx) are not kept.
 *
 * - `chapters`: every HS2 row the API returned (countries and "-").
 * - `headings`: HS4. The "-" row: every heading. Each country: its top
 *   `heading_k` goods headings by value plus every special heading (98xx/99xx).
 *
 * `through_month` is 12 for a full year; for the year in progress it is the
 * latest published month and every value is year to date.
 */
const rawProducts = z
  .object({
    fetched_at: z.string(),
    flow: z.enum(FLOWS),
    year: z.number().int(),
    through_month: z.number().int().min(1).max(12),
    heading_k: z.number().int().positive(),
    chapters: z.array(row),
    headings: z.array(row),
    /**
     * For each of the year's top `RAW_PARTNER_HEADINGS` all-countries goods headings, its top `partners_k` partners
     * (every partner was in the API response, so the ranking is exact): `[CTY_CODE, HS4, ...values]`, heading by
     * heading, largest first. Absent in a snapshot fetched before partner rankings existed.
     */
    partners_k: z.number().int().positive().optional(),
    partners: z.array(row).optional(),
  })
  .strict();
export type RawProducts = z.infer<typeof rawProducts>;
export type RawProductRow = RawProducts["chapters"][number];

export function parseRawProducts(value: unknown): RawProducts {
  const r = rawProducts.parse(value);
  const width = r.flow === "exports" ? 3 : 5;
  for (const x of [...r.chapters, ...r.headings, ...(r.partners ?? [])]) {
    if (x.length !== width) throw new Error(`products raw ${r.flow} ${r.year}: row ${JSON.stringify(x)} has ${x.length} cells, expected ${width}`);
  }
  for (const x of r.chapters) if (!/^\d{2}$/.test(x[1])) throw new Error(`products raw ${r.flow} ${r.year}: bad chapter "${x[1]}"`);
  for (const x of [...r.headings, ...(r.partners ?? [])]) if (!/^\d{4}$/.test(x[1])) throw new Error(`products raw ${r.flow} ${r.year}: bad heading "${x[1]}"`);
  return r;
}

/** Census's own short descriptions (latest year that carries the code), for reference and the headings lookup. */
const rawDescriptions = z
  .object({
    fetched_at: z.string(),
    exports: z.object({ hs2: z.record(z.string(), z.string()), hs4: z.record(z.string(), z.string()) }),
    imports: z.object({ hs2: z.record(z.string(), z.string()), hs4: z.record(z.string(), z.string()) }),
  })
  .strict();
export type RawDescriptions = z.infer<typeof rawDescriptions>;

export function parseRawDescriptions(value: unknown): RawDescriptions {
  return rawDescriptions.parse(value);
}

/** One row per line inside a small object, so a refresh diffs by row in git. */
export function serializeRawProducts(r: RawProducts): string {
  const rows = (a: RawProductRow[]) => (a.length ? `[\n${a.map((x) => JSON.stringify(x)).join(",\n")}\n]` : "[]");
  const head = { fetched_at: r.fetched_at, flow: r.flow, year: r.year, through_month: r.through_month, heading_k: r.heading_k, ...(r.partners_k ? { partners_k: r.partners_k } : {}) };
  return `${JSON.stringify(head).slice(0, -1)},\n"chapters": ${rows(r.chapters)},\n"headings": ${rows(r.headings)}${r.partners ? `,\n"partners": ${rows(r.partners)}` : ""}\n}\n`;
}

/**
 * Keep the "-" row's headings whole; for each country keep its top `k` goods
 * headings by first value (ties broken by code) and every special heading.
 */
export function pruneHeadings(rows: RawProductRow[], k: number): RawProductRow[] {
  const byCty = new Map<string, RawProductRow[]>();
  for (const r of rows) byCty.set(r[0], [...(byCty.get(r[0]) ?? []), r]);
  const out: RawProductRow[] = [];
  for (const [code, list] of byCty) {
    if (code === "-") {
      out.push(...list);
      continue;
    }
    const goods = list.filter((r) => !isSpecialHs(r[1])).sort((a, b) => Number(b[2]) - Number(a[2]) || a[1].localeCompare(b[1]));
    out.push(...goods.slice(0, k), ...list.filter((r) => isSpecialHs(r[1])));
  }
  return sortRows(out);
}

export const sortRows = (rows: RawProductRow[]) => rows.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0] === "-" ? -1 : b[0] === "-" ? 1 : a[0].localeCompare(b[0])));

/** The `n` largest goods headings (chapters 01-97) in the all-countries ("-") rows, by first value; ties by code. */
export function nationalTopHeadings(rows: RawProductRow[], n: number): string[] {
  return rows
    .filter((r) => r[0] === "-" && !isSpecialHs(r[1]))
    .sort((a, b) => Number(b[2]) - Number(a[2]) || a[1].localeCompare(b[1]))
    .slice(0, n)
    .map((r) => r[1]);
}

/** For each heading in `headings`, its `k` largest partner rows (by first value; ties by partner code), in `sortRows` order. */
export function topPartnerRows(rows: RawProductRow[], headings: ReadonlySet<string>, k: number): RawProductRow[] {
  const byHeading = new Map<string, RawProductRow[]>();
  for (const r of rows) if (r[0] !== "-" && headings.has(r[1])) byHeading.set(r[1], [...(byHeading.get(r[1]) ?? []), r]);
  const out: RawProductRow[] = [];
  for (const list of byHeading.values()) out.push(...list.sort((a, b) => Number(b[2]) - Number(a[2]) || a[0].localeCompare(b[0])).slice(0, k));
  return out.sort((a, b) => a[1].localeCompare(b[1]) || Number(b[2]) - Number(a[2]) || a[0].localeCompare(b[0]));
}

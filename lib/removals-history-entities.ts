import { z } from "zod";

/**
 * The INS-era removals series (`pipeline/output/removals_history_{series,report}.json`) and its source catalog
 * (`pipeline/reference/removals-history-catalog.json`): DHS Office of Homeland Security Statistics, Yearbook of
 * Immigration Statistics, Table 39 "DHS Repatriations: Fiscal Years 1892 to 2023", **Removals column only** (never
 * returns, never expulsions, never summed). The newest edition that still carries the table is the source of truth for
 * every number. Rows are stored FY1980 to FY2002, the years before ICE's own series begins (FY2003); the later years are
 * in the report as a comparison with ICE, not as data the page draws. See `docs/IMMIGRATION_SOURCE_NOTES.md` §10.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "ISO date");

export const HISTORY_FIRST_FY = 1980;
/** The last fiscal year before ICE's own series (FY2003 on). */
export const HISTORY_LAST_FY = 2002;
export const historyFiscalYear = z.number().int().gte(HISTORY_FIRST_FY).lte(HISTORY_LAST_FY);

export const removalsHistorySource = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  role: z.enum(["primary", "comparison"]),
  edition: z.number().int().gte(2000),
  title: z.string().min(1),
  url: z.url(),
  /** Snapshot in `pipeline/raw/ohss-removals/`. */
  file: z.string().min(1),
  /** Plain-text extract of the snapshot (`pnpm fetch:ohss-removals`); the transform reads only this. */
  text_file: z.string().min(1),
  as_of: isoDate,
});
export type RemovalsHistorySource = z.infer<typeof removalsHistorySource>;

export const removalsHistoryCatalog = z
  .strictObject({ table: z.literal("Table 39"), sources: z.array(removalsHistorySource).min(2) })
  .refine((c) => c.sources.filter((s) => s.role === "primary").length === 1, "exactly one primary source");

export const removalsHistoryRow = z.strictObject({
  period: historyFiscalYear,
  /** DHS removals (compulsory, confirmed movements out of the U.S. based on a removal order), rounded to tens by DHS. */
  removals: z.number().int().positive().refine((n) => n % 10 === 0, "OHSS rounds Table 39 to the nearest ten"),
  status: z.literal("final"),
  administration_term_id: z.string().min(1),
  blended: z.boolean(),
  administration_days: z.array(z.strictObject({ term_id: z.string().min(1), days: z.number().int().positive() })).min(1),
  source: z.string().min(1),
  source_url: z.url(),
  edition: z.number().int(),
  as_of: isoDate,
});
export type RemovalsHistoryRow = z.infer<typeof removalsHistoryRow>;

const fileHash = z.strictObject({ id: z.string(), path: z.string(), bytes: z.number().int().positive(), sha256: z.string().length(64) });

export const removalsHistoryReport = z.strictObject({
  table: z.string(),
  edition: z.number().int(),
  url: z.url(),
  title: z.string(),
  as_of: isoDate,
  /** Fiscal years the printed table covers, and the first/last stored as rows. */
  table_years: z.strictObject({ first: z.number().int(), last: z.number().int() }),
  first_period: z.number().int(),
  last_period: z.number().int(),
  rows: z.number().int(),
  /** Column headers as printed, in order. */
  columns: z.array(z.string()),
  /** The printed notes the page's labelling rests on, quoted from the extract. */
  quoted_notes: z.array(z.string()),
  /** DHS removals against ICE's headline figure for each year both exist (FY2003 on). */
  ice_comparison: z.array(z.strictObject({ period: z.number().int(), dhs: z.number().int(), ice: z.number().int(), difference: z.number().int() })),
  /** The previous edition (2022) against this one, FY1980 to FY2002: how much a figure moved between editions. */
  edition_revisions: z.strictObject({
    compared_edition: z.number().int(),
    years: z.number().int(),
    changed: z.number().int(),
    max_abs_difference: z.number().int(),
    /** Same comparison for FY2003 to the last common year. */
    later_years: z.strictObject({ changed: z.number().int(), max_abs_difference: z.number().int(), max_abs_year: z.number().int() }),
  }),
  sources: z.array(fileHash),
});
export type RemovalsHistoryReport = z.infer<typeof removalsHistoryReport>;

import { z } from "zod";

/**
 * The legal-immigration track, part one (`pipeline/output/lpr_*.json`): people who became lawful
 * permanent residents ("green cards") and people who naturalized, by fiscal year, from the DHS Office
 * of Homeland Security Statistics (OHSS): the Yearbook of Immigration Statistics (final) and the
 * quarterly Legal Immigration and Adjustment of Status Report (preliminary, newest year only).
 * Keyed by fiscal year; no person key. Joined to presidents through dates, like the enforcement and
 * refugee tracks. The curated part is `pipeline/reference/lpr-catalog.json`: which workbooks, which
 * tables in them, and the restatements found between editions. Every value is machine-read from a
 * workbook snapshot and carries the sheet and cell it came from. See `docs/LPR_METHODOLOGY.md` and
 * `docs/IMMIGRATION_SOURCE_NOTES.md` §8.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "ISO date");
/** Fiscal year, named by the calendar year it ends in. */
export const lprFiscalYear = z.number().int().gte(1900).lte(2100);

/**
 * Major classes of admission, in Yearbook Table 6 order. `other` is every remaining printed class
 * (parolees, children born abroad to residents, cancellation of removal, NACARA, HRIFA, Iraqi and
 * Afghan special immigrants, trafficking and crime victims, "Other"); which printed rows fell into
 * it changes by era (see the notes).
 */
export const LPR_CLASSES = ["immediate_relatives", "family_preference", "employment_preference", "diversity", "refugees", "asylees", "other"] as const;
export const lprClass = z.enum(LPR_CLASSES);
export type LprClass = z.infer<typeof lprClass>;

/** How a person became a permanent resident: arriving from abroad with an immigrant visa, or adjusting status from inside the U.S. */
export const ADMISSION_TYPES = ["new_arrival", "adjustment"] as const;
export const admissionType = z.enum(ADMISSION_TYPES);
export type AdmissionType = z.infer<typeof admissionType>;

export const LPR_METRICS = ["lpr", "naturalizations"] as const;
export const lprMetric = z.enum(LPR_METRICS);
export type LprMetric = z.infer<typeof lprMetric>;

/** What a by-country table's country is: the Yearbook counts by country of birth, the quarterly report by country of nationality. */
export const countryBasis = z.enum(["birth", "nationality"]);
export type CountryBasis = z.infer<typeof countryBasis>;

// ---- curated catalog (pipeline/reference/lpr-catalog.json) ----

export const ohssSource = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  publisher: z.string().min(1),
  /** Download URL of the file. */
  url: z.url(),
  /** The OHSS page that links it. */
  page_url: z.url(),
  /** Snapshot in `pipeline/raw/ohss/`. */
  file: z.string().min(1),
  /** Plain-text extract of the snapshot (`pnpm fetch:ohss`); the transform reads only this. */
  text_file: z.string().min(1),
  /** `html`: an OHSS page kept for the notes' verbatim quotes (definitions, caveats); never read for numbers. */
  kind: z.enum(["xlsx", "zip", "html"]),
  /** Zip only: the workbooks inside to extract (`.xlsx` or Excel 97–2003 `.xls`). */
  members: z.array(z.string().min(1)).min(1).optional(),
  /** Sheets to extract (all when omitted). The quarterly reports' I-94 sheets are left for the visas track. */
  sheets: z.array(z.string().min(1)).min(1).optional(),
  /** Workbooks only (null for a page). */
  edition: z
    .strictObject({
      kind: z.enum(["yearbook", "quarterly"]),
      /** The edition's fiscal year: a Yearbook covers this year and earlier ones; a quarterly report only this one. */
      fy: lprFiscalYear,
    })
    .nullable(),
  /** "Date Posted" on the OHSS listing, where it prints one. */
  posted: isoDate.nullable(),
});
export type OhssSource = z.infer<typeof ohssSource>;

/** How a table is laid out; one reader per layout in `pipeline/transform/lpr.ts`. */
export const TABLE_LAYOUTS = [
  /** Yearbook Table 1: persons obtaining LPR status, 1820 on, in four Year | Number column pairs. */
  "lpr_long",
  /** Yearbook naturalization table (20 or 21): applications, persons naturalized (Total, civilian, military...) by year, 1907 on. */
  "naturalization_long",
  /** Yearbook Table 6: type and major class of admission x ten fiscal years, in TOTAL / ADJUSTMENTS OF STATUS / NEW ARRIVALS sections. */
  "class_by_year",
  /** Yearbook by-country tables (LPR Table 3, naturalizations Table 21/22): REGION then COUNTRY sections x ten fiscal years. */
  "country_by_year",
  /** Quarterly Table 1B: class x Total | Q1–Q4 for all, adjustments and new arrivals. */
  "quarterly_class",
  /** Quarterly Table 1A: country x Total | Q1–Q4 for all, adjustments and new arrivals. */
  "quarterly_country_by_type",
  /** Quarterly Tables 2 and 3: country x Total | Q1–Q4. */
  "quarterly_country",
] as const;

export const ohssTable = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  source: z.string().min(1),
  /** The workbook inside a zip source. */
  member: z.string().min(1).optional(),
  sheet: z.string().min(1),
  /** The title row as printed (verbatim, including any footnote digit OHSS glued to it). A retitled table fails the build. */
  title: z.string().min(1),
  layout: z.enum(TABLE_LAYOUTS),
  metric: z.enum(["lpr", "naturalizations", "refugee_arrivals"]),
  basis: countryBasis.optional(),
  /** 10 where OHSS rounds cells to the nearest ten (here: the FY2024 Yearbook and the quarterly reports from FY2023); null when the table prints exact counts. Checked against every cell. */
  rounding: z.union([z.literal(10), z.null()]),
  /**
   * A documented error in the printed table (mislabelled rows, a dropped value). Such a table is
   * read for its national total only: its classes and countries are never used or compared, and
   * the sum checks that its error breaks are skipped.
   */
  defect: z.string().min(1).optional(),
});
export type OhssTable = z.infer<typeof ohssTable>;

/**
 * Values that differ between two Yearbook editions by more than rounding. The transform lists every
 * such difference; one at the national level (totals, classes, types) fails the build until a
 * restatement here covers it (and a restatement that covers nothing fails too). One entry can cover a
 * systematic revision: a pair of tables, a range of years and a set of series keys.
 */
export const restatement = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  metric: lprMetric,
  /** The two tables compared, in either order. */
  tables: z.tuple([z.string().min(1), z.string().min(1)]),
  fy_start: lprFiscalYear,
  fy_end: lprFiscalYear,
  /** Series keys as the report prints them (`all`, `class:other`, `type:adjustment/class:diversity`), or a prefix ending in `*` (`type:*`). */
  keys: z.array(z.string().min(1)).min(1),
  /** Which table the series uses for these years, and why. */
  used: z.string().min(1),
  /** What changed, as far as the documents say. */
  explanation: z.string().min(1),
});
export type Restatement = z.infer<typeof restatement>;

export const lprNote = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  kind: z.enum(["definition", "era", "caveat", "context", "coverage", "restatement"]),
  /** Which series it applies to; null = all. */
  metric: lprMetric.nullable(),
  fy_start: lprFiscalYear,
  fy_end: lprFiscalYear.nullable(),
  title: z.string().min(1),
  text: z.string().min(1),
  /** Catalog source id the note rests on; null for a note about the data model. */
  source: z.string().min(1).nullable(),
  /** Verbatim from that source's text extract (a footnote, a column header). */
  quote: z.string().min(1).optional(),
});
export type LprNote = z.infer<typeof lprNote>;

export const lprCatalog = z.strictObject({
  retrieved_at: isoDate,
  /** First fiscal year of the national totals (Table 1 and the naturalization table run back to 1820 and 1907). */
  first_fiscal_year: lprFiscalYear,
  sources: z.array(ohssSource).min(1),
  tables: z.array(ohssTable).min(1),
  restatements: z.array(restatement),
  notes: z.array(lprNote),
});
export type LprCatalog = z.infer<typeof lprCatalog>;

// ---- outputs ----

const administrationDays = z.strictObject({ term_id: isoDate, days: z.number().int().positive() });
export const lprStatus = z.enum(["final", "preliminary"]);

/** Where a value came from: the table and its cell (A1 notation). A derived value lists every cell it was computed from. */
const provenance = {
  source: z.string().min(1),
  source_url: z.url(),
  table: z.string().min(1),
  /** "Yearbook FY2024", "Quarterly report FY2025". */
  edition: z.string().min(1),
  member: z.string().nullable(),
  sheet: z.string().min(1),
  cells: z.array(z.string().regex(/^[A-Z]{1,3}\d+$/)).min(1),
  /** `printed`: one cell as printed. `sum`: the sum of the printed classes grouped into this one. `residual`: the printed total minus the printed parts, where a part is withheld ("D"). */
  method: z.enum(["printed", "sum", "residual"]),
  /** Cells rounded to the nearest 10 by OHSS (null: exact). */
  rounding: z.union([z.literal(10), z.null()]),
};

/**
 * `lpr_series.json`: one row per (period, metric, admission_type, class). National totals have
 * both dimensions null. Naturalizations have only the total. Missing years are absent.
 */
export const lprSeriesRow = z.strictObject({
  period: lprFiscalYear,
  period_type: z.literal("fiscal_year"),
  metric: lprMetric,
  /** null = all LPRs. */
  admission_type: admissionType.nullable(),
  /** null = all classes. */
  class: lprClass.nullable(),
  value: z.number().int().nonnegative(),
  status: lprStatus,
  ...provenance,
  as_of: isoDate,
  note_ids: z.array(z.string()),
  administration_term_id: isoDate,
  blended: z.boolean(),
  administration_days: z.array(administrationDays).min(1),
});
export type LprSeriesRow = z.infer<typeof lprSeriesRow>;

/**
 * Non-country buckets in a by-country table, with user-assigned keys:
 *   XOT  All other countries  (OHSS: countries under 10 a year, grouped)
 *   XUN  Unknown              (country not recorded)
 *   XWH  Withheld             (printed total minus every printed row, where OHSS withheld small cells as "D")
 */
export const BUCKET_KEYS = { other: "XOT", unknown: "XUN", withheld: "XWH" } as const;

/** `lpr_by_country.json`: one row per (fy, metric, basis, country_key); rows sum to the year's printed total. */
export const lprCountryRow = z.strictObject({
  fy: lprFiscalYear,
  metric: lprMetric,
  basis: countryBasis,
  /** The trade pipeline's `country_code` (ISO 3166-1 alpha-3, former entities, documented user-assigned codes) or a bucket key. */
  country_key: z.string().regex(/^[A-Z]{3}$/),
  country_name: z.string().min(1),
  kind: z.enum(["country", "other", "unknown", "withheld"]),
  /** Names as printed (more than one when two rows were merged into one key). */
  printed_names: z.array(z.string().min(1)),
  value: z.number().int().nonnegative(),
  status: lprStatus,
  ...provenance,
});
export type LprCountryRow = z.infer<typeof lprCountryRow>;

export const lprNoteRow = lprNote;
export type LprNoteRow = LprNote;

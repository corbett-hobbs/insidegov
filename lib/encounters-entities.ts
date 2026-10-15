import { z } from "zod";

/**
 * The CBP border-encounters track (`pipeline/output/encounters_*.json`) and its curated source catalog
 * (`pipeline/reference/cbp-encounters-catalog.json`). An encounter is one of three things, counted per event, not per
 * person: a Border Patrol (USBP) apprehension between ports of entry, an Office of Field Operations (OFO) inadmissible
 * at a port of entry (both Title 8), or a Title 42 expulsion by either component (March 2020 to May 11, 2023). Keyed by
 * fiscal year (or month), scope, component and authority; no person key. CBP only: never summed with ICE or any other
 * agency's count. Joined to presidents through dates. See `docs/CBP_ENCOUNTERS_METHODOLOGY.md` and
 * `docs/IMMIGRATION_SOURCE_NOTES.md` §9.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "ISO date");
/** Fiscal year, named by the calendar year it ends in. Stored from FY1980, the page's first year. */
export const encountersFiscalYear = z.number().int().gte(1980).lte(2100);

export const ENCOUNTER_SCOPES = ["nationwide", "southwest"] as const;
export const encounterScope = z.enum(ENCOUNTER_SCOPES);
export type EncounterScope = z.infer<typeof encounterScope>;

export const ENCOUNTER_COMPONENTS = ["usbp", "ofo"] as const;
export const encounterComponent = z.enum(ENCOUNTER_COMPONENTS);
export type EncounterComponent = z.infer<typeof encounterComponent>;

export const ENCOUNTER_AUTHORITIES = ["title8", "title42"] as const;
export const encounterAuthority = z.enum(ENCOUNTER_AUTHORITIES);
export type EncounterAuthority = z.infer<typeof encounterAuthority>;

/**
 * How much of the split a year has, nationwide and southwest alike:
 *   usbp_only   Border Patrol apprehensions only (no port-of-entry figures published for the year)
 *   components  Border Patrol and OFO, all Title 8 (before Title 42)
 *   full        Border Patrol and OFO, each split Title 8 / Title 42 (FY2020 on; Title 42 rows only while it applied)
 */
export const encounterDetail = z.enum(["usbp_only", "components", "full"]);
export type EncounterDetail = z.infer<typeof encounterDetail>;

// ---- curated source catalog (pipeline/reference/cbp-encounters-catalog.json) ----

export const cbpSource = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  publisher: z.enum(["CBP", "DHS OHSS"]),
  url: z.url(),
  /** Snapshot in `pipeline/raw/cbp/`. */
  file: z.string().min(1),
  /** Plain-text extract of the snapshot (`pnpm fetch:cbp`); the transform reads only this. */
  text_file: z.string().min(1),
  kind: z.enum(["html", "pdf", "xlsx"]),
  /** Sheets to extract from a workbook (the KHSM citizenship sheets run to 60,000 rows and are not needed). */
  sheets: z.array(z.string().min(1)).min(1).optional(),
  /** `table`: the transform reads values from it. `printed`: curated values with quotes. `cross_check`, `definition`: report and notes only. */
  role: z.enum(["table", "printed", "cross_check", "definition"]),
});
export type CbpSource = z.infer<typeof cbpSource>;

/**
 * A row of figures printed on a CBP page (one per fiscal year), with the verbatim quote that contains them all. Used for
 * the years before the encounters CSVs (FY2015–FY2019 OFO) and for every printed total the gates check.
 */
export const printedRow = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  source: z.string().min(1),
  scope: encounterScope,
  /** `total`: Border Patrol plus OFO, as printed. */
  component: z.enum(["usbp", "ofo", "total"]),
  /** Fiscal year -> value. */
  values: z.record(z.string().regex(/^\d{4}$/), z.number().int().nonnegative()),
  /** Verbatim from the source's text extract; must contain every value. */
  evidence: z.string().min(1),
  /** `series`: these values are the series for those years. `check`: compared with the series only. */
  use: z.enum(["series", "check"]),
});
export type PrintedRow = z.infer<typeof printedRow>;

/** A known disagreement that the overlap gates allow: a misprint, a restatement, or a difference neither source explains. */
export const overlapException = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  kind: z.enum(["misprint", "restatement", "unexplained"]),
  fy: encountersFiscalYear,
  scope: encounterScope,
  component: z.enum(["usbp", "ofo", "total"]),
  /** The sources that disagree (printed-row ids or `ohss`, `usbp-pdf`, `csv`). */
  between: z.array(z.string().min(1)).length(2),
  values: z.array(z.number().int().nonnegative()).length(2),
  /** What is used, and why. */
  resolution: z.string().min(1),
});
export type OverlapException = z.infer<typeof overlapException>;

export const encountersNote = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  kind: z.enum(["definition", "change", "caveat", "coverage"]),
  fy_start: encountersFiscalYear,
  fy_end: encountersFiscalYear.nullable(),
  /** The components whose rows the note is attached to. */
  components: z.array(encounterComponent).min(1),
  title: z.string().min(1),
  text: z.string().min(1),
  /** Catalog source of the quotes; null for a note written from the data itself. */
  source: z.string().min(1).nullable(),
  /** Verbatim from the source's text extract (checked at build time). */
  evidence: z.array(z.string().min(1)),
  /** Where a numbered marker sits on the axis, for a definition change; null for a note that is not a marker. */
  marker: z
    .strictObject({
      date: isoDate,
      /** `month`: the source gives the month only; the date is its first day. */
      precision: z.enum(["day", "month"]),
      /** Short axis label. */
      label: z.string().min(1).max(40),
    })
    .nullable(),
});
export type EncountersNote = z.infer<typeof encountersNote>;

export const cbpCatalog = z.strictObject({
  retrieved_at: isoDate,
  first_fiscal_year: encountersFiscalYear,
  /** First year OHSS publishes OFO figures (KHSM); OFO before this is not published anywhere. */
  ofo_first_fiscal_year: encountersFiscalYear,
  /** First year the series takes OFO from CBP itself (the years between come from OHSS). */
  ofo_cbp_first_fiscal_year: encountersFiscalYear,
  /** Last year read from the USBP history PDFs; the encounters CSVs take over after it. */
  usbp_tables_last_fiscal_year: encountersFiscalYear,
  /** Largest relative difference allowed where two sources overlap (OHSS rounds to tens), as a fraction. */
  overlap_tolerance: z.number().positive().lt(0.05),
  sources: z.array(cbpSource).min(1),
  printed: z.array(printedRow).min(1),
  exceptions: z.array(overlapException),
  notes: z.array(encountersNote).min(1),
});
export type CbpCatalog = z.infer<typeof cbpCatalog>;

/**
 * `pipeline/raw/cbp/encounters-vintages.json`, written by `pnpm fetch:cbp`: the encounters CSVs kept on disk. CBP posts
 * a new file every month covering four fiscal years; one file per range of years is kept (the newest month), so a year
 * that drops out of the newest range is still on disk.
 */
export const encountersVintage = z.strictObject({
  file: z.string().regex(/\.csv$/),
  url: z.url(),
  fy_start: encountersFiscalYear,
  fy_end: encountersFiscalYear,
  /** Last month in the file, as named ("aug"); null for a file posted after its last year ended. */
  through: z.enum(["oct", "nov", "dec", "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep"]).nullable(),
  /** Month CBP posted the file (the `/sites/default/files/<yyyy-mm>/` folder; older files sit under `assets/documents/<yyyy-Mon>/`). */
  posted: z.string().regex(/^\d{4}-\d{2}$/),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
});
export type EncountersVintage = z.infer<typeof encountersVintage>;
export const encountersVintages = z.array(encountersVintage).min(1);

// ---- outputs ----

const administrationDays = z.strictObject({ term_id: isoDate, days: z.number().int().positive() });
export const encountersStatus = z.enum(["final", "preliminary"]);

/** Where a value came from. */
const provenance = {
  /** Catalog source id, or the encounters CSV file name. */
  source: z.string().min(1),
  source_url: z.url(),
  publisher: z.enum(["CBP", "DHS OHSS"]),
  /** `table`: one printed cell. `rows`: the sum of CSV rows. `printed`: a curated page figure with its quote. */
  method: z.enum(["table", "rows", "printed"]),
  /** Human-readable cell or row filter, e.g. "line 1990" or "Fiscal Year 2023, U.S. Border Patrol, Southwest Land Border, Title 8". */
  location: z.string().min(1),
  /** Cells rounded to the nearest 10 by OHSS (null: exact). */
  rounding: z.union([z.literal(10), z.null()]),
};

/**
 * `encounters_series.json`: one row per (period, scope, component, authority). A row exists only where the source
 * publishes the figure: no OFO rows before FY2004, no Title 42 rows outside FY2020–FY2023. There are no total rows: a
 * year's total is the sum of its rows for one scope.
 */
export const encountersSeriesRow = z.strictObject({
  period: encountersFiscalYear,
  period_type: z.literal("fiscal_year"),
  scope: encounterScope,
  component: encounterComponent,
  authority: encounterAuthority,
  value: z.number().int().nonnegative(),
  status: encountersStatus,
  /** Months of the fiscal year included (12 unless the newest year is still in progress). */
  months: z.number().int().min(1).max(12),
  detail: encounterDetail,
  ...provenance,
  as_of: isoDate,
  note_ids: z.array(z.string()),
  /** Administration in office on Sept 30, from administrations.json plus the historical presidents table. */
  administration_term_id: isoDate,
  blended: z.boolean(),
  administration_days: z.array(administrationDays).min(1),
});
export type EncountersSeriesRow = z.infer<typeof encountersSeriesRow>;

/** `encounters_monthly.json`: the same key by month, FY2020 on (the encounters CSVs). */
export const encountersMonthRow = z.strictObject({
  fy: encountersFiscalYear,
  /** YYYY-MM (October is in the prior calendar year). */
  month: z.string().regex(/^\d{4}-\d{2}$/),
  scope: encounterScope,
  component: encounterComponent,
  authority: encounterAuthority,
  value: z.number().int().nonnegative(),
  status: encountersStatus,
  source: z.string().min(1),
});
export type EncountersMonthRow = z.infer<typeof encountersMonthRow>;

export const encountersNoteRow = encountersNote;
export type EncountersNoteRow = EncountersNote;

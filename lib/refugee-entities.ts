import { z } from "zod";

/**
 * The refugee-admissions track (`pipeline/output/refugee_*.json`) and its curated source catalog
 * (`pipeline/reference/refugee-catalog.json`). Two measures per fiscal year: the ceiling the
 * President sets in a Presidential Determination (PD) under INA §207, and the refugees actually
 * admitted through the U.S. Refugee Admissions Program (USRAP), as counted by the State
 * Department's Refugee Processing Center (WRAPS). Keyed by fiscal year; no person key. Joined to
 * presidents through dates, like the enforcement track. See
 * `docs/REFUGEE_ADMISSIONS_METHODOLOGY.md` and `docs/IMMIGRATION_SOURCE_NOTES.md` §6.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "ISO date");
/** Fiscal year, named by the calendar year it ends in. The State Department table starts in FY1975. */
export const refugeeFiscalYear = z.number().int().gte(1975).lte(2100);

/**
 * Comparable regions. The PDs and the State Department tables name Europe differently over time
 * ("Eastern Europe/Soviet Union", "Former Soviet Union/Eastern Europe", "Europe", "NIS/Baltics",
 * "Europe and Central Asia", ...), so every printed label maps to one group here. `unallocated` is
 * a reserve, `private_sector` the privately funded numbers of FY1987–FY1995, `category` an
 * allocation by kind of refugee rather than by region (FY2020, FY2021 before April), `group` a
 * named population (Afrikaners, FY2026–FY2027).
 */
export const REGION_GROUPS = [
  "africa",
  "east_asia",
  "europe",
  "latin_america_caribbean",
  "near_east_south_asia",
  "unallocated",
  "private_sector",
  "category",
  "group",
] as const;
export const regionGroup = z.enum(REGION_GROUPS);
export type RegionGroup = z.infer<typeof regionGroup>;
/** The five geographic groups an admission can belong to. */
export const GEOGRAPHIC_GROUPS = ["africa", "east_asia", "europe", "latin_america_caribbean", "near_east_south_asia"] as const;

// ---- curated source catalog (pipeline/reference/refugee-catalog.json) ----

export const refugeeSource = z.strictObject({
  id: z.string().min(1),
  title: z.string().min(1),
  publisher: z.string().min(1),
  url: z.url(),
  /** Who serves this copy, when it is not the publisher (e.g. the American Presidency Project's copy of the Public Papers). */
  host: z.string().min(1).optional(),
  /** Snapshot in `pipeline/raw/refugee/`. */
  file: z.string().min(1),
  /** Plain-text extract of the snapshot (`pnpm fetch:refugee`); the transform reads only this. */
  text_file: z.string().min(1),
  kind: z.enum(["html", "xlsx"]),
  role: z.enum(["determination", "admissions", "compilation", "cross_check", "policy"]),
});
export type RefugeeSource = z.infer<typeof refugeeSource>;

export const allocation = z.strictObject({
  /** Stable id within the determination, e.g. `africa`, `east_asia_first_asylum`, `religious_persecution`. */
  key: z.string().regex(/^[a-z0-9_]+$/),
  /** The label as printed. */
  label: z.string().min(1),
  region_group: regionGroup,
  /** Equal for a single number; FY2024–FY2025 print ranges ("30,000-50,000"). */
  min: z.number().int().nonnegative(),
  max: z.number().int().nonnegative(),
  /** Verbatim from the source's text extract; must contain `min` and `max`. */
  evidence: z.string().min(1),
  /** Catalog source when not the determination's own (FY2020: the FR text omits the table as an image). */
  source: z.string().min(1).optional(),
});
export type Allocation = z.infer<typeof allocation>;

export const determination = z.strictObject({
  /** The PD number as printed, e.g. "PD 95-1"; "PD 2021-06". */
  id: z.string().min(1),
  fy: refugeeFiscalYear,
  /** Date of the determination (the date in its number line; the White House date where there is none). */
  signed: isoDate,
  kind: z.enum(["annual", "emergency"]),
  source: z.string().min(1),
  /** Federal Register citation, when published there and snapshotted from it. */
  citation: z.string().min(1).nullable(),
  /** Worldwide ceiling in force after this determination. */
  ceiling: z.number().int().positive(),
  /** Verbatim; contains `ceiling`, or `increase` when the document states only the addition. */
  ceiling_evidence: z.string().min(1),
  /** Emergency PDs that add numbers rather than restate the total (FY1988). */
  increase: z.number().int().positive().optional(),
  allocation_basis: z.enum(["region", "category", "group", "none"]),
  /** `replace`: the list is the full allocation after this PD. `add`: it is the increase only. */
  allocation_mode: z.enum(["replace", "add"]).default("replace"),
  allocations: z.array(allocation),
  /** Verbatim allocation wording when the PD allocates to a named group without numbers. */
  allocation_text: z.string().min(1).optional(),
  note_ids: z.array(z.string().min(1)).default([]),
});
export type Determination = z.infer<typeof determination>;

/** Final ceilings from a compilation, for years whose PD text is not snapshotted. */
export const compiledCeiling = z.strictObject({
  fy: refugeeFiscalYear,
  ceiling: z.number().int().positive(),
  /** Verbatim row from the compilation's text extract, e.g. "1981 217,000 159,252". */
  evidence: z.string().min(1),
});

export const policyCountry = z.strictObject({
  /** As printed in the instrument. */
  name: z.string().min(1),
  level: z.enum(["full", "partial", "excluded"]),
});

export const policyEvent = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  instrument: z.string().min(1),
  citation: z.string().min(1).nullable(),
  source: z.string().min(1),
  signed: isoDate,
  /** First day it applied. */
  effective: isoDate,
  /** Last day it applied, when it has ended; null while in effect (as of `status_as_of`). */
  ended: isoDate.nullable(),
  ended_by: z.string().min(1).nullable(),
  kind: z.enum(["program_suspension", "program_resumption", "program_expansion", "entry_restriction", "country_exclusion", "priority"]),
  title: z.string().min(1),
  /** Plain-English summary written for the page; the quotes carry the legal wording. */
  summary: z.string().min(1),
  /** How it touches refugee admissions specifically. */
  refugee_effect: z.string().min(1),
  /** Verbatim quotes from the instrument's text extract. */
  evidence: z.array(z.string().min(1)).min(1),
  countries: z.array(policyCountry),
  status: z.enum(["in_effect", "superseded", "expired", "revoked"]),
  /** Date the status was last checked against the documents in the catalog. */
  status_as_of: isoDate,
});
export type PolicyEvent = z.infer<typeof policyEvent>;

export const refugeeNote = z.strictObject({
  id: z.string().min(1),
  kind: z.enum(["definition", "caveat", "context", "coverage"]),
  fy_start: refugeeFiscalYear,
  fy_end: refugeeFiscalYear.nullable(),
  title: z.string().min(1),
  text: z.string().min(1),
  source: z.string().min(1).nullable(),
});
export type RefugeeNote = z.infer<typeof refugeeNote>;

export const refugeeCatalog = z.strictObject({
  retrieved_at: isoDate,
  sources: z.array(refugeeSource).min(1),
  determinations: z.array(determination).min(1),
  compiled_ceilings: z.strictObject({ source: z.string().min(1), rows: z.array(compiledCeiling) }),
  /** First fiscal year of the output series (admissions are printed from FY1975; the Refugee Act took effect in FY1980). */
  first_fiscal_year: refugeeFiscalYear,
  notes: z.array(refugeeNote),
  policy_events: z.array(policyEvent),
  /**
   * Documents in the Federal Register index (`raw/refugee/fr-refugee-admissions-index.json`) that
   * were read and deliberately left out. Every other indexed document must be a catalog source,
   * or the transform fails: that is how a new or emergency determination gets noticed.
   */
  fr_index_reviewed: z.array(z.strictObject({ document_number: z.string().min(1), reason: z.string().min(1) })),
});
export type RefugeeCatalog = z.infer<typeof refugeeCatalog>;

// ---- outputs ----

const administrationDays = z.strictObject({ term_id: isoDate, days: z.number().int().positive() });
const status = z.enum(["final", "preliminary"]);

/** `refugee_series.json`: one row per fiscal year. */
export const refugeeSeriesRow = z.strictObject({
  period: refugeeFiscalYear,
  period_type: z.literal("fiscal_year"),
  scope: z.literal("usrap"),
  /** Ceiling in force at year end (last determination, or the compilation); null when no source. */
  ceiling: z.number().int().positive().nullable(),
  /** Ceiling set at the start of the year (first determination); null when only the compilation is available. */
  ceiling_initial: z.number().int().positive().nullable(),
  /** True when a later determination (or the compilation) changed the ceiling within the year. */
  ceiling_revised: z.boolean(),
  ceiling_source_kind: z.enum(["determination", "compilation"]).nullable(),
  ceiling_status: status.nullable(),
  /** PD ids for the year, in signing order. */
  determination_ids: z.array(z.string()),
  /** Refugees admitted (State Department, Refugee Processing Center); null while the year has no report. */
  admissions: z.number().int().nonnegative().nullable(),
  admissions_status: status.nullable(),
  /** admissions / ceiling, rounded to 4 places; null if either is missing. */
  share_of_ceiling: z.number().nonnegative().nullable(),
  as_of: isoDate,
  note_ids: z.array(z.string()),
  /** Administration in office on Sept 30 — from administrations.json plus the historical presidents table. */
  administration_term_id: isoDate,
  blended: z.boolean(),
  administration_days: z.array(administrationDays).min(1),
});
export type RefugeeSeriesRow = z.infer<typeof refugeeSeriesRow>;

/** `refugee_determinations.json`: every PD, dated, with its allocations. */
export const refugeeDeterminationRow = z.strictObject({
  id: z.string(),
  fy: refugeeFiscalYear,
  signed: isoDate,
  kind: z.enum(["annual", "emergency"]),
  /** Order within the fiscal year, from 1. */
  sequence: z.number().int().positive(),
  ceiling: z.number().int().positive(),
  /** Ceiling in force before this PD (null for the first of a year). */
  previous_ceiling: z.number().int().positive().nullable(),
  allocation_basis: z.enum(["region", "category", "group", "none"]),
  allocation_mode: z.enum(["replace", "add"]),
  allocations: z.array(z.strictObject({ key: z.string(), label: z.string(), region_group: regionGroup, min: z.number().int(), max: z.number().int() })),
  allocation_text: z.string().nullable(),
  source: z.string(),
  source_url: z.url(),
  citation: z.string().nullable(),
  note_ids: z.array(z.string()),
});
export type RefugeeDeterminationRow = z.infer<typeof refugeeDeterminationRow>;

const range = z.strictObject({ min: z.number().int().nonnegative(), max: z.number().int().nonnegative() });

/** `refugee_regions.json`: one row per (fiscal year, region group) — allocation vs. admissions. */
export const refugeeRegionRow = z.strictObject({
  fy: refugeeFiscalYear,
  region_group: regionGroup,
  /** Sum of the State Department's region columns in the group; null for `unallocated`/`category`/`group`, which admit no one. */
  admissions: z.number().int().nonnegative().nullable(),
  /** From the first PD of the year (replace-mode allocations only). */
  allocation_initial: range.nullable(),
  /** From the allocations in force after the last PD of the year. */
  allocation_final: range.nullable(),
  /** The State Department's year-end regional ceiling (after reallocations), FY2001 on. */
  year_end_ceiling: range.nullable(),
});
export type RefugeeRegionRow = z.infer<typeof refugeeRegionRow>;

/** `refugee_by_country.json`: one row per (fiscal year, country_key), FY2001 on. */
export const refugeeCountryRow = z.strictObject({
  fy: refugeeFiscalYear,
  /** The trade pipeline's `country_code` (ISO 3166-1 alpha-3) or a documented user-assigned code. */
  country_key: z.string().regex(/^[A-Z]{3}$/),
  country_name: z.string().min(1),
  /** Names as the State Department printed them (more than one when two rows were merged). */
  printed_names: z.array(z.string().min(1)).min(1),
  /** Region section the country was printed under that year. */
  region_group: regionGroup,
  admissions: z.number().int().positive(),
  status,
});
export type RefugeeCountryRow = z.infer<typeof refugeeCountryRow>;

/** `refugee_monthly.json`: national admissions by month, FY2001 on. */
export const refugeeMonthRow = z.strictObject({
  fy: refugeeFiscalYear,
  /** YYYY-MM (October is in the prior calendar year). */
  month: z.string().regex(/^\d{4}-\d{2}$/),
  admissions: z.number().int().nonnegative(),
  status,
});
export type RefugeeMonthRow = z.infer<typeof refugeeMonthRow>;

/** `refugee_policy.json`: the dated restriction / suspension table (rules, not counts). */
export const refugeePolicyRow = z.strictObject({
  id: z.string(),
  instrument: z.string(),
  citation: z.string().nullable(),
  signed: isoDate,
  effective: isoDate,
  ended: isoDate.nullable(),
  ended_by: z.string().nullable(),
  kind: policyEvent.shape.kind,
  title: z.string(),
  summary: z.string(),
  refugee_effect: z.string(),
  countries: z.array(z.strictObject({ name: z.string(), country_key: z.string().regex(/^[A-Z]{3}$/), level: policyCountry.shape.level })),
  status: policyEvent.shape.status,
  status_as_of: isoDate,
  source: z.string(),
  source_url: z.url(),
});
export type RefugeePolicyRow = z.infer<typeof refugeePolicyRow>;

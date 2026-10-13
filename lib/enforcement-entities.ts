import { z } from "zod";

/**
 * The immigration-enforcement track's entities (`pipeline/output/enforcement_series.json`,
 * `enforcement_notes.json`) and the curated source catalog
 * (`pipeline/reference/ice-removals-catalog.json`). A time series keyed by
 * `(period, metric, scope, arresting_agency, criminality)` — no `bioguide_id`,
 * no person key. National removals (the page's timeline) is the slice with no
 * breakdown (`isNationalRemovals`). It joins to the rest of the site through
 * dates: each fiscal year is attributed to a presidential tenure (`term_id`
 * into `administrations.json`). See `docs/DATA_CONVENTIONS.md` ("Enforcement
 * track") and `docs/IMMIGRATION_ENFORCEMENT_METHODOLOGY.md`.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "ISO date");
/** Fiscal year, named by the calendar year it ends in (FY2013 = 2012-10-01..2013-09-30). */
export const fiscalYear = z.number().int().gte(2003).lte(2100);

/** `scope` is required with no default, so a future CBP or DHS-wide series cannot be spliced in silently. */
export const ENFORCEMENT_SCOPES = ["ice"] as const;
/**
 * `removals`: ICE removals (returns included from FY2007). `administrative_arrests`: ERO arrests for a civil immigration
 * violation; `at_large_arrests` is the subset made in the community. `detainers_issued`: ERO detainers.
 * `initial_book_ins`: first book-ins to ICE detention. `detention_adp`: average daily population in ICE detention.
 * The order here is the output order.
 */
export const ENFORCEMENT_METRICS = [
  "removals",
  "administrative_arrests",
  "at_large_arrests",
  "detainers_issued",
  "initial_book_ins",
  "detention_adp",
] as const;
export type EnforcementMetric = (typeof ENFORCEMENT_METRICS)[number];

/**
 * The agency that first apprehended the person (ICE's "arresting agency"), not where the removal or detention happened.
 * `cbp` rows are still ICE's own counts (ICE removed or detained someone CBP apprehended), never CBP's figures.
 */
export const ARRESTING_AGENCIES = ["ice", "cbp"] as const;
export type ArrestingAgency = (typeof ARRESTING_AGENCIES)[number];

/**
 * Criminal history as recorded in ICE systems. Two complete schemes, never mixed within a year:
 * `convicted` + `not_convicted` (ICE's reports through FY2015) and `convicted` + `pending_charges` +
 * `other_immigration_violator` (FY2016 on). `convicted_or_pending` is a combined figure printed without the split
 * (FY2025): a partial breakdown with no complement.
 */
export const CRIMINALITY = ["convicted", "not_convicted", "pending_charges", "other_immigration_violator", "convicted_or_pending"] as const;
export type Criminality = (typeof CRIMINALITY)[number];
/** Complete criminality partitions: each sums to its total wherever ICE prints one. */
export const CRIMINALITY_SCHEMES = {
  two_way: ["convicted", "not_convicted"],
  three_way: ["convicted", "pending_charges", "other_immigration_violator"],
} as const satisfies Record<string, readonly Criminality[]>;
/** Criminality figures with no printed complement. Each stands alone and needs a caveat note saying why. */
export const PARTIAL_CRIMINALITY: readonly Criminality[] = ["convicted_or_pending"];

// ---- curated source catalog (pipeline/reference/ice-removals-catalog.json) ----

export const iceSource = z.strictObject({
  id: z.string().min(1),
  title: z.string().min(1),
  publisher: z.string().min(1),
  url: z.url(),
  /** Snapshot in `pipeline/raw/ice/`. */
  file: z.string().min(1),
  /** Plain-text extract of the snapshot (`pnpm fetch:ice`); the transform reads only this. */
  text_file: z.string().min(1),
  kind: z.enum(["pdf", "html", "xlsx"]),
});
export type IceSource = z.infer<typeof iceSource>;

/**
 * Where a bar label sits in a chart. `pdftotext` scatters labels across the page, so the extract alone cannot say
 * which fiscal year or category a label belongs to; `read` records how it was assigned from the rendered PDF page.
 */
const chartRead = z.strictObject({
  /** 1-based page of the source PDF (as `pdftoppm -f` numbers it). */
  page: z.number().int().positive(),
  /** As captioned in the source, e.g. "Figure 26". */
  figure: z.string().min(1),
  /** The bar and segment the value was read from, e.g. "FY2021 bar, lower (ICE) segment". */
  read: z.string().min(1),
});

const quote = z.strictObject({
  source: z.string().min(1),
  /** Verbatim text from the source's text extract (whitespace-insensitive). Must contain the value. */
  evidence: z.string().min(1),
  /** Set when the quote is a chart bar label (see `chartRead`). */
  chart: chartRead.optional(),
});

export const iceYear = z.strictObject({
  fy: fiscalYear,
  value: z.number().int().nonnegative(),
  status: z.enum(["final", "preliminary"]),
  source: z.string().min(1),
  /**
   * `text`: `evidence` is a verbatim quote from the source's text extract.
   * `figure`: the number is read from a chart image (`figure_file`), not
   * checkable by text; corroboration of the neighbouring years in the same
   * chart is what vouches for the reading.
   */
  evidence_kind: z.enum(["text", "figure"]),
  evidence: z.string().min(1),
  figure_file: z.string().min(1).optional(),
  /** Other ICE documents that print the same number. Each is checked like `evidence`. */
  corroboration: z.array(quote).default([]),
  note_ids: z.array(z.string().min(1)).default([]),
});
export type IceYear = z.infer<typeof iceYear>;

/**
 * One figure of a breakdown, or of an ERO metric other than removals. National removals are `years`, never repeated
 * here. Evidence kinds:
 * - `text`: prose or a table; `evidence` is a verbatim quote that contains the value.
 * - `chart_label`: a bar label that is in the text extract (`evidence` contains it) but whose year and category were
 *   assigned by reading the rendered page (`chart` says how).
 * - `figure`: the chart is an image with no text layer; `evidence` is its caption (must be in the extract),
 *   `figure_file` is a snapshot of the rendered page in `pipeline/raw/ice/`, and `chart` says what was read.
 */
export const iceValue = z
  .strictObject({
    fy: fiscalYear,
    metric: z.enum(ENFORCEMENT_METRICS),
    arresting_agency: z.enum(ARRESTING_AGENCIES).nullable().default(null),
    criminality: z.enum(CRIMINALITY).nullable().default(null),
    value: z.number().int().nonnegative(),
    status: z.enum(["final", "preliminary"]),
    source: z.string().min(1),
    evidence_kind: z.enum(["text", "chart_label", "figure"]),
    evidence: z.string().min(1),
    chart: chartRead.optional(),
    figure_file: z.string().min(1).optional(),
    /** Other ICE documents (other vintages) that print the same number. Each is checked like `evidence`. */
    corroboration: z.array(quote).default([]),
    note_ids: z.array(z.string().min(1)).default([]),
  })
  .refine((v) => v.evidence_kind === "text" || v.chart !== undefined, { message: "chart_label and figure values need `chart`" })
  .refine((v) => (v.evidence_kind === "figure") === (v.figure_file !== undefined), { message: "`figure_file` is required for, and only for, figure values" });
export type IceValue = z.infer<typeof iceValue>;

/**
 * A subtotal ICE prints in text for some categories of a breakdown ("81,312 … were convicted criminals or had pending
 * criminal charges"). The named rows must sum to it. These vouch, in text, for the categories of chart labels.
 */
export const iceSumCheck = z.strictObject({
  fy: fiscalYear,
  metric: z.enum(ENFORCEMENT_METRICS),
  arresting_agency: z.enum(ARRESTING_AGENCIES).nullable().default(null),
  criminality: z.array(z.enum(CRIMINALITY)).min(2),
  value: z.number().int().nonnegative(),
  source: z.string().min(1),
  evidence: z.string().min(1),
});

/**
 * A complete breakdown whose parts do not add up to the printed total, and why. Any other mismatch fails the build,
 * and so does an exception whose numbers no longer match the rows.
 */
export const iceSumException = z.strictObject({
  fy: fiscalYear,
  metric: z.enum(ENFORCEMENT_METRICS),
  dimension: z.enum(["arresting_agency", "criminality"]),
  /** The other dimension's value for the slice (null = all). */
  slice: z.string().nullable(),
  parts_sum: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  reason: z.string().min(1),
});

/**
 * A number an ICE document prints that disagrees with the value used (a typo, or another vintage). `evidence` must be
 * in the source and contain `printed`; the report lists each with its resolution. Values are never averaged.
 */
export const iceDisagreement = z.strictObject({
  fy: fiscalYear,
  metric: z.enum(ENFORCEMENT_METRICS),
  arresting_agency: z.enum(ARRESTING_AGENCIES).nullable().default(null),
  criminality: z.enum(CRIMINALITY).nullable().default(null),
  source: z.string().min(1),
  printed: z.number().int().nonnegative(),
  evidence: z.string().min(1),
  used: z.number().int().nonnegative(),
  resolution: z.string().min(1),
});

export const enforcementNote = z.strictObject({
  id: z.string().min(1),
  kind: z.enum(["definition_change", "caveat", "context"]),
  /** First and last fiscal year the note applies to (`fy_end: null` = through the latest year). */
  fy_start: fiscalYear,
  fy_end: fiscalYear.nullable(),
  title: z.string().min(1),
  text: z.string().min(1),
  /** Catalog source id that documents it, or null where the note records general knowledge. */
  source: z.string().min(1).nullable(),
});
export type EnforcementNote = z.infer<typeof enforcementNote>;

export const iceCatalog = z.strictObject({
  /** Date the snapshots were retrieved (`as_of` on every series row). */
  retrieved_at: isoDate,
  sources: z.array(iceSource).min(1),
  /** National removals, one per fiscal year. */
  years: z.array(iceYear).min(1),
  /** Breakdowns of removals, and the other ERO metrics. */
  values: z.array(iceValue),
  sum_checks: z.array(iceSumCheck),
  sum_exceptions: z.array(iceSumException),
  disagreements: z.array(iceDisagreement),
  notes: z.array(enforcementNote),
});
export type IceCatalog = z.infer<typeof iceCatalog>;

// ---- outputs ----

export const administrationDays = z.strictObject({
  /** `term_id` into administrations.json. */
  term_id: isoDate,
  days: z.number().int().positive(),
});

export const enforcementRow = z.strictObject({
  /** Fiscal year (Oct 1 of the prior calendar year – Sep 30). */
  period: fiscalYear,
  period_type: z.literal("fiscal_year"),
  metric: z.enum(ENFORCEMENT_METRICS),
  scope: z.enum(ENFORCEMENT_SCOPES),
  /** null = every arresting agency. */
  arresting_agency: z.enum(ARRESTING_AGENCIES).nullable(),
  /** null = every criminality category. */
  criminality: z.enum(CRIMINALITY).nullable(),
  value: z.number().int().nonnegative(),
  source: z.string().min(1),
  source_url: z.url(),
  /** Retrieval date of the snapshot. */
  as_of: isoDate,
  status: z.enum(["final", "preliminary"]),
  note_ids: z.array(z.string().min(1)),
  /** Administration in office on the year's last day (Sep 30) — computed from administrations.json. */
  administration_term_id: isoDate,
  /** True when the administration changed within the fiscal year. */
  blended: z.boolean(),
  /** Calendar days of the fiscal year under each administration (a Jan 20 day belongs to the incoming one). Not a split of the count. */
  administration_days: z.array(administrationDays).min(1),
});
export type EnforcementRow = z.infer<typeof enforcementRow>;

/** National ICE removals (the page's timeline): removals with no breakdown. */
export const isNationalRemovals = (r: Pick<EnforcementRow, "metric" | "arresting_agency" | "criminality">): boolean =>
  r.metric === "removals" && r.arresting_agency === null && r.criminality === null;

/**
 * `enforcement_report.json`: only the fields the page reads (the transform
 * writes more). Loose on purpose; the invariants the page depends on are
 * asserted in `lib/immigration-derive.ts`.
 */
export const enforcementReport = z.object({
  first_period: fiscalYear,
  last_period: fiscalYear,
  by_status: z.record(z.string(), z.number().int()),
  blended_periods: z.array(fiscalYear),
  corroborated_periods: z.array(fiscalYear),
  single_source_periods: z.array(fiscalYear),
  figure_read_periods: z.array(fiscalYear),
  anchors: z.array(z.object({ period: fiscalYear, value: z.number().int(), ok: z.boolean() })),
  breakdowns: z.object({
    /** Complete breakdowns that may miss their printed total, each with a documented reason. */
    exceptions: z.array(
      z.object({
        period: fiscalYear,
        metric: z.enum(ENFORCEMENT_METRICS),
        dimension: z.enum(["arresting_agency", "criminality"]),
        slice: z.string().nullable(),
        parts_sum: z.number().int(),
        total: z.number().int(),
      }),
    ),
  }),
});
export type EnforcementReport = z.infer<typeof enforcementReport>;

// ---- annual-report freshness ----

/** Days after a fiscal year ends before ICE's locked annual report is expected (its report lands Dec–Jan). */
export const ICE_REPORT_GRACE_DAYS = 60;

/** Newest fiscal year whose end plus the grace period is on or before `today` (YYYY-MM-DD): the year that should be `final` by now. */
export function expectedFinalFiscalYear(today: string): number {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ICE_REPORT_GRACE_DAYS);
  // A fiscal year ends Sep 30 of its own number; Oct 1 onward belongs to the next one.
  return d.getUTCMonth() >= 9 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
}

/** Newest fiscal year the catalog carries as `final`, or null. */
export function latestFinalFiscalYear(years: readonly Pick<IceYear, "fy" | "status">[]): number | null {
  const final = years.filter((y) => y.status === "final").map((y) => y.fy);
  return final.length ? Math.max(...final) : null;
}

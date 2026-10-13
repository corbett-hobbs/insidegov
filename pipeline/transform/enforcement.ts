import {
  ARRESTING_AGENCIES,
  CRIMINALITY,
  CRIMINALITY_SCHEMES,
  ENFORCEMENT_METRICS,
  PARTIAL_CRIMINALITY,
  enforcementRow,
  isNationalRemovals,
  type ArrestingAgency,
  type Criminality,
  type EnforcementMetric,
  type EnforcementNote,
  type EnforcementRow,
  type IceCatalog,
  type IceValue,
  type IceYear,
} from "../../lib/enforcement-entities";
import type { Administration } from "../../lib/executive-orders-entities";
import { termIdForDate } from "../../lib/indicator-derive";

/**
 * Pure logic for the immigration-enforcement track (no I/O; the runner in
 * `enforcement-run.ts` reads the files). Turns the curated catalog + the text
 * extracts of the ICE snapshots into `enforcement_series.json` rows and
 * attributes each fiscal year to a presidential tenure.
 *
 * Every figure in the catalog is CHECKED against the text of the ICE document
 * it cites: the quoted evidence must appear verbatim in the extract and must
 * contain the number. Missing is missing — a year with no ICE-sourced figure
 * is simply absent, never estimated.
 *
 * Breakdowns and the other ERO metrics (`values`) are also checked against
 * each other: a complete breakdown must sum to its printed total (the national
 * series, for removals) unless a `sum_exceptions` entry explains why not,
 * printed subtotals (`sum_checks`) must match their rows, and the two
 * criminality schemes never mix within a year.
 */

export class EnforcementDataError extends Error {}

/**
 * Independent regression anchors: figures ICE published in several documents
 * (the FY2013 report; the FY2023 annual report). If the catalog ever
 * disagrees, either the catalog or a snapshot is wrong.
 */
export const ANCHORS: Readonly<Record<number, number>> = { 2013: 368_644, 2023: 142_580 };

/** Collapse whitespace and typographic punctuation so a quote matches across PDF line breaks. */
export function normalizeText(s: string): string {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The number as it may appear in a source: with thousands separators or plain. */
function numberForms(n: number): string[] {
  return [n.toLocaleString("en-US"), String(n)];
}

/** The number as a whole token: no digit (or comma-digit) on either side, so "65,332, or 27 percent" matches but "165,332" and "65,332,000" do not. */
export function containsNumber(text: string, n: number): boolean {
  return numberForms(n).some((f) => new RegExp(`(?<!\\d|\\d,)${f}(?!\\d|,\\d)`).test(text));
}

/** First/last day of a fiscal year (Oct 1 of the prior calendar year – Sep 30). */
export function fiscalYearBounds(fy: number): { start: string; end: string } {
  return { start: `${fy - 1}-10-01`, end: `${fy}-09-30` };
}

function* daysBetween(start: string, end: string): Generator<string> {
  const d = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`).getTime();
  for (; d.getTime() <= last; d.setUTCDate(d.getUTCDate() + 1)) yield d.toISOString().slice(0, 10);
}

export interface Attribution {
  administration_term_id: string;
  blended: boolean;
  administration_days: { term_id: string; days: number }[];
}

/**
 * A fiscal year belongs to the administration in office on its last day
 * (Sept 30). Also returns the calendar-day share per administration and
 * `blended` (the administration changed within the year). Tenure boundaries
 * come from `administrations.json` via `termIdForDate` — a Jan 20 day belongs
 * to the incoming president, the same rule the executive-orders and economy
 * pages use.
 */
export function attributeFiscalYear(fy: number, administrations: readonly Administration[]): Attribution {
  const { start, end } = fiscalYearBounds(fy);
  const counts = new Map<string, number>();
  for (const day of daysBetween(start, end)) {
    const id = termIdForDate(day, administrations);
    if (id === null) throw new EnforcementDataError(`FY${fy}: ${day} is outside every tenure in administrations.json`);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const lastDay = termIdForDate(end, administrations)!;
  return {
    administration_term_id: lastDay,
    blended: counts.size > 1,
    administration_days: [...counts].map(([term_id, days]) => ({ term_id, days })),
  };
}

/** Value for `fy` in a row of an xlsx text extract (`Total | n | n ...`), keyed by the `FYxxxx | ...` header row. */
export function tableValue(text: string, rowLabel: string, fy: number): number | null {
  const lines = text.split("\n");
  const header = lines.find((l) => l.includes(`FY${fy}`) && /^FY\d{4} \|/.test(l));
  const row = lines.find((l) => l.startsWith(`${rowLabel} |`));
  if (!header || !row) return null;
  const col = header.split(" | ").indexOf(`FY${fy}`);
  const cell = row.split(" | ")[col + 1]; // the row label occupies the first cell
  return col < 0 || cell === undefined ? null : Number(cell);
}

/** One series of `enforcement_series.json`: national removals is `{ removals, null, null }`. */
export type SeriesKey = { metric: EnforcementMetric; arresting_agency: ArrestingAgency | null; criminality: Criminality | null };
type Dimension = "arresting_agency" | "criminality";

export interface BreakdownReport {
  rows: number;
  /** One entry per series (metric × agency × criminality); national removals is reported above, not here. */
  coverage: (SeriesKey & {
    first_period: number;
    last_period: number;
    periods: number[];
    /** Years between first and last with no row: no ICE figure, left absent. */
    missing_periods: number[];
    preliminary_periods: number[];
    by_evidence: Record<string, number>;
    corroborated_periods: number[];
  })[];
  /** Every breakdown set against its total. */
  partitions: {
    period: number;
    metric: EnforcementMetric;
    dimension: Dimension;
    /** The other dimension's value for the slice (null = all). */
    slice: string | null;
    scheme: "agency" | "two_way" | "three_way" | "partial";
    parts_sum: number;
    /** The printed total, or null where ICE prints none (the sum cannot be checked). */
    total: number | null;
    exception: string | null;
  }[];
  exceptions: { period: number; metric: EnforcementMetric; dimension: Dimension; slice: string | null; parts_sum: number; total: number; reason: string }[];
  sum_checks: { period: number; metric: EnforcementMetric; arresting_agency: ArrestingAgency | null; criminality: Criminality[]; value: number; source: string }[];
  disagreements: (SeriesKey & { period: number; source: string; printed: number; used: number; resolution: string })[];
  figure_files: string[];
}

export interface EnforcementBuild {
  /** National removals first, then each breakdown series; within a series, by year. */
  series: EnforcementRow[];
  notes: EnforcementNote[];
  report: {
    first_period: number;
    last_period: number;
    rows: number;
    missing_periods: number[];
    by_status: Record<string, number>;
    blended_periods: number[];
    attribution: { period: number; administration_term_id: string; blended: boolean }[];
    corroborated_periods: number[];
    single_source_periods: number[];
    figure_read_periods: number[];
    anchors: { period: number; value: number; ok: boolean }[];
    breakdowns: BreakdownReport;
  };
}

export interface BuildInput {
  catalog: IceCatalog;
  /** Text extract per source id. */
  texts: ReadonlyMap<string, string>;
  /** Figure snapshot files that exist in pipeline/raw/ice. */
  figureFiles: ReadonlySet<string>;
  administrations: readonly Administration[];
}

function checkQuote(where: string, sourceId: string, evidence: string, value: number, texts: ReadonlyMap<string, string>) {
  const text = texts.get(sourceId);
  if (text === undefined) throw new EnforcementDataError(`${where}: no text extract for source "${sourceId}" (run pnpm fetch:ice)`);
  if (!normalizeText(text).includes(normalizeText(evidence))) {
    throw new EnforcementDataError(`${where}: quoted evidence not found in ${sourceId}: "${evidence.slice(0, 80)}"`);
  }
  if (!containsNumber(normalizeText(evidence), value)) {
    throw new EnforcementDataError(`${where}: evidence from ${sourceId} does not contain ${value.toLocaleString("en-US")}`);
  }
}

function checkCaption(where: string, sourceId: string, caption: string, figureFile: string | undefined, input: BuildInput) {
  const text = input.texts.get(sourceId);
  if (text === undefined || !normalizeText(text).includes(normalizeText(caption))) {
    throw new EnforcementDataError(`${where}: figure caption not found in the source text: "${caption}"`);
  }
  if (!figureFile || !input.figureFiles.has(figureFile)) {
    throw new EnforcementDataError(`${where}: figure snapshot "${figureFile ?? "(none)"}" is missing from pipeline/raw/ice`);
  }
}

function checkYear(y: IceYear, input: BuildInput) {
  const where = `FY${y.fy} (${y.source})`;
  const src = input.catalog.sources.find((s) => s.id === y.source);
  if (!src) throw new EnforcementDataError(`${where}: source is not in the catalog`);
  if (y.evidence_kind === "figure") {
    checkCaption(where, y.source, y.evidence, y.figure_file, input);
  } else if (src.kind === "xlsx") {
    checkQuote(where, y.source, y.evidence, y.value, input.texts);
    const cell = tableValue(input.texts.get(y.source)!, "Total", y.fy);
    if (cell !== y.value) throw new EnforcementDataError(`${where}: the table's Total for FY${y.fy} is ${cell}, catalog says ${y.value}`);
  } else {
    checkQuote(where, y.source, y.evidence, y.value, input.texts);
  }
  for (const c of y.corroboration) checkQuote(`${where} corroboration`, c.source, c.evidence, y.value, input.texts);
}

const keyLabel = (k: SeriesKey) => [k.metric, k.arresting_agency ?? "all agencies", k.criminality ?? "all criminality"].join(" / ");
const sameKey = (a: SeriesKey, b: SeriesKey) => a.metric === b.metric && a.arresting_agency === b.arresting_agency && a.criminality === b.criminality;
const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && b.every((x) => a.includes(x));
const fmt = (n: number) => n.toLocaleString("en-US");

function checkValue(v: IceValue, input: BuildInput) {
  const where = `FY${v.fy} ${keyLabel(v)} (${v.source})`;
  if (!input.catalog.sources.some((s) => s.id === v.source)) throw new EnforcementDataError(`${where}: source is not in the catalog`);
  if (isNationalRemovals(v)) throw new EnforcementDataError(`${where}: national removals belong in \`years\`, not \`values\``);
  if (v.evidence_kind === "figure") checkCaption(where, v.source, v.evidence, v.figure_file, input);
  else checkQuote(where, v.source, v.evidence, v.value, input.texts);
  for (const c of v.corroboration) {
    if (!input.catalog.sources.some((s) => s.id === c.source)) throw new EnforcementDataError(`${where}: corroborating source "${c.source}" is not in the catalog`);
    checkQuote(`${where} corroboration`, c.source, c.evidence, v.value, input.texts);
  }
}

/**
 * Every breakdown against its total: the agency split of each (year, metric) and the criminality split of each
 * (year, metric, agency slice). A complete scheme must sum to the printed total, when there is one, unless a
 * `sum_exceptions` entry explains the difference (an exception that no longer matches the rows fails too). The
 * criminality schemes never mix within a slice; a partial figure (`convicted_or_pending`) stands alone and must
 * carry a caveat note that says why.
 */
function checkPartitions(series: readonly EnforcementRow[], catalog: IceCatalog): BreakdownReport["partitions"] {
  const partitions: BreakdownReport["partitions"] = [];
  const caveats = new Set(catalog.notes.filter((n) => n.kind === "caveat").map((n) => n.id));
  const used = new Set<number>();

  const settle = (p: Omit<BreakdownReport["partitions"][number], "exception">) => {
    const what = `FY${p.period} ${p.metric} by ${p.dimension}${p.slice ? ` (${p.slice})` : ""}`;
    const i = catalog.sum_exceptions.findIndex((e) => e.fy === p.period && e.metric === p.metric && e.dimension === p.dimension && e.slice === p.slice);
    if (i >= 0) {
      const e = catalog.sum_exceptions[i];
      if (e.parts_sum !== p.parts_sum || e.total !== p.total) {
        throw new EnforcementDataError(`${what}: the sum exception says ${fmt(e.parts_sum)} vs ${fmt(e.total)}, the rows give ${fmt(p.parts_sum)} vs ${p.total === null ? "no total" : fmt(p.total)} (stale)`);
      }
      used.add(i);
      partitions.push({ ...p, exception: e.reason });
    } else if (p.total !== null && p.parts_sum !== p.total) {
      throw new EnforcementDataError(`${what}: parts sum to ${fmt(p.parts_sum)}, the total is ${fmt(p.total)}`);
    } else {
      partitions.push({ ...p, exception: null });
    }
  };

  const groups = new Map<string, EnforcementRow[]>();
  for (const r of series) {
    if (r.arresting_agency === null && r.criminality === null) continue;
    const k = `${r.period}|${r.metric}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  for (const rows of groups.values()) {
    const { period, metric } = rows[0];
    const total = (agency: ArrestingAgency | null) =>
      series.find((r) => r.period === period && sameKey(r, { metric, arresting_agency: agency, criminality: null }))?.value ?? null;

    const agencyRows = rows.filter((r) => r.arresting_agency !== null && r.criminality === null);
    if (agencyRows.length) {
      const set = agencyRows.map((r) => r.arresting_agency!);
      if (!sameSet(set, ARRESTING_AGENCIES)) throw new EnforcementDataError(`FY${period} ${metric}: the agency breakdown has [${set}]; it needs ${ARRESTING_AGENCIES.join(" and ")}`);
      settle({ period, metric, dimension: "arresting_agency", slice: null, scheme: "agency", parts_sum: agencyRows.reduce((s, r) => s + r.value, 0), total: total(null) });
    }

    for (const agency of [null, ...ARRESTING_AGENCIES]) {
      const crimRows = rows.filter((r) => r.arresting_agency === agency && r.criminality !== null);
      if (!crimRows.length) continue;
      const set = crimRows.map((r) => r.criminality!);
      const what = `FY${period} ${metric}${agency ? ` (${agency})` : ""}`;
      const parts = crimRows.reduce((s, r) => s + r.value, 0);
      const scheme = (Object.keys(CRIMINALITY_SCHEMES) as (keyof typeof CRIMINALITY_SCHEMES)[]).find((k) => sameSet(set, CRIMINALITY_SCHEMES[k]));
      if (scheme) {
        if (agency !== null && total(agency) === null) throw new EnforcementDataError(`${what}: criminality split of a slice that has no ${agency} total`);
        settle({ period, metric, dimension: "criminality", slice: agency, scheme, parts_sum: parts, total: total(agency) });
      } else if (set.length === 1 && PARTIAL_CRIMINALITY.includes(set[0])) {
        if (!crimRows[0].note_ids.some((id) => caveats.has(id))) throw new EnforcementDataError(`${what}: the partial criminality figure "${set[0]}" needs a caveat note saying why`);
        partitions.push({ period, metric, dimension: "criminality", slice: agency, scheme: "partial", parts_sum: parts, total: total(agency), exception: null });
      } else {
        const schemes = Object.values(CRIMINALITY_SCHEMES).map((x) => x.join(" + ")).join(" or ");
        throw new EnforcementDataError(`${what}: criminality categories [${set}] are not one scheme (${schemes})`);
      }
    }
  }
  catalog.sum_exceptions.forEach((e, i) => {
    if (!used.has(i)) throw new EnforcementDataError(`sum exception FY${e.fy} ${e.metric} by ${e.dimension} matches no breakdown (stale)`);
  });
  return partitions.sort(
    (a, b) => a.period - b.period || ENFORCEMENT_METRICS.indexOf(a.metric) - ENFORCEMENT_METRICS.indexOf(b.metric) || a.dimension.localeCompare(b.dimension) || String(a.slice).localeCompare(String(b.slice)),
  );
}

/** Series order in the output: metric, then agency, then criminality, each as its enum lists them (null first). */
function compareKeys(a: SeriesKey, b: SeriesKey): number {
  const agency = (x: ArrestingAgency | null) => (x === null ? -1 : ARRESTING_AGENCIES.indexOf(x));
  const crim = (x: Criminality | null) => (x === null ? -1 : CRIMINALITY.indexOf(x));
  return (
    ENFORCEMENT_METRICS.indexOf(a.metric) - ENFORCEMENT_METRICS.indexOf(b.metric) ||
    agency(a.arresting_agency) - agency(b.arresting_agency) ||
    crim(a.criminality) - crim(b.criminality)
  );
}

export function buildEnforcement(input: BuildInput): EnforcementBuild {
  const { catalog } = input;
  const sourceIds = new Set<string>();
  for (const s of catalog.sources) {
    if (sourceIds.has(s.id)) throw new EnforcementDataError(`duplicate source id "${s.id}"`);
    sourceIds.add(s.id);
  }
  const noteIds = new Set(catalog.notes.map((n) => n.id));
  if (noteIds.size !== catalog.notes.length) throw new EnforcementDataError("duplicate note id in the catalog");
  for (const n of catalog.notes) {
    if (n.fy_end !== null && n.fy_end < n.fy_start) throw new EnforcementDataError(`note ${n.id}: fy_end before fy_start`);
    if (n.source !== null && !sourceIds.has(n.source)) throw new EnforcementDataError(`note ${n.id}: unknown source "${n.source}"`);
  }

  const row = (y: IceYear | IceValue, key: SeriesKey): EnforcementRow => {
    for (const id of y.note_ids) {
      if (!noteIds.has(id)) throw new EnforcementDataError(`FY${y.fy} ${keyLabel(key)}: unknown note id "${id}"`);
    }
    const src = catalog.sources.find((s) => s.id === y.source)!;
    return enforcementRow.parse({
      period: y.fy,
      period_type: "fiscal_year",
      metric: key.metric,
      scope: "ice",
      arresting_agency: key.arresting_agency,
      criminality: key.criminality,
      value: y.value,
      source: src.title,
      source_url: src.url,
      as_of: catalog.retrieved_at,
      status: y.status,
      note_ids: y.note_ids,
      ...attributeFiscalYear(y.fy, input.administrations),
    });
  };

  // --- national removals ---
  const national: EnforcementRow[] = [];
  for (const y of catalog.years) {
    checkYear(y, input);
    national.push(row(y, { metric: "removals", arresting_agency: null, criminality: null }));
  }
  national.sort((a, b) => a.period - b.period);

  const seen = new Set<number>();
  for (const [i, r] of national.entries()) {
    if (seen.has(r.period)) throw new EnforcementDataError(`duplicate (period, metric, scope): FY${r.period} removals ice`);
    seen.add(r.period);
    if (i > 0 && r.period <= national[i - 1].period) throw new EnforcementDataError(`periods are not strictly increasing at FY${r.period}`);
    if (r.value < 0) throw new EnforcementDataError(`FY${r.period}: negative value`);
    // The fiscal year still in progress at retrieval (or later) can only be preliminary.
    if (fiscalYearBounds(r.period).end >= r.as_of && r.status !== "preliminary") {
      throw new EnforcementDataError(`FY${r.period}: ends on or after ${r.as_of} (in progress) but status is "${r.status}"`);
    }
  }
  const anchors = Object.entries(ANCHORS).map(([p, value]) => {
    const r = national.find((x) => x.period === Number(p));
    return { period: Number(p), value, ok: r?.value === value };
  });
  const bad = anchors.find((a) => !a.ok);
  if (bad) throw new EnforcementDataError(`FY${bad.period}: expected ICE's published ${fmt(bad.value)}, got ${national.find((r) => r.period === bad.period)?.value ?? "no row"}`);

  // --- breakdowns and the other ERO metrics ---
  const keys = new Set<string>();
  const breakdown: EnforcementRow[] = [];
  for (const v of catalog.values) {
    const key: SeriesKey = { metric: v.metric, arresting_agency: v.arresting_agency, criminality: v.criminality };
    const id = `${v.fy}|${keyLabel(key)}`;
    if (keys.has(id)) throw new EnforcementDataError(`duplicate (period, metric, scope, arresting_agency, criminality): FY${v.fy} ${keyLabel(key)}`);
    keys.add(id);
    checkValue(v, input);
    const nat = national.find((r) => r.period === v.fy);
    if (!nat) throw new EnforcementDataError(`FY${v.fy} ${keyLabel(key)}: outside the national series`);
    // A year ICE has not locked (preliminary in the national series) is preliminary in every series, and only that year.
    if (v.status !== nat.status) throw new EnforcementDataError(`FY${v.fy} ${keyLabel(key)}: status "${v.status}" but the year is "${nat.status}" in the national series`);
    breakdown.push(row(v, key));
  }
  breakdown.sort((a, b) => compareKeys(a, b) || a.period - b.period);
  const series = [...national, ...breakdown];

  const partitions = checkPartitions(series, catalog);

  const sumChecks = catalog.sum_checks.map((c) => {
    const where = `sum check FY${c.fy} ${c.metric} [${c.criminality.join(" + ")}] (${c.source})`;
    checkQuote(where, c.source, c.evidence, c.value, input.texts);
    const sum = c.criminality.reduce((s, crim) => {
      const r = series.find((x) => x.period === c.fy && sameKey(x, { metric: c.metric, arresting_agency: c.arresting_agency, criminality: crim }));
      if (!r) throw new EnforcementDataError(`${where}: no ${crim} row`);
      return s + r.value;
    }, 0);
    if (sum !== c.value) throw new EnforcementDataError(`${where}: the rows sum to ${fmt(sum)}, ICE prints ${fmt(c.value)}`);
    return { period: c.fy, metric: c.metric, arresting_agency: c.arresting_agency, criminality: c.criminality, value: c.value, source: c.source };
  });

  const disagreements = catalog.disagreements.map((d) => {
    const key: SeriesKey = { metric: d.metric, arresting_agency: d.arresting_agency, criminality: d.criminality };
    const where = `disagreement FY${d.fy} ${keyLabel(key)} (${d.source})`;
    checkQuote(where, d.source, d.evidence, d.printed, input.texts);
    const r = series.find((x) => x.period === d.fy && sameKey(x, key));
    if (!r) throw new EnforcementDataError(`${where}: no row`);
    if (r.value !== d.used) throw new EnforcementDataError(`${where}: says ${fmt(d.used)} is used, the row is ${fmt(r.value)}`);
    if (d.printed === d.used) throw new EnforcementDataError(`${where}: printed and used agree, so it is not a disagreement`);
    return { period: d.fy, ...key, source: d.source, printed: d.printed, used: d.used, resolution: d.resolution };
  });

  const coverage: BreakdownReport["coverage"] = [];
  for (const r of breakdown) {
    if (coverage.some((c) => sameKey(c, r))) continue;
    const vals = catalog.values.filter((v) => sameKey(v, r)).sort((a, b) => a.fy - b.fy);
    const periods = vals.map((v) => v.fy);
    const missing: number[] = [];
    for (let p = periods[0]; p <= periods[periods.length - 1]; p++) if (!periods.includes(p)) missing.push(p);
    const byEvidence: Record<string, number> = {};
    for (const v of vals) byEvidence[v.evidence_kind] = (byEvidence[v.evidence_kind] ?? 0) + 1;
    coverage.push({
      metric: r.metric,
      arresting_agency: r.arresting_agency,
      criminality: r.criminality,
      first_period: periods[0],
      last_period: periods[periods.length - 1],
      periods,
      missing_periods: missing,
      preliminary_periods: vals.filter((v) => v.status === "preliminary").map((v) => v.fy),
      by_evidence: byEvidence,
      corroborated_periods: vals.filter((v) => v.corroboration.length > 0).map((v) => v.fy),
    });
  }

  const periods = national.map((r) => r.period);
  const first = periods[0];
  const last = periods[periods.length - 1];
  const missing: number[] = [];
  for (let p = first; p <= last; p++) if (!seen.has(p)) missing.push(p);

  const byStatus: Record<string, number> = {};
  for (const r of national) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  const yearOf = new Map(catalog.years.map((y) => [y.fy, y]));

  return {
    series,
    notes: [...catalog.notes].sort((a, b) => a.fy_start - b.fy_start || a.id.localeCompare(b.id)),
    report: {
      first_period: first,
      last_period: last,
      rows: national.length,
      missing_periods: missing,
      by_status: byStatus,
      blended_periods: national.filter((r) => r.blended).map((r) => r.period),
      attribution: national.map((r) => ({ period: r.period, administration_term_id: r.administration_term_id, blended: r.blended })),
      corroborated_periods: periods.filter((p) => yearOf.get(p)!.corroboration.length > 0),
      single_source_periods: periods.filter((p) => yearOf.get(p)!.corroboration.length === 0),
      figure_read_periods: periods.filter((p) => yearOf.get(p)!.evidence_kind === "figure"),
      anchors,
      breakdowns: {
        rows: breakdown.length,
        coverage,
        partitions,
        exceptions: catalog.sum_exceptions.map((e) => ({ period: e.fy, metric: e.metric, dimension: e.dimension, slice: e.slice, parts_sum: e.parts_sum, total: e.total, reason: e.reason })),
        sum_checks: sumChecks,
        disagreements,
        figure_files: [...new Set(catalog.values.flatMap((v) => (v.figure_file ? [v.figure_file] : [])))].sort(),
      },
    },
  };
}

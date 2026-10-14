import {
  ARRESTING_AGENCIES,
  CRIMINALITY_SCHEMES,
  PARTIAL_CRIMINALITY,
  isNationalRemovals,
  type ArrestingAgency,
  type Criminality,
  type EnforcementMetric,
  type EnforcementNote,
  type EnforcementReport,
  type EnforcementRow,
} from "./enforcement-entities";
import type { Administration } from "./executive-orders-entities";
import { criminalityBars, criminalityYMax, type AgencyView, type CrimBar } from "./immigration-breakdown";

/**
 * Pure shaping for /presidency/immigration: ICE removals by fiscal year joined
 * to presidents, notes and the report's corroboration flags. No I/O (the reader
 * is `lib/immigration-data.ts`), so it is unit-tested over the real files.
 */

export type IceParty = "D" | "R";

export interface IceTerm {
  termId: string;
  /** "Donald Trump" */
  president: string;
  /** "Trump" */
  last: string;
  party: IceParty;
  startYear: number;
  /** Year the term ends (the successor's inauguration year), or null while in office. */
  endYear: number | null;
}

export interface IceCardNote {
  id: string;
  title: string;
  text: string;
}

export interface IceYear {
  /** Fiscal year, named by the calendar year it ends in. */
  fy: number;
  value: number;
  status: "final" | "preliminary";
  termId: string;
  party: IceParty;
  blended: boolean;
  /** Calendar days under each administration; more than one entry only for blended years. */
  days: { termId: string; last: string; days: number }[];
  corroborated: boolean;
  figureRead: boolean;
  /**
   * Removals by the agency that first apprehended the person: ICE's own officers, or Border Patrol (CBP) who handed the
   * person to ICE. ICE's count either way; the two add up to `value`. Null where ICE prints no split (FY2003–FY2007, FY2025).
   */
  agency: { ice: number; cbp: number } | null;
  /** Average daily population in ICE detention, with the agency split where ICE prints one; null before FY2018. */
  detention: { value: number; status: "final" | "preliminary"; ice: number | null; cbp: number | null } | null;
  source: string;
  sourceUrl: string;
  /** Notes shown on this year's card: not covered by a numbered marker, not the global Oct 5 lock note. */
  cardNotes: IceCardNote[];
}

export interface IceMarker {
  n: number;
  /** First day the marker refers to (ISO). */
  date: string;
  /** Exclusive end of a shaded span (ISO), when the change covers a period. */
  end?: string;
  title: string;
  text: string;
  /** Notes in `enforcement_notes.json` this marker stands for. */
  noteIds: string[];
}

/**
 * The five definition-change markers. The notes only give fiscal-year
 * granularity, so the positions are curated here (docs/IMMIGRATION_ENFORCEMENT_METHODOLOGY.md).
 * Title 42's start is approximate to the month.
 */
export const ICE_MARKERS: readonly IceMarker[] = [
  {
    n: 1,
    date: "2003-03-01",
    title: "FY2003 · ICE is created",
    text: "ICE began operating March 1, 2003, so FY2003 is a part-year count.",
    noteIds: ["ice-formed-fy2003"],
  },
  {
    n: 2,
    date: "2006-10-01",
    title: "FY2007 · returns start counting",
    text: "From FY2007 ICE’s count includes returns. Part of the FY2006 to FY2007 jump is a change in what is counted, not only in enforcement.",
    noteIds: ["removals-exclude-returns-pre-fy2007", "removals-include-returns"],
  },
  {
    n: 3,
    date: "2013-06-01",
    title: "June 2013 · returns shift to Border Patrol",
    text: "Returns without an ICE intake, recorded on or after June 1, 2013, are no longer ICE removals.",
    noteIds: ["cbp-handoff-june-2013"],
  },
  {
    n: 4,
    date: "2020-03-01",
    end: "2023-05-12",
    title: "March 2020–May 2023 · Title 42",
    text: "Public-health expulsions are not removals, which pulls FY2020 to FY2023 down against earlier years. Shading is approximate to the month.",
    noteIds: ["title42-expulsions-excluded"],
  },
  {
    n: 5,
    date: "2023-05-12",
    title: "May 12, 2023 · ICE Air flights counted",
    text: "Border Patrol expedited removals flown by ICE Air are counted as ICE removals from this date.",
    noteIds: ["ice-air-expedited-removal-2023"],
  },
];

/** Notes that live in the page footnote instead of on a bar's card. */
const GLOBAL_NOTE_IDS = ["oct5-lock-and-lag"];

/** Removals before this fiscal year leave out returns (hatched). */
export const RETURNS_COUNTED_FROM = 2007;

export interface ImmigrationPageData {
  years: IceYear[];
  /** Presidents with at least one fiscal year, oldest first. */
  terms: IceTerm[];
  markers: readonly IceMarker[];
  /** Fixed chart ceiling, from the whole series. */
  yMax: number;
  firstFy: number;
  lastFy: number;
  finalCount: number;
  corroboratedCount: number;
  /** ISO date the snapshots were retrieved. */
  asOf: string;
  /** Removals by criminal history in three views (everyone, first arrested by ICE, first arrested by Border Patrol) on one fixed count scale. */
  criminality: { views: Record<AgencyView, CrimBar[]>; yMax: number };
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
/** Days in fiscal year `fy` (Oct 1 of fy-1 through Sep 30): 366 when it contains Feb 29. */
export const fiscalYearDays = (fy: number) => (isLeap(fy) ? 366 : 365);

/** ceil(series max x 1.08 / 20,000) x 20,000: computed from the whole series so it never moves with a selection. */
export function yDomainMax(values: readonly number[]): number {
  return Math.ceil((Math.max(...values) * 1.08) / 20_000) * 20_000;
}

/**
 * Throws, loudly, if the series stops matching what the page was built around.
 * Run at build time by the reader and over the real files in the unit tests.
 */
export function assertEnforcementInvariants(
  allRows: readonly EnforcementRow[],
  report: EnforcementReport,
  admins: readonly Administration[],
): void {
  const fail = (msg: string): never => {
    throw new Error(`enforcement invariant: ${msg}`);
  };
  const rows = allRows.filter(isNationalRemovals);
  if (rows.length === 0) fail("no rows");
  const periods = rows.map((r) => r.period);
  const first = periods[0];
  periods.forEach((p, i) => {
    if (p !== first + i) fail(`periods not contiguous at ${p}`);
  });
  if (first !== 2003) fail(`series starts at ${first}, expected 2003`);
  const prelim = rows.filter((r) => r.status === "preliminary").map((r) => r.period);
  if (prelim.length > 1 || (prelim.length === 1 && prelim[0] !== periods[periods.length - 1])) fail(`only the latest year may be preliminary, got [${prelim}]`);
  for (const r of rows) {
    const total = r.administration_days.reduce((s, d) => s + d.days, 0);
    if (total !== fiscalYearDays(r.period)) fail(`FY${r.period} days sum to ${total}`);
    const majority = [...r.administration_days].sort((a, b) => b.days - a.days)[0].term_id;
    if (majority !== r.administration_term_id) fail(`FY${r.period} majority term ${majority} != ${r.administration_term_id}`);
    if (r.blended !== r.administration_days.length > 1) fail(`FY${r.period} blended flag disagrees with its days`);
    if (!admins.some((a) => a.term_id === r.administration_term_id)) fail(`FY${r.period} term ${r.administration_term_id} is not in administrations.json`);
  }
  const blended = rows.filter((r) => r.blended).map((r) => r.period);
  if (blended.join() !== [...report.blended_periods].sort().join()) fail("report.blended_periods differs from rows with blended: true");
  const anchors = new Map(report.anchors.map((a) => [a.period, a]));
  for (const p of [2013, 2023]) {
    const a = anchors.get(p);
    if (!a?.ok) fail(`report anchor FY${p} missing or not ok`);
    if (rows.find((r) => r.period === p)?.value !== a?.value) fail(`FY${p} value differs from the report anchor`);
  }
  assertBreakdownInvariants(allRows, report);
}

// ---- breakdowns (removals by arresting agency and criminality; arrests, detainers, book-ins, detention) ----

/** A series of `enforcement_series.json`; omitted dimensions mean "all" (null). */
export interface SeriesSelector {
  metric: EnforcementMetric;
  arresting_agency?: ArrestingAgency | null;
  criminality?: Criminality | null;
}

const matches = (r: EnforcementRow, s: SeriesSelector) =>
  r.metric === s.metric && r.arresting_agency === (s.arresting_agency ?? null) && r.criminality === (s.criminality ?? null);

/** One series by fiscal year, oldest first. Years ICE prints no figure for are absent, never zero. */
export function seriesValues(rows: readonly EnforcementRow[], s: SeriesSelector): { fy: number; value: number; status: "final" | "preliminary" }[] {
  return rows
    .filter((r) => matches(r, s))
    .map((r) => ({ fy: r.period, value: r.value, status: r.status }))
    .sort((a, b) => a.fy - b.fy);
}

export type CriminalityScheme = keyof typeof CRIMINALITY_SCHEMES | "partial";

/**
 * How a year's criminality is split for one metric (and agency slice): `two_way` (convicted / not convicted, through
 * FY2015), `three_way` (convicted / pending charges / other immigration violator), `partial` (only a combined
 * convicted-or-pending figure, FY2025), or null when ICE prints no criminality for that year.
 */
export function criminalityScheme(
  rows: readonly EnforcementRow[],
  fy: number,
  metric: EnforcementMetric,
  agency: ArrestingAgency | null = null,
): CriminalityScheme | null {
  const set = rows.filter((r) => r.period === fy && r.metric === metric && r.arresting_agency === agency && r.criminality !== null).map((r) => r.criminality!);
  if (!set.length) return null;
  for (const [k, cats] of Object.entries(CRIMINALITY_SCHEMES) as [keyof typeof CRIMINALITY_SCHEMES, readonly Criminality[]][]) {
    if (set.length === cats.length && cats.every((c) => set.includes(c))) return k;
  }
  if (set.length === 1 && PARTIAL_CRIMINALITY.includes(set[0])) return "partial";
  throw new Error(`enforcement invariant: FY${fy} ${metric}${agency ? ` (${agency})` : ""} mixes criminality schemes [${set}]`);
}

/**
 * The breakdown rows a page can rely on: every year is in the national series with the same status; agency splits
 * are complete; criminality never mixes schemes; complete splits sum to their totals (exactly, unless the report
 * lists the slice as a documented exception, e.g. rounded detention averages). The transform checks the same and
 * more; this re-asserts it at build time over the committed files.
 */
export function assertBreakdownInvariants(allRows: readonly EnforcementRow[], report: EnforcementReport): void {
  const fail = (msg: string): never => {
    throw new Error(`enforcement invariant: ${msg}`);
  };
  const national = new Map(allRows.filter(isNationalRemovals).map((r) => [r.period, r]));
  const breakdown = allRows.filter((r) => !isNationalRemovals(r));
  const total = (period: number, metric: EnforcementMetric, agency: ArrestingAgency | null) =>
    allRows.find((r) => r.period === period && r.metric === metric && r.arresting_agency === agency && r.criminality === null)?.value ?? null;
  const excused = (period: number, metric: EnforcementMetric, dimension: string, slice: string | null, parts: number, tot: number) =>
    report.breakdowns.exceptions.some((e) => e.period === period && e.metric === metric && e.dimension === dimension && e.slice === slice && e.parts_sum === parts && e.total === tot);

  const seen = new Set<string>();
  for (const r of breakdown) {
    const nat = national.get(r.period);
    if (!nat) fail(`FY${r.period} ${r.metric} has no national removals row`);
    if (nat!.status !== r.status) fail(`FY${r.period} ${r.metric} status ${r.status} differs from the national ${nat!.status}`);
    const k = `${r.period}|${r.metric}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const yearRows = breakdown.filter((x) => x.period === r.period && x.metric === r.metric);
    const agencyRows = yearRows.filter((x) => x.arresting_agency !== null && x.criminality === null);
    if (agencyRows.length) {
      if (agencyRows.length !== ARRESTING_AGENCIES.length) fail(`FY${r.period} ${r.metric} agency split is incomplete`);
      const parts = agencyRows.reduce((s, x) => s + x.value, 0);
      const tot = total(r.period, r.metric, null);
      if (tot !== null && parts !== tot && !excused(r.period, r.metric, "arresting_agency", null, parts, tot)) fail(`FY${r.period} ${r.metric} agencies sum to ${parts}, total ${tot}`);
    }
    for (const agency of [null, ...ARRESTING_AGENCIES]) {
      const scheme = criminalityScheme(allRows, r.period, r.metric, agency);
      if (scheme === null || scheme === "partial") continue;
      const parts = yearRows.filter((x) => x.arresting_agency === agency && x.criminality !== null).reduce((s, x) => s + x.value, 0);
      const tot = total(r.period, r.metric, agency);
      if (tot !== null && parts !== tot && !excused(r.period, r.metric, "criminality", agency, parts, tot)) fail(`FY${r.period} ${r.metric} criminality sums to ${parts}, total ${tot}`);
    }
  }
}

export function buildImmigrationData(
  allRows: readonly EnforcementRow[],
  notes: readonly EnforcementNote[],
  report: EnforcementReport,
  admins: readonly Administration[],
): ImmigrationPageData {
  assertEnforcementInvariants(allRows, report, admins);
  const rows = allRows.filter(isNationalRemovals);
  const adminById = new Map(admins.map((a) => [a.term_id, a]));
  const lastName = (id: string) => {
    const name = adminById.get(id)!.president;
    return name.split(" ").pop() ?? name;
  };
  const markerNotes = new Set(ICE_MARKERS.flatMap((m) => m.noteIds));
  for (const id of [...markerNotes, ...GLOBAL_NOTE_IDS])
    if (!notes.some((n) => n.id === id)) throw new Error(`enforcement invariant: marker/global note ${id} missing from enforcement_notes.json`);
  const noteById = new Map(notes.map((n) => [n.id, n]));
  const corroborated = new Set(report.corroborated_periods);
  const figureRead = new Set(report.figure_read_periods);

  const byFy = (selector: SeriesSelector) => new Map(seriesValues(allRows, selector).map((v) => [v.fy, v]));
  const agencyIce = byFy({ metric: "removals", arresting_agency: "ice" });
  const agencyCbp = byFy({ metric: "removals", arresting_agency: "cbp" });
  const adp = byFy({ metric: "detention_adp" });
  const adpIce = byFy({ metric: "detention_adp", arresting_agency: "ice" });
  const adpCbp = byFy({ metric: "detention_adp", arresting_agency: "cbp" });

  const years: IceYear[] = rows.map((r) => ({
    fy: r.period,
    value: r.value,
    status: r.status,
    termId: r.administration_term_id,
    party: adminById.get(r.administration_term_id)!.party === "Democratic" ? "D" : "R",
    blended: r.blended,
    days: r.administration_days.map((d) => ({ termId: d.term_id, last: lastName(d.term_id), days: d.days })),
    corroborated: corroborated.has(r.period),
    figureRead: figureRead.has(r.period),
    agency: agencyIce.has(r.period) ? { ice: agencyIce.get(r.period)!.value, cbp: agencyCbp.get(r.period)!.value } : null,
    detention: adp.has(r.period)
      ? { value: adp.get(r.period)!.value, status: adp.get(r.period)!.status, ice: adpIce.get(r.period)?.value ?? null, cbp: adpCbp.get(r.period)?.value ?? null }
      : null,
    source: r.source,
    sourceUrl: r.source_url,
    cardNotes: r.note_ids
      .filter((id) => !markerNotes.has(id) && !GLOBAL_NOTE_IDS.includes(id))
      .map((id) => {
        const n = noteById.get(id);
        if (!n) throw new Error(`enforcement invariant: FY${r.period} cites unknown note ${id}`);
        return { id, title: n.title, text: n.text };
      }),
  }));

  const termIds = [...new Set(years.map((y) => y.termId))];
  const terms: IceTerm[] = termIds
    .map((id) => adminById.get(id)!)
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((a) => ({
      termId: a.term_id,
      president: a.president,
      last: a.president.split(" ").pop() ?? a.president,
      party: a.party === "Democratic" ? "D" : "R",
      startYear: Number(a.start.slice(0, 4)),
      endYear: a.end === null ? null : Number(new Date(Date.parse(`${a.end}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 4)),
    }));

  return {
    years,
    terms,
    markers: ICE_MARKERS,
    yMax: yDomainMax(years.map((y) => y.value)),
    firstFy: years[0].fy,
    lastFy: years[years.length - 1].fy,
    finalCount: years.filter((y) => y.status === "final").length,
    corroboratedCount: years.filter((y) => y.corroborated).length,
    asOf: rows[0].as_of,
    criminality: {
      views: { all: criminalityBars(allRows, "all"), ice: criminalityBars(allRows, "ice"), cbp: criminalityBars(allRows, "cbp") },
      yMax: criminalityYMax(allRows),
    },
  };
}

/** "all", or a term id from `terms`. */
export type PresidentSelection = "all" | string;

export function filterYears(years: readonly IceYear[], selection: PresidentSelection): IceYear[] {
  return selection === "all" ? [...years] : years.filter((y) => y.termId === selection);
}

/** The unlocked-year slot follows the newest administration: shown for "All" and for that administration. */
export function showsPendingSlot(data: Pick<ImmigrationPageData, "years">, selection: PresidentSelection): boolean {
  return selection === "all" || selection === data.years[data.years.length - 1].termId;
}

/** "Donald Trump (2025–)", "Joe Biden (2021–2025)". */
export function termOptionLabel(t: IceTerm): string {
  return `${t.president} (${t.startYear}–${t.endYear ?? ""})`;
}

/** The dropdown order: newest first. */
export const termsNewestFirst = (terms: readonly IceTerm[]): IceTerm[] => [...terms].reverse();

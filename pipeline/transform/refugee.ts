import {
  GEOGRAPHIC_GROUPS,
  refugeeCountryRow,
  refugeeDeterminationRow,
  refugeeMonthRow,
  refugeePolicyRow,
  refugeeRegionRow,
  refugeeSeriesRow,
  type Allocation,
  type Determination,
  type RefugeeCatalog,
  type RefugeeCountryRow,
  type RefugeeDeterminationRow,
  type RefugeeMonthRow,
  type RefugeeNote,
  type RefugeePolicyRow,
  type RefugeeRegionRow,
  type RefugeeSeriesRow,
  type RegionGroup,
} from "../../lib/refugee-entities";
import type { Administration } from "../../lib/executive-orders-entities";
import { attributeFiscalYear, containsNumber, fiscalYearBounds, normalizeText } from "./enforcement";
import { resolveCountry, type CountryIndex } from "./removals-country-names";
import { REFUGEE_NAME_TABLES } from "./refugee-country-names";

/**
 * Pure logic for the refugee-admissions track (the runner in `refugee-run.ts` reads the files).
 * Catalog + text extracts in raw/refugee -> refugee_{series,determinations,regions,by_country,
 * monthly,policy,notes,report}.json.
 *
 * Fails the build unless:
 *   - every curated number's verbatim quote is in its source's text extract and contains it;
 *   - each determination's allocations add up to its ceiling (ranges bracket it);
 *   - an emergency PD that adds numbers moves the ceiling by exactly that many;
 *   - CRS's compiled final ceiling equals the last determination's, wherever both exist
 *     (FY1989 is the one documented exception: its revision was not located);
 *   - the State Department's year-end worldwide ceiling (FY2001 on) equals the last determination's;
 *   - in the State Department workbook: region columns sum to each year's total, country rows to
 *     their region total, regions to the grand total, months to the year, and each year sheet's
 *     total equals the cumulative summary's;
 *   - every country name resolves to a key, and every policy event's countries are in its quotes;
 *   - every Federal Register document that mentions "refugee admissions" is either a catalog
 *     source or reviewed and ignored, so a new determination cannot go unnoticed.
 * Missing is missing: no ceiling or admissions figure is estimated.
 */

export class RefugeeDataError extends Error {}

/** Years whose final ceiling is taken from CRS although a determination for the year exists (the revising PD was not located). */
export const UNLOCATED_REVISIONS: ReadonlySet<number> = new Set([1989]);

/** Admissions stay `preliminary` until this many days after the fiscal year ends (the State Department's later vintages revise recent years slightly). */
export const ADMISSIONS_SETTLE_DAYS = 90;

export interface FrIndexRow {
  document_number: string;
  title: string;
  publication_date: string;
}

export interface RefugeeBuildInput {
  catalog: RefugeeCatalog;
  /** Text extract per source id. */
  texts: ReadonlyMap<string, string>;
  frIndex: readonly FrIndexRow[];
  administrations: readonly Administration[];
  countries: CountryIndex;
}

// ---------------------------------------------------------------- evidence

function textOf(input: RefugeeBuildInput, source: string, where: string): string {
  const t = input.texts.get(source);
  if (t === undefined) throw new RefugeeDataError(`${where}: no text extract for source "${source}" (run pnpm fetch:refugee)`);
  return t;
}

function checkQuote(input: RefugeeBuildInput, where: string, source: string, evidence: string, values: readonly number[]) {
  const text = normalizeText(textOf(input, source, where));
  const ev = normalizeText(evidence);
  if (!text.includes(ev)) throw new RefugeeDataError(`${where}: quoted evidence not found in ${source}: "${evidence.slice(0, 90)}"`);
  for (const v of values) {
    if (!containsNumber(ev, v)) throw new RefugeeDataError(`${where}: evidence from ${source} does not contain ${v.toLocaleString("en-US")}`);
  }
}

function checkText(input: RefugeeBuildInput, where: string, source: string, evidence: string) {
  if (!normalizeText(textOf(input, source, where)).includes(normalizeText(evidence))) {
    throw new RefugeeDataError(`${where}: quoted text not found in ${source}: "${evidence.slice(0, 90)}"`);
  }
}

// ---------------------------------------------------------------- State Department workbook

export interface WorkbookSheet {
  name: string;
  rows: string[][];
}

/** Split a workbook extract (`## sheet: <name>` + ` | `-separated positional rows) into sheets. */
export function parseWorkbook(text: string): WorkbookSheet[] {
  const sheets: WorkbookSheet[] = [];
  for (const line of text.split("\n")) {
    const m = line.match(/^## sheet: (.+)$/);
    if (m) sheets.push({ name: m[1], rows: [] });
    else if (line.trim() && sheets.length) sheets[sheets.length - 1].rows.push(line.split(" | ").map((c) => c.trim()));
  }
  return sheets;
}

const int = (s: string | undefined, where: string): number => {
  const v = (s ?? "").replace(/,/g, "");
  if (!/^\d+$/.test(v)) throw new RefugeeDataError(`${where}: "${s ?? ""}" is not a whole number`);
  return Number(v);
};

/** Cumulative-summary columns -> region groups (Kosovo and the former Soviet Union are European). */
const CUMULATIVE_COLUMNS = [
  { col: 1, label: "Africa", group: "africa" },
  { col: 2, label: "Asia", group: "east_asia" },
  { col: 4, label: "Europe and Central Asia", group: "europe" },
  { col: 5, label: "Former Soviet Union", group: "europe" },
  { col: 6, label: "Kosovo", group: "europe" },
  { col: 7, label: "Latin America/Caribbean", group: "latin_america_caribbean" },
  { col: 8, label: "Near East/South Asia", group: "near_east_south_asia" },
  { col: 9, label: "PSI", group: "private_sector" },
] as const satisfies readonly { col: number; label: string; group: RegionGroup }[];
const TOTAL_COL = 10;

export interface CumulativeYear {
  fy: number;
  total: number;
  byGroup: Map<RegionGroup, number>;
}

export function parseCumulative(sheet: WorkbookSheet): CumulativeYear[] {
  const header = sheet.rows.findIndex((r) => r[0] === "Year" && r[TOTAL_COL] === "Total");
  if (header < 0) throw new RefugeeDataError(`${sheet.name}: header row "Year | Africa | Asia | ... | Total" not found`);
  if (sheet.rows[header][1] !== "Africa" || sheet.rows[header][2] !== "Asia" || sheet.rows[header][9] !== "PSI") {
    throw new RefugeeDataError(`${sheet.name}: column layout changed: ${sheet.rows[header].join(" | ")}`);
  }
  const out: CumulativeYear[] = [];
  let printedGrand: number | null = null;
  for (const r of sheet.rows.slice(header + 1)) {
    if (r[0] === "Total") {
      printedGrand = int(r[TOTAL_COL], `${sheet.name} Total row`);
      continue;
    }
    if (!/^\d{4}$/.test(r[0])) continue;
    const fy = Number(r[0]);
    const where = `${sheet.name} FY${fy}`;
    const byGroup = new Map<RegionGroup, number>();
    let sum = 0;
    for (const c of CUMULATIVE_COLUMNS) {
      const v = int(r[c.col], `${where} ${c.label}`);
      byGroup.set(c.group, (byGroup.get(c.group) ?? 0) + v);
      sum += v;
    }
    const total = int(r[TOTAL_COL], `${where} Total`);
    if (sum !== total) throw new RefugeeDataError(`${where}: region columns sum to ${sum}, printed total ${total}`);
    out.push({ fy, total, byGroup });
  }
  const all = out.reduce((s, y) => s + y.total, 0);
  if (printedGrand !== null && printedGrand !== all) throw new RefugeeDataError(`${sheet.name}: years sum to ${all}, printed grand total ${printedGrand}`);
  return out;
}

/** Year-sheet region headers -> groups. */
const SHEET_REGIONS: Readonly<Record<string, RegionGroup>> = {
  Africa: "africa",
  "East Asia": "east_asia",
  "Europe and Central Asia": "europe",
  "Former Soviet Union": "europe",
  "Latin America/Caribbean": "latin_america_caribbean",
  "Near East/South Asia": "near_east_south_asia",
  "Unallocated Reserve": "unallocated",
};

export interface Range {
  min: number;
  max: number;
}

/** "30,000 - 50,000" -> {30000, 50000}; "5,000" -> {5000, 5000}; "" -> null. */
export function parseRange(s: string | undefined, where: string): Range | null {
  const v = (s ?? "").trim();
  if (!v) return null;
  const m = v.match(/^([\d,]+)(?:\s*-\s*([\d,]+))?$/);
  if (!m) throw new RefugeeDataError(`${where}: unreadable ceiling "${v}"`);
  const min = int(m[1], where);
  const max = m[2] ? int(m[2], where) : min;
  if (max < min) throw new RefugeeDataError(`${where}: range ${v} is reversed`);
  return { min, max };
}

export interface SheetCountry {
  name: string;
  group: RegionGroup;
  total: number;
}

export interface YearSheet {
  fy: number;
  ceiling: number;
  total: number;
  months: number[];
  regions: { label: string; group: RegionGroup; ceiling: Range | null; total: number }[];
  countries: SheetCountry[];
}

const COL = { region: 0, name: 1, ceiling: 2, total: 3, month0: 4 } as const;

export function parseYearSheet(sheet: WorkbookSheet): YearSheet {
  const fyRow = sheet.rows.find((r) => /^Fiscal Year \d{4}$/.test(r[0]));
  if (!fyRow) throw new RefugeeDataError(`sheet ${sheet.name}: no "Fiscal Year YYYY" row`);
  const fy = Number(fyRow[0].slice(-4));
  if (String(fy) !== sheet.name) throw new RefugeeDataError(`sheet ${sheet.name} is labelled Fiscal Year ${fy}`);
  const where = `FY${fy} sheet`;
  const regions: YearSheet["regions"] = [];
  const countries: SheetCountry[] = [];
  let open: { label: string; group: RegionGroup; ceiling: Range | null; sum: number; total: number | null } | null = null;
  let grand: { ceiling: number; total: number; months: number[] } | null = null;
  const close = () => {
    if (!open) return;
    if (open.total === null) {
      if (open.sum !== 0 || open.group !== "unallocated") throw new RefugeeDataError(`${where} ${open.label}: no "Total ${open.label}" row`);
      open.total = 0;
    }
    if (open.sum !== open.total) throw new RefugeeDataError(`${where} ${open.label}: countries sum to ${open.sum}, printed ${open.total}`);
    regions.push({ label: open.label, group: open.group, ceiling: open.ceiling, total: open.total });
    open = null;
  };
  const start = sheet.rows.indexOf(fyRow) + 1;
  for (const r of sheet.rows.slice(start)) {
    const a = r[COL.region] ?? "";
    const b = r[COL.name] ?? "";
    if (a.startsWith("Note:")) continue;
    if (a) {
      close();
      const group = SHEET_REGIONS[a];
      if (!group) throw new RefugeeDataError(`${where}: unknown region "${a}"`);
      open = { label: a, group, ceiling: parseRange(r[COL.ceiling], `${where} ${a} ceiling`), sum: 0, total: null };
      continue;
    }
    if (b === "Grand Totals") {
      close();
      const months = Array.from({ length: 12 }, (_, i) => int(r[COL.month0 + i] || "0", `${where} grand total month ${i + 1}`));
      grand = { ceiling: int(r[COL.ceiling], `${where} grand ceiling`), total: int(r[COL.total], `${where} grand total`), months };
      continue;
    }
    if (!open) continue;
    if (b.startsWith("Total ")) {
      if (b !== `Total ${open.label}`) throw new RefugeeDataError(`${where}: "${b}" closes region "${open.label}"`);
      open.total = r[COL.total] ? int(r[COL.total], `${where} ${b}`) : 0;
      continue;
    }
    if (!b) continue;
    const total = int(r[COL.total], `${where} ${b}`);
    const months = Array.from({ length: 12 }, (_, i) => int(r[COL.month0 + i] || "0", `${where} ${b} month ${i + 1}`));
    const mSum = months.reduce((s, v) => s + v, 0);
    if (mSum !== total) throw new RefugeeDataError(`${where} ${b}: months sum to ${mSum}, FY total ${total}`);
    open.sum += total;
    if (total > 0) countries.push({ name: b, group: open.group, total });
  }
  close();
  if (!grand) throw new RefugeeDataError(`${where}: no Grand Totals row`);
  const regionSum = regions.reduce((s, x) => s + x.total, 0);
  if (regionSum !== grand.total) throw new RefugeeDataError(`${where}: regions sum to ${regionSum}, grand total ${grand.total}`);
  const monthSum = grand.months.reduce((s, v) => s + v, 0);
  if (monthSum !== grand.total) throw new RefugeeDataError(`${where}: months sum to ${monthSum}, grand total ${grand.total}`);
  return { fy, ceiling: grand.ceiling, total: grand.total, months: grand.months, regions, countries };
}

// ---------------------------------------------------------------- determinations

function checkDetermination(d: Determination, input: RefugeeBuildInput) {
  const where = `${d.id} (FY${d.fy})`;
  const src = input.catalog.sources.find((s) => s.id === d.source);
  if (!src) throw new RefugeeDataError(`${where}: source "${d.source}" is not in the catalog`);
  if (src.role !== "determination") throw new RefugeeDataError(`${where}: source ${d.source} has role ${src.role}`);
  checkQuote(input, `${where} ceiling`, d.source, d.ceiling_evidence, [d.increase ?? d.ceiling]);
  for (const a of d.allocations) {
    if (a.max < a.min) throw new RefugeeDataError(`${where} ${a.key}: max < min`);
    checkQuote(input, `${where} ${a.key}`, a.source ?? d.source, a.evidence, a.min === a.max ? [a.min] : [a.min, a.max]);
  }
  const keys = new Set(d.allocations.map((a) => a.key));
  if (keys.size !== d.allocations.length) throw new RefugeeDataError(`${where}: duplicate allocation key`);
  if (d.allocation_basis === "group" || d.allocation_basis === "none") {
    if (d.allocations.length) throw new RefugeeDataError(`${where}: basis ${d.allocation_basis} carries numeric allocations`);
    if (d.allocation_basis === "group") {
      if (!d.allocation_text) throw new RefugeeDataError(`${where}: group allocation without allocation_text`);
      checkText(input, `${where} allocation text`, d.source, d.allocation_text);
    }
    return;
  }
  const lo = d.allocations.reduce((s, a) => s + a.min, 0);
  const hi = d.allocations.reduce((s, a) => s + a.max, 0);
  const target = d.allocation_mode === "add" ? d.increase : d.ceiling;
  if (target === undefined) throw new RefugeeDataError(`${where}: add-mode allocations need an increase`);
  if (lo > target || hi < target) throw new RefugeeDataError(`${where}: allocations sum to ${lo === hi ? lo : `${lo}-${hi}`}, ${d.allocation_mode === "add" ? "increase" : "ceiling"} is ${target}`);
  if (d.allocation_basis === "region" && d.allocations.some((a) => a.region_group === "category" || a.region_group === "group")) {
    throw new RefugeeDataError(`${where}: regional allocation filed under a non-geographic group`);
  }
}

/** Allocations in force after each PD of a year: replace-mode lists replace, add-mode lists add to the same key. */
function allocationsInForce(pds: readonly Determination[]): Allocation[] | null {
  let cur: Allocation[] | null = null;
  for (const d of pds) {
    if (d.allocation_basis === "group" || d.allocation_basis === "none") {
      cur = null;
      continue;
    }
    if (d.allocation_mode === "replace" || cur === null) {
      cur = d.allocations.map((a) => ({ ...a }));
      continue;
    }
    for (const a of d.allocations) {
      const hit: Allocation | undefined = cur.find((c) => c.key === a.key);
      if (hit) {
        hit.min += a.min;
        hit.max += a.max;
      } else cur.push({ ...a });
    }
  }
  return cur;
}

function byGroup(allocs: readonly Allocation[] | null): Map<RegionGroup, Range> {
  const m = new Map<RegionGroup, Range>();
  for (const a of allocs ?? []) {
    const r = m.get(a.region_group) ?? { min: 0, max: 0 };
    m.set(a.region_group, { min: r.min + a.min, max: r.max + a.max });
  }
  return m;
}

// ---------------------------------------------------------------- build

export interface RefugeeBuild {
  series: RefugeeSeriesRow[];
  determinations: RefugeeDeterminationRow[];
  regions: RefugeeRegionRow[];
  byCountry: RefugeeCountryRow[];
  monthly: RefugeeMonthRow[];
  policy: RefugeePolicyRow[];
  notes: RefugeeNote[];
  report: Record<string, unknown>;
}

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export function buildRefugee(input: RefugeeBuildInput): RefugeeBuild {
  const { catalog } = input;
  const asOf = catalog.retrieved_at;
  const sourceById = new Map(catalog.sources.map((s) => [s.id, s]));
  if (sourceById.size !== catalog.sources.length) throw new RefugeeDataError("duplicate source id in the catalog");
  const noteIds = new Set(catalog.notes.map((n) => n.id));
  if (noteIds.size !== catalog.notes.length) throw new RefugeeDataError("duplicate note id in the catalog");
  for (const n of catalog.notes) {
    if (n.fy_end !== null && n.fy_end < n.fy_start) throw new RefugeeDataError(`note ${n.id}: fy_end before fy_start`);
    if (n.source !== null && !sourceById.has(n.source)) throw new RefugeeDataError(`note ${n.id}: unknown source "${n.source}"`);
  }

  // --- Federal Register discovery gate ---
  const reviewed = new Set(catalog.fr_index_reviewed.map((r) => r.document_number));
  const sourced = catalog.sources.map((s) => s.url).join(" ");
  const unreviewed = input.frIndex.filter((r) => !reviewed.has(r.document_number) && !sourced.includes(`/${r.document_number}.htm`));
  if (unreviewed.length) {
    throw new RefugeeDataError(
      `Federal Register lists ${unreviewed.length} refugee-admissions document(s) the catalog has not reviewed — curate them (determinations / policy_events) or add them to fr_index_reviewed:\n` +
        unreviewed.map((r) => `  ${r.document_number} (${r.publication_date}) ${r.title}`).join("\n"),
    );
  }
  for (const r of catalog.fr_index_reviewed) {
    if (!input.frIndex.some((x) => x.document_number === r.document_number)) throw new RefugeeDataError(`fr_index_reviewed ${r.document_number} is not in the Federal Register index`);
  }

  // --- determinations ---
  const pdIds = new Set<string>();
  for (const d of catalog.determinations) {
    if (pdIds.has(d.id)) throw new RefugeeDataError(`duplicate determination ${d.id}`);
    pdIds.add(d.id);
    for (const id of d.note_ids) if (!noteIds.has(id)) throw new RefugeeDataError(`${d.id}: unknown note "${id}"`);
    checkDetermination(d, input);
  }
  const pdsByFy = new Map<number, Determination[]>();
  for (const d of [...catalog.determinations].sort((a, b) => a.signed.localeCompare(b.signed))) {
    const list = pdsByFy.get(d.fy) ?? [];
    list.push(d);
    pdsByFy.set(d.fy, list);
  }
  const determinations: RefugeeDeterminationRow[] = [];
  for (const [fy, pds] of pdsByFy) {
    if (pds[0].kind !== "annual") throw new RefugeeDataError(`FY${fy}: first determination ${pds[0].id} is not the annual one`);
    pds.forEach((d, i) => {
      const prev = i ? pds[i - 1].ceiling : null;
      if (i && d.kind !== "emergency") throw new RefugeeDataError(`FY${fy}: ${d.id} follows ${pds[i - 1].id} but is not an emergency determination`);
      if (d.increase !== undefined && prev !== null && prev + d.increase !== d.ceiling) {
        throw new RefugeeDataError(`${d.id}: ${prev} + ${d.increase} != ${d.ceiling}`);
      }
      const src = sourceById.get(d.source)!;
      determinations.push(
        refugeeDeterminationRow.parse({
          id: d.id,
          fy,
          signed: d.signed,
          kind: d.kind,
          sequence: i + 1,
          ceiling: d.ceiling,
          previous_ceiling: prev,
          allocation_basis: d.allocation_basis,
          allocation_mode: d.allocation_mode,
          allocations: d.allocations.map(({ key, label, region_group, min, max }) => ({ key, label, region_group, min, max })),
          allocation_text: d.allocation_text ?? null,
          source: src.title,
          source_url: src.url,
          citation: d.citation,
          note_ids: d.note_ids,
        }),
      );
    });
  }
  determinations.sort((a, b) => a.fy - b.fy || a.sequence - b.sequence);

  // --- CRS compilation ---
  const crs = new Map<number, number>();
  for (const c of catalog.compiled_ceilings.rows) {
    checkQuote(input, `CRS FY${c.fy}`, catalog.compiled_ceilings.source, c.evidence, [c.ceiling]);
    if (crs.has(c.fy)) throw new RefugeeDataError(`CRS FY${c.fy} listed twice`);
    crs.set(c.fy, c.ceiling);
  }
  const crsChecks: { fy: number; determination: number; crs: number; ok: boolean }[] = [];
  for (const [fy, v] of crs) {
    const pds = pdsByFy.get(fy);
    if (!pds) continue;
    const last = pds[pds.length - 1].ceiling;
    const ok = last === v;
    if (!ok && !UNLOCATED_REVISIONS.has(fy)) throw new RefugeeDataError(`FY${fy}: CRS final ceiling ${v} != last determination ${pds[pds.length - 1].id} (${last})`);
    crsChecks.push({ fy, determination: last, crs: v, ok });
  }

  // --- State Department workbook ---
  const rpcId = catalog.sources.find((s) => s.role === "admissions")?.id;
  if (!rpcId) throw new RefugeeDataError("no admissions source in the catalog");
  const sheets = parseWorkbook(textOf(input, rpcId, "admissions workbook"));
  const cumulativeSheet = sheets.find((s) => s.name === "Cumulative Summary");
  if (!cumulativeSheet) throw new RefugeeDataError(`${rpcId}: no "Cumulative Summary" sheet`);
  const cumulative = new Map(parseCumulative(cumulativeSheet).map((y) => [y.fy, y]));
  const years = sheets.filter((s) => /^\d{4}$/.test(s.name)).map(parseYearSheet).sort((a, b) => a.fy - b.fy);
  const yearSheet = new Map(years.map((y) => [y.fy, y]));
  for (const y of years) {
    const c = cumulative.get(y.fy);
    if (!c || c.total !== y.total) throw new RefugeeDataError(`FY${y.fy}: year sheet total ${y.total}, cumulative summary ${c?.total ?? "missing"}`);
    for (const g of GEOGRAPHIC_GROUPS) {
      const sheetSum = y.regions.filter((r) => r.group === g).reduce((s, r) => s + r.total, 0);
      if (sheetSum !== (c.byGroup.get(g) ?? 0)) throw new RefugeeDataError(`FY${y.fy} ${g}: year sheet ${sheetSum}, cumulative summary ${c.byGroup.get(g)}`);
    }
    const pds = pdsByFy.get(y.fy);
    const final = pds?.[pds.length - 1].ceiling;
    if (final !== y.ceiling) throw new RefugeeDataError(`FY${y.fy}: State Department year-end ceiling ${y.ceiling}, last determination ${final ?? "missing"}`);
  }

  // --- series ---
  const firstFy = catalog.first_fiscal_year;
  const lastFy = Math.max(...pdsByFy.keys(), ...cumulative.keys());
  const series: RefugeeSeriesRow[] = [];
  for (let fy = firstFy; fy <= lastFy; fy++) {
    const pds = pdsByFy.get(fy) ?? [];
    const crsFinal = crs.get(fy);
    let ceiling: number | null = null;
    let kind: "determination" | "compilation" | null = null;
    if (pds.length && !(crsFinal !== undefined && UNLOCATED_REVISIONS.has(fy) && crsFinal !== pds[pds.length - 1].ceiling)) {
      ceiling = pds[pds.length - 1].ceiling;
      kind = "determination";
    } else if (crsFinal !== undefined) {
      ceiling = crsFinal;
      kind = "compilation";
    }
    const initial = pds.length ? pds[0].ceiling : null;
    const ended = fiscalYearBounds(fy).end < asOf;
    const adm = cumulative.get(fy);
    const admissions = adm?.total ?? null;
    const settled = addDays(fiscalYearBounds(fy).end, ADMISSIONS_SETTLE_DAYS) < asOf;
    const notes = catalog.notes.filter((n) => n.fy_start <= fy && (n.fy_end === null || fy <= n.fy_end)).map((n) => n.id);
    series.push(
      refugeeSeriesRow.parse({
        period: fy,
        period_type: "fiscal_year",
        scope: "usrap",
        ceiling,
        ceiling_initial: initial,
        ceiling_revised: ceiling !== null && initial !== null && (pds.some((d) => d.ceiling !== initial) || ceiling !== initial),
        ceiling_source_kind: kind,
        ceiling_status: ceiling === null ? null : ended ? "final" : "preliminary",
        determination_ids: pds.map((d) => d.id),
        admissions,
        admissions_status: admissions === null ? null : settled ? "final" : "preliminary",
        share_of_ceiling: admissions !== null && ceiling ? Math.round((admissions / ceiling) * 10_000) / 10_000 : null,
        as_of: asOf,
        note_ids: notes,
        ...attributeFiscalYear(fy, input.administrations),
      }),
    );
    if (admissions !== null && !ended) throw new RefugeeDataError(`FY${fy}: admissions reported for a year still in progress`);
  }

  // --- regions ---
  const regions: RefugeeRegionRow[] = [];
  const GROUP_ORDER: readonly RegionGroup[] = [...GEOGRAPHIC_GROUPS, "private_sector", "unallocated", "category"];
  for (let fy = firstFy; fy <= lastFy; fy++) {
    const pds = pdsByFy.get(fy) ?? [];
    const initial = pds.length && pds[0].allocation_mode === "replace" ? byGroup(allocationsInForce(pds.slice(0, 1))) : new Map<RegionGroup, Range>();
    const final = byGroup(allocationsInForce(pds));
    const ys = yearSheet.get(fy);
    const yearEnd = new Map<RegionGroup, Range>();
    for (const r of ys?.regions ?? []) {
      if (!r.ceiling) continue;
      const prev = yearEnd.get(r.group) ?? { min: 0, max: 0 };
      yearEnd.set(r.group, { min: prev.min + r.ceiling.min, max: prev.max + r.ceiling.max });
    }
    const adm = cumulative.get(fy);
    for (const g of GROUP_ORDER) {
      const admitted = g === "unallocated" || g === "category" ? null : (adm?.byGroup.get(g) ?? null);
      const row = {
        fy,
        region_group: g,
        admissions: admitted,
        allocation_initial: initial.get(g) ?? null,
        allocation_final: final.get(g) ?? null,
        year_end_ceiling: yearEnd.get(g) ?? null,
      };
      const geographic = (GEOGRAPHIC_GROUPS as readonly RegionGroup[]).includes(g);
      if (!((geographic && adm) || row.allocation_initial || row.allocation_final || row.year_end_ceiling || (admitted ?? 0) > 0)) continue;
      regions.push(refugeeRegionRow.parse(row));
    }
  }

  // --- by country + monthly ---
  const byCountry: RefugeeCountryRow[] = [];
  const monthly: RefugeeMonthRow[] = [];
  const unmapped = new Set<string>();
  for (const y of years) {
    const status = series.find((r) => r.period === y.fy)?.admissions_status ?? "preliminary";
    const merged = new Map<string, RefugeeCountryRow>();
    for (const c of y.countries) {
      let resolved;
      try {
        resolved = resolveCountry(c.name, input.countries, REFUGEE_NAME_TABLES);
      } catch {
        unmapped.add(c.name);
        continue;
      }
      const prev = merged.get(resolved.country_key);
      if (prev) {
        if (prev.region_group !== c.group) throw new RefugeeDataError(`FY${y.fy} ${resolved.country_key}: printed under ${prev.region_group} and ${c.group}`);
        prev.admissions += c.total;
        prev.printed_names.push(c.name);
      } else {
        merged.set(resolved.country_key, { fy: y.fy, country_key: resolved.country_key, country_name: resolved.display_name, printed_names: [c.name], region_group: c.group, admissions: c.total, status });
      }
    }
    const rows = [...merged.values()].sort((a, b) => b.admissions - a.admissions || a.country_key.localeCompare(b.country_key));
    const sum = rows.reduce((s, r) => s + r.admissions, 0);
    if (!unmapped.size && sum !== y.total) throw new RefugeeDataError(`FY${y.fy}: country rows sum to ${sum}, total ${y.total}`);
    byCountry.push(...rows.map((r) => refugeeCountryRow.parse(r)));
    y.months.forEach((v, i) => {
      const calYear = i < 3 ? y.fy - 1 : y.fy;
      const month = ((i + 9) % 12) + 1;
      monthly.push(refugeeMonthRow.parse({ fy: y.fy, month: `${calYear}-${String(month).padStart(2, "0")}`, admissions: v, status }));
    });
  }
  if (unmapped.size) throw new RefugeeDataError(`State Department country names with no country_key (add to REFUGEE_ALIASES): ${[...unmapped].sort().join(", ")}`);

  // --- policy events ---
  const policyIds = new Set(catalog.policy_events.map((p) => p.id));
  const policy: RefugeePolicyRow[] = catalog.policy_events.map((p) => {
    const where = `policy ${p.id}`;
    const src = sourceById.get(p.source);
    if (!src) throw new RefugeeDataError(`${where}: unknown source "${p.source}"`);
    // Quotes may come from the instrument or from a later document that records its fate (revocation, expiry).
    const quoted = p.evidence.map((e) => {
      const home = [p.source, ...catalog.sources.map((s) => s.id)].find((id) => input.texts.has(id) && normalizeText(input.texts.get(id)!).includes(normalizeText(e)));
      if (!home) throw new RefugeeDataError(`${where}: quote not found in any source: "${e.slice(0, 90)}"`);
      return normalizeText(e);
    });
    if (!normalizeText(input.texts.get(p.source) ?? "").includes(quoted[0])) throw new RefugeeDataError(`${where}: first quote must come from the instrument itself (${p.source})`);
    if (p.effective < p.signed) throw new RefugeeDataError(`${where}: effective before signed`);
    if (p.ended !== null && p.ended < p.effective) throw new RefugeeDataError(`${where}: ended before effective`);
    if ((p.status === "in_effect") !== (p.ended === null)) throw new RefugeeDataError(`${where}: status ${p.status} but ended ${p.ended}`);
    if (p.ended_by !== null && !policyIds.has(p.ended_by) && !pdIds.has(p.ended_by)) throw new RefugeeDataError(`${where}: ended_by "${p.ended_by}" is neither a policy event nor a determination`);
    const joined = quoted.join(" ");
    const countries = p.countries.map((c) => {
      if (!new RegExp(`(?<![A-Za-z])${c.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z])`).test(joined)) {
        throw new RefugeeDataError(`${where}: country "${c.name}" is not in the event's quotes`);
      }
      return { name: c.name, country_key: resolveCountry(c.name, input.countries, REFUGEE_NAME_TABLES).country_key, level: c.level };
    });
    const keys = countries.map((c) => c.country_key);
    if (new Set(keys).size !== keys.length) throw new RefugeeDataError(`${where}: a country is listed twice`);
    return refugeePolicyRow.parse({
      id: p.id,
      instrument: p.instrument,
      citation: p.citation,
      signed: p.signed,
      effective: p.effective,
      ended: p.ended,
      ended_by: p.ended_by,
      kind: p.kind,
      title: p.title,
      summary: p.summary,
      refugee_effect: p.refugee_effect,
      countries,
      status: p.status,
      status_as_of: p.status_as_of,
      source: src.title,
      source_url: src.url,
    });
  });
  policy.sort((a, b) => a.effective.localeCompare(b.effective) || a.id.localeCompare(b.id));

  // --- cross-checks (reported, not gated: different counting systems) ---
  const crossCheck = buildCrossChecks(input, cumulative, byCountry);

  const withCeiling = series.filter((r) => r.ceiling !== null);
  const withAdm = series.filter((r) => r.admissions !== null);
  const report = {
    first_period: firstFy,
    last_period: lastFy,
    rows: series.length,
    ceiling_years: { first: withCeiling[0]?.period ?? null, last: withCeiling.at(-1)?.period ?? null, missing: series.filter((r) => r.ceiling === null).map((r) => r.period) },
    admissions_years: { first: withAdm[0]?.period ?? null, last: withAdm.at(-1)?.period ?? null, missing: series.filter((r) => r.admissions === null).map((r) => r.period) },
    ceiling_source: {
      determination: series.filter((r) => r.ceiling_source_kind === "determination").map((r) => r.period),
      compilation: series.filter((r) => r.ceiling_source_kind === "compilation").map((r) => r.period),
    },
    revised_years: series.filter((r) => r.ceiling_revised).map((r) => ({ period: r.period, initial: r.ceiling_initial, final: r.ceiling, determinations: r.determination_ids })),
    status: {
      ceiling: Object.fromEntries(["final", "preliminary"].map((s) => [s, series.filter((r) => r.ceiling_status === s).length])),
      admissions: Object.fromEntries(["final", "preliminary"].map((s) => [s, series.filter((r) => r.admissions_status === s).length])),
    },
    blended_periods: series.filter((r) => r.blended).map((r) => r.period),
    determinations: determinations.length,
    crs_vs_determinations: crsChecks,
    state_department_year_end_ceiling_checked: years.map((y) => y.fy),
    country_years: { first: years[0]?.fy ?? null, last: years.at(-1)?.fy ?? null, rows: byCountry.length, countries: new Set(byCountry.map((r) => r.country_key)).size },
    policy_events: policy.length,
    cross_checks: crossCheck,
  };

  return {
    series,
    determinations,
    regions,
    byCountry,
    monthly,
    policy,
    notes: [...catalog.notes].sort((a, b) => a.fy_start - b.fy_start || a.id.localeCompare(b.id)),
    report,
  };
}

function buildCrossChecks(input: RefugeeBuildInput, cumulative: ReadonlyMap<number, CumulativeYear>, byCountry: readonly RefugeeCountryRow[]) {
  const out: Record<string, unknown> = {};
  // CRS admissions column (as of Nov 30, 2022) vs. the current State Department vintage.
  out.crs_admissions_vs_state_department = input.catalog.compiled_ceilings.rows
    .map((c) => {
      const crsAdm = Number(c.evidence.split(" ")[2].replace(/,/g, ""));
      const rpc = cumulative.get(c.fy)?.total ?? null;
      return { fy: c.fy, crs: crsAdm, state_department: rpc, diff: rpc === null ? null : rpc - crsAdm };
    })
    .filter((r) => r.diff !== 0);

  const ohssId = input.catalog.sources.find((s) => s.role === "cross_check")?.id;
  const ohssText = ohssId ? input.texts.get(ohssId) : undefined;
  if (!ohssId || ohssText === undefined) return out;
  const sheets = parseWorkbook(ohssText);
  const t13 = sheets.find((s) => s.name === "Table 13");
  const t14 = sheets.find((s) => s.name === "Table 14");
  if (t13) {
    out.ohss_table13_vs_state_department = t13.rows
      .filter((r) => /^\d{4}$/.test(r[0]) && /^\d+$/.test(r[1] ?? ""))
      .map((r) => {
        const fy = Number(r[0]);
        const dhs = Number(r[1]);
        const rpc = cumulative.get(fy)?.total ?? null;
        return { fy, dhs, state_department: rpc, diff: rpc === null ? null : rpc - dhs, pct: rpc === null || dhs === 0 ? null : Math.round(((rpc - dhs) / dhs) * 1000) / 10 };
      });
  }
  if (t14) {
    const header = t14.rows.find((r) => r[0].startsWith("Region and country"));
    const countryStart = t14.rows.findIndex((r) => r[0] === "COUNTRY");
    if (header && countryStart >= 0) {
      const fys = header.slice(1).map(Number);
      const diffs: { fy: number; country_key: string; dhs: number; state_department: number; diff: number }[] = [];
      const unmatched = new Set<string>();
      for (const r of t14.rows.slice(countryStart + 1)) {
        // Data rows only: one count per year; "All other countries" and "Unknown" (footnoted) are residuals, not countries.
        if (r.length !== fys.length + 1 || r.slice(1).some((c) => !/^\d+$/.test(c))) continue;
        if (r[0] === "Total" || /^(All other countries|Unknown)\d*$/.test(r[0])) continue;
        let key: string;
        try {
          key = resolveCountry(r[0], input.countries, REFUGEE_NAME_TABLES).country_key;
        } catch {
          unmatched.add(r[0]);
          continue;
        }
        fys.forEach((fy, i) => {
          const dhs = Number(r[i + 1]);
          const rpc = byCountry.find((c) => c.fy === fy && c.country_key === key)?.admissions ?? 0;
          // DHS rounds to tens: only differences beyond rounding are listed.
          if (Math.abs(rpc - dhs) > 10) diffs.push({ fy, country_key: key, dhs, state_department: rpc, diff: rpc - dhs });
        });
      }
      diffs.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
      out.ohss_table14_vs_state_department = { fiscal_years: fys, beyond_rounding: diffs.length, largest: diffs.slice(0, 25), dhs_names_not_matched: [...unmatched].sort() };
    }
  }
  return out;
}

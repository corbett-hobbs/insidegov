import { parse } from "csv-parse/sync";
import {
  ENCOUNTER_AUTHORITIES,
  ENCOUNTER_COMPONENTS,
  ENCOUNTER_SCOPES,
  encountersMonthRow,
  encountersSeriesRow,
  type CbpCatalog,
  type EncounterAuthority,
  type EncounterComponent,
  type EncounterDetail,
  type EncounterScope,
  type EncountersMonthRow,
  type EncountersNote,
  type EncountersSeriesRow,
  type EncountersVintage,
  type OverlapException,
  type PrintedRow,
} from "../../lib/encounters-entities";
import type { Administration } from "../../lib/executive-orders-entities";
import { attributeFiscalYear, containsNumber, normalizeText } from "./enforcement";

/**
 * Pure logic for the CBP border-encounters track (the runner in `encounters-run.ts` reads the files).
 * Catalog + text extracts + encounters CSVs in raw/cbp -> encounters_{series,monthly,notes,report}.json.
 *
 * Where each value comes from (one source per year and component, the same for both scopes):
 *   Border Patrol  FY1980–FY2019  CBP's history tables (nationwide FY1925 on; southwest sectors FY1960 on)
 *                  FY2020 on      CBP's encounters CSVs
 *   OFO            FY2004–FY2014  DHS OHSS (Key Homeland Security Metrics), rounded to tens
 *                  FY2015–FY2019  CBP's statistics pages (curated, with quotes)
 *                  FY2020 on      CBP's encounters CSVs
 *   Title 42       FY2020–FY2023  CBP's encounters CSVs
 *
 * Fails the build unless:
 *   - every curated figure's verbatim quote is in its source's text extract and contains it, and every note's quotes are;
 *   - each year's parts add up to the printed total: southwest sectors to the southwest total, CBP's printed OFO plus
 *     Border Patrol to its printed total, OHSS regions to its count (within rounding);
 *   - overlapping sources agree: CBP with CBP exactly, CBP with OHSS within `overlap_tolerance`, CSV files with each
 *     other within it; every disagreement beyond that is a catalog exception, and every exception is still needed;
 *   - schemes never mix within a year: one level of detail per year, the same rows nationwide and southwest, one source
 *     per year and component;
 *   - Title 42 rows fall only between March 2020 and May 2023;
 *   - the southwest never exceeds the nationwide figure, and only the newest year is preliminary.
 * Missing is missing: nothing is estimated, and OFO before FY2004 has no rows.
 */

export class EncountersDataError extends Error {}

const fail = (msg: string): never => {
  throw new EncountersDataError(msg);
};

/** Title 42 applied from March 21, 2020 to May 11, 2023: rows may only fall in these months. */
export const TITLE42_FIRST_MONTH = "2020-03";
export const TITLE42_LAST_MONTH = "2023-05";

export interface EncountersBuildInput {
  catalog: CbpCatalog;
  /** Text extract per catalog source id. */
  texts: ReadonlyMap<string, string>;
  /** The encounters CSVs listed in `encounters-vintages.json`, with their contents. */
  vintages: readonly { vintage: EncountersVintage; csv: string }[];
  administrations: readonly Administration[];
}

type Key = `${EncounterScope}|${EncounterComponent}|${EncounterAuthority}`;
const key = (s: EncounterScope, c: EncounterComponent, a: EncounterAuthority): Key => `${s}|${c}|${a}`;

// ---------------------------------------------------------------- evidence

function textOf(input: EncountersBuildInput, source: string, where: string): string {
  return input.texts.get(source) ?? fail(`${where}: no text extract for source "${source}" (run pnpm fetch:cbp)`);
}

function checkQuote(input: EncountersBuildInput, where: string, source: string, evidence: string, values: readonly number[]) {
  const ev = normalizeText(evidence);
  if (!normalizeText(textOf(input, source, where)).includes(ev)) fail(`${where}: quoted evidence not found in ${source}: "${evidence.slice(0, 90)}"`);
  for (const v of values) if (!containsNumber(ev, v)) fail(`${where}: evidence from ${source} does not contain ${v.toLocaleString("en-US")}`);
}

// ---------------------------------------------------------------- CBP history tables (PDF text)

/** The two-column FY1925–FY2020 table: every `<year>  <count>` pair on each line. */
export function parseNationwideHistory(text: string): Map<number, number> {
  const out = new Map<number, number>();
  for (const line of text.split("\n")) {
    for (const m of line.matchAll(/(?:^|\s)(19\d\d|20\d\d)\s{2,}([\d,]+)(?=\s|$)/g)) {
      const fy = Number(m[1]);
      if (out.has(fy)) fail(`USBP history: FY${fy} appears twice`);
      out.set(fy, Number(m[2].replace(/,/g, "")));
    }
  }
  const years = [...out.keys()].sort((a, b) => a - b);
  if (!years.length) fail("USBP history: no rows read");
  years.forEach((y, i) => y !== years[0] + i && fail(`USBP history: years not contiguous at FY${y}`));
  return out;
}

/** The southwest sector table: nine sectors and the southwest total per year; the sectors must add up to the total. */
export function parseSouthwestSectors(text: string): Map<number, number> {
  const out = new Map<number, number>();
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*(19\d\d|20\d\d)\s+((?:[\d,]+\s+){9}[\d,]+)\s*$/);
    if (!m) continue;
    const fy = Number(m[1]);
    const v = m[2].trim().split(/\s+/).map((x) => Number(x.replace(/,/g, "")));
    const sectors = v.slice(0, 9).reduce((s, x) => s + x, 0);
    if (sectors !== v[9]) fail(`southwest sectors FY${fy}: sectors add up to ${sectors}, printed total ${v[9]}`);
    if (out.has(fy)) fail(`southwest sectors: FY${fy} appears twice`);
    out.set(fy, v[9]);
  }
  const years = [...out.keys()].sort((a, b) => a - b);
  if (!years.length) fail("southwest sectors: no rows read");
  years.forEach((y, i) => y !== years[0] + i && fail(`southwest sectors: years not contiguous at FY${y}`));
  return out;
}

// ---------------------------------------------------------------- OHSS workbooks (row-numbered extracts)

export interface SheetRow {
  row: number;
  cells: string[];
}

/** Split a row-numbered workbook extract (`## sheet: <name>`, then `<row>\t<cell> | <cell>`) into sheets. */
export function parseSheets(text: string): Map<string, SheetRow[]> {
  const out = new Map<string, SheetRow[]>();
  let cur: SheetRow[] | null = null;
  for (const line of text.split("\n")) {
    const h = line.match(/^## sheet: (.+)$/);
    if (h) out.set(h[1], (cur = []));
    else if (cur && /^\d+\t/.test(line)) {
      const [row, rest] = line.split("\t", 2);
      cur.push({ row: Number(row), cells: rest.split(" | ").map((c) => c.trim()) });
    }
  }
  return out;
}

const sheet = (sheets: Map<string, SheetRow[]>, name: string, where: string) => sheets.get(name) ?? fail(`${where}: no sheet "${name}"`);

export interface OhssYear {
  fy: number;
  value: number;
  row: number;
}

/** KHSM "Annual Count": `Fiscal Year | Quantity`. */
export function parseKhsmCount(rows: readonly SheetRow[], where: string): Map<number, OhssYear> {
  if (rows[0]?.cells.join("|") !== "Fiscal Year|Quantity") fail(`${where}: Annual Count header changed: ${rows[0]?.cells.join(" | ")}`);
  const out = new Map<number, OhssYear>();
  for (const r of rows.slice(1)) {
    if (!/^\d{4}$/.test(r.cells[0]) || !/^\d+$/.test(r.cells[1] ?? "")) fail(`${where}: unreadable row ${r.row}: ${r.cells.join(" | ")}`);
    out.set(Number(r.cells[0]), { fy: Number(r.cells[0]), value: Number(r.cells[1]), row: r.row });
  }
  return out;
}

/** KHSM "Annual Region": `Fiscal Year | Region | Quantity`. */
export function parseKhsmRegions(rows: readonly SheetRow[], where: string): Map<number, Map<string, OhssYear>> {
  if (rows[0]?.cells.join("|") !== "Fiscal Year|Region|Quantity") fail(`${where}: Annual Region header changed: ${rows[0]?.cells.join(" | ")}`);
  const out = new Map<number, Map<string, OhssYear>>();
  for (const r of rows.slice(1)) {
    if (!/^\d{4}$/.test(r.cells[0]) || !/^\d+$/.test(r.cells[2] ?? "")) fail(`${where}: unreadable row ${r.row}: ${r.cells.join(" | ")}`);
    const fy = Number(r.cells[0]);
    if (!out.has(fy)) out.set(fy, new Map());
    out.get(fy)!.set(r.cells[1], { fy, value: Number(r.cells[2]), row: r.row });
  }
  return out;
}

export interface OhssTrack {
  count: Map<number, OhssYear>;
  southwest: Map<number, OhssYear>;
  /** KHSM's newest year runs only to the data cut-off (November): it is never compared or used. */
  partialFy: number;
}

function readKhsm(text: string, where: string): OhssTrack {
  const sheets = parseSheets(text);
  const count = parseKhsmCount(sheet(sheets, "Annual Count", where), where);
  const regions = parseKhsmRegions(sheet(sheets, "Annual Region", where), where);
  const southwest = new Map<number, OhssYear>();
  for (const [fy, rs] of regions) {
    const total = count.get(fy) ?? fail(`${where}: FY${fy} has regions but no count`);
    const sum = [...rs.values()].reduce((s, r) => s + r.value, 0);
    // Each cell is rounded to the nearest ten on its own, so the regions may miss the count by up to 5 per region.
    if (Math.abs(sum - total.value) > 5 * rs.size) fail(`${where} FY${fy}: regions add up to ${sum}, count ${total.value}`);
    southwest.set(fy, rs.get("Southwest Land Border") ?? fail(`${where} FY${fy}: no Southwest Land Border row`));
  }
  return { count, southwest, partialFy: Math.max(...count.keys()) };
}

/** OHSS Yearbook Table 36 (OFO encounters, FY2005 on): `Year | Total | Administrative | Enforcement`. */
export function parseYearbookOfo(rows: readonly SheetRow[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const r of rows) if (/^\d{4}$/.test(r.cells[0]) && /^\d+$/.test(r.cells[1] ?? "")) out.set(Number(r.cells[0]), Number(r.cells[1]));
  if (!out.size) fail("OHSS Yearbook Table 36: no rows read");
  return out;
}

// ---------------------------------------------------------------- encounters CSVs

const MONTH_ORDER = ["OCT", "NOV", "DEC", "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP"] as const;
const COMPONENTS: Readonly<Record<string, EncounterComponent>> = { "U.S. Border Patrol": "usbp", "Office of Field Operations": "ofo" };
const AUTHORITIES: Readonly<Record<string, EncounterAuthority>> = { "Title 8": "title8", "Title 42": "title42" };
const REGIONS = new Set(["Southwest Land Border", "Northern Land Border", "Other"]);
/** The data dictionary's rule: Title 8 for USBP = Apprehensions; Title 8 for OFO = Inadmissibles; Title 42 = Expulsions. */
const ENCOUNTER_TYPE: Readonly<Record<string, string>> = { "usbp|title8": "Apprehensions", "ofo|title8": "Inadmissibles", "usbp|title42": "Expulsions", "ofo|title42": "Expulsions" };

export interface CsvYear {
  fy: number;
  /** The file labels the year "(FYTD)": still in progress when posted. */
  inProgress: boolean;
  /** YYYY-MM -> key -> value. */
  months: Map<string, Map<Key, number>>;
}

/** Calendar month of a fiscal-year month: October–December fall in the prior calendar year. */
export function calendarMonth(fy: number, abbr: string): string {
  const i = MONTH_ORDER.indexOf(abbr as (typeof MONTH_ORDER)[number]);
  if (i < 0) fail(`unknown month "${abbr}"`);
  return `${i < 3 ? fy - 1 : fy}-${String(((i + 9) % 12) + 1).padStart(2, "0")}`;
}

/** One encounters CSV, summed to (fiscal year, month, scope, component, authority). Nationwide is every region; southwest is "Southwest Land Border". */
export function parseEncountersCsv(csv: string, where: string): Map<number, CsvYear> {
  const rows = parse(csv, { columns: true, skip_empty_lines: true, bom: true }) as Record<string, string>[];
  const need = ["Fiscal Year", "Month (abbv)", "Component", "Land Border Region", "Title of Authority", "Encounter Type", "Encounter Count"];
  for (const c of need) if (rows.length && !(c in rows[0])) fail(`${where}: column "${c}" missing (columns: ${Object.keys(rows[0]).join(", ")})`);
  const out = new Map<number, CsvYear>();
  rows.forEach((r, i) => {
    const at = `${where} row ${i + 2}`;
    const fyM = r["Fiscal Year"].match(/^(\d{4})( \(FYTD\))?$/) ?? fail(`${at}: unreadable fiscal year "${r["Fiscal Year"]}"`);
    const fy = Number(fyM[1]);
    const component = COMPONENTS[r["Component"]] ?? fail(`${at}: unknown component "${r["Component"]}"`);
    const authority = AUTHORITIES[r["Title of Authority"]] ?? fail(`${at}: unknown title of authority "${r["Title of Authority"]}"`);
    if (!REGIONS.has(r["Land Border Region"])) fail(`${at}: unknown land border region "${r["Land Border Region"]}"`);
    if (r["Encounter Type"] !== ENCOUNTER_TYPE[`${component}|${authority}`]) fail(`${at}: ${r["Component"]} ${r["Title of Authority"]} is "${r["Encounter Type"]}", expected "${ENCOUNTER_TYPE[`${component}|${authority}`]}"`);
    const count = r["Encounter Count"].replace(/,/g, "");
    if (!/^\d+$/.test(count)) fail(`${at}: unreadable count "${r["Encounter Count"]}"`);
    const year = out.get(fy) ?? { fy, inProgress: false, months: new Map() };
    out.set(fy, year);
    year.inProgress ||= fyM[2] !== undefined;
    const month = calendarMonth(fy, r["Month (abbv)"]);
    const cell = year.months.get(month) ?? new Map<Key, number>();
    year.months.set(month, cell);
    const scopes: EncounterScope[] = r["Land Border Region"] === "Southwest Land Border" ? ["nationwide", "southwest"] : ["nationwide"];
    for (const s of scopes) cell.set(key(s, component, authority), (cell.get(key(s, component, authority)) ?? 0) + Number(count));
  });
  for (const y of out.values()) if (!y.inProgress && y.months.size !== 12) fail(`${where}: FY${y.fy} is not labelled year-to-date but has ${y.months.size} months`);
  return out;
}

/** A year's totals by key, from its months. */
function yearTotals(y: CsvYear): Map<Key, number> {
  const out = new Map<Key, number>();
  for (const cell of y.months.values()) for (const [k, v] of cell) out.set(k, (out.get(k) ?? 0) + v);
  return out;
}

const MONTH_RANK = ["oct", "nov", "dec", "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep"];
/** Later is newer: by last fiscal year, then last month (no month = posted after the last year ended). */
export const vintageOrder = (v: EncountersVintage) => v.fy_end * 100 + (v.through === null ? 12 : MONTH_RANK.indexOf(v.through));

// ---------------------------------------------------------------- build

export interface EncountersBuild {
  series: EncountersSeriesRow[];
  monthly: EncountersMonthRow[];
  notes: EncountersNote[];
  report: Record<string, unknown>;
}

const pct = (a: number, b: number) => (b === 0 ? (a === 0 ? 0 : Infinity) : Math.abs(a - b) / b);
const round4 = (x: number) => Math.round(x * 10000) / 10000;

export function buildEncounters(input: EncountersBuildInput): EncountersBuild {
  const { catalog } = input;
  const sourceById = new Map(catalog.sources.map((s) => [s.id, s]));
  const src = (id: string, where: string) => sourceById.get(id) ?? fail(`${where}: unknown source "${id}"`);
  const tol = catalog.overlap_tolerance;

  // --- exceptions: each must be used by a check below, or it is stale ---
  const exceptionUsed = new Set<string>();
  const findException = (fy: number, scope: EncounterScope, component: PrintedRow["component"], between: readonly string[], values: readonly number[]): OverlapException | undefined => {
    const e = catalog.exceptions.find(
      (x) => x.fy === fy && x.scope === scope && x.component === component && between.every((b) => x.between.includes(b)) && values.every((v) => x.values.includes(v)),
    );
    if (e) exceptionUsed.add(e.id);
    return e;
  };

  // --- curated printed rows: quotes ---
  for (const p of catalog.printed) {
    const s = src(p.source, `printed ${p.id}`);
    if (s.role !== "printed") fail(`printed ${p.id}: source ${s.id} has role ${s.role}, expected printed`);
    checkQuote(input, `printed ${p.id}`, p.source, p.evidence, Object.values(p.values));
  }
  // Printed parts add up to the printed total, row set by row set (one page, one scope).
  const printedChecks: unknown[] = [];
  for (const total of catalog.printed.filter((p) => p.component === "total")) {
    const parts = catalog.printed.filter((p) => p.source === total.source && p.scope === total.scope && p.component !== "total");
    for (const fy of Object.keys(total.values)) {
      const vals = parts.map((p) => p.values[fy]);
      if (vals.some((v) => v === undefined)) fail(`printed ${total.id} FY${fy}: no part rows for the year`);
      const sum = vals.reduce((s, v) => s + v!, 0);
      if (sum === total.values[fy]) continue;
      // A misprinted part or a total out of step with its parts: allowed only by a catalog exception naming the row.
      const e =
        parts.map((p) => findException(Number(fy), total.scope, p.component, [p.id], [p.values[fy]])).find(Boolean) ??
        findException(Number(fy), total.scope, "total", [total.id], [total.values[fy], sum]);
      if (!e) fail(`printed ${total.id} FY${fy}: parts add up to ${sum}, printed total ${total.values[fy]}`);
      printedChecks.push({ fy: Number(fy), page: total.source, parts_sum: sum, total: total.values[fy], exception: e!.id });
    }
  }

  // --- notes: quotes ---
  for (const n of catalog.notes) {
    if (n.source === null) {
      if (n.evidence.length) fail(`note ${n.id}: evidence without a source`);
      continue;
    }
    src(n.source, `note ${n.id}`);
    if (!n.evidence.length) fail(`note ${n.id}: a sourced note needs at least one quote`);
    for (const e of n.evidence) checkQuote(input, `note ${n.id}`, n.source, e, []);
    if (n.fy_end !== null && n.fy_end < n.fy_start) fail(`note ${n.id}: fy_end before fy_start`);
  }

  // --- tables ---
  const natHist = parseNationwideHistory(textOf(input, "usbp-nationwide-history", "USBP history"));
  const swHist = parseSouthwestSectors(textOf(input, "usbp-southwest-sectors", "southwest sectors"));
  const ofoOhss = readKhsm(textOf(input, "ohss-khsm-ofo", "KHSM OFO"), "KHSM OFO");
  const usbpOhss = readKhsm(textOf(input, "ohss-khsm-usbp", "KHSM USBP"), "KHSM USBP");
  const yearbookOfo = parseYearbookOfo(sheet(parseSheets(textOf(input, "ohss-yearbook-2023-enforcement", "Yearbook")), "Table 36", "Yearbook"));

  // --- encounters CSVs: each year from the newest file that has it ---
  if (!input.vintages.length) fail("no encounters CSVs (run pnpm fetch:cbp)");
  const parsed = input.vintages.map(({ vintage, csv }) => {
    const years = parseEncountersCsv(csv, vintage.file);
    const fys = [...years.keys()].sort((a, b) => a - b);
    if (fys[0] !== vintage.fy_start || fys.at(-1) !== vintage.fy_end) fail(`${vintage.file}: holds FY${fys[0]}–FY${fys.at(-1)}, named FY${vintage.fy_start}–FY${vintage.fy_end}`);
    return { vintage, years };
  });
  parsed.sort((a, b) => vintageOrder(b.vintage) - vintageOrder(a.vintage));
  const csvYears = new Map<number, { year: CsvYear; file: string; url: string }>();
  const csvOverlaps: unknown[] = [];
  for (const { vintage, years } of parsed) {
    for (const [fy, y] of years) {
      const kept = csvYears.get(fy);
      if (!kept) {
        csvYears.set(fy, { year: y, file: vintage.file, url: vintage.url });
        continue;
      }
      // An older file's figures for a year a newer file also has: compared, never used. A year that was in progress in the older file is skipped.
      if (y.inProgress) continue;
      const a = yearTotals(kept.year);
      const b = yearTotals(y);
      let maxDiff = 0;
      for (const k of new Set([...a.keys(), ...b.keys()])) {
        const d = pct(b.get(k) ?? 0, a.get(k) ?? 0);
        if (d > tol) fail(`FY${fy} ${k}: ${vintage.file} has ${b.get(k) ?? 0}, newer ${kept.file} has ${a.get(k) ?? 0} (beyond ${tol * 100}%)`);
        maxDiff = Math.max(maxDiff, Math.abs((b.get(k) ?? 0) - (a.get(k) ?? 0)));
      }
      csvOverlaps.push({ fy, used: kept.file, compared: vintage.file, max_abs_diff: maxDiff });
    }
  }
  const csvFys = [...csvYears.keys()].sort((a, b) => a - b);
  const csvFirst = csvFys[0];
  const lastFy = csvFys.at(-1)!;
  csvFys.forEach((fy, i) => fy !== csvFirst + i && fail(`encounters CSVs: FY${csvFirst + i} is in no file (a year dropped out of the newest range; keep the older file)`));
  for (const { year } of csvYears.values()) if (year.inProgress && year.fy !== lastFy) fail(`FY${year.fy} is year-to-date but is not the newest year`);
  if (catalog.usbp_tables_last_fiscal_year !== csvFirst - 1) fail(`usbp_tables_last_fiscal_year is FY${catalog.usbp_tables_last_fiscal_year}, but the CSVs start in FY${csvFirst}`);
  if (catalog.ofo_cbp_first_fiscal_year >= csvFirst || catalog.ofo_first_fiscal_year >= catalog.ofo_cbp_first_fiscal_year) fail("OFO source years are out of order in the catalog");

  // Title 42 only in its months.
  const t42Months: Record<string, number> = {};
  for (const { year } of csvYears.values()) {
    for (const [month, cell] of year.months) {
      for (const [k, v] of cell) {
        if (!k.endsWith("|title42") || v === 0) continue;
        if (month < TITLE42_FIRST_MONTH || month > TITLE42_LAST_MONTH) fail(`Title 42 ${k} has ${v} in ${month}, outside ${TITLE42_FIRST_MONTH}..${TITLE42_LAST_MONTH}`);
        if (k.startsWith("nationwide|")) t42Months[month] = (t42Months[month] ?? 0) + v;
      }
    }
  }

  // --- printed series values (CBP pages), by scope and component ---
  const printedSeries = new Map<string, { value: number; row: PrintedRow }>();
  for (const p of catalog.printed.filter((x) => x.use === "series")) {
    for (const [fyS, value] of Object.entries(p.values)) {
      const fy = Number(fyS);
      if (fy < catalog.ofo_cbp_first_fiscal_year || fy >= csvFirst) continue;
      if (p.component !== "ofo") fail(`printed ${p.id}: only OFO is taken from the pages`);
      const k = `${fy}|${p.scope}`;
      const prev = printedSeries.get(k);
      if (prev && prev.value !== value && !findException(fy, p.scope, "ofo", [prev.row.id, p.id], [prev.value, value])) {
        fail(`printed FY${fy} ${p.scope} OFO: ${prev.row.id} has ${prev.value}, ${p.id} has ${value}`);
      }
      if (!prev) printedSeries.set(k, { value, row: p });
    }
  }

  // --- the series ---
  const series: EncountersSeriesRow[] = [];
  const monthly: EncountersMonthRow[] = [];
  const asOf = catalog.retrieved_at;
  const notesFor = (fy: number, c: EncounterComponent, preliminary: boolean) =>
    catalog.notes
      .filter((n) => n.fy_start <= fy && (n.fy_end ?? fy) >= fy && n.components.includes(c))
      .filter((n) => n.id !== "operational-data" || preliminary)
      .map((n) => n.id);

  type Draft = Pick<EncountersSeriesRow, "scope" | "component" | "authority" | "value" | "source" | "source_url" | "publisher" | "method" | "location" | "rounding">;
  for (let fy = catalog.first_fiscal_year; fy <= lastFy; fy++) {
    const drafts: Draft[] = [];
    let status: "final" | "preliminary" = "final";
    let months = 12;
    if (fy < csvFirst) {
      const nat = natHist.get(fy) ?? fail(`FY${fy}: not in the USBP history table`);
      const sw = swHist.get(fy) ?? fail(`FY${fy}: not in the southwest sector table`);
      const h = src("usbp-nationwide-history", "series");
      const s = src("usbp-southwest-sectors", "series");
      drafts.push({ scope: "nationwide", component: "usbp", authority: "title8", value: nat, source: h.id, source_url: h.url, publisher: "CBP", method: "table", location: `fiscal year ${fy}`, rounding: null });
      drafts.push({ scope: "southwest", component: "usbp", authority: "title8", value: sw, source: s.id, source_url: s.url, publisher: "CBP", method: "table", location: `fiscal year ${fy}, Southwest Border Total`, rounding: null });
      if (fy >= catalog.ofo_first_fiscal_year && fy < catalog.ofo_cbp_first_fiscal_year) {
        const o = src("ohss-khsm-ofo", "series");
        const n = ofoOhss.count.get(fy) ?? fail(`FY${fy}: no OHSS OFO count`);
        const w = ofoOhss.southwest.get(fy) ?? fail(`FY${fy}: no OHSS OFO southwest figure`);
        if (fy >= ofoOhss.partialFy) fail(`FY${fy}: OHSS's year is partial`);
        drafts.push({ scope: "nationwide", component: "ofo", authority: "title8", value: n.value, source: o.id, source_url: o.url, publisher: "DHS OHSS", method: "table", location: `sheet Annual Count, row ${n.row}`, rounding: 10 });
        drafts.push({ scope: "southwest", component: "ofo", authority: "title8", value: w.value, source: o.id, source_url: o.url, publisher: "DHS OHSS", method: "table", location: `sheet Annual Region, row ${w.row}`, rounding: 10 });
      } else if (fy >= catalog.ofo_cbp_first_fiscal_year) {
        for (const scope of ENCOUNTER_SCOPES) {
          const p = printedSeries.get(`${fy}|${scope}`) ?? fail(`FY${fy}: no printed ${scope} OFO figure`);
          const s2 = src(p.row.source, "series");
          drafts.push({ scope, component: "ofo", authority: "title8", value: p.value, source: s2.id, source_url: s2.url, publisher: "CBP", method: "printed", location: `printed row ${p.row.id}`, rounding: null });
        }
      }
    } else {
      const { year, file, url } = csvYears.get(fy)!;
      const totals = yearTotals(year);
      const hasT42 = [...totals].some(([k, v]) => k.endsWith("|title42") && v > 0);
      status = year.inProgress ? "preliminary" : "final";
      months = year.months.size;
      for (const scope of ENCOUNTER_SCOPES) {
        for (const component of ENCOUNTER_COMPONENTS) {
          for (const authority of ENCOUNTER_AUTHORITIES) {
            if (authority === "title42" && !hasT42) continue;
            const k = key(scope, component, authority);
            const label = `Fiscal Year ${fy}, ${component === "usbp" ? "U.S. Border Patrol" : "Office of Field Operations"}${scope === "southwest" ? ", Southwest Land Border" : ", all regions"}, ${authority === "title8" ? "Title 8" : "Title 42"}`;
            drafts.push({ scope, component, authority, value: totals.get(k) ?? 0, source: file, source_url: url, publisher: "CBP", method: "rows", location: label, rounding: null });
            for (const month of [...year.months.keys()].sort()) {
              monthly.push(encountersMonthRow.parse({ fy, month, scope, component, authority, value: year.months.get(month)!.get(k) ?? 0, status, source: file }));
            }
          }
        }
      }
    }

    // `full`: the CSV years, where every encounter carries its title of authority (Title 42 rows only while it applied).
    const detail: EncounterDetail = fy >= csvFirst ? "full" : drafts.some((d) => d.component === "ofo") ? "components" : "usbp_only";
    const attribution = attributeFiscalYear(fy, input.administrations);
    for (const d of drafts) {
      series.push(
        encountersSeriesRow.parse({
          period: fy,
          period_type: "fiscal_year",
          ...d,
          status,
          months,
          detail,
          as_of: asOf,
          note_ids: notesFor(fy, d.component, status === "preliminary"),
          ...attribution,
        }),
      );
    }
  }

  // --- invariants: schemes never mix, southwest within nationwide ---
  const byFy = new Map<number, EncountersSeriesRow[]>();
  for (const r of series) byFy.set(r.period, [...(byFy.get(r.period) ?? []), r]);
  for (const [fy, rows] of byFy) {
    const keysOf = (s: EncounterScope) => rows.filter((r) => r.scope === s).map((r) => `${r.component}|${r.authority}`).sort().join(",");
    if (keysOf("nationwide") !== keysOf("southwest")) fail(`FY${fy}: nationwide rows (${keysOf("nationwide")}) and southwest rows (${keysOf("southwest")}) differ`);
    for (const c of ENCOUNTER_COMPONENTS) {
      const pubs = new Set(rows.filter((r) => r.component === c).map((r) => r.source));
      if (pubs.size > 2) fail(`FY${fy} ${c}: rows from ${[...pubs].join(", ")}`);
      const nat = rows.filter((r) => r.component === c && r.scope === "nationwide").map((r) => r.publisher);
      const sw = rows.filter((r) => r.component === c && r.scope === "southwest").map((r) => r.publisher);
      if (nat.join() !== sw.join()) fail(`FY${fy} ${c}: nationwide from ${nat.join()}, southwest from ${sw.join()}`);
    }
    if (rows.some((r) => r.authority === "title42") && (fy < 2020 || fy > 2023)) fail(`FY${fy}: Title 42 rows outside FY2020–FY2023`);
    if (rows.some((r) => r.component === "ofo") !== fy >= catalog.ofo_first_fiscal_year) fail(`FY${fy}: OFO rows ${fy >= catalog.ofo_first_fiscal_year ? "missing" : "before FY" + catalog.ofo_first_fiscal_year}`);
    for (const r of rows.filter((x) => x.scope === "southwest")) {
      const n = rows.find((x) => x.scope === "nationwide" && x.component === r.component && x.authority === r.authority)!;
      if (r.value > n.value) fail(`FY${fy} ${r.component} ${r.authority}: southwest ${r.value} exceeds nationwide ${n.value}`);
    }
    if (new Set(rows.map((r) => r.detail)).size !== 1) fail(`FY${fy}: rows disagree on the level of detail`);
  }
  const details = [...byFy.values()].map((rows) => rows[0].detail);
  const order: EncounterDetail[] = ["usbp_only", "components", "full"];
  details.forEach((d, i) => i > 0 && order.indexOf(d) < order.indexOf(details[i - 1]) && fail(`FY${catalog.first_fiscal_year + i}: detail goes back from ${details[i - 1]} to ${d}`));

  const value = (fy: number, scope: EncounterScope, component: PrintedRow["component"]): { value: number; publisher: string } | null => {
    const rows = series.filter((r) => r.period === fy && r.scope === scope && (component === "total" || r.component === component));
    if (!rows.length || (component === "total" && !rows.some((r) => r.component === "ofo"))) return null;
    return { value: rows.reduce((s, r) => s + r.value, 0), publisher: rows.some((r) => r.publisher === "DHS OHSS") ? "DHS OHSS" : "CBP" };
  };

  // --- cross-checks: CBP pages against the series ---
  const pageChecks: unknown[] = [];
  for (const p of catalog.printed) {
    for (const [fyS, printed] of Object.entries(p.values)) {
      const fy = Number(fyS);
      const v = value(fy, p.scope, p.component);
      if (!v) continue;
      const exact = v.publisher === "CBP";
      const ok = exact ? v.value === printed : pct(printed, v.value) <= tol;
      if (ok) {
        pageChecks.push({ fy, printed_row: p.id, printed, series: v.value, ok: true });
        continue;
      }
      const e = findException(fy, p.scope, p.component, [p.id], [printed]);
      if (!e) fail(`FY${fy} ${p.scope} ${p.component}: ${p.id} prints ${printed}, the series has ${v.value}${exact ? "" : ` (beyond ${tol * 100}%)`}`);
      pageChecks.push({ fy, printed_row: p.id, printed, series: v.value, ok: false, exception: e!.id });
    }
  }

  // --- cross-checks: the USBP history tables against the CSVs where both exist (both CBP: exact) ---
  const historyVsCsv: unknown[] = [];
  for (const fy of csvFys) {
    for (const [scope, hist] of [["nationwide", natHist], ["southwest", swHist]] as const) {
      const h = hist.get(fy);
      if (h === undefined) continue;
      const v = value(fy, scope, "usbp")!.value;
      if (h !== v) fail(`FY${fy} ${scope} USBP: history table ${h}, encounters CSV ${v}`);
      historyVsCsv.push({ fy, scope, value: v });
    }
  }

  // --- cross-checks: CBP against OHSS (rounded to tens) ---
  const ohssChecks: { fy: number; scope: EncounterScope; component: EncounterComponent; cbp: number; ohss: number; pct: number; exception?: string }[] = [];
  const compareOhss = (component: EncounterComponent, track: OhssTrack) => {
    for (const fy of [...track.count.keys()].sort((a, b) => a - b)) {
      if (fy >= track.partialFy) continue;
      for (const scope of ENCOUNTER_SCOPES) {
        const o = (scope === "nationwide" ? track.count : track.southwest).get(fy);
        const cbpRows = series.filter((r) => r.period === fy && r.scope === scope && r.component === component);
        // Only CBP's own figures are compared: OHSS's FY2004–FY2014 OFO rows are the OHSS figures themselves.
        if (!o || !cbpRows.length || cbpRows.some((r) => r.publisher !== "CBP")) continue;
        const cbp = cbpRows.reduce((s, r) => s + r.value, 0);
        const d = pct(o.value, cbp);
        const row = { fy, scope, component, cbp, ohss: o.value, pct: round4(d * 100) };
        if (d > tol) {
          const e = findException(fy, scope, component, ["ohss"], [cbp, o.value]) ?? fail(`FY${fy} ${scope} ${component}: CBP ${cbp}, OHSS ${o.value} (${row.pct}%, beyond ${tol * 100}%)`);
          ohssChecks.push({ ...row, exception: e.id });
        } else ohssChecks.push(row);
      }
    }
  };
  compareOhss("usbp", usbpOhss);
  compareOhss("ofo", ofoOhss);
  // The OHSS Yearbook's OFO table against KHSM: the same OHSS records, so the same numbers.
  const yearbookVsKhsm = [...yearbookOfo].map(([fy, v]) => ({ fy, yearbook: v, khsm: ofoOhss.count.get(fy)?.value ?? null }));
  for (const r of yearbookVsKhsm) if (r.khsm === null || r.khsm !== r.yearbook) fail(`FY${r.fy} OFO: OHSS Yearbook ${r.yearbook}, KHSM ${r.khsm}`);

  for (const e of catalog.exceptions) if (!exceptionUsed.has(e.id)) fail(`exception ${e.id} is no longer needed (the sources now agree, or its values changed): remove or update it`);

  // --- notes: markers fall in their fiscal-year range ---
  for (const n of catalog.notes) {
    if (!n.marker) continue;
    const d = n.marker.date;
    const fy = Number(d.slice(0, 4)) + (Number(d.slice(5, 7)) >= 10 ? 1 : 0);
    if (fy < n.fy_start || (n.fy_end !== null && fy > n.fy_end)) fail(`note ${n.id}: marker ${d} is in FY${fy}, outside FY${n.fy_start}–FY${n.fy_end ?? "now"}`);
  }

  const coverage = (pred: (r: EncountersSeriesRow) => boolean) => {
    const fys = [...new Set(series.filter(pred).map((r) => r.period))].sort((a, b) => a - b);
    return fys.length ? { first: fys[0], last: fys.at(-1)! } : null;
  };
  const report = {
    first_period: catalog.first_fiscal_year,
    last_period: lastFy,
    rows: series.length,
    monthly_rows: monthly.length,
    coverage: {
      usbp: coverage((r) => r.component === "usbp"),
      ofo: coverage((r) => r.component === "ofo"),
      title42: coverage((r) => r.authority === "title42"),
      detail: Object.fromEntries(order.map((d) => [d, coverage((r) => r.detail === d)])),
    },
    sources_by_year: Object.fromEntries(
      ENCOUNTER_COMPONENTS.map((c) => {
        const spans: { source: string; first: number; last: number }[] = [];
        for (const r of series.filter((x) => x.component === c && x.scope === "nationwide" && x.authority === "title8")) {
          const last = spans.at(-1);
          if (last && last.source === r.source && last.last === r.period - 1) last.last = r.period;
          else spans.push({ source: r.source, first: r.period, last: r.period });
        }
        return [c, spans];
      }),
    ),
    status: Object.fromEntries(["final", "preliminary"].map((s) => [s, [...new Set(series.filter((r) => r.status === s).map((r) => r.period))].length])),
    preliminary: series.filter((r) => r.status === "preliminary").map((r) => ({ fy: r.period, months: r.months }))[0] ?? null,
    blended_periods: [...new Set(series.filter((r) => r.blended).map((r) => r.period))],
    encounters_files: [...parsed].reverse().map(({ vintage }) => ({ file: vintage.file, fy_start: vintage.fy_start, fy_end: vintage.fy_end, through: vintage.through, posted: vintage.posted, years_used: [...csvYears].filter(([, v]) => v.file === vintage.file).map(([fy]) => fy) })),
    csv_overlaps: csvOverlaps,
    title42_months: Object.fromEntries(Object.entries(t42Months).sort()),
    printed_totals: printedChecks,
    pages_vs_series: pageChecks,
    history_tables_vs_csv: historyVsCsv,
    cbp_vs_ohss: { tolerance_pct: tol * 100, largest: [...ohssChecks].sort((a, b) => b.pct - a.pct).slice(0, 10), checked: ohssChecks.length },
    ohss_yearbook_vs_khsm: { checked: yearbookVsKhsm.length, identical: true },
    exceptions: catalog.exceptions.map((e) => ({ id: e.id, kind: e.kind, fy: e.fy, scope: e.scope, component: e.component, values: e.values })),
  };

  return {
    series,
    monthly,
    notes: [...catalog.notes].sort((a, b) => a.fy_start - b.fy_start || a.id.localeCompare(b.id)),
    report,
  };
}

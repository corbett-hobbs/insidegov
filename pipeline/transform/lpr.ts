import type { Administration } from "../../lib/executive-orders-entities";
import {
  BUCKET_KEYS,
  LPR_CLASSES,
  lprCountryRow,
  lprRegionRow,
  LPR_REGIONS,
  type LprRegion,
  type LprRegionRow,
  lprSeriesRow,
  type AdmissionType,
  type CountryBasis,
  type LprCatalog,
  type LprClass,
  type LprCountryRow,
  type LprMetric,
  type LprNote,
  type LprSeriesRow,
  type OhssSource,
  type OhssTable,
} from "../../lib/lpr-entities";
import { columnLetters } from "../fetch/workbook-lib";
import { attributeFiscalYear, normalizeText } from "./enforcement";
import { LPR_NAME_TABLES } from "./lpr-country-names";
import { resolveCountry, type CountryIndex } from "./removals-country-names";

/**
 * Pure logic for the legal-immigration track, part one: green cards (persons obtaining lawful
 * permanent resident status, "LPRs") and naturalizations. The runner (`lpr-run.ts`) reads the files.
 * Catalog + workbook text extracts in raw/ohss -> lpr_{series,by_country,notes,report}.json.
 *
 * Which table a year comes from (never averaged, never mixed within a year):
 *   - LPRs: the newest Yearbook whose class table (Table 6) covers the year gives the total, the
 *     classes and new arrivals vs. adjustments, so the parts add up to the printed total. Years no
 *     class table covers come from the newest Yearbook's Table 1 (total only).
 *   - Naturalizations: the newest Yearbook's long table (Table 20/21) gives the total.
 *   - By country: the newest Yearbook country-of-birth table covering the year.
 *   - Years after the newest Yearbook: the quarterly report (preliminary; country of nationality).
 *
 * Fails the build unless:
 *   - every table is found by its verbatim title, and its header years match the title's range;
 *   - every cell is a count, "D" (withheld), "-" (zero), and a table marked rounded has only
 *     multiples of ten;
 *   - in each class table: sub-classes add up to their major class, classes to the total, and new
 *     arrivals plus adjustments to the total, per class (exactly, or within the rounding bound);
 *   - country rows (plus "All other countries", "Unknown" and any withheld remainder) add up to the
 *     printed total, and regions too;
 *   - every country name resolves to a key (`LPR_ALIASES`);
 *   - two Yearbook editions agree on every shared national value (total, class, type) within
 *     rounding, or the difference is recorded in the catalog's `restatements` (and every recorded
 *     restatement still occurs);
 *   - the quarterly report's national totals are within 3% of the Yearbook's for shared years;
 *   - every note's quote is in its source.
 * Missing is missing: no value is estimated or interpolated.
 */

export class LprDataError extends Error {}

const fail = (msg: string): never => {
  throw new LprDataError(msg);
};

/** Quarterly report vs. Yearbook national totals: beyond this relative difference the build fails (a misread table, not a revision). */
export const QUARTERLY_TOLERANCE = 0.03;

// ---------------------------------------------------------------- extracts

export interface XRow {
  row: number;
  cells: string[];
}
export interface XSheet {
  name: string;
  rows: XRow[];
}

/** Split a `pnpm fetch:ohss` extract (`## sheet: <name>`, then `<row>\t<cell> | <cell>` lines) into sheets. */
export function parseExtract(text: string): XSheet[] {
  const sheets: XSheet[] = [];
  for (const line of text.split("\n")) {
    const m = line.match(/^## sheet: (.+)$/);
    if (m) {
      sheets.push({ name: m[1], rows: [] });
      continue;
    }
    if (!line.trim()) continue;
    const t = line.match(/^(\d+)\t(.*)$/);
    if (!t || !sheets.length) throw new LprDataError(`extract line without a row number: "${line.slice(0, 60)}"`);
    sheets[sheets.length - 1].rows.push({ row: Number(t[1]), cells: t[2].split(" | ").map((c) => c.trim()) });
  }
  return sheets;
}

/** A1 reference of a cell. */
export const cellRef = (row: number, col: number) => `${columnLetters(col)}${row}`;

/** A parsed count: a number, zero ("-"), withheld ("D"), or no value: "X" (not applicable: the country did not exist yet) or "NA" (not available: the class was not counted separately yet). */
export interface Count {
  value: number | null;
  withheld: boolean;
  notApplicable?: boolean;
  cell: string;
}

export function parseCount(s: string | undefined, cell: string, where: string): Count {
  const v = (s ?? "").replace(/,/g, "").trim();
  if (/^\d+$/.test(v)) return { value: Number(v), withheld: false, cell };
  if (v === "-" || v === "0") return { value: 0, withheld: false, cell };
  if (v === "D") return { value: null, withheld: true, cell };
  if (v === "X" || v === "NA") return { value: null, withheld: false, notApplicable: true, cell };
  return fail(`${where} ${cell}: "${s ?? ""}" is not a count`);
}

/** Footnote markers: digits glued to or spaced after a label, or superscripts (the older editions use "¹"). */
const FOOTNOTE = /(?:(?<=[a-z)])\d+|\s+\d|[¹²³⁴⁵⁶⁷⁸⁹⁰]+)$/i;
const label = (s: string) => normalizeText(s).replace(FOOTNOTE, "").trim();
const key = (s: string) => label(s).toLowerCase();

/** Footnote digits OHSS glues to a year ("1976 1", "2022" + "2" -> "20222" in one title). */
const yearCell = (s: string): number | null => {
  const m = s.trim().match(/^(\d{4})(?:\s*\d|[¹²³⁴⁵⁶⁷⁸⁹⁰]+)?$/);
  return m ? Number(m[1]) : null;
};

export interface TableContext {
  table: OhssTable;
  source: OhssSource;
  sheet: XSheet;
  /** Row index (in `sheet.rows`) of the title. */
  titleAt: number;
}

export function locateTable(table: OhssTable, source: OhssSource, sheets: readonly XSheet[]): TableContext {
  const name = table.member ? `${table.member}!${table.sheet}` : table.sheet;
  const sheet = sheets.find((s) => s.name === name) ?? fail(`${table.id}: sheet "${name}" not in ${source.text_file} (run pnpm fetch:ohss)`);
  const titleAt = sheet.rows.findIndex((r) => normalizeText(r.cells[0] ?? "") === normalizeText(table.title));
  if (titleAt < 0) fail(`${table.id}: title "${table.title}" not found in ${name}`);
  return { table, source, sheet, titleAt };
}

/** Every numeric cell of a rounded table must be a multiple of ten. */
function checkRounding(ctx: TableContext, counts: Iterable<Count>) {
  if (ctx.table.rounding !== 10) return;
  for (const c of counts) if (c.value !== null && c.value % 10 !== 0) fail(`${ctx.table.id} ${c.cell}: ${c.value} is not rounded to 10 although the table is marked rounded`);
}

/** Largest difference rounding alone can cause between n rounded parts and a rounded total. */
const roundingSlack = (rounding: 10 | null, parts: number) => (rounding ? (rounding / 2) * (parts + 1) : 0);

function checkSum(where: string, parts: readonly Count[], total: Count, rounding: 10 | null): void {
  if (parts.some((p) => p.withheld)) return; // a withheld part is handled by the caller
  const sum = parts.reduce((s, p) => s + (p.value ?? 0), 0);
  const slack = roundingSlack(rounding, parts.length);
  if (total.value === null) fail(`${where}: total ${total.cell} is withheld`);
  if (Math.abs(sum - total.value!) > slack) {
    fail(`${where}: parts (${parts.map((p) => p.cell).join("+")}) sum to ${sum}, printed total ${total.cell} = ${total.value}${slack ? ` (rounding allows ±${slack})` : ""}`);
  }
}

// ---------------------------------------------------------------- long tables (Table 1, naturalization table)

export interface LongValue {
  fy: number;
  count: Count;
}

/** Yearbook Table 1 (Year | Number pairs) or the naturalization table (Total persons naturalized column). */
export function readLong(ctx: TableContext): Map<number, Count> {
  const { table, sheet, titleAt } = ctx;
  const out = new Map<number, Count>();
  const rows = sheet.rows.slice(titleAt + 1);
  if (table.layout === "lpr_long") {
    const header = rows.find((r) => r.cells[0] === "Year" && r.cells[1] === "Number") ?? fail(`${table.id}: "Year | Number" header not found`);
    if (header.cells.length % 2 !== 0) fail(`${table.id}: header is not Year | Number pairs`);
    for (const r of rows.filter((x) => x.row > header.row)) {
      for (let c = 0; c + 1 < r.cells.length; c += 2) {
        const fy = yearCell(r.cells[c]);
        if (fy === null) continue;
        if (out.has(fy)) fail(`${table.id}: FY${fy} printed twice`);
        out.set(fy, parseCount(r.cells[c + 1], cellRef(r.row, c + 1), table.id));
      }
    }
  } else if (table.layout === "naturalization_long") {
    // The header spans one to three rows ("Year | Applications filed | Total persons naturalized | ..."; " | Petitions | Persons
    // naturalized" over "Year | filed | Total | ..."; "Year | Petitions filed | Persons naturalized" over " |  | Total | ..."):
    // the column is the one headed "Persons naturalized" and "Total", or "Total persons naturalized".
    const firstData = rows.findIndex((r) => yearCell(r.cells[0]) !== null);
    const header = rows.slice(Math.max(0, firstData - 3), Math.max(0, firstData));
    if (!header.some((r) => r.cells[0] === "Year")) fail(`${table.id}: "Year" header not found`);
    const width = Math.max(...header.map((r) => r.cells.length));
    const col = Array.from({ length: width }, (_, i) => i).find((i) => {
      const heads = header.map((r) => r.cells[i] ?? "");
      return heads.includes("Total persons naturalized") || (heads.includes("Total") && heads.some((h) => /^Persons naturalized$/i.test(h)));
    });
    if (col === undefined) fail(`${table.id}: no "Persons naturalized: Total" column in ${header.map((r) => r.cells.join(" | ")).join(" / ")}`);
    for (const r of rows.slice(firstData)) {
      const fy = yearCell(r.cells[0]);
      if (fy === null) continue;
      if (out.has(fy)) fail(`${table.id}: FY${fy} printed twice`);
      out.set(fy, parseCount(r.cells[col!], cellRef(r.row, col!), table.id));
    }
  } else fail(`${table.id}: readLong cannot read layout ${table.layout}`);
  checkRounding(ctx, out.values());
  const range = table.title.match(/FISCAL YEARS (\d{4}) TO (\d{4})/);
  if (!range) fail(`${table.id}: title has no year range`);
  const [first, last] = [Number(range![1]), Number(range![2])];
  for (let fy = first; fy <= last; fy++) if (!out.has(fy)) fail(`${table.id}: FY${fy} missing although the title covers ${first}–${last}`);
  if ([...out.keys()].some((fy) => fy < first || fy > last)) fail(`${table.id}: years outside the title's range`);
  return out;
}

// ---------------------------------------------------------------- class tables

const MAJOR_CLASSES: Readonly<Record<string, LprClass>> = {
  "immediate relatives of u.s. citizens": "immediate_relatives",
  "family-sponsored preferences": "family_preference",
  "employment-based preferences": "employment_preference",
  diversity: "diversity",
  refugees: "refugees",
  asylees: "asylees",
};

/** Printed classes grouped into `other`. A printed class not listed here (or above) fails the build. */
export const OTHER_CLASS_ROWS: readonly string[] = [
  "parolees",
  "children born abroad to alien residents",
  "children born abroad to noncitizen residents",
  "nicaraguan adjustment and central american relief act (nacara)",
  "haitian refugee immigration fairness act (hrifa)",
  "cancellation of removal",
  "certain iraqis and afghans employed by u.s. government and their spouses and children",
  "victims of human trafficking",
  "victims of crimes and their immediate relatives",
  "victims of crimes and their spouses and children",
  "other",
];

/** Sub-classes printed under a major class (they add up to it). */
const SUB_CLASS: Partial<Record<LprClass, RegExp>> = {
  immediate_relatives: /^(spouses|children|parents)$/,
  family_preference: /^(first|second|third|fourth):/,
  employment_preference: /^(first|second|third|fourth|fifth):/,
};

export interface ClassCell {
  value: number;
  cells: string[];
  method: "printed" | "sum" | "residual";
}

/** One fiscal year x one admission type (null = all) of a class table. */
export interface ClassYear {
  total: Count;
  classes: Map<LprClass, ClassCell>;
  /** Printed `other` rows, by label (for the era notes and the report). */
  otherRows: Map<string, Count>;
}

export type ClassTable = Map<number, Map<AdmissionType | null, ClassYear>>;

interface ClassRowSet {
  type: AdmissionType | null;
  rows: { label: string; counts: Count[] }[];
}

function groupClasses(where: string, set: ClassRowSet, i: number, rounding: 10 | null, defect = false): ClassYear {
  let total: Count | null = null;
  const majors = new Map<LprClass, Count>();
  const subs = new Map<LprClass, Count[]>();
  const otherRows = new Map<string, Count>();
  let current: LprClass | null = null;
  for (const r of set.rows) {
    const k = key(r.label);
    const c = r.counts[i];
    if (k === "total") {
      total = c;
      current = null;
    } else if (MAJOR_CLASSES[k]) {
      current = MAJOR_CLASSES[k];
      if (majors.has(current)) fail(`${where}: "${r.label}" printed twice`);
      majors.set(current, c);
    } else if (current && SUB_CLASS[current]?.test(k)) {
      subs.set(current, [...(subs.get(current) ?? []), c]);
    } else if (OTHER_CLASS_ROWS.includes(k)) {
      current = null;
      if (otherRows.has(label(r.label))) fail(`${where}: "${r.label}" printed twice`);
      otherRows.set(label(r.label), c);
    } else fail(`${where}: unknown class of admission "${r.label}" (add it to OTHER_CLASS_ROWS or the major classes in lpr.ts)`);
  }
  if (!total) return fail(`${where}: no Total row`);
  for (const cls of LPR_CLASSES.filter((c) => c !== "other")) if (!majors.has(cls)) fail(`${where}: class "${cls}" missing`);
  for (const [cls, parts] of subs) checkSum(`${where} ${cls} sub-classes`, parts, majors.get(cls)!, rounding);
  for (const [cls, c] of majors) if (c.withheld) fail(`${where}: major class ${cls} (${c.cell}) is withheld`);

  const classes = new Map<LprClass, ClassCell>();
  for (const [cls, c] of majors) classes.set(cls, { value: c.value!, cells: [c.cell], method: "printed" });
  const others = [...otherRows.values()];
  if (others.some((o) => o.withheld)) {
    // A withheld "other" class: the group is the printed total minus the printed major classes.
    const known = [...majors.values()].reduce((s, c) => s + c.value!, 0);
    const residual = total.value! - known;
    const printed = others.reduce((s, o) => s + (o.value ?? 0), 0);
    if (rounding !== null) fail(`${where}: a withheld cell in a rounded table`);
    if (residual < printed + others.filter((o) => o.withheld).length) fail(`${where}: other = total - major classes = ${residual}, less than its printed rows (${printed}) plus one per withheld cell`);
    classes.set("other", { value: residual, cells: [total.cell, ...[...majors.values()].map((c) => c.cell)], method: "residual" });
  } else {
    const printed = others.filter((o) => !o.notApplicable);
    classes.set("other", { value: printed.reduce((s, o) => s + o.value!, 0), cells: printed.map((o) => o.cell), method: printed.length === 1 ? "printed" : "sum" });
    if (!defect) checkSum(`${where} classes`, [...majors.values(), ...others], total, rounding);
  }
  return { total, classes, otherRows };
}

const TYPE_SECTIONS: Readonly<Record<string, AdmissionType | null>> = { TOTAL: null, "ADJUSTMENTS OF STATUS": "adjustment", "NEW ARRIVALS": "new_arrival" };

/** Yearbook Table 6: ten fiscal years, sections TOTAL / ADJUSTMENTS OF STATUS / NEW ARRIVALS. */
export function readClassByYear(ctx: TableContext): ClassTable {
  const { table, sheet, titleAt } = ctx;
  const rows = sheet.rows.slice(titleAt + 1);
  const header = rows.find((r) => r.cells[0] === "Type and class of admission") ?? fail(`${table.id}: header row not found`);
  const fys = header.cells.slice(1).map((c) => yearCell(c) ?? fail(`${table.id}: header cell "${c}" is not a year`));
  checkTitleYears(table, fys);
  const sets: ClassRowSet[] = [];
  for (const r of rows.filter((x) => x.row > header.row)) {
    if (r.cells.length === 1 && r.cells[0] in TYPE_SECTIONS) {
      sets.push({ type: TYPE_SECTIONS[r.cells[0]], rows: [] });
      continue;
    }
    if (r.cells.length !== fys.length + 1) continue; // footnotes
    if (!sets.length) fail(`${table.id} row ${r.row}: data before the TOTAL section`);
    sets[sets.length - 1].rows.push({ label: r.cells[0], counts: fys.map((_, i) => parseCount(r.cells[i + 1], cellRef(r.row, i + 1), table.id)) });
  }
  if (sets.map((s) => s.type).join() !== [null, "adjustment", "new_arrival"].join()) fail(`${table.id}: sections are not TOTAL, ADJUSTMENTS OF STATUS, NEW ARRIVALS`);
  checkRounding(ctx, sets.flatMap((s) => s.rows.flatMap((r) => r.counts)));
  const out: ClassTable = new Map();
  fys.forEach((fy, i) => {
    const byType = new Map<AdmissionType | null, ClassYear>();
    for (const s of sets) byType.set(s.type, groupClasses(`${table.id} FY${fy} ${s.type ?? "all"}`, s, i, table.rounding, table.defect !== undefined));
    if (!table.defect) checkTypes(`${table.id} FY${fy}`, byType, table.rounding);
    out.set(fy, byType);
  });
  return out;
}

/** Quarterly Table 1B: one fiscal year; Total | Q1–Q4 for all, adjustments of status (col 6) and new arrivals (col 11). */
export function readQuarterlyClass(ctx: TableContext, fy: number): ClassTable {
  const { table, sheet, titleAt } = ctx;
  if (!new RegExp(`FISCAL YEAR ${fy}\\d?$`).test(table.title)) fail(`${table.id}: title is not for FY${fy}`);
  const rows = sheet.rows.slice(titleAt + 1);
  const groupHeader = rows.find((r) => r.cells[6] === "Adjustments of status" && r.cells[11] === "New arrivals") ?? fail(`${table.id}: "Adjustments of status | New arrivals" header not found`);
  const quarterHeader = rows.find((r) => r.cells[1] === "Total" && r.cells[2] === "Quarter 1" && r.cells[6] === "Total" && r.cells[11] === "Total") ?? fail(`${table.id}: quarter header not found`);
  const start = Math.max(groupHeader.row, quarterHeader.row);
  const sets: ClassRowSet[] = [
    { type: null, rows: [] },
    { type: "adjustment", rows: [] },
    { type: "new_arrival", rows: [] },
  ];
  const all: Count[] = [];
  for (const r of rows.filter((x) => x.row > start)) {
    if (r.cells.length !== 16) continue;
    sets.forEach((s, k) => {
      const base = 1 + k * 5;
      const counts = [0, 1, 2, 3, 4].map((j) => parseCount(r.cells[base + j], cellRef(r.row, base + j), table.id));
      all.push(...counts);
      checkSum(`${table.id} ${label(r.cells[0])} ${s.type ?? "all"} quarters`, counts.slice(1), counts[0], table.rounding);
      s.rows.push({ label: r.cells[0], counts: [counts[0]] });
    });
  }
  checkRounding(ctx, all);
  const byType = new Map<AdmissionType | null, ClassYear>();
  for (const s of sets) byType.set(s.type, groupClasses(`${table.id} ${s.type ?? "all"}`, s, 0, table.rounding, table.defect !== undefined));
  if (!table.defect) checkTypes(`${table.id}`, byType, table.rounding);
  return new Map([[fy, byType]]);
}

/** New arrivals + adjustments = all, for the total and each class. */
function checkTypes(where: string, byType: ReadonlyMap<AdmissionType | null, ClassYear>, rounding: 10 | null) {
  const all = byType.get(null)!;
  const adj = byType.get("adjustment")!;
  const neu = byType.get("new_arrival")!;
  checkSum(`${where} new arrivals + adjustments`, [adj.total, neu.total], all.total, rounding);
  for (const cls of LPR_CLASSES) {
    const a = adj.classes.get(cls)!;
    const n = neu.classes.get(cls)!;
    const t = all.classes.get(cls)!;
    const slack = rounding ? roundingSlack(rounding, a.cells.length + n.cells.length + t.cells.length) : 0;
    if (Math.abs(a.value + n.value - t.value) > slack) fail(`${where} ${cls}: adjustments ${a.value} + new arrivals ${n.value} != ${t.value}`);
  }
}

function checkTitleYears(table: OhssTable, fys: readonly number[]) {
  const range = table.title.match(/FISCAL YEARS (\d{4}) TO (\d{4})/) ?? fail(`${table.id}: title has no year range`);
  const want: number[] = [];
  for (let fy = Number(range[1]); fy <= Number(range[2]); fy++) want.push(fy);
  if (fys.join() !== want.join()) fail(`${table.id}: header years ${fys.join(",")} do not match the title's ${range[1]}–${range[2]}`);
}

// ---------------------------------------------------------------- country tables

export interface CountryYear {
  total: Count;
  /** The REGION section's rows as printed (the Total row excluded). */
  regionRows: { name: string; count: Count }[];
  regionSum: number;
  regions: number;
  rows: { name: string; count: Count }[];
}

/** OHSS's continent rows, as printed (lower-cased), to a region key. A new label fails the build. */
const REGION_NAME: Readonly<Record<string, LprRegion>> = {
  africa: "africa",
  asia: "asia",
  europe: "europe",
  "north america": "north_america",
  oceania: "oceania",
  "south america": "south_america",
  unknown: "unknown",
};

const BUCKET_NAME: Readonly<Record<string, "other" | "unknown">> = { "all other countries": "other", unknown: "unknown" };

function readCountrySections(ctx: TableContext, fys: readonly number[], dataRows: XRow[], col: (i: number) => number): Map<number, CountryYear> {
  const { table } = ctx;
  const regionAt = dataRows.findIndex((r) => r.cells[0] === "REGION");
  const countryAt = dataRows.findIndex((r) => r.cells[0] === "COUNTRY");
  if (regionAt < 0 || countryAt < regionAt) fail(`${table.id}: REGION / COUNTRY sections not found`);
  const width = Math.max(...fys.map((_, i) => col(i))) + 1;
  const isData = (r: XRow) => r.cells.length >= width && r.cells[0] !== "";
  const regionRows = dataRows.slice(regionAt + 1, countryAt).filter(isData);
  const countryRows = dataRows.slice(countryAt + 1).filter(isData);
  const counts = (r: XRow) => fys.map((_, i) => parseCount(r.cells[col(i)], cellRef(r.row, col(i)), table.id));
  const out = new Map<number, CountryYear>();
  const regionTotal = regionRows.find((r) => r.cells[0] === "Total") ?? fail(`${table.id}: no Total in the REGION section`);
  const countryTotal = countryRows.find((r) => r.cells[0] === "Total") ?? fail(`${table.id}: no Total in the COUNTRY section`);
  const rt = counts(regionTotal);
  const ct = counts(countryTotal);
  const regionData = regionRows.filter((r) => r !== regionTotal).map((r) => ({ name: label(r.cells[0]), counts: counts(r) }));
  const regions = regionData.map((r) => r.counts);
  const countries = countryRows.filter((r) => r !== countryTotal).map((r) => ({ name: label(r.cells[0]), counts: counts(r) }));
  checkRounding(ctx, [...rt, ...ct, ...regions.flat(), ...countries.flatMap((c) => c.counts)]);
  fys.forEach((fy, i) => {
    const where = `${table.id} FY${fy}`;
    if (rt[i].value !== ct[i].value) fail(`${where}: REGION total ${rt[i].value} != COUNTRY total ${ct[i].value}`);
    const rs = regions.map((r) => r[i]);
    if (!rs.some((r) => r.withheld)) checkSum(`${where} regions`, rs, rt[i], table.rounding);
    const names = new Set<string>();
    for (const c of countries) {
      if (names.has(c.name)) fail(`${where}: "${c.name}" printed twice`);
      names.add(c.name);
    }
    out.set(fy, {
      total: ct[i],
      regionRows: regionData.map((r) => ({ name: r.name, count: r.counts[i] })),
      regionSum: rs.reduce((s, r) => s + (r.value ?? 0), 0),
      regions: rs.length,
      rows: countries.map((c) => ({ name: c.name, count: c.counts[i] })),
    });
  });
  return out;
}

/** Yearbook by-country tables: header "Region and country of birth | <years>", REGION then COUNTRY sections. */
export function readCountryByYear(ctx: TableContext): Map<number, CountryYear> {
  const { table, sheet, titleAt } = ctx;
  const rows = sheet.rows.slice(titleAt + 1);
  const header = rows.find((r) => /^Region and country of (birth|nationality)$/.test(r.cells[0])) ?? fail(`${table.id}: header row not found`);
  if (!header.cells[0].endsWith(table.basis ?? "?")) fail(`${table.id}: header "${header.cells[0]}" is not by country of ${table.basis}`);
  const fys = header.cells.slice(1).map((c) => yearCell(c) ?? fail(`${table.id}: header cell "${c}" is not a year`));
  checkTitleYears(table, fys);
  return readCountrySections(ctx, fys, rows.filter((r) => r.row > header.row), (i) => i + 1);
}

/** Quarterly Tables 1A, 2 and 3: one fiscal year; the Total column (1A also has adjustments at col 6, new arrivals at col 11). */
export function readQuarterlyCountry(ctx: TableContext, fy: number): Map<number, CountryYear> {
  const { table, sheet, titleAt } = ctx;
  if (!new RegExp(`FISCAL YEAR ${fy}\\d?$`).test(table.title)) fail(`${table.id}: title is not for FY${fy}`);
  if (!table.title.endsWith(`NATIONALITY: FISCAL YEAR ${fy}`) && !new RegExp(`NATIONALITY: FISCAL YEAR ${fy}\\d$`).test(table.title)) fail(`${table.id}: not by country of nationality`);
  const rows = sheet.rows.slice(titleAt + 1);
  const qh = rows.find((r) => r.cells[1] === "Total" && r.cells[2] === "Quarter 1") ?? fail(`${table.id}: quarter header not found`);
  if (table.layout === "quarterly_country_by_type" && !(qh.cells[6] === "Total" && qh.cells[11] === "Total")) fail(`${table.id}: not a Total | Adjustments | New arrivals layout`);
  const data = rows.filter((r) => r.row > qh.row);
  if (table.layout === "quarterly_country_by_type") {
    // Adjustments + new arrivals = total, for every row.
    for (const r of data.filter((x) => x.cells.length === 16 && x.cells[0] !== "")) {
      const [t, a, n] = [1, 6, 11].map((c) => parseCount(r.cells[c], cellRef(r.row, c), table.id));
      if (t.value !== null && a.value !== null && n.value !== null && Math.abs(a.value + n.value - t.value) > roundingSlack(table.rounding, 2)) {
        fail(`${table.id} ${r.cells[0]}: adjustments ${a.value} + new arrivals ${n.value} != total ${t.value}`);
      }
    }
  }
  return readCountrySections(ctx, [fy], data, () => 1);
}

// ---------------------------------------------------------------- build

export interface LprBuildInput {
  catalog: LprCatalog;
  /** Text extract per source id. */
  texts: ReadonlyMap<string, string>;
  administrations: readonly Administration[];
  countries: CountryIndex;
  /** refugee_series.json rows (period, admissions), for the arrivals cross-check only. */
  refugeeAdmissions: ReadonlyMap<number, number>;
}

interface Located {
  ctx: TableContext;
  edition: string;
  editionFy: number;
  kind: "yearbook" | "quarterly";
}

const seriesKey = (type: AdmissionType | null, cls: LprClass | null) =>
  type === null && cls === null ? "all" : [type ? `type:${type}` : null, cls ? `class:${cls}` : null].filter(Boolean).join("/");

export function buildLpr(input: LprBuildInput) {
  const { catalog } = input;
  const asOf = catalog.retrieved_at;
  const sourceById = new Map(catalog.sources.map((s) => [s.id, s]));
  const sheetsBySource = new Map<string, XSheet[]>();
  const sheetsOf = (s: OhssSource) => {
    let x = sheetsBySource.get(s.id);
    if (!x) {
      const t = input.texts.get(s.id) ?? fail(`no text extract for source "${s.id}" (run pnpm fetch:ohss)`);
      x = parseExtract(t);
      sheetsBySource.set(s.id, x);
    }
    return x;
  };
  const ids = new Set<string>();
  const located: Located[] = catalog.tables.map((t) => {
    if (ids.has(t.id)) fail(`table id ${t.id} listed twice`);
    ids.add(t.id);
    const s = sourceById.get(t.source) ?? fail(`${t.id}: unknown source "${t.source}"`);
    if (!s.edition) return fail(`${t.id}: source ${s.id} is a page, not a workbook`);
    if ((t.layout === "country_by_year" || t.layout.startsWith("quarterly_country")) !== (t.basis !== undefined)) fail(`${t.id}: basis must be given for (and only for) by-country tables`);
    const ed = s.edition;
    if (t.layout.startsWith("quarterly") !== (ed.kind === "quarterly")) fail(`${t.id}: layout ${t.layout} in a ${ed.kind} source`);
    return {
      ctx: locateTable(t, s, sheetsOf(s)),
      edition: `${ed.kind === "yearbook" ? "Yearbook" : "Quarterly report"} FY${ed.fy}`,
      editionFy: ed.fy,
      kind: ed.kind,
    };
  });
  const newestFirst = [...located].sort((a, b) => b.editionFy - a.editionFy);
  const of = (pred: (l: Located) => boolean) => newestFirst.filter(pred);

  // ---- read every table ----
  const longs = new Map<string, Map<number, Count>>();
  const classes = new Map<string, ClassTable>();
  const countryTabs = new Map<string, Map<number, CountryYear>>();
  for (const l of located) {
    const t = l.ctx.table;
    if (t.layout === "lpr_long" || t.layout === "naturalization_long") longs.set(t.id, readLong(l.ctx));
    else if (t.layout === "class_by_year") classes.set(t.id, readClassByYear(l.ctx));
    else if (t.layout === "quarterly_class") classes.set(t.id, readQuarterlyClass(l.ctx, l.editionFy));
    else if (t.layout === "country_by_year") countryTabs.set(t.id, readCountryByYear(l.ctx));
    else countryTabs.set(t.id, readQuarterlyCountry(l.ctx, l.editionFy));
  }
  const tableById = new Map(located.map((l) => [l.ctx.table.id, l]));
  const latestYearbook = Math.max(...located.filter((l) => l.kind === "yearbook").map((l) => l.editionFy));

  const administrations = input.administrations;
  const provenance = (l: Located, cells: string[], method: "printed" | "sum" | "residual") => ({
    source: l.ctx.source.id,
    source_url: l.ctx.source.url,
    table: l.ctx.table.id,
    edition: l.edition,
    member: l.ctx.table.member ?? null,
    sheet: l.ctx.table.sheet,
    cells,
    method,
    rounding: l.ctx.table.rounding,
  });
  const notesFor = (metric: LprMetric, fy: number) =>
    catalog.notes.filter((n) => (n.metric === null || n.metric === metric) && n.fy_start <= fy && (n.fy_end === null || fy <= n.fy_end)).map((n) => n.id);

  // ---- national series ----
  const series: LprSeriesRow[] = [];
  const push = (metric: LprMetric, fy: number, type: AdmissionType | null, cls: LprClass | null, value: number, l: Located, cells: string[], method: "printed" | "sum" | "residual") =>
    series.push(
      lprSeriesRow.parse({
        period: fy,
        period_type: "fiscal_year",
        metric,
        admission_type: type,
        class: cls,
        value,
        status: l.kind === "yearbook" ? "final" : "preliminary",
        ...provenance(l, cells, method),
        as_of: asOf,
        note_ids: notesFor(metric, fy),
        ...attributeFiscalYear(fy, administrations),
      }),
    );

  const lprClassTables = of((l) => (l.ctx.table.layout === "class_by_year" || l.ctx.table.layout === "quarterly_class") && l.ctx.table.metric === "lpr" && !l.ctx.table.defect);
  const lprLong = of((l) => l.ctx.table.layout === "lpr_long")[0] ?? fail("no LPR Table 1");
  const natLong = of((l) => l.ctx.table.layout === "naturalization_long")[0] ?? fail("no naturalization long table");
  const quarterlyNat = of((l) => l.kind === "quarterly" && l.ctx.table.metric === "naturalizations" && !l.ctx.table.defect);
  const lastFy = Math.max(latestYearbook, ...located.filter((l) => l.kind === "quarterly").map((l) => l.editionFy));
  const lprHome = new Map<number, Located>();
  const natHome = new Map<number, Located>();

  for (let fy = catalog.first_fiscal_year; fy <= lastFy; fy++) {
    // LPRs: the newest class table covering the year (Yearbook first; the quarterly report only after the newest Yearbook).
    const yb = fy <= latestYearbook;
    const home = lprClassTables.find((l) => (yb ? l.kind === "yearbook" : l.kind === "quarterly") && classes.get(l.ctx.table.id)!.has(fy));
    if (home) {
      lprHome.set(fy, home);
      const byType = classes.get(home.ctx.table.id)!.get(fy)!;
      for (const type of [null, "new_arrival", "adjustment"] as const) {
        const y = byType.get(type)!;
        push("lpr", fy, type, null, y.total.value!, home, [y.total.cell], "printed");
        for (const cls of LPR_CLASSES) {
          const c = y.classes.get(cls)!;
          push("lpr", fy, type, cls, c.value, home, c.cells, c.method);
        }
      }
    } else if (yb) {
      const v = longs.get(lprLong.ctx.table.id)!.get(fy) ?? fail(`FY${fy}: not in ${lprLong.ctx.table.id}`);
      lprHome.set(fy, lprLong);
      push("lpr", fy, null, null, v.value!, lprLong, [v.cell], "printed");
    }
    // Naturalizations: the newest Yearbook's long table; after it, the quarterly report's Table 3 total.
    if (yb) {
      const v = longs.get(natLong.ctx.table.id)!.get(fy) ?? fail(`FY${fy}: not in ${natLong.ctx.table.id}`);
      natHome.set(fy, natLong);
      push("naturalizations", fy, null, null, v.value!, natLong, [v.cell], "printed");
    } else {
      const q = quarterlyNat.find((l) => countryTabs.get(l.ctx.table.id)!.has(fy));
      if (q) {
        const t = countryTabs.get(q.ctx.table.id)!.get(fy)!.total;
        natHome.set(fy, q);
        push("naturalizations", fy, null, null, t.value!, q, [t.cell], "printed");
      }
    }
  }

  // ---- by country ----
  const byCountry: LprCountryRow[] = [];
  const byRegion: LprRegionRow[] = [];
  const unmapped = new Set<string>();
  const countryHome = new Map<string, Located>();
  for (const metric of ["lpr", "naturalizations"] as const) {
    const tabs = of((l) => l.ctx.table.metric === metric && !l.ctx.table.defect && (l.ctx.table.layout === "country_by_year" || l.ctx.table.layout === "quarterly_country_by_type" || l.ctx.table.layout === "quarterly_country"));
    const years = new Set(tabs.flatMap((l) => [...countryTabs.get(l.ctx.table.id)!.keys()]));
    for (const fy of [...years].sort()) {
      if (fy < catalog.first_fiscal_year) continue;
      const yb = fy <= latestYearbook;
      const home = tabs.find((l) => (yb ? l.kind === "yearbook" : l.kind === "quarterly") && countryTabs.get(l.ctx.table.id)!.has(fy));
      if (!home) continue;
      countryHome.set(`${metric}|${fy}`, home);
      const y = countryTabs.get(home.ctx.table.id)!.get(fy)!;
      const status = home.kind === "yearbook" ? "final" : "preliminary";
      const merged = new Map<string, LprCountryRow>();
      let printedSum = 0;
      let withheldCells = 0;
      for (const r of y.rows) {
        if (r.count.withheld) {
          withheldCells++;
          continue;
        }
        if (r.count.notApplicable) continue;
        printedSum += r.count.value!;
        const bucket = BUCKET_NAME[r.name.toLowerCase()];
        let k: string;
        let name: string;
        if (bucket) {
          k = BUCKET_KEYS[bucket];
          name = bucket === "other" ? "All other countries" : "Unknown";
        } else {
          try {
            const res = resolveCountry(r.name, input.countries, LPR_NAME_TABLES);
            k = res.country_key;
            name = res.display_name;
          } catch {
            unmapped.add(r.name);
            continue;
          }
        }
        if (r.count.value === 0) continue; // zero rows are not stored (missing = zero in a by-country table)
        const prev = merged.get(k);
        if (prev) {
          prev.value += r.count.value!;
          prev.printed_names.push(r.name);
          prev.cells.push(r.count.cell);
          prev.method = "sum";
        } else {
          merged.set(k, {
            fy,
            metric,
            basis: home.ctx.table.basis!,
            country_key: k,
            country_name: name,
            kind: bucket ?? "country",
            printed_names: [r.name],
            value: r.count.value!,
            status,
            ...provenance(home, [r.count.cell], "printed"),
          });
        }
      }
      const total = y.total.value!;
      if (withheldCells) {
        // OHSS withheld small cells ("D"): the remainder of the printed total is its own bucket.
        const rest = total - printedSum;
        if (rest < withheldCells) fail(`${home.ctx.table.id} FY${fy}: ${withheldCells} withheld cells but only ${rest} left of the printed total`);
        merged.set(BUCKET_KEYS.withheld, {
          fy,
          metric,
          basis: home.ctx.table.basis!,
          country_key: BUCKET_KEYS.withheld,
          country_name: "Withheld (small counts)",
          kind: "withheld",
          printed_names: [],
          value: rest,
          status,
          ...provenance(home, [y.total.cell], "residual"),
        });
      } else if (!unmapped.size) {
        checkSum(`${home.ctx.table.id} FY${fy} countries`, y.rows.map((r) => r.count), y.total, home.ctx.table.rounding);
      }
      const regionMerged = new Map<LprRegion, LprRegionRow>();
      let regionPrinted = 0;
      let regionWithheld = 0;
      for (const r of y.regionRows) {
        if (r.count.withheld) {
          regionWithheld++;
          continue;
        }
        if (r.count.notApplicable) continue;
        const region = REGION_NAME[r.name.toLowerCase()] ?? fail(`${home.ctx.table.id} FY${fy}: unknown region "${r.name}" (add it to REGION_NAME in lpr.ts)`);
        regionPrinted += r.count.value!;
        if (r.count.value === 0) continue;
        const prev = regionMerged.get(region);
        if (prev) fail(`${home.ctx.table.id} FY${fy}: region "${r.name}" printed twice`);
        regionMerged.set(region, { fy, metric, basis: home.ctx.table.basis!, region, printed_name: r.name, value: r.count.value!, status, ...provenance(home, [r.count.cell], "printed") });
      }
      if (regionWithheld) fail(`${home.ctx.table.id} FY${fy}: ${regionWithheld} withheld region cells (no region remainder is modelled)`);
      if (Math.abs(regionPrinted - total) > roundingSlack(home.ctx.table.rounding, y.regionRows.length + 1)) fail(`${home.ctx.table.id} FY${fy}: regions sum to ${regionPrinted}, printed total ${total}`);
      byRegion.push(...[...regionMerged.values()].sort((a, b) => LPR_REGIONS.indexOf(a.region) - LPR_REGIONS.indexOf(b.region)).map((r) => lprRegionRow.parse(r)));
      const rows = [...merged.values()].sort((a, b) => b.value - a.value || a.country_key.localeCompare(b.country_key));
      byCountry.push(...rows.map((r) => lprCountryRow.parse(r)));
    }
  }
  if (unmapped.size) fail(`OHSS country names with no country_key (add to LPR_ALIASES in lpr-country-names.ts): ${[...unmapped].sort().join(", ")}`);

  // ---- vintage comparisons ----
  const vintages = compareVintages({ located, longs, classes, countryTabs, catalog, latestYearbook, lprHome, natHome });
  const countryVintages = compareCountries(located, countryTabs, input.countries, catalog.first_fiscal_year);

  // ---- notes ----
  for (const n of catalog.notes) {
    if (n.source !== null) {
      const s = sourceById.get(n.source) ?? fail(`note ${n.id}: unknown source "${n.source}"`);
      if (n.quote && !normalizeText(input.texts.get(s.id) ?? "").includes(normalizeText(n.quote))) fail(`note ${n.id}: quote not found in ${s.id}: "${n.quote.slice(0, 80)}"`);
    } else if (n.quote) fail(`note ${n.id}: a quote needs a source`);
  }
  const noteIds = new Set<string>();
  for (const n of catalog.notes) {
    if (noteIds.has(n.id)) fail(`note ${n.id} listed twice`);
    noteIds.add(n.id);
  }

  // ---- refugee arrivals (OHSS) vs. refugee admissions (State Department), report only ----
  const refugeeArrivals = of((l) => l.ctx.table.metric === "refugee_arrivals")
    .map((l) => {
      const y = countryTabs.get(l.ctx.table.id)!.get(l.editionFy)!;
      const state = input.refugeeAdmissions.get(l.editionFy) ?? null;
      const dhs = y.total.value!;
      return { fy: l.editionFy, ohss_quarterly: dhs, state_department: state, diff: state === null ? null : state - dhs, pct: state === null ? null : Math.round(((state - dhs) / dhs) * 1000) / 10 };
    })
    .sort((a, b) => a.fy - b.fy);

  const lprRows = series.filter((r) => r.metric === "lpr" && r.admission_type === null && r.class === null);
  const natRows = series.filter((r) => r.metric === "naturalizations");
  const classYears = series.filter((r) => r.metric === "lpr" && r.class !== null && r.admission_type === null).map((r) => r.period);
  const countryYears = (metric: LprMetric, basis: CountryBasis) => [...new Set(byCountry.filter((r) => r.metric === metric && r.basis === basis).map((r) => r.fy))].sort();
  const report = {
    first_period: catalog.first_fiscal_year,
    last_period: lastFy,
    rows: series.length,
    latest_yearbook: latestYearbook,
    lpr_total_years: { first: lprRows[0]?.period ?? null, last: lprRows.at(-1)?.period ?? null, missing: missingYears(lprRows.map((r) => r.period)) },
    lpr_class_years: { first: Math.min(...classYears), last: Math.max(...classYears) },
    naturalization_years: { first: natRows[0]?.period ?? null, last: natRows.at(-1)?.period ?? null, missing: missingYears(natRows.map((r) => r.period)) },
    status: Object.fromEntries(["final", "preliminary"].map((s) => [s, [...new Set(series.filter((r) => r.status === s).map((r) => r.period))].length])),
    tables_used: Object.fromEntries(
      [...new Set([...lprHome.values(), ...natHome.values(), ...countryHome.values()])].map((l) => [
        l.ctx.table.id,
        {
          lpr: [...lprHome].filter(([, h]) => h === l).map(([fy]) => fy),
          naturalizations: [...natHome].filter(([, h]) => h === l).map(([fy]) => fy),
          by_country: [...countryHome].filter(([, h]) => h === l).map(([k]) => k),
        },
      ]),
    ),
    residual_other: series.filter((r) => r.method === "residual").map((r) => ({ fy: r.period, admission_type: r.admission_type, class: r.class, value: r.value, table: r.table })),
    blended_periods: [...new Set(series.filter((r) => r.blended).map((r) => r.period))],
    country_years: {
      lpr_birth: countryYears("lpr", "birth"),
      lpr_nationality: countryYears("lpr", "nationality"),
      naturalizations_birth: countryYears("naturalizations", "birth"),
      naturalizations_nationality: countryYears("naturalizations", "nationality"),
      rows: byCountry.length,
      countries: new Set(byCountry.filter((r) => r.kind === "country").map((r) => r.country_key)).size,
      withheld: byCountry.filter((r) => r.kind === "withheld").map((r) => ({ fy: r.fy, metric: r.metric, value: r.value })),
    },
    vintages: { ...vintages, countries: countryVintages },
    refugee_arrivals_vs_state_department: refugeeArrivals,
    tables: located.length,
  };

  return {
    series,
    byCountry,
    byRegion,
    notes: [...catalog.notes].sort((a, b) => a.fy_start - b.fy_start || a.id.localeCompare(b.id)) as LprNote[],
    report,
    tableById,
  };
}

/**
 * Country rows printed by more than one table, reported (never gated): Yearbook editions against
 * each other (same basis, birth), and the quarterly report's country of nationality against the
 * Yearbook's country of birth for the same year (different questions, so differences are expected).
 */
function compareCountries(located: readonly Located[], countryTabs: ReadonlyMap<string, Map<number, CountryYear>>, countries: CountryIndex, firstFy: number) {
  const keyed = (y: CountryYear) => {
    const m = new Map<string, number>();
    for (const r of y.rows) {
      if (r.count.value === null || BUCKET_NAME[r.name.toLowerCase()]) continue;
      try {
        const k = resolveCountry(r.name, countries, LPR_NAME_TABLES).country_key;
        m.set(k, (m.get(k) ?? 0) + r.count.value);
      } catch {
        // unmapped names already fail the build in the main pass
      }
    }
    return m;
  };
  const tabs = located.filter((l) => countryTabs.has(l.ctx.table.id) && l.ctx.table.metric !== "refugee_arrivals" && !l.ctx.table.defect);
  const pairs: { metric: string; tables: [string, string]; fiscal_years: number[]; compared: number; beyond_rounding: number; largest: { fy: number; country_key: string; values: [number, number]; diff: number }[] }[] = [];
  for (let i = 0; i < tabs.length; i++) {
    for (let j = i + 1; j < tabs.length; j++) {
      const [a, b] = [tabs[i], tabs[j]];
      if (a.ctx.table.metric !== b.ctx.table.metric) continue;
      const ya = countryTabs.get(a.ctx.table.id)!;
      const yb = countryTabs.get(b.ctx.table.id)!;
      const shared = [...ya.keys()].filter((fy) => yb.has(fy) && fy >= firstFy).sort();
      if (!shared.length) continue;
      const slack = (a.ctx.table.rounding ? 5 : 0) + (b.ctx.table.rounding ? 5 : 0);
      const diffs: { fy: number; country_key: string; values: [number, number]; diff: number }[] = [];
      let compared = 0;
      for (const fy of shared) {
        const ma = keyed(ya.get(fy)!);
        const mb = keyed(yb.get(fy)!);
        for (const k of new Set([...ma.keys(), ...mb.keys()])) {
          compared++;
          const [va, vb] = [ma.get(k) ?? 0, mb.get(k) ?? 0];
          if (Math.abs(va - vb) > slack) diffs.push({ fy, country_key: k, values: [va, vb], diff: vb - va });
        }
      }
      diffs.sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff));
      pairs.push({ metric: a.ctx.table.metric, tables: [a.ctx.table.id, b.ctx.table.id], fiscal_years: shared, compared, beyond_rounding: diffs.length, largest: diffs.slice(0, 10) });
    }
  }
  return {
    note: "Report only. Yearbook pairs are the same question (country of birth) in two vintages; a quarterly-vs-Yearbook pair compares country of nationality with country of birth.",
    pairs: pairs.filter((p) => p.beyond_rounding > 0 || p.tables.every((t) => t.startsWith("yb"))),
  };
}

function missingYears(years: readonly number[]): number[] {
  if (!years.length) return [];
  const have = new Set(years);
  const out: number[] = [];
  for (let fy = Math.min(...years); fy <= Math.max(...years); fy++) if (!have.has(fy)) out.push(fy);
  return out;
}

// ---------------------------------------------------------------- vintages

interface VintageInput {
  located: readonly Located[];
  longs: ReadonlyMap<string, Map<number, Count>>;
  classes: ReadonlyMap<string, ClassTable>;
  countryTabs: ReadonlyMap<string, Map<number, CountryYear>>;
  catalog: LprCatalog;
  latestYearbook: number;
  lprHome: ReadonlyMap<number, Located>;
  natHome: ReadonlyMap<number, Located>;
}

interface Point {
  table: string;
  kind: "yearbook" | "quarterly";
  editionFy: number;
  /** How far rounding alone can move this value: half the rounding unit per cell it was read or summed from. */
  slack: number;
  value: number;
}

/**
 * Every national value printed by more than one table, compared pairwise. Two Yearbook editions must
 * agree within rounding unless the catalog records the restatement; the quarterly report (an earlier
 * vintage) is compared with the Yearbook and only gated on gross differences in the total.
 */
function compareVintages(v: VintageInput) {
  const points = new Map<string, Point[]>(); // `${metric}|${fy}|${key}`
  const add = (metric: LprMetric, fy: number, key: string, l: Located, value: number | null, cells = 1) => {
    if (value === null) return;
    const k = `${metric}|${fy}|${key}`;
    const slack = l.ctx.table.rounding ? (l.ctx.table.rounding / 2) * cells : 0;
    points.set(k, [...(points.get(k) ?? []), { table: l.ctx.table.id, kind: l.kind, editionFy: l.editionFy, slack, value }]);
  };
  for (const l of v.located) {
    const t = l.ctx.table;
    if (t.metric === "refugee_arrivals") continue;
    const metric = t.metric;
    if (v.longs.has(t.id)) for (const [fy, c] of v.longs.get(t.id)!) if (fy >= v.catalog.first_fiscal_year) add(metric, fy, "all", l, c.value);
    if (v.classes.has(t.id)) {
      for (const [fy, byType] of v.classes.get(t.id)!) {
        for (const [type, y] of byType) {
          if (t.defect && type !== null) continue;
          add(metric, fy, seriesKey(type, null), l, y.total.value);
          if (!t.defect) for (const [cls, c] of y.classes) add(metric, fy, seriesKey(type, cls), l, c.value, c.cells.length);
        }
      }
    }
    if (v.countryTabs.has(t.id)) for (const [fy, y] of v.countryTabs.get(t.id)!) add(metric, fy, "all", l, y.total.value);
  }

  const yearbookDiffs: { metric: string; fy: number; key: string; tables: [string, string]; values: [number, number]; diff: number; restatement: string | null }[] = [];
  const quarterly: { metric: string; fy: number; key: string; quarterly_table: string; quarterly: number; yearbook_table: string; yearbook: number; diff: number; pct: number }[] = [];
  const matched = new Set<number>();
  let comparisons = 0;
  for (const [k, pts] of points) {
    const [metric, fyS, key] = k.split("|");
    const fy = Number(fyS);
    const ybs = pts.filter((p) => p.kind === "yearbook");
    // Yearbook vs. Yearbook: every pair of editions.
    for (let i = 0; i < ybs.length; i++) {
      for (let j = i + 1; j < ybs.length; j++) {
        const [a, b] = [ybs[i], ybs[j]];
        if (a.table === b.table) continue;
        comparisons++;
        if (Math.abs(a.value - b.value) <= a.slack + b.slack) continue;
        const covering = v.catalog.restatements
          .map((r, idx) => ({ r, idx }))
          .filter(({ r }) => r.metric === metric && r.fy_start <= fy && fy <= r.fy_end && new Set([...r.tables, a.table, b.table]).size === 2 && r.keys.some((k) => (k.endsWith("*") ? key.startsWith(k.slice(0, -1)) : k === key)));
        for (const c of covering) matched.add(c.idx);
        const idx = covering[0]?.idx ?? -1;
        yearbookDiffs.push({ metric, fy, key, tables: [a.table, b.table], values: [a.value, b.value], diff: b.value - a.value, restatement: idx >= 0 ? v.catalog.restatements[idx].id : null });
      }
    }
    // Quarterly vs. the newest Yearbook value.
    const newest = [...ybs].sort((a, b) => b.editionFy - a.editionFy)[0];
    for (const q of pts.filter((p) => p.kind === "quarterly")) {
      if (!newest) continue;
      comparisons++;
      if (Math.abs(q.value - newest.value) <= q.slack + newest.slack) continue;
      const pct = newest.value ? Math.round(((q.value - newest.value) / newest.value) * 10000) / 100 : 0;
      quarterly.push({ metric, fy, key, quarterly_table: q.table, quarterly: q.value, yearbook_table: newest.table, yearbook: newest.value, diff: q.value - newest.value, pct });
      if (key === "all" && Math.abs(pct) > QUARTERLY_TOLERANCE * 100) fail(`${metric} FY${fy}: quarterly ${q.table} ${q.value} vs. Yearbook ${newest.table} ${newest.value} (${pct}%): beyond ${QUARTERLY_TOLERANCE * 100}%, a misread table?`);
    }
  }
  const unrecorded = yearbookDiffs.filter((d) => d.restatement === null);
  if (unrecorded.length) {
    // Grouped by metric and table pair, so a systematic revision reads as one line.
    const groups = new Map<string, typeof unrecorded>();
    for (const d of unrecorded) {
      const g = `${d.metric} ${[...d.tables].sort().join(" vs ")}`;
      groups.set(g, [...(groups.get(g) ?? []), d]);
    }
    fail(
      `Yearbook editions disagree beyond rounding and no catalog restatement covers it:\n${[...groups]
        .map(([g, ds]) => {
          const fys = [...new Set(ds.map((d) => d.fy))].sort();
          const keys = [...new Set(ds.map((d) => d.key))].sort();
          const sample = ds.slice(0, 3).map((d) => `FY${d.fy} ${d.key}: ${d.tables[0]}=${d.values[0]}, ${d.tables[1]}=${d.values[1]}`);
          return `  ${g}: ${ds.length} values, FY${fys.join(",")}; keys ${keys.join(", ")}\n      e.g. ${sample.join("; ")}`;
        })
        .join("\n")}`,
    );
  }
  const stale = v.catalog.restatements.filter((_, i) => !matched.has(i));
  if (stale.length) fail(`catalog restatements that cover no difference: ${stale.map((r) => r.id).join(", ")}`);
  quarterly.sort((a, b) => a.metric.localeCompare(b.metric) || a.fy - b.fy || a.key.localeCompare(b.key));
  return {
    comparisons,
    yearbook_restatements: yearbookDiffs.sort((a, b) => a.metric.localeCompare(b.metric) || a.fy - b.fy || a.key.localeCompare(b.key)),
    quarterly_vs_yearbook: {
      rule: "The Yearbook is used for every year it covers; the quarterly report only for years after the newest Yearbook.",
      totals: quarterly.filter((q) => q.key === "all"),
      breakdowns_differing: quarterly.filter((q) => q.key !== "all").length,
      largest_breakdowns: [...quarterly.filter((q) => q.key !== "all")].sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 15),
    },
  };
}

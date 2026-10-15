import {
  HISTORY_FIRST_FY,
  HISTORY_LAST_FY,
  removalsHistoryRow,
  type RemovalsHistoryReport,
  type RemovalsHistoryRow,
  type RemovalsHistorySource,
} from "../../lib/removals-history-entities";
import type { Administration } from "../../lib/executive-orders-entities";
import { attributeFiscalYear } from "./enforcement";

/**
 * Pure logic for the INS-era removals series (no I/O; `removals-history-run.ts` reads the files). Parses the text extract
 * of an OHSS Yearbook Table 39 page (`pipeline/fetch/ohss-removals-lib.ts`), reads the **Removals column only**, and
 * builds the FY1980–FY2002 rows plus a report that sets the DHS figure against ICE's own for every later year.
 * Missing is missing: a year the table prints no number for fails the build, it is never estimated.
 */

export class RemovalsHistoryError extends Error {}

export interface Table39 {
  title: string;
  columns: string[];
  /** Cells by year, in column order after the year. */
  rows: Map<number, string[]>;
  notes: string;
}

export function parseTable39(text: string): Table39 {
  const lines = text.split("\n");
  const at = (h: string) => lines.indexOf(h);
  const [c, r, n] = [at("## columns"), at("## rows"), at("## notes")];
  if (c < 0 || r < 0 || n < 0 || !lines[0].startsWith("# ")) throw new RemovalsHistoryError("Table 39 extract is missing its title, columns, rows or notes section");
  const columns = lines[c + 1].split(" | ").slice(1);
  const rows = new Map<number, string[]>();
  for (const line of lines.slice(r + 1, n)) {
    const [year, ...cells] = line.split(" | ");
    if (cells.length !== columns.length) throw new RemovalsHistoryError(`row ${year} has ${cells.length} cells, the table has ${columns.length} columns`);
    if (rows.has(Number(year))) throw new RemovalsHistoryError(`row ${year} appears twice`);
    rows.set(Number(year), cells);
  }
  return { title: lines[0].slice(2), columns, rows, notes: lines.slice(n + 1).filter(Boolean).join("\n") };
}

/** A printed count ("18,010"), or null for the table's "NA" / "X". */
export const cellNumber = (cell: string): number | null => (/^\d{1,3}(,\d{3})*$|^\d+$/.test(cell) ? Number(cell.replace(/,/g, "")) : null);

export function removalsByYear(t: Table39): Map<number, number> {
  const col = t.columns.indexOf("Removals");
  if (col < 0) throw new RemovalsHistoryError(`no "Removals" column in [${t.columns.join(", ")}]`);
  const out = new Map<number, number>();
  for (const [year, cells] of t.rows) {
    const n = cellNumber(cells[col]);
    if (n !== null) out.set(year, n);
  }
  return out;
}

export interface BuildInput {
  primary: { source: RemovalsHistorySource; text: string };
  comparison: { source: RemovalsHistorySource; text: string };
  /** ICE's national removals by fiscal year (`enforcement_series.json`). */
  ice: ReadonlyMap<number, number>;
  administrations: readonly Administration[];
}

const NOTE_QUOTES = ["rounded to the nearest ten", "Data include all DHS removals, returns, and expulsions", "FY 1976 includes the 15 months from July 1, 1975 to September 30, 1976"];

export function buildRemovalsHistory({ primary, comparison, ice, administrations }: BuildInput): { rows: RemovalsHistoryRow[]; report: Omit<RemovalsHistoryReport, "sources"> } {
  const table = parseTable39(primary.text);
  const fail = (m: string): never => {
    throw new RemovalsHistoryError(`Table 39 (${primary.source.edition}): ${m}`);
  };
  const edition = primary.source.edition;
  if (!table.title.includes(`Fiscal Years 1892 to ${edition}`)) fail(`title "${table.title}" does not cover FY1892 to FY${edition}`);
  const years = [...table.rows.keys()];
  years.forEach((y, i) => {
    if (y !== 1892 + i) fail(`years are not contiguous at ${y}`);
  });
  if (years[years.length - 1] !== edition) fail(`last year is ${years[years.length - 1]}, expected ${edition}`);
  for (const q of NOTE_QUOTES) if (!table.notes.includes(q)) fail(`the printed notes no longer say "${q}", so the labelling needs another look`);
  if (!table.columns.includes("Removals") || !table.columns.some((c) => c.startsWith("Administrative Returns")) || !table.columns.includes("Enforcement Returns")) fail(`unexpected columns [${table.columns.join(", ")}]`);

  // Column sanity: the printed total of removals and returns is the sum of its three parts (within the rounding the notes
  // warn about), which proves the Removals column is the one read and not a neighbour.
  const idx = (name: string) => table.columns.findIndex((c) => c.startsWith(name));
  for (const y of years.filter((v) => v >= 1927)) {
    const cells = table.rows.get(y)!;
    const part = (name: string) => cellNumber(cells[idx(name)]) ?? 0;
    const total = cellNumber(cells[idx("Total removals and returns")]);
    const sum = part("Administrative Returns") + part("Enforcement Returns") + part("Removals");
    if (total === null || Math.abs(total - sum) > 20) fail(`FY${y}: total removals and returns ${total} is not the sum of its parts (${sum})`);
  }

  const removals = removalsByYear(table);
  const rows: RemovalsHistoryRow[] = [];
  for (let fy = HISTORY_FIRST_FY; fy <= HISTORY_LAST_FY; fy++) {
    const value = removals.get(fy);
    if (value === undefined) fail(`FY${fy} has no printed removals figure`);
    const a = attributeFiscalYear(fy, administrations);
    rows.push(
      removalsHistoryRow.parse({
        period: fy,
        removals: value,
        status: "final",
        administration_term_id: a.administration_term_id,
        blended: a.blended,
        administration_days: a.administration_days,
        source: `DHS OHSS Yearbook ${edition}, Table 39`,
        source_url: primary.source.url,
        edition,
        as_of: primary.source.as_of,
      }),
    );
  }

  const ice_comparison = [...ice]
    .filter(([fy]) => removals.has(fy))
    .sort((a, b) => a[0] - b[0])
    .map(([fy, v]) => ({ period: fy, dhs: removals.get(fy)!, ice: v, difference: removals.get(fy)! - v }));
  if (!ice_comparison.some((c) => c.period === 2003)) fail("ICE's FY2003 figure is missing, so there is nothing to compare the DHS series against");

  const prior = removalsByYear(parseTable39(comparison.text));
  const diffs = (from: number, to: number) =>
    [...prior].filter(([fy]) => fy >= from && fy <= to && removals.has(fy)).map(([fy, v]) => ({ fy, d: Math.abs(removals.get(fy)! - v) }));
  const early = diffs(HISTORY_FIRST_FY, HISTORY_LAST_FY);
  const late = diffs(HISTORY_LAST_FY + 1, 2100);
  const worst = late.reduce((a, b) => (b.d > a.d ? b : a), { fy: 0, d: 0 });

  return {
    rows,
    report: {
      table: "Table 39",
      edition,
      url: primary.source.url,
      title: table.title,
      as_of: primary.source.as_of,
      table_years: { first: years[0], last: years[years.length - 1] },
      first_period: rows[0].period,
      last_period: rows[rows.length - 1].period,
      rows: rows.length,
      columns: table.columns,
      quoted_notes: NOTE_QUOTES,
      ice_comparison,
      edition_revisions: {
        compared_edition: comparison.source.edition,
        years: early.length,
        changed: early.filter((x) => x.d > 0).length,
        max_abs_difference: Math.max(...early.map((x) => x.d)),
        later_years: { changed: late.filter((x) => x.d > 0).length, max_abs_difference: worst.d, max_abs_year: worst.fy },
      },
    },
  };
}

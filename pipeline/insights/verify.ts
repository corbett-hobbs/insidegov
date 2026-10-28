import { readOutput } from "./datasets";
import { daysBetween, fmtDate, fmtInt, fmtPct, fmtUnit, fmtUnitAbs, monthsBetween, yearsBetween } from "./format";
import type { CellRef, Fact, Insight } from "./types";

/**
 * Traceability: every fact is re-derived from the committed data cells it cites, then re-formatted, and must match both
 * the stored value and the text a caption may quote. A fact that cites a missing or ambiguous row fails.
 */

type Row = Record<string, unknown>;

export class CellIndex {
  private files = new Map<string, Row[]>();
  private indexes = new Map<string, Map<string, Row[]>>();

  /** `ref` reads files at a git revision; `rows` seeds files directly (tests). */
  constructor(
    private ref?: string,
    rows?: Record<string, Row[]>,
  ) {
    for (const [file, r] of Object.entries(rows ?? {})) this.files.set(file, r);
  }

  private rows(file: string): Row[] {
    const cached = this.files.get(file);
    if (cached) return cached;
    // `file.json#prop`: the array at `prop` of a file that holds an object (treasury_fiscal.json).
    const [path, prop] = file.split("#") as [string, string | undefined];
    const data = readOutput<unknown>(path, this.ref);
    const rows = (prop ? (data as Record<string, Row[]>)[prop] : data) as Row[];
    this.files.set(file, rows);
    return rows;
  }

  /** The value of one cell, derived from others when it says how (types.ts CellRef.derive); throws when a key matches no row or more than one. */
  resolve(cell: CellRef): number {
    const own = this.read(cell);
    const d = cell.derive;
    let v = own;
    if (d?.op === "pct_change") v = (own / this.resolve(d.from) - 1) * 100;
    else if (d?.op === "diff") v = own - this.resolve(d.from);
    else if (d?.op === "deflate") v = (own * this.resolve(d.base)) / this.resolve(d.by);
    return cell.negate ? -v : v;
  }

  /** The number in the row a cell's key names, before any negation or derivation. */
  private read(cell: CellRef): number {
    const fields = Object.keys(cell.key).sort();
    const sig = `${cell.file}|${fields.join(",")}`;
    let idx = this.indexes.get(sig);
    if (!idx) {
      idx = new Map();
      for (const row of this.rows(cell.file)) {
        const k = JSON.stringify(fields.map((f) => row[f] ?? null));
        (idx.get(k) ?? idx.set(k, []).get(k)!).push(row);
      }
      this.indexes.set(sig, idx);
    }
    const matches = idx.get(JSON.stringify(fields.map((f) => cell.key[f] ?? null))) ?? [];
    if (matches.length !== 1) throw new Error(`${cell.file} ${JSON.stringify(cell.key)}: ${matches.length} rows`);
    if (cell.field === "__row") return 1;
    const raw = matches[0]![cell.field];
    const v = cell.index === undefined ? raw : Array.isArray(raw) ? raw[cell.index] : undefined;
    if (typeof v !== "number") throw new Error(`${cell.file} ${JSON.stringify(cell.key)}.${cell.field}${cell.index === undefined ? "" : `[${cell.index}]`} is not a number`);
    return v;
  }

  sum(cells: CellRef[]): number {
    return cells.reduce((s, c) => s + this.resolve(c), 0);
  }
}

function close(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}

/** Null when the fact checks out, else why not. */
export function verifyFact(fact: Fact, index: CellIndex): string | null {
  let value: number | string;
  const d = fact.derivation;
  try {
    switch (d.op) {
      case "value":
        value = index.sum(d.cells);
        break;
      case "pct_change": {
        const from = index.sum(d.from);
        value = ((index.sum(d.to) - from) / Math.abs(from)) * 100;
        break;
      }
      case "change":
        value = index.sum(d.to) - index.sum(d.from);
        break;
      case "date":
        value = d.date;
        break;
      case "duration":
        value = d.unit === "days" ? daysBetween(d.from, d.to) : d.unit === "months" ? monthsBetween(d.from, d.to) : yearsBetween(d.from, d.to);
        break;
    }
  } catch (err) {
    return `${fact.id}: ${(err as Error).message}`;
  }
  if (typeof value === "number" ? typeof fact.value !== "number" || !close(value, fact.value) : value !== fact.value) {
    return `${fact.id}: data gives ${value}, fact says ${fact.value}`;
  }
  const f = fact.format;
  const text =
    f.kind === "unit"
      ? fmtUnit(value as number, f.unit)
      : f.kind === "unit_abs"
        ? fmtUnitAbs(value as number, f.unit)
        : f.kind === "pct"
          ? fmtPct(value as number, f.decimals)
          : f.kind === "int"
            ? fmtInt(value as number)
            : fmtDate(String(value), f.style);
  return text === fact.text ? null : `${fact.id}: formats as "${text}", fact text is "${fact.text}"`;
}

export function verifyInsight(insight: Insight, index: CellIndex): string[] {
  return insight.facts.map((f) => verifyFact(f, index)).filter((e): e is string => e !== null);
}

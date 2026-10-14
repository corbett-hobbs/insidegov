/**
 * The query engine behind the public API (`/api/v1/datasets/<id>/rows`) and the MCP
 * `query_dataset` tool. Pure: takes rows and a parsed query, no I/O, so both surfaces
 * answer a question the same way and the rules are tested in one place.
 *
 * Query grammar (the same keys in a URL query string and in the MCP `filters` object):
 *   field=value        equals (strings compare case-insensitively)
 *   field=a..b         a range, both ends included: numbers, or ISO dates / text by order;
 *                      leave one end off for "a or more" (a..) or "b or less" (..b)
 *   fields=a,b         columns to return (default: all)
 *   sort=a,-b          ascending / descending, in order
 *   limit, offset      paging
 * Filters apply to top-level scalar fields; nested arrays/objects are returned, not filtered.
 */

export type Row = Record<string, unknown>;

/** Either `value` (equals) or `lo` and/or `hi` (a range, ends included). */
export interface Filter {
  field: string;
  value?: string;
  lo?: string;
  hi?: string;
}

export interface SortKey {
  field: string;
  desc: boolean;
}

export interface Query {
  filters: Filter[];
  fields: string[] | null;
  sort: SortKey[];
  limit: number;
  offset: number;
}

export interface QueryLimits {
  defaultLimit: number;
  maxLimit: number;
}

export type ParseResult = { ok: true; query: Query } | { ok: false; error: string };

/** Query-string keys that control the request rather than filter a field. */
export const RESERVED_PARAMS = new Set(["fields", "sort", "limit", "offset", "format"]);

const splitList = (s: string): string[] =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter((x) => x !== "");

/** Parse `?a=1&b=2010..2020&sort=-a&limit=50` against a dataset's known fields. */
export function parseQuery(params: URLSearchParams, fieldNames: readonly string[], limits: QueryLimits): ParseResult {
  const known = new Set(fieldNames);
  const unknown = (f: string) => `Unknown field "${f}". Available fields: ${fieldNames.join(", ")}.`;

  const filters: Filter[] = [];
  for (const [key, raw] of params) {
    if (RESERVED_PARAMS.has(key)) continue;
    if (!known.has(key)) return { ok: false, error: unknown(key) };
    const v = raw.trim();
    if (v === "" || v === "..") return { ok: false, error: `Filter "${key}" has no value.` };
    const dots = v.indexOf("..");
    if (dots < 0) filters.push({ field: key, value: v });
    else filters.push({ field: key, lo: v.slice(0, dots).trim() || undefined, hi: v.slice(dots + 2).trim() || undefined });
  }

  let fields: string[] | null = null;
  const fieldsParam = params.get("fields");
  if (fieldsParam) {
    fields = splitList(fieldsParam);
    for (const f of fields) if (!known.has(f)) return { ok: false, error: unknown(f) };
  }

  const sort: SortKey[] = [];
  for (const part of splitList(params.get("sort") ?? "")) {
    const desc = part.startsWith("-");
    const field = desc ? part.slice(1) : part;
    if (!known.has(field)) return { ok: false, error: unknown(field) };
    sort.push({ field, desc });
  }

  const intParam = (name: string, fallback: number, min: number, max: number): number | string => {
    const raw = params.get(name);
    if (raw === null || raw === "") return fallback;
    if (!/^\d+$/.test(raw)) return `"${name}" must be a whole number.`;
    return Math.min(Math.max(Number(raw), min), max);
  };
  const limit = intParam("limit", limits.defaultLimit, 1, limits.maxLimit);
  if (typeof limit === "string") return { ok: false, error: limit };
  const offset = intParam("offset", 0, 0, Number.MAX_SAFE_INTEGER);
  if (typeof offset === "string") return { ok: false, error: offset };

  return { ok: true, query: { filters, fields, sort, limit, offset } };
}

/** Turn an MCP `filters` object ({ "fiscal_year": "2010..2020", "country_key": "MEX" }) into the same params. */
export function paramsFromObject(input: {
  filters?: Record<string, unknown>;
  fields?: unknown;
  sort?: unknown;
  limit?: unknown;
  offset?: unknown;
}): URLSearchParams {
  const p = new URLSearchParams();
  const asText = (v: unknown) => (Array.isArray(v) ? v.map(String).join(",") : String(v));
  for (const [k, v] of Object.entries(input.filters ?? {})) if (v !== undefined && v !== null) p.set(k, asText(v));
  for (const k of ["fields", "sort", "limit", "offset"] as const) {
    const v = input[k];
    if (v !== undefined && v !== null && v !== "") p.set(k, asText(v));
  }
  return p;
}

const norm = (v: unknown): string => String(v).toLowerCase();

/** Where `cell` falls against `bound`: negative below, zero equal, positive above. NaN when a number is compared to text. */
function order(cell: unknown, bound: string): number {
  if (typeof cell === "number") return cell - Number(bound);
  const a = String(cell);
  return a < bound ? -1 : a > bound ? 1 : 0;
}

function matches(cell: unknown, f: Filter): boolean {
  if (cell === null || cell === undefined || typeof cell === "object") return false;
  if (f.value !== undefined) return norm(cell) === f.value.toLowerCase();
  if (f.lo !== undefined && !(order(cell, f.lo) >= 0)) return false;
  if (f.hi !== undefined && !(order(cell, f.hi) <= 0)) return false;
  return true;
}

function compare(a: unknown, b: unknown): number {
  const an = a === null || a === undefined;
  const bn = b === null || b === undefined;
  if (an || bn) return an === bn ? 0 : an ? 1 : -1; // nulls last, either direction
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

export interface QueryResult {
  /** Rows matching the filters, before paging. */
  total: number;
  rows: Row[];
}

export function runQuery(all: readonly Row[], q: Query): QueryResult {
  let rows = all as Row[];
  if (q.filters.length) rows = rows.filter((r) => q.filters.every((f) => matches(r[f.field], f)));
  const total = rows.length;

  if (q.sort.length) {
    rows = rows.slice().sort((a, b) => {
      for (const k of q.sort) {
        const c = compare(a[k.field], b[k.field]);
        if (c !== 0) return k.desc && a[k.field] != null && b[k.field] != null ? -c : c;
      }
      return 0;
    });
  }

  rows = rows.slice(q.offset, q.offset + q.limit);
  if (q.fields) {
    const keep = q.fields;
    rows = rows.map((r) => Object.fromEntries(keep.map((f) => [f, r[f] ?? null])));
  }
  return { total, rows };
}

/** Every top-level key across the rows, in first-seen order. */
export function fieldNamesOf(rows: readonly Row[]): string[] {
  const seen = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r)) seen.add(k);
  return [...seen];
}

export type FieldType = "string" | "number" | "boolean" | "array" | "object";

/** Type of each field, from its first non-null value. A field that is only ever null reads "string". */
export function fieldTypesOf(rows: readonly Row[], names: readonly string[]): Record<string, FieldType> {
  const out: Record<string, FieldType> = {};
  const pending = new Set(names);
  for (const r of rows) {
    for (const n of pending) {
      const v = r[n];
      if (v === null || v === undefined) continue;
      out[n] = Array.isArray(v) ? "array" : (typeof v as FieldType);
      pending.delete(n);
    }
    if (!pending.size) break;
  }
  for (const n of pending) out[n] = "string";
  return out;
}

const csvCell = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** RFC 4180 CSV; nested arrays and objects are written as JSON text in their cell. */
export function toCsv(rows: readonly Row[], columns: readonly string[]): string {
  const lines = [columns.map(csvCell).join(",")];
  for (const r of rows) lines.push(columns.map((c) => csvCell(r[c])).join(","));
  return lines.join("\r\n") + "\r\n";
}

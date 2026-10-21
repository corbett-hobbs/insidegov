/**
 * Parse/format helpers for the filter state a page keeps in its query string
 * (`lib/use-url-state.ts`). Pure, no React. Every `parse` returns `undefined` for a
 * value it can't use (missing, malformed, out of bounds), so a stale or hand-edited
 * link falls back to the page's default instead of breaking it. Every `format`
 * returns `null` for the default, so a page at rest keeps a clean URL.
 */
import type { YearRange } from "./year-range";

/** `?years=2001-2020` (or `2008` for a one-year window), clamped to `[lo, hi]`; the full span formats as null. */
export const yearsParam = {
  parse(raw: string | null, lo: number, hi: number): YearRange | undefined {
    const m = raw?.match(/^(\d{4})(?:-(\d{4}))?$/);
    if (!m) return undefined;
    let a = Number(m[1]);
    let b = Number(m[2] ?? m[1]);
    if (a > b) [a, b] = [b, a];
    a = Math.max(lo, a);
    b = Math.min(hi, b);
    return a <= b ? [a, b] : undefined;
  },
  format(r: readonly [number, number] | null, lo: number, hi: number): string | null {
    if (!r || (r[0] <= lo && r[1] >= hi)) return null;
    return r[0] === r[1] ? String(r[0]) : `${r[0]}-${r[1]}`;
  },
};

/** One of a fixed set of values; the default formats as null. */
export function enumParam<T extends string>(values: readonly T[], fallback: T) {
  return {
    parse: (raw: string | null): T | undefined => (raw != null && (values as readonly string[]).includes(raw) ? (raw as T) : undefined),
    format: (v: T): string | null => (v === fallback ? null : v),
  };
}

/** `?cong=1` for an on/off toggle that defaults to off. */
export const flagParam = {
  parse: (raw: string | null): boolean | undefined => (raw === "1" ? true : raw === "0" ? false : undefined),
  format: (on: boolean): string | null => (on ? "1" : null),
};

/** A whole number inside `[lo, hi]`; `fallback` formats as null. */
export const intParam = {
  parse(raw: string | null, lo: number, hi: number): number | undefined {
    if (raw == null || !/^-?\d+$/.test(raw)) return undefined;
    const n = Number(raw);
    return n >= lo && n <= hi ? n : undefined;
  },
  format: (n: number, fallback: number): string | null => (n === fallback ? null : String(n)),
};

/** A code from a known list (a country, a state), matched case-insensitively; null formats as null. */
export const codeParam = {
  parse(raw: string | null, known: ReadonlySet<string>): string | undefined {
    if (!raw) return undefined;
    const up = raw.toUpperCase();
    return known.has(up) ? up : known.has(raw) ? raw : undefined;
  },
  format: (code: string | null): string | null => code,
};

/**
 * `search` with each of `params` set (or removed when null), other params kept and in
 * their original order. Returns the new search string with its `?`, or "" when empty.
 */
export function withParams(search: string, params: Readonly<Record<string, string | null>>): string {
  const sp = new URLSearchParams(search);
  for (const [k, v] of Object.entries(params)) {
    if (v == null) sp.delete(k);
    else sp.set(k, v);
  }
  const q = sp.toString();
  return q ? `?${q}` : "";
}

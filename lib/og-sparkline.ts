/**
 * Pure helpers for the topic pages' share cards (`app/_og/topic-card.tsx`): thin a
 * long series to a few hundred points and turn it into an SVG path. No I/O, so it is
 * unit-tested; the figures themselves come from `lib/og-topics.ts`.
 */

/** Keep about `max` evenly spaced points of `values`, always including the first and the last. */
export function thin(values: readonly number[], max = 160): number[] {
  if (values.length <= max) return [...values];
  const out: number[] = [];
  const step = (values.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) out.push(values[Math.round(i * step)]!);
  return out;
}

export interface SparkPath {
  /** Line path, `M x y L x y …`. */
  line: string;
  /** The same line closed down to the bottom edge, for a faint fill. */
  area: string;
  /** Where the last point sits, for the end dot. */
  end: { x: number; y: number };
}

/**
 * Path for `values` drawn into a `w × h` box with `pad` px kept clear on every side.
 * The y domain is the series' own extent (rule 10d: axes fit the data); a flat series
 * sits mid-height. Returns null for fewer than two points.
 */
export function sparkPath(values: readonly number[], w: number, h: number, pad = 6): SparkPath | null {
  const v = values.filter((n) => Number.isFinite(n));
  if (v.length < 2) return null;
  const lo = Math.min(...v);
  const hi = Math.max(...v);
  const x = (i: number) => pad + (i / (v.length - 1)) * (w - 2 * pad);
  const y = (n: number) => (hi === lo ? h / 2 : pad + (1 - (n - lo) / (hi - lo)) * (h - 2 * pad));
  const pts = v.map((n, i) => `${x(i).toFixed(1)} ${y(n).toFixed(1)}`);
  const line = `M ${pts.join(" L ")}`;
  const area = `${line} L ${x(v.length - 1).toFixed(1)} ${h} L ${x(0).toFixed(1)} ${h} Z`;
  return { line, area, end: { x: x(v.length - 1), y: y(v[v.length - 1]!) } };
}

/** Median of the finite values, or null for none. */
export function median(values: readonly (number | null | undefined)[]): number | null {
  const v = values.filter((n): n is number => typeof n === "number" && Number.isFinite(n)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = v.length >> 1;
  return v.length % 2 ? v[m]! : (v[m - 1]! + v[m]!) / 2;
}

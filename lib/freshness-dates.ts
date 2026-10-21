/**
 * Parse the date shapes the pipeline reports use ("2026-10-15", "2026-08" and a `Date`) and pick the newest.
 * Anything else is skipped. Pure, so it is unit-tested; the file reads live in `data-freshness.ts`.
 */
export function parseDataDate(value: unknown): Date | undefined {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;
  if (typeof value !== "string") return undefined;
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(value);
  if (!m) return undefined;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3] ?? 1)));
  return Number.isNaN(d.getTime()) || d.getUTCMonth() !== Number(m[2]) - 1 ? undefined : d;
}

export function latestDate(values: unknown[]): Date | undefined {
  let best: Date | undefined;
  for (const v of values) {
    const d = parseDataDate(v);
    if (d && (!best || d > best)) best = d;
  }
  return best;
}

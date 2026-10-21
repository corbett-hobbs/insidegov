/**
 * The site's compact number rule (ARCHITECTURE_MAP, "Numbers in prose"): a figure of 10,000 or more is shortened to one
 * decimal with K, M or B ("166.6K", "1.1M", "47.8B"; a trailing ".0" dropped: "283M"); a smaller one stays exact with
 * thousands separators ("2,464"), since "2.5K laws" reads worse than the number. Exact values belong in tables, tooltips
 * and "View as table". Pure and isomorphic.
 */

const UNITS: readonly [number, string][] = [
  [1e9, "B"],
  [1e6, "M"],
  [1e3, "K"],
];

/** "166.6K", "1.1M", "2,464". Negative values keep their sign ("−12.5K"). */
export function compactNumber(value: number): string {
  const sign = value < 0 ? "−" : "";
  const v = Math.abs(value);
  if (v < 10_000) return `${sign}${Math.round(v).toLocaleString("en-US")}`;
  for (let i = 0; i < UNITS.length; i++) {
    const [size, unit] = UNITS[i]!;
    if (v < size) continue;
    const scaled = Math.round((v / size) * 10) / 10;
    // 999,960 rounds to "1000K": carry into the next unit up instead.
    if (scaled >= 1000 && i > 0) return `${sign}${Math.round((v / UNITS[i - 1]![0]) * 10) / 10}${UNITS[i - 1]![1]}`;
    return `${sign}${Number.isInteger(scaled) ? scaled : scaled.toFixed(1)}${unit}`;
  }
  return `${sign}${Math.round(v).toLocaleString("en-US")}`;
}

/** "$1.7M", "$896K", "$4,250": `compactNumber` with a dollar sign. */
export const compactDollars = (value: number): string => {
  const s = compactNumber(value);
  return s.startsWith("−") ? `−$${s.slice(1)}` : `$${s}`;
};

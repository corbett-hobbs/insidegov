import type { DateStyle, UnitFormat } from "./types";

/**
 * Number and date formatting for insight facts. Every number a caption may use is produced here, and verify.ts
 * re-runs the same functions on re-derived values, so formatting is part of the traceability check.
 */

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function fmtNumber(value: number, decimals: number): string {
  // Avoid "-0" and "-0.0" after rounding.
  const rounded = Number(value.toFixed(decimals));
  return (Object.is(rounded, -0) ? 0 : rounded).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** A value in a series' unit, e.g. "$3.12" or "13.6 million barrels a day". Negative values keep their sign. */
export function fmtUnit(value: number, unit: UnitFormat): string {
  const scaled = value * unit.scale;
  const body = fmtNumber(Math.abs(scaled), unit.decimals);
  const sign = Number(scaled.toFixed(unit.decimals)) < 0 ? "-" : "";
  return `${sign}${unit.prefix ?? ""}${body}${unit.suffix}`;
}

/** A magnitude in a series' unit with no sign (a change whose direction is said in words). */
export function fmtUnitAbs(value: number, unit: UnitFormat): string {
  return fmtUnit(Math.abs(value), unit);
}

/** A percent magnitude, e.g. "12.4%" (direction is said in words, so no sign). */
export function fmtPct(value: number, decimals: number): string {
  return `${fmtNumber(Math.abs(value), decimals)}%`;
}

export function fmtInt(value: number): string {
  return fmtNumber(value, 0);
}

/** Decimals that keep a percent change readable: 1 under 10%, else 0. */
export function pctDecimals(pct: number): number {
  return Math.abs(pct) < 10 ? 1 : 0;
}

export function fmtDate(date: string, style: DateStyle): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  if (style === "year") return String(y);
  if (style === "fiscal_year") return `fiscal ${y}`;
  if (style === "month") return `${MONTHS[m - 1]} ${y}`;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** "August" (no year), for seasonal series. */
export function monthName(date: string): string {
  return MONTHS[Number(date.slice(5, 7)) - 1]!;
}

export function shortMonth(date: string): string {
  return `${MONTHS[Number(date.slice(5, 7)) - 1]!.slice(0, 3)} ${date.slice(0, 4)}`;
}

/** Whole days between two YYYY-MM-DD dates (to - from). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Whole calendar months between the months of two dates (to - from). */
export function monthsBetween(from: string, to: string): number {
  return (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + (Number(to.slice(5, 7)) - Number(from.slice(5, 7)));
}

export function yearsBetween(from: string, to: string): number {
  return daysBetween(from, to) / 365.25;
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

export function addMonths(date: string, months: number): string {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7)) - 1 + months;
  const yy = y + Math.floor(m / 12);
  const mm = ((m % 12) + 12) % 12;
  return `${yy}-${String(mm + 1).padStart(2, "0")}-01`;
}

/** The format a series' dates read in: monthly data by month, weekly by day, fiscal years by year. */
export function dateStyleFor(frequency: "weekly" | "monthly" | "fiscal_year"): DateStyle {
  return frequency === "weekly" ? "day" : frequency === "monthly" ? "month" : "fiscal_year";
}

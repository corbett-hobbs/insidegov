import { fiscalYearDays, type IceMarker } from "./immigration-derive";

/**
 * Pure geometry for the ICE removals bar chart (`components/immigration`):
 * slot sizing, label density, term-band segments and where a date falls on
 * the fiscal-year axis. No React, unit-tested.
 */

export const MAX_SLOT = 80;
export const MAX_BAR = 52;
export const BAR_GAP = 5;

/**
 * One slot per fiscal year and the bar inside it. The gap between bars is `BAR_GAP` in a wide slot but shrinks with the slot
 * (about a seventh of it, at least 1px), so a dense window (46 years on a phone) draws near-touching bars like the troops chart
 * instead of thin bars in wide empty gaps.
 */
export function slotLayout(plotWidth: number, slots: number): { slotW: number; barW: number } {
  const slotW = Math.min(MAX_SLOT, plotWidth / Math.max(1, slots));
  const gap = Math.min(BAR_GAP, Math.max(1, slotW * 0.15));
  return { slotW, barW: Math.min(MAX_BAR, Math.max(2, slotW - gap)) };
}

/** Value labels on every bar when 8 or fewer show; otherwise only these fiscal years (2000 is the INS era's peak). */
export const SPARSE_LABEL_YEARS: readonly number[] = [2000, 2012, 2021, 2025];
export const ALL_LABELS_MAX_BARS = 8;
export const labelsBar = (fy: number, shown: number) => shown <= ALL_LABELS_MAX_BARS || SPARSE_LABEL_YEARS.includes(fy);

export type YearLabelMode = "four" | "two" | "every4" | "every8";
/**
 * 4-digit labels when the slot is at least 30px wide, else 2-digit; every 4th year (2003, 2007, ...) under 20px, and every 8th
 * (1983, 1991, ..., 2023) under 12px, so the whole FY1980 to FY2025 window still keeps its year labels apart on a phone.
 */
export const yearLabelMode = (slotW: number): YearLabelMode => (slotW >= 30 ? "four" : slotW >= 20 ? "two" : slotW >= 12 ? "every4" : "every8");

export function yearLabel(fy: number, mode: YearLabelMode): string | null {
  if (mode === "four") return String(fy);
  if (mode === "two") return String(fy).slice(2);
  if (mode === "every8") return fy % 8 === 7 ? String(fy) : null;
  return fy % 4 === 3 ? String(fy) : null;
}

/** 442,637 -> "442,637"; compact "443k" when the slot is under 40px. */
export const formatRemovals = (n: number) => n.toLocaleString("en-US");
export const formatCompact = (n: number) => `${Math.round(n / 1000)}k`;
export const valueLabel = (n: number, slotW: number) => (slotW < 40 ? formatCompact(n) : formatRemovals(n));

export const gridValues = (yMax: number): number[] => {
  const out: number[] = [];
  for (let v = 0; v < yMax; v += 100_000) out.push(v);
  return out;
};

/** Y-axis tick text: 0, 100k, 200k. */
export const axisLabel = (v: number) => (v === 0 ? "0" : `${v / 1000}k`);

/**
 * Where an ISO date sits on the fiscal-year axis, as `fy + fraction of that
 * year elapsed` (Oct 1, 2006 = 2007.0; Mar 1, 2003 = 2003.41). A year's slot
 * spans `[fy - 1 + ..., fy)` visually as slot `fy`, so the axis position of a
 * date is the slot index `fy - firstShownFy` plus the fraction.
 */
export function fyPosition(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const fy = m >= 10 ? y + 1 : y;
  const start = Date.UTC(fy - 1, 9, 1);
  const day = Date.UTC(y, m - 1, d);
  return fy + (day - start) / 86_400_000 / fiscalYearDays(fy);
}

/** Slot-unit x of a date: 0 is the left edge of the first shown fiscal year. */
export const slotPosition = (iso: string, firstShownFy: number) => fyPosition(iso) - firstShownFy;

export interface MarkerPlacement {
  marker: IceMarker;
  /** Slot units from the left edge of the first shown year. */
  at: number;
}

/** Markers whose date falls inside the shown years (the span-start rule for Title 42). */
export function visibleMarkers(markers: readonly IceMarker[], firstShownFy: number, lastShownFy: number): MarkerPlacement[] {
  return markers
    .map((marker) => ({ marker, at: slotPosition(marker.date, firstShownFy) }))
    .filter((p) => p.at >= 0 && p.at < lastShownFy - firstShownFy + 1);
}

/** The shaded span of a marker, clipped to the shown slots (`slots` may include the pending slot); null if outside. */
export function shadeSpan(marker: IceMarker, firstShownFy: number, slots: number): [number, number] | null {
  if (!marker.end) return null;
  const a = Math.max(0, slotPosition(marker.date, firstShownFy));
  const b = Math.min(slots, slotPosition(marker.end, firstShownFy));
  return b > a ? [a, b] : null;
}

export interface TermSegment {
  termId: string;
  party: "D" | "R";
  /** Slot indices, `to` exclusive. */
  from: number;
  to: number;
}

/**
 * Runs of consecutive fiscal years under one administration, in slot units.
 * The pending slot extends the last segment, so the band reaches the end of the axis.
 */
export function termSegments(years: readonly { termId: string; party: "D" | "R" }[], pending: boolean): TermSegment[] {
  const out: TermSegment[] = [];
  years.forEach((y, i) => {
    const last = out[out.length - 1];
    if (last && last.termId === y.termId) last.to = i + 1;
    else out.push({ termId: y.termId, party: y.party, from: i, to: i + 1 });
  });
  if (pending && out.length) out[out.length - 1].to += 1;
  return out;
}


/** Regime strip text that fits the width, or null. */
export function regimeLabel(widthPx: number, long: string, short: string): string | null {
  const need = (s: string) => s.length * 5.6 + 12;
  if (widthPx >= need(long)) return long;
  if (widthPx >= need(short)) return short;
  return null;
}

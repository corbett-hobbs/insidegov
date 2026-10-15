import { fyPosition } from "./immigration-chart";
import type { EncounterParts, EncounterScopeKey, EncountersMarker, EncountersYear } from "./encounters-types";

/**
 * Pure helpers for the CBP border-encounters chart (`components/immigration/EncountersChart`): which segments a year draws,
 * the value the axis is sized from, and where the numbered markers sit. No React, unit-tested. CBP only: nothing here reads
 * an ICE figure.
 */

export type EncounterSeriesKey = "usbp" | "ofo" | "title42";

/** Stack order, bottom to top; the legend, bars and table all read in this order. */
export const ENCOUNTER_SERIES: readonly { key: EncounterSeriesKey; name: string; short: string; color: string }[] = [
  { key: "usbp", name: "Border Patrol apprehensions (between ports)", short: "Border Patrol", color: "var(--agency-cbp)" },
  { key: "ofo", name: "Port-of-entry inadmissibles (OFO)", short: "Ports of entry", color: "var(--sector-econ)" },
  { key: "title42", name: "Title 42 expulsions (both components)", short: "Title 42", color: "var(--sector-ps)" },
];

/** The neutral bar for years with Border Patrol figures only. */
export const USBP_ONLY_COLOR = "var(--oth)";

export const partValue = (p: EncounterParts, key: EncounterSeriesKey): number | null => p[key];

/** A year's parts for the chosen border scope. */
export const partsOf = (y: EncountersYear, scope: EncounterScopeKey): EncounterParts => y[scope];

/** What the bar's height shows: the whole stack, or one isolated series (null when that series has no figure for the year). */
export function barValue(y: EncountersYear, scope: EncounterScopeKey, only: EncounterSeriesKey | null): number | null {
  const p = partsOf(y, scope);
  return only ? partValue(p, only) : p.total;
}

/** The stack segments to draw, bottom first. Years with Border Patrol only draw one neutral segment; an isolated series is drawn from zero. */
export function segments(y: EncountersYear, scope: EncounterScopeKey, only: EncounterSeriesKey | null): { key: EncounterSeriesKey | "usbp_only"; value: number; from: number }[] {
  const p = partsOf(y, scope);
  if (only) {
    const v = partValue(p, only);
    return v !== null && v > 0 ? [{ key: only, value: v, from: 0 }] : [];
  }
  if (y.detail === "usbp_only") return [{ key: "usbp_only", value: p.usbp, from: 0 }];
  let acc = 0;
  const out: { key: EncounterSeriesKey; value: number; from: number }[] = [];
  for (const s of ENCOUNTER_SERIES) {
    const v = partValue(p, s.key);
    if (v === null || v <= 0) continue;
    out.push({ key: s.key, value: v, from: acc });
    acc += v;
  }
  return out;
}

/** The years that fall in the page window; the in-progress newest year shows whenever the window reaches ICE's newest year, like the removals chart's "not yet locked" slot. */
export function windowYears(years: readonly EncountersYear[], range: readonly [number, number], iceLastFy: number): EncountersYear[] {
  const end = range[1] >= iceLastFy ? Infinity : range[1];
  return years.filter((y) => y.fy >= range[0] && y.fy <= end);
}

export interface MarkerGroup {
  markers: EncountersMarker[];
  /** Slot units from the left edge of the first shown year. */
  at: number;
  /** "3", or "4–5" when markers closer than a pill merge. */
  label: string;
}

/**
 * The numbered markers whose date falls inside the shown slots, with markers closer than `minGapPx` merged into one pill that
 * opens a card listing every one of them (the refugee chart's rule). Numbers are the payload's, so a marker keeps its number
 * whatever the window.
 */
export function markerGroups(markers: readonly EncountersMarker[], firstShownFy: number, slots: number, slotW: number, minGapPx: number): MarkerGroup[] {
  const placed = markers
    .map((m) => ({ m, at: fyPosition(m.date) - firstShownFy }))
    .filter((p) => p.at >= 0 && p.at < slots)
    .sort((a, b) => a.at - b.at);
  const groups: { items: typeof placed }[] = [];
  for (const p of placed) {
    const last = groups[groups.length - 1];
    if (last && (p.at - last.items[last.items.length - 1].at) * slotW < minGapPx) last.items.push(p);
    else groups.push({ items: [p] });
  }
  return groups.map(({ items }) => {
    const ns = items.map((i) => i.m.n).sort((a, b) => a - b);
    return {
      markers: items.map((i) => i.m),
      at: items.reduce((s, i) => s + i.at, 0) / items.length,
      label: ns.length === 1 ? String(ns[0]) : ns.length === 2 && ns[1] - ns[0] === 1 ? `${ns[0]}–${ns[1]}` : `${ns[0]}–${ns[ns.length - 1]}`,
    };
  });
}

/** "FY2026: 11 months (Oct to Aug)" for an in-progress year. */
const MONTHS = ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"];
export const monthsLabel = (months: number) => (months >= 12 ? "12 months" : `${months} months (Oct to ${MONTHS[months - 1]})`);

import { slotPosition } from "./immigration-chart";
import type { RefugeeMarker } from "./refugee-types";

/**
 * Pure geometry for the refugee cards (`components/immigration/Refugee*`): the ceiling chart's axis and numbered rules, the
 * "Who's sent the most refugees" axis and span labels. No React; unit-tested in `refugee-chart.test.ts`.
 */

/** The smallest round number at or above `max` x `pad`, from 1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8 times a power of ten. */
export function niceMax(max: number, pad = 1.06): number {
  const target = Math.max(1, max) * pad;
  const mag = 10 ** Math.floor(Math.log10(target));
  for (const s of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (s * mag >= target) return s * mag;
  return 10 * mag;
}

/** Gridline values for the ceiling chart's y-axis: a round step that gives at most five intervals. */
export function gridTicks(yMax: number): number[] {
  const step = [100, 200, 250, 500, 1_000, 2_000, 2_500, 5_000, 10_000, 20_000, 25_000, 50_000, 100_000].find((s) => yMax / s <= 5) ?? yMax;
  const out: number[] = [];
  for (let v = 0; v <= yMax + 1; v += step) out.push(v);
  return out;
}

/** "0", "5k", "12.5k". */
export const axisText = (v: number) => (v === 0 ? "0" : v >= 1000 ? `${+(v / 1000).toFixed(1)}k` : String(v));

/** Nice ticks for a bar axis with about four intervals (the first-place cards' scale). */
export function niceCountTicks(max: number): { ticks: number[]; top: number } {
  if (max <= 0) return { ticks: [0, 1], top: 1 };
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * pow).find((s) => s >= raw)!;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 1000; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return { ticks, top };
}

/** "20k", "12.3k", "1.2M": the in-bar and peak labels. */
export const compactCount = (v: number) => (v >= 1_000_000 ? `${+(v / 1_000_000).toFixed(2)}M` : v >= 10_000 ? `${Math.round(v / 1000)}k` : v >= 1000 ? `${+(v / 1000).toFixed(1)}k` : String(Math.round(v)));

export interface RulePlacement {
  marker: RefugeeMarker;
  /** Slot units from the left edge of the first shown year. */
  at: number;
}

/** The rules whose effective date falls inside the shown years. */
export function rulePlacements(markers: readonly RefugeeMarker[], firstShownFy: number, lastShownFy: number): RulePlacement[] {
  return markers
    .map((marker) => ({ marker, at: slotPosition(marker.date, firstShownFy) }))
    .filter((p) => p.at >= 0 && p.at < lastShownFy - firstShownFy + 1);
}

export interface RuleGroup {
  markers: RefugeeMarker[];
  /** Slot units: the middle of the group. */
  at: number;
}

/**
 * Rules closer than `gapPx` (the width of a numbered pill) merge into one pill, "1–3", whose card lists every rule it holds
 * (ARCHITECTURE_MAP rule 10m: flags that merge list every action).
 */
export function groupRules(placements: readonly RulePlacement[], slotW: number, gapPx = 24): RuleGroup[] {
  const sorted = [...placements].sort((a, b) => a.at - b.at);
  const out: { markers: RefugeeMarker[]; first: number; last: number }[] = [];
  for (const p of sorted) {
    const g = out[out.length - 1];
    if (g && (p.at - g.last) * slotW < gapPx) {
      g.markers.push(p.marker);
      g.last = p.at;
    } else out.push({ markers: [p.marker], first: p.at, last: p.at });
  }
  return out.map((g) => ({ markers: g.markers, at: (g.first + g.last) / 2 }));
}

/** "6", or "6–9" for a merged pill. */
export const groupLabel = (g: RuleGroup) => (g.markers.length === 1 ? String(g.markers[0].n) : `${g.markers[0].n}–${g.markers[g.markers.length - 1].n}`);

export interface SpanLabel {
  /** Text drawn flat across the span ("" when it does not fit). */
  flat: string;
  /** Text slanted up and to the right when nothing fits flat ("" otherwise). Never both empty. */
  slant: string;
}

/** Three-letter ISO codes that readers know by another short form: the Democratic Republic of the Congo is "DRC", not "COD". */
const CODE_LABEL: Readonly<Record<string, string>> = { COD: "DRC" };

/**
 * A run's label: the name when it fits across the span, else the code, else the name (or the code, if the name is long)
 * slanted up and to the right, at any width: a label that does not fit is never dropped (ARCHITECTURE_MAP rule 10). `narrow`
 * (a phone-width chart) prefers slanting a short name to a three-letter code.
 */
export function spanLabel(name: string, code: string, widthPx: number, narrow: boolean): SpanLabel {
  code = CODE_LABEL[code] ?? code;
  if (widthPx >= name.length * 7.2 + 14) return { flat: name, slant: "" };
  if (widthPx >= 34 && !(narrow && name.length <= 9)) return { flat: code, slant: "" };
  return { flat: "", slant: name.length <= 9 ? name : code };
}

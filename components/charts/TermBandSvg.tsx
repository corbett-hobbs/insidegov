import type { ReactNode } from "react";
import { fitTermLabel, initialsOf } from "@/lib/term-label";
import { selectedTerms, toggleTermWindow, type TermWindow } from "@/lib/term-window";
import { presidentOfBandLabel, useBandLink } from "./BandLink";

export interface TermSegment {
  id: string;
  /** Last name, shown when it fits; then four letters, then initials, then the last initial. */
  last: string;
  /** Full name, for the initials ("Barack Obama" -> "BO"). */
  president: string;
  party: "D" | "R";
  /** First and last slot index the term covers inside the plot (inclusive). */
  s: number;
  e: number;
}

export const TERM_BAND_H = 20;

/**
 * Makes a band under a chart tappable, the same as the term band under the filter bar's slider (ARCHITECTURE_MAP rule 10k): tap a term to
 * add it to the window, tap a selected one at either end of the run to drop it, tap the only selected one to clear. `axis` maps a slot to
 * the window's units (`edge` says whether the segment's first or last slot is wanted); `min`/`max` are the full range.
 */
export interface TermBandSelect extends TermWindow {
  axis: (slot: number, edge: "from" | "to") => number;
  /** A term's extent on the window's axis by id, when the filter bar's band has its own (it then wins over `axis`, so the two bands always agree). */
  extent?: (id: string) => readonly [number, number] | undefined;
}

/** One band segment: the tint (deeper when selected), the 2.5px party rule and the label; a button when the band is tappable. */
function BandSegment({ x, w, party, text, label, president, picked, faded, onPress }: { x: number; w: number; party: "D" | "R"; text: string; label: string; president: string; picked: boolean; faded: boolean; onPress?: () => void }) {
  const c = party === "R" ? "--rep" : "--dem";
  const body = (
    <>
      <rect x={x + 0.5} y={0} width={Math.max(0, w - 1)} height={TERM_BAND_H} rx={2} style={{ fill: `color-mix(in oklab, var(${c}) ${picked ? 34 : 20}%, var(--surface))` }} />
      <rect x={x + 0.5} y={0} width={Math.max(0, w - 1)} height={2.5} style={{ fill: `var(${c})` }} />
      {text && (
        <text x={x + w / 2} y={TERM_BAND_H - 5} textAnchor="middle" style={{ fontSize: 11, fill: "var(--ink)" }}>
          {text}
        </text>
      )}
    </>
  );
  if (!onPress) return <g>{body}</g>;
  return (
    <PressableBand label={label} president={president} picked={picked} faded={faded} onPress={onPress}>
      {body}
    </PressableBand>
  );
}

/**
 * An SVG group that works as a toggle button: tap, Enter or Space presses it; the focus ring shows for keyboard use only (see `.term-band` in
 * globals.css). A press also pins a card linking to the president's page (`useBandLink`); `president` names them, else the label's
 * "Name: tap to …" prefix does.
 */
export function PressableBand({ label, picked, faded, onPress, president, children }: { label: string; picked: boolean; faded: boolean; onPress: () => void; president?: string; children: ReactNode }) {
  const link = useBandLink(president ?? presidentOfBandLabel(label));
  return (
    <g
      className="term-band cursor-pointer"
      role="button"
      tabIndex={0}
      aria-label={link.linked ? `${label}; also links to the president's page` : label}
      aria-pressed={picked}
      opacity={faded ? 0.4 : 1}
      data-pin-target=""
      onClick={(e) => {
        e.stopPropagation();
        onPress();
        link.toggle(e.clientX, e.clientY);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPress();
          const r = e.currentTarget.getBoundingClientRect();
          link.toggle(r.left + r.width / 2, r.bottom);
        }
      }}
    >
      <title>{label}</title>
      {children}
      {link.card}
    </g>
  );
}

/** Per-segment press handlers and selected flags for a tappable band. */
function segmentActions(segments: readonly { id: string; label: string; from: number; to: number }[], sel: TermWindow | undefined) {
  if (!sel) return segments.map(() => ({ picked: false, onPress: undefined as undefined | (() => void) }));
  const picked = new Set(selectedTerms(segments, sel.min, sel.max, sel.value));
  return segments.map((_, k) => ({ picked: picked.has(k), onPress: () => sel.onChange(toggleTermWindow(segments, k, sel.min, sel.max, sel.value)) }));
}


/** Runs of consecutive slots that share a term id, as segments. `termAt` returns the slot's term (or null for none). */
export function termSegments<T extends { id: string; last: string; president: string; party: "D" | "R" }>(
  slots: number,
  termAt: (slot: number) => T | null,
): TermSegment[] {
  const out: TermSegment[] = [];
  for (let i = 0; i < slots; i++) {
    const t = termAt(i);
    if (!t) continue;
    const prev = out[out.length - 1];
    if (prev && prev.id === t.id && prev.e === i - 1) prev.e = i;
    else out.push({ id: t.id, last: t.last, president: t.president, party: t.party, s: i, e: i });
  }
  return out;
}

/**
 * The presidential-term band under a slot-based SVG chart (the "Who's been No. 1" / "Who's hosted the most" cards):
 * the same light party tint, 2.5px party rule and `var(--ink)` label as every other term band (ARCHITECTURE_MAP rule
 * 10b), each label centred in its segment and shortened (last name, four letters, initials, last initial) rather than
 * dropped (rule 10). Render inside the chart's `<svg>`; `y` is the band's top edge.
 */
export function TermBandSvg({ segments, x0, step, y, select }: { segments: readonly TermSegment[]; x0: number; step: number; y: number; select?: TermBandSelect }) {
  const ext = segments.map((g) => {
    const own = select?.extent?.(g.id);
    return { id: g.id, label: g.president, from: own ? own[0] : select ? select.axis(g.s, "from") : 0, to: own ? own[1] : select ? select.axis(g.e, "to") : 0 };
  });
  const acts = segmentActions(ext, select);
  return (
    <g transform={`translate(0,${y})`} aria-hidden={select ? undefined : true}>
      {segments.map((g, k) => {
        const w = (g.e - g.s + 1) * step;
        const text = fitTermLabel(w, g.last, initialsOf(g.president)) ?? "";
        const anySel = select ? selectedTerms(ext, select.min, select.max, select.value).length > 0 : false;
        return (
          <BandSegment
            key={`${g.id}-${g.s}`}
            x={x0 + g.s * step}
            w={w}
            party={g.party}
            text={text}
            label={`${g.president}: tap to ${acts[k].picked ? "drop" : "show"} these years`}
            president={g.president}
            picked={acts[k].picked}
            faded={anySel && !acts[k].picked}
            onPress={acts[k].onPress}
          />
        );
      })}
    </g>
  );
}

/** A term on a continuous axis: pixel edges instead of slot indexes (the Court line chart, where a term starts mid-year). */
export interface TermSpan {
  id: string;
  last: string;
  president: string;
  party: "D" | "R";
  x0: number;
  x1: number;
}

/** `TermBandSvg` for a continuous axis: the same tint, party rule and shortened labels, each span between its own pixel edges. `y` is the band's top edge. With `select`, `from`/`to` are the span's extent on the window's axis. */
export function TermSpanSvg({ spans, y, select }: { spans: readonly (TermSpan & { from?: number; to?: number })[]; y: number; select?: Omit<TermBandSelect, "axis"> }) {
  const ext = spans.map((g) => ({ id: g.id, label: g.president, from: g.from ?? 0, to: g.to ?? 0 }));
  const acts = segmentActions(ext, select);
  const anySel = select ? selectedTerms(ext, select.min, select.max, select.value).length > 0 : false;
  return (
    <g transform={`translate(0,${y})`} aria-hidden={select ? undefined : true}>
      {spans.map((g, k) => {
        const w = g.x1 - g.x0;
        const text = fitTermLabel(w, g.last, initialsOf(g.president)) ?? "";
        return (
          <BandSegment
            key={g.id}
            x={g.x0}
            w={w}
            party={g.party}
            text={text}
            label={`${g.president}: tap to ${acts[k].picked ? "drop" : "show"} these years`}
            president={g.president}
            picked={acts[k].picked}
            faded={anySel && !acts[k].picked}
            onPress={acts[k].onPress}
          />
        );
      })}
    </g>
  );
}

"use client";

import { Y_GUTTER } from "@/lib/chart-bars";
import { useId, useMemo, useState } from "react";
import { scaleLinear } from "d3-scale";
import { area, line } from "d3-shape";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { Axis } from "@/components/charts/Axis";
import { RangeReset } from "@/components/charts/RangeReset";
import { RangeSelector } from "@/components/charts/RangeSelector";
import { TERM_BAND_H, TermSpanSvg } from "@/components/charts/TermBandSvg";
import type { CourtBandTerm } from "@/lib/court-president-band";
import { Tooltip, usePinnedTooltip, useTooltip } from "@/components/charts/Tooltip";
import { useElementWidth } from "@/lib/use-element-width";
import { useMediaQuery } from "@/lib/use-media-query";
import { sameRange } from "@/lib/year-range";
import {
  fmtScore,
  isDimmed,
  isSeated,
  partyLabel,
  scoreAt,
  type CourtFilter,
  type CourtJustice,
  type CourtPayload,
} from "@/lib/court-types";
import { LEGEND_ROW } from "@/components/charts/legend";

const FALLBACK_W = 1100;
const H = 340;
const MARGIN = { top: 14, right: 14, bottom: 30, left: Y_GUTTER };
const BAND_GAP = 4;
/** Fewest terms the zoom can show. */
const MIN_SPAN = 3;

/** A tick step (in years) that gives about `want` ticks over `span` years. */
const niceStep = (span: number, want: number): number => [1, 2, 5, 10, 20].find((s) => span / s <= want) ?? 20;
const partyVar = (j: CourtJustice) => (j.party === "D" ? "var(--dem)" : "var(--rep)");

/**
 * "How each justice moved": every justice's score by term, one faint party-
 * coloured line each, a bold Court-median line, a playhead on the shared term
 * and — for the selected justice — the real 95% interval band, clipped to the
 * plot. Click or drag the background to scrub the shared term.
 */
export function JusticeTrajectory({
  data,
  presidents,
  term,
  filter,
  selectedId,
  onSelect,
  onScrub,
}: {
  data: CourtPayload;
  /** Presidents on the term axis, drawn as a band under the year axis; none, no band. */
  presidents: readonly CourtBandTerm[];
  term: number;
  filter: CourtFilter;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onScrub: (t: number) => void;
}) {
  const [wrapRef, measuredW] = useElementWidth<HTMLDivElement>();
  const W = measuredW || FALLBACK_W;
  const clipId = `court-clip-${useId().replace(/:/g, "")}`;
  const [hoverId, setHoverId] = useState<number | null>(null);
  const tip = useTooltip<CourtJustice>();
  // Scatter rule (ARCHITECTURE_MAP 10e): a click or tap pins the justice's card, and the card is the link to their page, never the line.
  const pin = usePinnedTooltip<CourtJustice>();
  // Hover previews only where there is a hover; a phone taps straight to the pinned card.
  const tapMode = !useMediaQuery("(hover: hover)");
  const { firstTerm, lastTerm } = data;

  // The zoom window, in terms. The band's tap and the slider under the chart both set it, so it is the single source of truth.
  const [win, setWin] = useState<[number, number]>([firstTerm, lastTerm]);
  const full = sameRange(win, [firstTerm, lastTerm]);
  const yearStep = niceStep(win[1] - win[0], W < 600 ? 4 : 7);
  const yearTicks = useMemo(() => {
    const out: number[] = [];
    for (let t = Math.ceil(win[0] / yearStep) * yearStep; t <= win[1]; t += yearStep) out.push(t);
    return out;
  }, [win, yearStep]);

  // Zoomed in, the score axis refits to the lines on screen, so the detail is not flattened by one far-out justice.
  const yDomain = useMemo((): [number, number] => {
    if (full) return data.domain;
    const vals: number[] = [];
    for (const j of data.justices)
      j.s.forEach((v, i) => {
        const t = j.t0 + i;
        if (t >= win[0] && t <= win[1]) vals.push(v);
      });
    for (const m of data.terms) if (m.term >= win[0] && m.term <= win[1]) vals.push(m.median);
    if (vals.length === 0) return data.domain;
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const pad = Math.max(0.4, (hi - lo) * 0.06);
    return [Math.max(data.domain[0], Math.floor(lo - pad)), Math.min(data.domain[1], Math.ceil(hi + pad))];
  }, [data, win, full]);
  const yTickStep = yDomain[1] - yDomain[0] <= 6 ? 1 : 2;

  /** The band's spans inside the zoom window, as pixel edges on the chart's x scale. */
  const bandSpans = (x: (v: number) => number) =>
    presidents
      .filter((p) => p.to > win[0] && p.from < win[1])
      .map((p) => ({ id: p.id, last: p.last, president: p.president, party: p.party, x0: x(Math.max(p.from, win[0])), x1: x(Math.min(p.to, win[1])) }));

  /** Tapping a president zooms to their years; tapping the one already zoomed to resets. */
  const pickPresident = (p: CourtBandTerm) => {
    const next: [number, number] = [Math.max(firstTerm, Math.floor(p.from)), Math.min(lastTerm, Math.ceil(p.to))];
    if (next[1] - next[0] < MIN_SPAN) next[1] = Math.min(lastTerm, next[0] + MIN_SPAN);
    setWin(sameRange(next, win) ? [firstTerm, lastTerm] : next);
  };

  const focusId = pin.state?.data.id ?? hoverId ?? selectedId;
  const byId = new Map(data.justices.map((j) => [j.id, j]));
  const focus = focusId != null ? (byId.get(focusId) ?? null) : null;
  const selected = selectedId != null ? (byId.get(selectedId) ?? null) : null;

  return (
    <div ref={wrapRef} className="-mx-3 sm:mx-0">
      <ChartFrame
        width={W}
        height={presidents.length > 0 ? H + BAND_GAP + TERM_BAND_H : H}
        margin={presidents.length > 0 ? { ...MARGIN, bottom: MARGIN.bottom + BAND_GAP + TERM_BAND_H } : MARGIN}
        ariaLabel="Line chart of each justice's ideology score by term, with the Court median"
      >
        {({ innerWidth, innerHeight }) => {
          const x = scaleLinear().domain(win).range([0, innerWidth]);
          const y = scaleLinear().domain(yDomain).range([innerHeight, 0]);

          const yTicks: number[] = [];
          for (let v = Math.ceil(yDomain[0] / yTickStep) * yTickStep; v <= yDomain[1]; v += yTickStep) yTicks.push(v);

          const path = (j: CourtJustice) =>
            line<number>()
              .x((_, i) => x(j.t0 + i))
              .y((v) => y(v))(j.s) ?? "";

          const band = (j: CourtJustice) =>
            area<number>()
              .x((_, i) => x(j.t0 + i))
              .y0((_, i) => y(j.lo[i]))
              .y1((_, i) => y(j.hi[i]))(j.s) ?? "";

          const medianPath =
            line<(typeof data.terms)[number]>()
              .x((t) => x(t.term))
              .y((t) => y(t.median))(data.terms) ?? "";

          const scrub = (e: React.PointerEvent<SVGRectElement>) => {
            const ctm = e.currentTarget.getScreenCTM();
            if (!ctm) return;
            const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
            const t = Math.round(x.invert(p.x));
            onScrub(Math.max(firstTerm, Math.min(lastTerm, t)));
          };

          // Dimmed lines draw first so the matching ones sit on top.
          const order = [...data.justices].sort(
            (a, b) => Number(isDimmed(b, filter)) - Number(isDimmed(a, filter)),
          );

          // Zoomed in there is room to name the lines: one label at the right end of each visible line, top to bottom, skipping any that
          // would sit on a label already placed (the focused justice is placed first, so it is never the one dropped).
          let zoomLabels: React.ReactNode = null;
          if (!full) {
            const LABEL_GAP = 12;
            const cand = data.justices
              .map((j) => {
                const from = Math.max(j.t0, win[0]);
                const to = Math.min(j.t1, win[1]);
                if (to - from < 1 || isDimmed(j, filter)) return null;
                return { j, ex: x(to), ey: y(scoreAt(j, to)) };
              })
              .filter((c): c is { j: CourtJustice; ex: number; ey: number } => c !== null)
              .sort((a, b) => Number(b.j.id === focusId) - Number(a.j.id === focusId) || a.ey - b.ey);
            const kept: typeof cand = [];
            for (const c of cand) if (kept.every((k) => Math.abs(k.ey - c.ey) >= LABEL_GAP)) kept.push(c);
            zoomLabels = kept.map(({ j, ex, ey }) => (
              <text
                key={j.id}
                x={Math.min(ex, innerWidth) - 4}
                y={ey - 5}
                textAnchor="end"
                fill={partyVar(j)}
                fontSize={11.5}
                fontWeight={j.id === focusId ? 700 : 500}
                opacity={focusId != null && j.id !== focusId ? 0.75 : 1}
                style={{ paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: 3.5 }}
                pointerEvents="none"
              >
                {j.short}
              </text>
            ));
          }

          let endLabel: React.ReactNode = null;
          if (full && focus && x(focus.t1) >= 0 && x(focus.t1) <= innerWidth + 1) {
            const ex = x(focus.t1);
            const ey = y(focus.s[focus.s.length - 1]);
            const fits = ex + 6 + focus.short.length * 7.2 <= innerWidth + MARGIN.right - 2;
            endLabel = (
              <text
                x={fits ? ex + 6 : ex - 4}
                y={fits ? ey + 4 : ey - 9}
                textAnchor={fits ? "start" : "end"}
                fill={partyVar(focus)}
                fontSize={12.5}
                fontWeight={600}
                pointerEvents="none"
              >
                {focus.short}
              </text>
            );
          }

          return (
            <>
              <defs>
                <clipPath id={clipId}>
                  <rect x={0} y={0} width={innerWidth} height={innerHeight} />
                </clipPath>
              </defs>

              <Axis
                scale={x}
                orientation="bottom"
                ticks={yearTicks}
                offset={innerHeight}
                gridExtent={innerHeight}
                format={(t) => String(t)}
              />
              <Axis
                scale={y}
                orientation="left"
                ticks={yTicks}
                offset={0}
                gridExtent={innerWidth}
                zeroAt={0}
                format={(v) => (v === 0 ? "0" : v > 0 ? `+${v}` : `−${Math.abs(v)}`)}
              />
              {presidents.length > 0 && (
                <>
                  <TermSpanSvg
                    y={innerHeight + MARGIN.bottom + BAND_GAP}
                    spans={bandSpans(x)}
                  />
                  {/* Each term is a button: tap to zoom to that president's years, tap again to reset. */}
                  {bandSpans(x).map((g) => (
                    <rect
                      key={g.id}
                      x={g.x0}
                      y={innerHeight + MARGIN.bottom + BAND_GAP}
                      width={Math.max(0, g.x1 - g.x0)}
                      height={TERM_BAND_H}
                      fill="transparent"
                      role="button"
                      tabIndex={0}
                      aria-label={`Zoom to ${g.president}'s years`}
                      style={{ cursor: "pointer" }}
                      onClick={() => pickPresident(presidents.find((p) => p.id === g.id)!)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          pickPresident(presidents.find((p) => p.id === g.id)!);
                        }
                      }}
                    />
                  ))}
                </>
              )}
              <text x={4} y={12} fill="var(--ink-muted)" fontSize={12}>
                More conservative
              </text>
              <text x={4} y={innerHeight - 6} fill="var(--ink-muted)" fontSize={12}>
                More liberal
              </text>

              <rect
                x={0}
                y={0}
                width={innerWidth}
                height={innerHeight}
                fill="transparent"
                style={{ cursor: "crosshair" }}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  scrub(e);
                }}
                onPointerMove={(e) => {
                  if (e.buttons) scrub(e);
                }}
              />

              <g clipPath={`url(#${clipId})`}>
              {selected && (
                <path
                  d={band(selected)}
                  fill={partyVar(selected)}
                  opacity={0.16}
                  pointerEvents="none"
                />
              )}

              {order.map((j) => {
                const f = focusId === j.id;
                const dim = isDimmed(j, filter);
                return (
                  <g key={j.id}>
                    <path
                      d={path(j)}
                      fill="none"
                      stroke={partyVar(j)}
                      strokeWidth={f ? 3 : 1.3}
                      strokeLinejoin="round"
                      opacity={f ? 1 : dim ? 0.07 : focusId != null ? 0.16 : 0.38}
                      pointerEvents="none"
                    />
                    <path
                      d={path(j)}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={10}
                      data-pin-target=""
                      style={{ cursor: "pointer" }}
                      onPointerEnter={(e) => {
                        if (tapMode) return;
                        setHoverId(j.id);
                        tip.show(j, e);
                      }}
                      onPointerMove={tapMode ? undefined : tip.move}
                      onPointerLeave={() => {
                        if (tapMode) return;
                        setHoverId(null);
                        tip.hide();
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        tip.hide();
                        if (pin.state?.data.id === j.id) pin.hide();
                        else pin.show(j, e);
                      }}
                    />
                  </g>
                );
              })}
              <path
                d={medianPath}
                fill="none"
                stroke="var(--ink)"
                strokeWidth={2.8}
                strokeLinejoin="round"
                pointerEvents="none"
              />

              {term >= win[0] && term <= win[1] && (
                <>
                  <line
                    className="trend-playhead"
                    x1={x(term)}
                    x2={x(term)}
                    y1={0}
                    y2={innerHeight}
                    pointerEvents="none"
                  />
                  {data.justices
                    .filter((j) => isSeated(j, term))
                    .map((j) => (
                      <circle
                        key={j.id}
                        cx={x(term)}
                        cy={y(scoreAt(j, term))}
                        r={3.2}
                        fill={partyVar(j)}
                        opacity={isDimmed(j, filter) ? 0.2 : 1}
                        pointerEvents="none"
                      />
                    ))}
                </>
              )}
              </g>
              {endLabel}
              {zoomLabels && <g clipPath={`url(#${clipId})`}>{zoomLabels}</g>}
              {/* The shared term is outside the zoom: a marker at the edge says which way it is. */}
              {(term < win[0] || term > win[1]) && (
                <text
                  x={term < win[0] ? 4 : innerWidth - 4}
                  y={innerHeight - 22}
                  textAnchor={term < win[0] ? "start" : "end"}
                  fill="var(--ink-muted)"
                  fontSize={11.5}
                  pointerEvents="none"
                >
                  {term < win[0] ? `‹ selected term ${term}` : `selected term ${term} ›`}
                </text>
              )}
            </>
          );
        }}
      </ChartFrame>

      {/* Zoom: the same two-handle slider the other pages use, local to this card; the band's taps set it too. */}
      <div className="mx-0.5 mt-3 flex items-center gap-2">
        <RangeSelector
          min={firstTerm}
          max={lastTerm}
          value={win}
          minSpan={MIN_SPAN}
          onChange={(r) => setWin(r)}
          format={String}
          ariaLabel="Terms shown on the chart"
          action={<RangeReset show={!full} onReset={() => setWin([firstTerm, lastTerm])} ariaLabel="Reset the chart zoom to every term" className="mt-0.5 font-sans leading-none" />}
          className="min-w-0 flex-1"
        />
      </div>

      <div className={`${LEGEND_ROW} mt-2`}>
        <Swatch color="var(--dem)" label="Democratic appointee" />
        <Swatch color="var(--rep)" label="Republican appointee" />
        <Swatch color="var(--ink)" label="Court median" thick />
        {selected && (
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-2.5 w-5 rounded-sm"
              style={{ background: partyVar(selected), opacity: 0.25 }}
            />
            {selected.short}&rsquo;s 95% interval
          </span>
        )}
      </div>

      <Tooltip state={pin.state ? null : tip.state}>{tipBody}</Tooltip>
      <Tooltip
        state={pin.state}
        onActivate={(j) => {
          pin.hide();
          onSelect(j.id);
        }}
        activateHint="Open profile →"
      >
        {tipBody}
      </Tooltip>
    </div>
  );
}

const tipBody = (j: CourtJustice) => (
  <>
    <b>{j.name}</b>
    <div>
      Appointed by {j.pres} ({partyLabel(j.party)})
    </div>
    <div className="tt-mono">
      Scored terms: {j.t0}–{j.t1}
    </div>
    <div className="tt-mono">Career average: {fmtScore(j.career)}</div>
  </>
);

function Swatch({ color, label, thick }: { color: string; label: string; thick?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <svg width="20" height="8" viewBox="0 0 20 8" aria-hidden className="flex-none">
        <line x1="0" y1="4" x2="20" y2="4" stroke={color} strokeWidth={thick ? 2.8 : 2.25} />
      </svg>
      {label}
    </span>
  );
}

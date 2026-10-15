"use client";

import { fitTermLabel, initialsOf } from "@/lib/term-label";
import { Y_GUTTER } from "@/lib/chart-bars";
import { scaleLinear } from "d3-scale";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Axis } from "@/components/charts/Axis";
import { ChartFrame } from "@/components/charts/ChartFrame";
import {
  axisLabel,
  gridValues,
  labelsBar,
  regimeLabel,
  shadeSpan,
  slotLayout,
  termSegments,
  valueLabel,
  visibleMarkers,
  yearLabel,
  yearLabelMode,
} from "@/lib/immigration-chart";
import { RETURNS_COUNTED_FROM, type IceMarker, type IceTerm, type IceYear } from "@/lib/immigration-derive";
import { useElementWidth } from "@/lib/use-element-width";
import { Tooltip, useTooltip } from "../charts/Tooltip";
import { BarCard, MarkerCard, YearTip } from "./Cards";

const FALLBACK_W = 1084;
const PLOT_TOP = 34;
const PLOT_H = 250;
const BASE = PLOT_TOP + PLOT_H;
const BAND_Y = BASE + 30;
const BAND_H = 22;
const STRIP_Y = BASE + 60;
const STRIP_H = 18;
const SVG_H = STRIP_Y + STRIP_H + 4;
const MARKER_Y = 16;

type Open = { key: string; pinned: boolean } | null;

const n = (v: number) => v.toLocaleString("en-US");

/** Screen-reader text for one bar: the removals total (INS era: who counted), who first apprehended the people, and the detention average. */
function barAria(yr: IceYear): string {
  if (yr.era === "ins") return `FY${yr.fy}: ${n(yr.value)} removals counted by the INS, DHS statistics, removals only, ${yr.status}`;
  const split = yr.agency ? `, ${n(yr.agency.ice)} first arrested by ICE and ${n(yr.agency.cbp)} by Border Patrol` : "";
  const held = yr.detention ? `; ${n(yr.detention.value)} people in ICE detention on an average day` : "";
  return `FY${yr.fy}: ${n(yr.value)} removals${split}${held}, ${yr.status}`;
}

interface DetentionPoint {
  fy: number;
  /** Slot index of the year among the shown ones. */
  i0: number;
  value: number;
  status: "final" | "preliminary";
  /** Whether the point carries a value label: the peak and the newest point. */
  label: boolean;
}

/** The detention line's points inside the shown years, oldest first, with labels on the peak and the latest. */
function detentionPoints(years: readonly IceYear[]): DetentionPoint[] {
  const pts = years.flatMap((y, i) => (y.detention ? [{ fy: y.fy, i0: i, value: y.detention.value, status: y.detention.status }] : []));
  if (pts.length === 0) return [];
  const peak = pts.reduce((a, b) => (b.value > a.value ? b : a));
  const last = pts[pts.length - 1];
  return pts.map((p) => ({ ...p, label: p === peak || p === last }));
}

const partyVar = (p: "D" | "R") => (p === "D" ? "var(--dem)" : "var(--rep)");

/**
 * Removals by fiscal year (the INS's, as DHS republishes them, FY1980 to FY2002; ICE's own from FY2003): one bar per year stacked by who first apprehended the person (ICE's own officers, teal;
 * Border Patrol, amber; grey where ICE prints no split), the average people in ICE detention as a line on the same
 * axis, a term band and a regime strip under the axis, numbered definition-change markers, and a card per bar. The
 * y-axis is fixed across selections (`yMax` is from the whole series).
 */
export function RemovalsChart({
  years,
  terms,
  markers,
  yMax,
  pending,
  pendingFy,
  selectedFy,
  onSelectFy,
  activeFy,
  onActiveFy,
}: {
  years: readonly IceYear[];
  terms: readonly IceTerm[];
  markers: readonly IceMarker[];
  yMax: number;
  pending: boolean;
  pendingFy: number;
  /** The fiscal year the pinned slider is on (its country list is the card below). */
  selectedFy?: number;
  onSelectFy?: (fy: number) => void;
  /** The year the encounters card above is on (hover or an open card): lit here too. */
  activeFy?: number | null;
  /** Reports the year this chart is on, so the encounters card can light it. */
  onActiveFy?: (fy: number | null) => void;
}) {
  const [ref, measured] = useElementWidth<HTMLDivElement>();
  const W = measured || FALLBACK_W;
  const compact = W < 520;
  const left = Y_GUTTER; // y labels sit in a gutter left of the plot
  const right = 8;
  const plotW = W - left - right;
  const slots = years.length + (pending ? 1 : 0);
  const { slotW, barW } = slotLayout(plotW, slots);
  const firstFy = years[0].fy;
  const lastFy = years[years.length - 1].fy;
  const y = scaleLinear().domain([0, yMax]).range([BASE, PLOT_TOP]);
  const xSlot = (i: number) => i * slotW;
  const mode = yearLabelMode(slotW);
  const detention = detentionPoints(years);
  const idBase = useId().replace(/:/g, "");

  const [open, setOpen] = useState<Open>(null);
  const tip = useTooltip<IceYear>();
  const wrap = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(null), []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest("[data-ice-hit]")) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const openFy = open?.key.startsWith("b") ? Number(open.key.slice(1)) : null;
  useEffect(() => {
    onActiveFy?.(openFy);
  }, [openFy, onActiveFy]);
  useEffect(() => () => onActiveFy?.(null), [onActiveFy]);

  const placements = visibleMarkers(markers, firstFy, lastFy);
  const shade = markers.map((m) => ({ m, span: shadeSpan(m, firstFy, slots) })).find((s) => s.span);
  const shadeW = shade?.span ? (shade.span[1] - shade.span[0]) * slotW : 0;
  const shadeLabelled = shadeW >= 124;

  const segs = termSegments(years, pending);
  const termById = new Map(terms.map((t) => [t.termId, t]));
  const insCount = years.filter((yr) => yr.era === "ins").length;
  const hatchedCount = years.filter((yr) => yr.fy < RETURNS_COUNTED_FROM).length;
  const hatchedFull = years.length > 0 && hatchedCount === years.length;
  const returnsFrom = hatchedCount;
  const insLabel = regimeLabel(insCount * slotW, "INS era · DHS statistics, removals only", "INS era · removals only") ?? regimeLabel(insCount * slotW, "INS era", "INS");
  const lead = regimeLabel((hatchedCount - insCount) * slotW, "Removals only", "Removals");
  const rest = regimeLabel((slots - returnsFrom) * slotW, "ICE count includes returns", "Includes returns");

  const openBar = (fy: number, pinned: boolean) => setOpen({ key: `b${fy}`, pinned });
  const openMarker = (n: number, pinned: boolean) => setOpen({ key: `m${n}`, pinned });
  const toggle = (key: string) => setOpen((o) => (o && o.key === key && o.pinned ? null : { key, pinned: true }));

  const cardLeft = (cx: number, w: number) => Math.max(0, Math.min(W - w, cx - w / 2));
  const barCardW = compact ? 240 : 280;
  const markerCardW = compact ? 240 : 250;

  let card: ReactNode = null;
  if (open?.key.startsWith("b")) {
    const yr = years.find((v) => `b${v.fy}` === open.key);
    if (yr && open.pinned) {
      const i = years.indexOf(yr);
      card = (
        <BarCard
          year={yr}
          terms={termById}
          width={barCardW}
          left={cardLeft(left + xSlot(i) + slotW / 2, barCardW)}
          interactive
        />
      );
    }
  } else if (open?.key.startsWith("m")) {
    const p = placements.find((v) => `m${v.marker.n}` === open.key);
    if (p) {
      card = (
        <MarkerCard
          marker={p.marker}
          width={markerCardW}
          left={cardLeft(left + p.at * slotW, markerCardW)}
        />
      );
    }
  }

  return (
    <div ref={wrap} className="relative" onBlur={(e) => {
      const next = e.relatedTarget;
      if (next instanceof Node && !wrap.current?.contains(next)) close();
    }}>
      <div ref={ref} className="-mx-3 sm:mx-0">
        <ChartFrame
          width={W}
          height={SVG_H}
          margin={{ top: 0, right, bottom: 0, left }}
          ariaLabel={`Bar chart of removals by fiscal year, FY${firstFy} to FY${lastFy}: the Immigration and Naturalization Service's before March 2003, as DHS republishes them, then ICE's, split by the agency that first apprehended the person, with a line for the average number of people in ICE detention.`}
          className="block h-auto w-full max-w-full"
          svgProps={{ role: "group" }}
        >
          {() => (
            <>
              <defs>
                <pattern id={`${idBase}-hatch`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <rect width="6" height="6" style={{ fill: "color-mix(in srgb, var(--oth) 22%, var(--surface))" }} />
                  <line x1="0" y1="0" x2="0" y2="6" strokeWidth="2.4" style={{ stroke: "var(--oth)" }} />
                </pattern>
              </defs>

              <Axis
                scale={y}
                orientation="left"
                ticks={gridValues(yMax)}
                offset={0}
                gridExtent={plotW}
                format={axisLabel}
                zeroAt={0}
              />

              {shade?.span && (
                <g aria-hidden>
                  <rect
                    x={xSlot(shade.span[0])}
                    y={PLOT_TOP}
                    width={shadeW}
                    height={PLOT_H}
                    fill="var(--oth)"
                    fillOpacity={0.16}
                  />
                  {shadeLabelled && (
                    <>
                      <text x={xSlot(shade.span[0]) + shadeW / 2} y={150} textAnchor="middle" className="fill-ink-muted text-[10.5px]">
                        Title 42 expulsions
                      </text>
                      <text x={xSlot(shade.span[0]) + shadeW / 2} y={163} textAnchor="middle" className="fill-ink-muted text-[10.5px]">
                        counted by CBP, above
                      </text>
                    </>
                  )}
                </g>
              )}

              {years.map((yr, i) => {
                const key = `b${yr.fy}`;
                const active = open?.key === key || activeFy === yr.fy;
                const x = xSlot(i);
                const bx = x + (slotW - barW) / 2;
                const top = y(yr.value);
                const hatched = yr.fy < RETURNS_COUNTED_FROM;
                const prelim = yr.status === "preliminary";
                const showLabel = labelsBar(yr.fy, years.length);
                // Right-align a label that would run past the plot edge.
                const overflow = bx + barW / 2 + 30 > plotW;
                const labelX = overflow ? Math.min(bx + barW, plotW) : bx + barW / 2;
                const labelAnchor = overflow ? "end" : "middle";
                return (
                  <g
                    key={yr.fy}
                    data-ice-hit
                    tabIndex={0}
                    role="button"
                    aria-label={barAria(yr)}
                    aria-expanded={open?.key === key}
                    className="cursor-pointer outline-none"
                    onPointerEnter={(e) => e.pointerType === "mouse" && !open?.pinned && (openBar(yr.fy, false), tip.show(yr, e))}
                    onPointerMove={(e) => e.pointerType === "mouse" && tip.move(e)}
                                        onPointerLeave={(e) => e.pointerType === "mouse" && setOpen((o) => (o && !o.pinned ? null : o))}
                    onFocus={(e) => e.currentTarget.matches(":focus-visible") && openBar(yr.fy, true)}
                    onClick={() => {
                      toggle(key);
                      if (yr.era === "ice") onSelectFy?.(yr.fy); // the selected year drives ICE's country card, which has no INS-era years
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggle(key);
                        if (yr.era === "ice") onSelectFy?.(yr.fy); // the selected year drives ICE's country card, which has no INS-era years
                      }
                    }}
                  >
                    <rect x={x} y={PLOT_TOP} width={slotW} height={PLOT_H} rx={2} fill={active ? "var(--accent)" : "transparent"} fillOpacity={0.09} style={yr.fy === selectedFy ? { fill: "var(--surface-raised)", fillOpacity: 1, stroke: "var(--line-strong)" } : undefined} />
                    {yr.agency ? (
                      <>
                        <rect x={bx} y={y(yr.agency.ice)} width={barW} height={BASE - y(yr.agency.ice)} style={{ fill: "var(--agency-ice)", fillOpacity: prelim ? 0.55 : 1 }} />
                        <rect x={bx} y={top} width={barW} height={y(yr.agency.ice) - top} style={{ fill: "var(--agency-cbp)", fillOpacity: prelim ? 0.55 : 1 }} />
                      </>
                    ) : (
                      <rect
                        x={bx}
                        y={top}
                        width={barW}
                        height={BASE - top}
                        style={{
                          fill: hatched ? `url(#${idBase}-hatch)` : "var(--oth)",
                          fillOpacity: prelim ? 0.55 : 1,
                          stroke: hatched ? "var(--oth)" : "none",
                          strokeWidth: 1,
                        }}
                      />
                    )}
                    {prelim && (
                      <rect x={bx} y={top} width={barW} height={BASE - top} style={{ fill: "none", stroke: "var(--ink)", strokeWidth: 1.2, strokeDasharray: "4 3" }} />
                    )}
                    {showLabel && (
                      <>
                        <text x={labelX} y={top - 6} textAnchor={labelAnchor} className="fill-ink font-mono text-[10.5px] font-semibold">
                          {valueLabel(yr.value, slotW)}
                        </text>
                        {prelim && (
                          <text x={labelX} y={top - 18} textAnchor={labelAnchor} className="fill-ink-muted text-[10px]">
                            preliminary
                          </text>
                        )}
                      </>
                    )}
                  </g>
                );
              })}

              {detention.length > 0 && (
                <g aria-hidden pointerEvents="none">
                  {detention.slice(1).map((d, i) => {
                    const prev = detention[i];
                    return (
                      <line
                        key={d.fy}
                        x1={xSlot(prev.i0) + slotW / 2}
                        y1={y(prev.value)}
                        x2={xSlot(d.i0) + slotW / 2}
                        y2={y(d.value)}
                        style={{ stroke: "var(--ink)", strokeWidth: 2.2, strokeLinecap: "round", strokeDasharray: d.status === "preliminary" ? "4 4" : undefined }}
                      />
                    );
                  })}
                  {detention.map((d) => (
                    <circle
                      key={d.fy}
                      cx={xSlot(d.i0) + slotW / 2}
                      cy={y(d.value)}
                      r={slotW < 20 ? 2.4 : 3.4}
                      style={{ fill: d.status === "preliminary" ? "var(--surface)" : "var(--ink)", stroke: d.status === "preliminary" ? "var(--ink)" : "var(--surface)", strokeWidth: d.status === "preliminary" ? 2 : 1.2 }}
                    />
                  ))}
                  {slotW >= 24 &&
                    detention
                      .filter((d) => d.label)
                      .map((d) => (
                        <text
                          key={d.fy}
                          x={Math.min(xSlot(d.i0) + slotW / 2, plotW - 12)}
                          y={y(d.value) - 8}
                          textAnchor="middle"
                          className="fill-ink font-mono text-[10px] font-semibold"
                          style={{ paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: 3 }}
                        >
                          {valueLabel(d.value, slotW)}
                        </text>
                      ))}
                </g>
              )}

              {placements.map(({ marker, at }) => (
                <line
                  key={marker.n}
                  x1={at * slotW}
                  x2={at * slotW}
                  y1={28}
                  y2={BASE}
                  stroke="var(--ink-muted)"
                  strokeWidth={1}
                  strokeDasharray="2 3"
                  aria-hidden
                />
              ))}

              {pending && (
                <text
                  transform={`translate(${xSlot(years.length) + slotW / 2 + 4},${BASE - 10}) rotate(-90)`}
                  className="fill-ink-muted text-[10.5px]"
                >
                  {`FY${pendingFy} · not yet locked`}
                </text>
              )}

              {mode === "four" && (
                <text x={-8} y={BASE + 17} textAnchor="end" className="fill-ink-faint font-mono text-[10.5px]">
                  FY
                </text>
              )}
              {[...years.map((v) => v.fy), ...(pending ? [pendingFy] : [])].map((fy, i) => {
                const label = yearLabel(fy, mode);
                if (!label) return null;
                const bold = open?.key === `b${fy}` || fy === selectedFy || fy === activeFy;
                return (
                  <text
                    key={fy}
                    x={xSlot(i) + slotW / 2}
                    y={BASE + 17}
                    textAnchor="middle"
                    className={`font-mono text-[10.5px] ${bold ? "fill-ink font-bold" : "fill-ink-muted"}`}
                  >
                    {label}
                  </text>
                );
              })}

              {segs.map((s) => {
                const t = termById.get(s.termId)!;
                const w = (s.to - s.from) * slotW;
                const text = fitTermLabel(w, t.last, initialsOf(t.president));
                return (
                  <g key={`${s.termId}-${s.from}`} aria-hidden>
                    <rect x={xSlot(s.from) + 0.5} y={BAND_Y} width={Math.max(0, w - 1)} height={BAND_H} rx={2} style={{ fill: `color-mix(in oklab, ${partyVar(s.party)} 20%, var(--surface))` }} />
                    <rect x={xSlot(s.from) + 0.5} y={BAND_Y} width={Math.max(0, w - 1)} height={2.5} fill={partyVar(s.party)} />
                    {text && (
                      <text x={xSlot(s.from) + w / 2} y={BAND_Y + 16} textAnchor="middle" className="text-[11px]" style={{ fill: "var(--ink)" }}>
                        {text}
                      </text>
                    )}
                  </g>
                );
              })}

              <g aria-hidden>
                {insCount > 0 && (
                  <>
                    <rect x={0.5} y={STRIP_Y} width={insCount * slotW - 1} height={STRIP_H} fill="var(--oth)" fillOpacity={0.34} />
                    {insLabel && (
                      <text x={(insCount * slotW) / 2} y={STRIP_Y + 12.5} textAnchor="middle" className="fill-ink text-[10.5px]">
                        {insLabel}
                      </text>
                    )}
                  </>
                )}
                {returnsFrom > insCount && (
                  <>
                    <rect x={insCount * slotW + 0.5} y={STRIP_Y} width={(returnsFrom - insCount) * slotW - 1} height={STRIP_H} fill="var(--oth)" fillOpacity={0.2} />
                    {lead && (
                      <text x={(insCount * slotW + returnsFrom * slotW) / 2} y={STRIP_Y + 12.5} textAnchor="middle" className="fill-ink text-[10.5px]">
                        {lead}
                      </text>
                    )}
                  </>
                )}
                {!hatchedFull && (
                  <>
                    <rect
                      x={returnsFrom * slotW + 0.5}
                      y={STRIP_Y}
                      width={(slots - returnsFrom) * slotW - 1}
                      height={STRIP_H}
                      fill="var(--oth)"
                      fillOpacity={0.1}
                    />
                    {rest && (
                      <text x={returnsFrom * slotW + ((slots - returnsFrom) * slotW) / 2} y={STRIP_Y + 12.5} textAnchor="middle" className="fill-ink text-[10.5px]">
                        {rest}
                      </text>
                    )}
                  </>
                )}
              </g>
            </>
          )}
        </ChartFrame>
      </div>

      {placements.map(({ marker, at }) => (
        <button
          key={marker.n}
          type="button"
          data-ice-hit
          aria-label={`Note ${marker.n}: ${marker.title}`}
          aria-expanded={open?.key === `m${marker.n}`}
          onPointerEnter={(e) => e.pointerType === "mouse" && !open?.pinned && openMarker(marker.n, false)}
          onPointerLeave={(e) => e.pointerType === "mouse" && setOpen((o) => (o && !o.pinned ? null : o))}
          onFocus={(e) => e.currentTarget.matches(":focus-visible") && openMarker(marker.n, true)}
          onClick={() => toggle(`m${marker.n}`)}
          className="absolute flex h-[22px] w-[22px] -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-0 bg-ink p-0 font-mono text-[11px] font-semibold text-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          style={{ left: left + at * slotW, top: MARKER_Y }}
        >
          {marker.n}
        </button>
      ))}
      {card}
      <Tooltip state={open && !open.pinned && open.key.startsWith("b") ? tip.state : null}>{(yr) => <YearTip year={yr} terms={termById} />}</Tooltip>
    </div>
  );
}

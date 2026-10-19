"use client";

import { scaleLinear } from "d3-scale";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Axis } from "@/components/charts/Axis";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { yGutter } from "@/lib/chart-bars";
import { slotLayout, termSegments, yearLabel, yearLabelMode } from "@/lib/immigration-chart";
import { axisText, gridTicks, groupLabel, groupRules, niceMax, rulePlacements } from "@/lib/refugee-chart";
import type { GeoGroup, RefugeeMarker, RefugeeTerm, RefugeeYear } from "@/lib/refugee-types";
import { TermBandSvg } from "@/components/charts/TermBandSvg";
import { useFyTermSelect } from "./TermWindowContext";
import { useElementWidth } from "@/lib/use-element-width";
import { Tooltip, useTooltip } from "../charts/Tooltip";
import { RuleCard, YearCard, YearTip } from "./RefugeeCards";
import { CEILING_TINT, GEO_STACK, REGION_COLOR, n } from "./refugee-style";

const FALLBACK_W = 1084;
const PLOT_TOP = 34;
const BAND_GAP = 30;
const BAND_H = 22;
const PILL_Y = 16;

type Open = { key: string; pinned: boolean } | null;

/**
 * Refugees admitted by fiscal year, one bar per year split by the region they came from, with the ceiling in force at the end of
 * the year behind each bar (a pale bar topped by a black cap). Numbered pills mark the executive orders and proclamations that
 * changed who could be admitted; a card per bar and per pill; the term band under the axis. Same slots, gutter and card
 * behaviour as the ICE removals chart above it, so the two line up. `only` shows a single region from zero on its own scale and
 * hides the ceiling, which is a total. The newest year, when preliminary, is hatched.
 */
export function RefugeeChart({
  years,
  terms,
  markers,
  only,
  selectedFy,
  onSelectFy,
}: {
  years: readonly RefugeeYear[];
  terms: readonly RefugeeTerm[];
  markers: readonly RefugeeMarker[];
  only: GeoGroup | null;
  selectedFy: number;
  onSelectFy: (fy: number) => void;
}) {
  const [ref, measured] = useElementWidth<HTMLDivElement>();
  const W = measured || FALLBACK_W;
  const compact = W < 520;
  const plotH = compact ? 210 : 250;
  const BASE = PLOT_TOP + plotH;
  const BAND_Y = BASE + BAND_GAP;
  const SVG_H = BAND_Y + BAND_H + 4;
  const right = 8;
  const idBase = useId().replace(/:/g, "");

  const valueOf = (y: RefugeeYear) => (only ? y.regions[only] : y.admissions);
  const topOf = (y: RefugeeYear) => (only ? y.regions[only] : Math.max(y.ceiling ?? 0, y.admissions));
  const yMax = niceMax(Math.max(1, ...years.map(topOf)), 1.14);
  const ticks = gridTicks(yMax);
  const left = yGutter(ticks.map(axisText));
  const plotW = W - left - right;
  const slots = years.length;
  const { slotW, barW } = slotLayout(plotW, slots);
  const y = scaleLinear().domain([0, yMax]).range([BASE, PLOT_TOP]);
  const xSlot = (i: number) => i * slotW;
  const mode = yearLabelMode(slotW);
  const firstFy = years[0].fy;
  const lastFy = years[years.length - 1].fy;
  const termById = new Map(terms.map((t) => [t.termId, t]));

  const [open, setOpen] = useState<Open>(null);
  const tip = useTooltip<RefugeeYear>();
  const wrap = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(null), []);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest("[data-rf-hit]")) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const placements = rulePlacements(markers, firstFy, lastFy);
  const groups = groupRules(placements, slotW);

  // Peak and low among finished years, labelled once each (rule 12: a time-series chart marks its peak and low).
  const finals = years.filter((v) => !v.preliminary);
  const peak = finals.length ? finals.reduce((a, b) => (valueOf(b) > valueOf(a) ? b : a)) : null;
  const low = finals.length ? finals.reduce((a, b) => (valueOf(b) < valueOf(a) ? b : a)) : null;
  const spots: { x: number; anchor: "start" | "middle" | "end"; y: number; text: string }[] = [];
  const boxes: { x0: number; x1: number; y: number }[] = [];
  for (const yr of peak && low ? (peak === low ? [peak] : [peak, low]) : []) {
    const text = `FY${yr.fy}: ${n(valueOf(yr))}`;
    const tw = text.length * 6.2;
    const i = years.indexOf(yr);
    const cx = xSlot(i) + slotW / 2;
    const bx = cx - barW / 2;
    for (const c of [
      { anchor: "middle" as const, ax: cx, x0: cx - tw / 2 },
      { anchor: "end" as const, ax: bx + barW, x0: bx + barW - tw },
      { anchor: "start" as const, ax: bx, x0: bx },
    ]) {
      if (c.x0 < 0 || c.x0 + tw > plotW) continue;
      const tallest = Math.max(...years.map((v, j) => (xSlot(j) + slotW > c.x0 && xSlot(j) < c.x0 + tw ? topOf(v) : 0)));
      const ly = y(tallest) - 6;
      if (boxes.some((b) => c.x0 < b.x1 + 4 && c.x0 + tw + 4 > b.x0 && Math.abs(ly - b.y) < 12)) continue;
      boxes.push({ x0: c.x0, x1: c.x0 + tw, y: ly });
      spots.push({ x: c.ax, anchor: c.anchor, y: ly, text });
      break;
    }
  }

  const openBar = (fy: number, pinned: boolean) => setOpen({ key: `b${fy}`, pinned });
  const openRule = (i: number, pinned: boolean) => setOpen({ key: `r${i}`, pinned });
  const toggle = (key: string) => setOpen((o) => (o && o.key === key && o.pinned ? null : { key, pinned: true }));
  const cardLeft = (cx: number, w: number) => Math.max(0, Math.min(W - w, cx - w / 2));
  const barCardW = compact ? 240 : 280;
  const ruleCardW = compact ? 260 : 340;

  let card: ReactNode = null;
  if (open?.key.startsWith("b")) {
    const yr = years.find((v) => `b${v.fy}` === open.key);
    if (yr && open.pinned) card = <YearCard year={yr} terms={termById} width={barCardW} left={cardLeft(left + xSlot(years.indexOf(yr)) + slotW / 2, barCardW)} interactive />;
  } else if (open?.key.startsWith("r")) {
    const g = groups[Number(open.key.slice(1))];
    if (g) card = <RuleCard rules={g.markers} width={ruleCardW} left={cardLeft(left + g.at * slotW, ruleCardW)} interactive={open.pinned} />;
  }

  const termSelect = useFyTermSelect((i) => years[Math.min(i, years.length - 1)].fy);
  const segs = termSegments(years, false);
  const aria = (yr: RefugeeYear) =>
    `FY${yr.fy}: ${n(yr.admissions)} refugees admitted${yr.ceiling !== null ? ` against a ceiling of ${n(yr.ceiling)}` : ""}${yr.preliminary ? ", preliminary" : ""}`;

  return (
    <div
      ref={wrap}
      className="relative"
      onBlur={(e) => {
        const next = e.relatedTarget;
        if (next instanceof Node && !wrap.current?.contains(next)) close();
      }}
    >
      <div ref={ref} className="-mx-3 sm:mx-0">
        <ChartFrame
          width={W}
          height={SVG_H}
          margin={{ top: 0, right, bottom: 0, left }}
          ariaLabel={`Bar chart of refugees admitted by fiscal year, FY${firstFy} to FY${lastFy}, split by region, with the ceiling in force each year. The table view lists the same figures.`}
          className="block h-auto w-full max-w-full"
          svgProps={{ role: "group" }}
        >
          {() => (
            <>
              <defs>
                <pattern id={`${idBase}-hatch`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <line x1="0" y1="0" x2="0" y2="6" strokeWidth="2.6" style={{ stroke: "var(--surface)" }} />
                </pattern>
              </defs>

              <Axis scale={y} orientation="left" ticks={ticks} offset={0} gridExtent={plotW} format={axisText} zeroAt={0} />

              {years.map((yr, i) => {
                const key = `b${yr.fy}`;
                const active = open?.key === key;
                const x = xSlot(i);
                const bx = x + (slotW - barW) / 2;
                const stack = only ? [only] : GEO_STACK;
                let acc = 0;
                const total = valueOf(yr);
                return (
                  <g
                    key={yr.fy}
                    data-rf-hit
                    tabIndex={0}
                    role="button"
                    aria-label={aria(yr)}
                    aria-expanded={active}
                    className="cursor-pointer outline-none"
                    onPointerEnter={(e) => e.pointerType === "mouse" && !open?.pinned && (openBar(yr.fy, false), tip.show(yr, e))}
                    onPointerMove={(e) => e.pointerType === "mouse" && tip.move(e)}
                                        onPointerLeave={(e) => e.pointerType === "mouse" && setOpen((o) => (o && !o.pinned ? null : o))}
                    onFocus={(e) => e.currentTarget.matches(":focus-visible") && openBar(yr.fy, true)}
                    onClick={() => {
                      toggle(key);
                      onSelectFy(yr.fy);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggle(key);
                        onSelectFy(yr.fy);
                      }
                    }}
                  >
                    <rect
                      x={x}
                      y={PLOT_TOP}
                      width={slotW}
                      height={plotH}
                      rx={2}
                      fill={active ? "var(--accent)" : "transparent"}
                      fillOpacity={0.09}
                      style={yr.fy === selectedFy ? { fill: "var(--surface-raised)", fillOpacity: 1, stroke: "var(--line-strong)" } : undefined}
                    />
                    {!only && yr.ceiling !== null && <rect x={bx} y={y(yr.ceiling)} width={barW} height={BASE - y(yr.ceiling)} style={{ fill: CEILING_TINT }} />}
                    {stack.map((g) => {
                      const v = yr.regions[g];
                      if (v <= 0) return null;
                      const top = y(acc + v);
                      const h = y(acc) - top;
                      acc += v;
                      return <rect key={g} x={bx} y={top} width={barW} height={Math.max(0, h)} style={{ fill: REGION_COLOR[g] }} />;
                    })}
                    {!only && yr.privateSector > 0 && (() => {
                      const top = y(acc + yr.privateSector);
                      const h = y(acc) - top;
                      acc += yr.privateSector;
                      return <rect x={bx} y={top} width={barW} height={Math.max(0, h)} style={{ fill: "var(--ink-faint)", opacity: 0.55 }} />;
                    })()}
                    {yr.preliminary && total > 0 && <rect x={bx} y={y(total)} width={barW} height={BASE - y(total)} fill={`url(#${idBase}-hatch)`} />}
                    {!only && yr.ceiling !== null && <line x1={bx - 1} x2={bx + barW + 1} y1={y(yr.ceiling)} y2={y(yr.ceiling)} style={{ stroke: "var(--ink)", strokeWidth: 2.2 }} />}
                  </g>
                );
              })}

              {placements.map(({ marker, at }) => (
                <line key={marker.n} x1={at * slotW} x2={at * slotW} y1={28} y2={BASE} stroke="var(--ink-muted)" strokeWidth={1} strokeDasharray="2 3" opacity={0.6} aria-hidden pointerEvents="none" />
              ))}

              {spots.map((s) => (
                <text
                  key={s.text}
                  x={s.x}
                  y={s.y}
                  textAnchor={s.anchor}
                  className="fill-ink font-mono text-[10px] font-semibold"
                  style={{ paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: 3 }}
                  pointerEvents="none"
                >
                  {s.text}
                </text>
              ))}

              {mode === "four" && (
                <text x={-8} y={BASE + 17} textAnchor="end" className="fill-ink-faint font-mono text-[10.5px]">
                  FY
                </text>
              )}
              {years.map((v, i) => {
                const label = yearLabel(v.fy, mode);
                if (!label) return null;
                const bold = open?.key === `b${v.fy}` || v.fy === selectedFy;
                return (
                  <text key={v.fy} x={xSlot(i) + slotW / 2} y={BASE + 17} textAnchor="middle" className={`font-mono text-[10.5px] ${bold ? "fill-ink font-bold" : "fill-ink-muted"}`}>
                    {label}
                  </text>
                );
              })}

              <TermBandSvg
                segments={segs.map((s) => ({ id: s.termId, last: termById.get(s.termId)!.last, president: termById.get(s.termId)!.president, party: s.party, s: s.from, e: s.to - 1 }))}
                x0={0}
                step={slotW}
                y={BAND_Y}
                select={termSelect}
              />
            </>
          )}
        </ChartFrame>
      </div>

      {groups.map((g, i) => {
        const label = groupLabel(g);
        return (
          <button
            key={label}
            type="button"
            data-rf-hit
            aria-label={`Rule${g.markers.length > 1 ? "s" : ""} ${label}: ${g.markers.map((m) => m.title).join("; ")}`}
            aria-expanded={open?.key === `r${i}`}
            onPointerEnter={(e) => e.pointerType === "mouse" && !open?.pinned && openRule(i, false)}
            onPointerLeave={(e) => e.pointerType === "mouse" && setOpen((o) => (o && !o.pinned ? null : o))}
            onFocus={(e) => e.currentTarget.matches(":focus-visible") && openRule(i, true)}
            onClick={() => toggle(`r${i}`)}
            className="absolute flex h-[22px] min-w-[22px] -translate-x-1/2 whitespace-nowrap -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-0 bg-ink px-1.5 font-mono text-[11px] font-semibold text-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            style={{ left: Math.min(left + g.at * slotW, W - right - 18), top: PILL_Y }}
          >
            {label}
          </button>
        );
      })}
      {card}
      <Tooltip state={open && !open.pinned && open.key.startsWith("b") ? tip.state : null}>{(yr) => <YearTip year={yr} terms={termById} />}</Tooltip>
    </div>
  );
}

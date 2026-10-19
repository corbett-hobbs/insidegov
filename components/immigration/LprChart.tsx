"use client";

import { scaleLinear } from "d3-scale";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Axis } from "@/components/charts/Axis";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { yGutter } from "@/lib/chart-bars";
import { slotLayout, termSegments, yearLabel, yearLabelMode } from "@/lib/immigration-chart";
import { LPR_GROUPS, LPR_REGION_STACK, axisText, compactCount, gridTicks, groupValues, niceMax, type LprGroupKey, type LprMarker, type LprMetric } from "@/lib/lpr-chart";
import type { LprRegionKey, LprTerm, LprYear } from "@/lib/lpr-types";
import { TermBandSvg } from "@/components/charts/TermBandSvg";
import { useFyTermSelect } from "./TermWindowContext";
import { useElementWidth } from "@/lib/use-element-width";
import { Tooltip, useTooltip } from "../charts/Tooltip";
import { LprMarkerCard, LprYearCard, LprYearTip } from "./LprCards";
import { GROUP_COLOR, REGION_COLOR } from "./lpr-style";
import { n } from "./refugee-style";

const FALLBACK_W = 1084;
const PLOT_TOP = 34;
const BAND_GAP = 30;
const BAND_H = 22;
const PILL_Y = 16;

type Open = { key: string; pinned: boolean } | null;

/**
 * Green cards (or, on the toggle, naturalizations) by fiscal year: one bar per year, green cards stacked by class group, the term
 * band under the axis, numbered notes on the axis, and a card per bar and per note. Same slots, gutter and card behaviour as the
 * refugee and ICE charts, so the three line up. `only` draws a single class group from zero on its own scale. Years before FY1999
 * have totals only (one grey bar); the newest year, when preliminary, is hatched. Years with no value are empty slots, never zeros.
 */
export function LprChart({
  years,
  terms,
  markers,
  metric,
  only,
  onlyRegion,
  regions,
  selectedFy,
  onSelectFy,
}: {
  years: readonly LprYear[];
  terms: readonly LprTerm[];
  markers: readonly LprMarker[];
  metric: LprMetric;
  only: LprGroupKey | null;
  /** Naturalizations: draw one continent from zero. */
  onlyRegion: LprRegionKey | null;
  /** Naturalizations by continent, per fiscal year (a missing year draws as one neutral bar). */
  regions: ReadonlyMap<number, Partial<Record<LprRegionKey, number>>>;
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
  const nat = metric === "naturalizations";

  const groupsOf = (y: LprYear) => groupValues(y);
  const valueOf = (y: LprYear): number | null => (nat ? (onlyRegion ? (regions.get(y.fy)?.[onlyRegion] ?? 0) : y.naturalizations) : only ? (groupsOf(y)?.[only] ?? null) : y.lpr);
  const yMax = niceMax(Math.max(1, ...years.map((y) => valueOf(y) ?? 0)), 1.14);
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
  const tip = useTooltip<LprYear>();
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(null);
    const onDown = (e: PointerEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest("[data-lpr-hit]")) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Peak and low among finished years, labelled once each (rule 12).
  const finals = years.filter((v) => !v.preliminary && valueOf(v) !== null);
  const peak = finals.length ? finals.reduce((a, b) => (valueOf(b)! > valueOf(a)! ? b : a)) : null;
  const low = finals.length ? finals.reduce((a, b) => (valueOf(b)! < valueOf(a)! ? b : a)) : null;
  const spots: { x: number; anchor: "start" | "middle" | "end"; y: number; text: string }[] = [];
  const boxes: { x0: number; x1: number; y: number }[] = [];
  for (const yr of peak && low ? (peak === low ? [peak] : [peak, low]) : []) {
    const text = `FY${yr.fy}: ${compactCount(valueOf(yr)!)}`;
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
      const tallest = Math.max(...years.map((v, j) => (xSlot(j) + slotW > c.x0 && xSlot(j) < c.x0 + tw ? (valueOf(v) ?? 0) : 0)));
      const ly = y(tallest) - 6;
      if (boxes.some((b) => c.x0 < b.x1 + 4 && c.x0 + tw + 4 > b.x0 && Math.abs(ly - b.y) < 12)) continue;
      boxes.push({ x0: c.x0, x1: c.x0 + tw, y: ly });
      spots.push({ x: c.ax, anchor: c.anchor, y: ly, text });
      break;
    }
  }

  const openBar = (fy: number, pinned: boolean) => setOpen({ key: `b${fy}`, pinned });
  const openNote = (i: number, pinned: boolean) => setOpen({ key: `r${i}`, pinned });
  const toggle = (key: string) => setOpen((o) => (o && o.key === key && o.pinned ? null : { key, pinned: true }));
  const cardLeft = (cx: number, w: number) => Math.max(0, Math.min(W - w, cx - w / 2));
  const barCardW = compact ? 250 : 300;
  const noteCardW = compact ? 260 : 340;
  const markerX = (m: LprMarker) => (m.at - firstFy + 0.5) * slotW;

  let card: ReactNode = null;
  if (open?.key.startsWith("b")) {
    const yr = years.find((v) => `b${v.fy}` === open.key);
    if (yr && open.pinned) card = <LprYearCard year={yr} terms={termById} metric={metric} regions={regions.get(yr.fy) ?? null} width={barCardW} left={cardLeft(left + xSlot(years.indexOf(yr)) + slotW / 2, barCardW)} interactive />;
  } else if (open?.key.startsWith("r")) {
    const m = markers[Number(open.key.slice(1))];
    if (m) card = <LprMarkerCard marker={m} width={noteCardW} left={cardLeft(left + markerX(m), noteCardW)} />;
  }

  const termSelect = useFyTermSelect((i) => years[Math.min(i, years.length - 1)].fy);
  const segs = termSegments(years, false);
  const aria = (yr: LprYear) => {
    const v = valueOf(yr);
    return v === null ? `FY${yr.fy}: no figure` : `FY${yr.fy}: ${n(v)} ${nat ? "people naturalized" : "new permanent residents"}${yr.preliminary ? ", preliminary" : ""}`;
  };

  return (
    <div
      ref={wrap}
      className="relative"
      onBlur={(e) => {
        const next = e.relatedTarget;
        if (next instanceof Node && !wrap.current?.contains(next)) setOpen(null);
      }}
    >
      <div ref={ref} className="-mx-3 sm:mx-0">
        <ChartFrame
          width={W}
          height={SVG_H}
          margin={{ top: 0, right, bottom: 0, left }}
          ariaLabel={`Bar chart of ${nat ? "naturalizations" : "green cards"} by fiscal year, FY${firstFy} to FY${lastFy}${nat ? ", split by region of birth" : only ? "" : ", split by class of admission"}. The table view lists the same figures.`}
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
                const total = valueOf(yr);
                const g = groupsOf(yr);
                const rg = regions.get(yr.fy) ?? null;
                let acc = 0;
                return (
                  <g
                    key={yr.fy}
                    data-lpr-hit
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
                    {total !== null && nat && !rg && <rect x={bx} y={y(total)} width={barW} height={BASE - y(total)} style={{ fill: "var(--ink-faint)", opacity: 0.55 }} />}
                    {nat &&
                      rg &&
                      LPR_REGION_STACK.map((r) => {
                        if (onlyRegion && onlyRegion !== r.key) return null;
                        const v = rg[r.key] ?? 0;
                        if (v <= 0) return null;
                        const top = y(acc + v);
                        const h = y(acc) - top;
                        acc += v;
                        return <rect key={r.key} x={bx} y={top} width={barW} height={Math.max(0, h)} style={{ fill: REGION_COLOR[r.key] }} />;
                      })}
                    {total !== null && !nat && !g && <rect x={bx} y={y(total)} width={barW} height={BASE - y(total)} style={{ fill: "var(--ink-faint)", opacity: 0.55 }} />}
                    {!nat &&
                      g &&
                      LPR_GROUPS.map((gr) => {
                        if (only && only !== gr.key) return null;
                        const v = g[gr.key];
                        if (v <= 0) return null;
                        const top = y(acc + v);
                        const h = y(acc) - top;
                        acc += v;
                        return <rect key={gr.key} x={bx} y={top} width={barW} height={Math.max(0, h)} style={{ fill: GROUP_COLOR[gr.key] }} />;
                      })}
                    {yr.preliminary && total !== null && total > 0 && <rect x={bx} y={y(total)} width={barW} height={BASE - y(total)} fill={`url(#${idBase}-hatch)`} />}
                  </g>
                );
              })}

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

      {markers.map((m, i) => (
        <button
          key={m.n}
          type="button"
          data-lpr-hit
          aria-label={`Note ${m.n}: ${m.title}`}
          aria-expanded={open?.key === `r${i}`}
          onPointerEnter={(e) => e.pointerType === "mouse" && !open?.pinned && openNote(i, false)}
          onPointerLeave={(e) => e.pointerType === "mouse" && setOpen((o) => (o && !o.pinned ? null : o))}
          onFocus={(e) => e.currentTarget.matches(":focus-visible") && openNote(i, true)}
          onClick={() => toggle(`r${i}`)}
          className="absolute flex h-[22px] min-w-[22px] -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center whitespace-nowrap rounded-full border-0 bg-ink px-1.5 font-mono text-[11px] font-semibold text-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          style={{ left: Math.min(left + markerX(m), W - right - 18), top: PILL_Y }}
        >
          {m.n}
        </button>
      ))}
      {card}
      <Tooltip state={open && !open.pinned && open.key.startsWith("b") ? tip.state : null}>{(yr) => <LprYearTip year={yr} terms={termById} metric={metric} regions={regions.get(yr.fy) ?? null} />}</Tooltip>
    </div>
  );
}

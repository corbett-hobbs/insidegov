"use client";

import { scaleLinear } from "d3-scale";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Axis } from "@/components/charts/Axis";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { Y_GUTTER } from "@/lib/chart-bars";
import { ENCOUNTER_SERIES, USBP_ONLY_COLOR, barValue, markerGroups, segments, type EncounterSeriesKey } from "@/lib/encounters-chart";
import type { EncounterScopeKey, EncountersMarker, EncountersNoteText, EncountersTerm, EncountersYear } from "@/lib/encounters-types";
import { slotLayout, termSegments, yearLabel, yearLabelMode } from "@/lib/immigration-chart";
import { axisText, compactCount, gridTicks, niceMax } from "@/lib/lpr-chart";
import { TermBandSvg } from "@/components/charts/TermBandSvg";
import { useFyTermSelect } from "./TermWindowContext";
import { useElementWidth } from "@/lib/use-element-width";
import { Tooltip, useTooltip } from "../charts/Tooltip";
import { EncountersMarkerCard, EncountersYearCard, EncountersYearTip } from "./EncountersCards";

const FALLBACK_W = 1084;
// Same top, gutter, right margin, plot height and band as RemovalsChart, so a fiscal year sits directly above itself.
const PLOT_TOP = 34;
const PLOT_H = 250;
const BASE = PLOT_TOP + PLOT_H;
const BAND_Y = BASE + 30;
const SVG_H = BASE + 60 + 18 + 4;
const MARKER_Y = 16;
const PILL_GAP = 24;

type Open = { key: string; pinned: boolean } | null;
const n = (v: number) => v.toLocaleString("en-US");
const colorOf = (k: EncounterSeriesKey | "usbp_only") => (k === "usbp_only" ? USBP_ONLY_COLOR : ENCOUNTER_SERIES.find((s) => s.key === k)!.color);

/**
 * CBP border encounters by fiscal year: one bar per year stacked Border Patrol / ports of entry / Title 42, with the years that
 * have Border Patrol figures only drawn as one neutral bar. Geometry matches `RemovalsChart` (slots, gutter, plot height, term
 * band), so the two cards line up when they show the same years. The y-axis is sized from the bars shown and re-fits when a
 * series is isolated. Hovering or tapping a year reports it through `onActiveFy`; the year the other card reports (`activeFy`)
 * is lit here too. CBP only: the one ICE figure, in the tooltip, is a separate labelled line.
 */
export function EncountersChart({
  years,
  terms,
  markers,
  notes,
  scope,
  only,
  removals,
  activeFy,
  onActiveFy,
}: {
  years: readonly EncountersYear[];
  terms: readonly EncountersTerm[];
  markers: readonly EncountersMarker[];
  notes: readonly EncountersNoteText[];
  scope: EncounterScopeKey;
  only: EncounterSeriesKey | null;
  /** ICE removals by fiscal year, for the tooltip's separate line. */
  removals: ReadonlyMap<number, number>;
  activeFy: number | null;
  onActiveFy: (fy: number | null) => void;
}) {
  const [ref, measured] = useElementWidth<HTMLDivElement>();
  const W = measured || FALLBACK_W;
  const compact = W < 520;
  const right = 8;
  const idBase = useId().replace(/:/g, "");

  const valueOf = (y: EncountersYear) => barValue(y, scope, only);
  const yMax = niceMax(Math.max(1, ...years.map((y) => valueOf(y) ?? 0)), 1.14);
  const ticks = gridTicks(yMax);
  const left = Y_GUTTER;
  const plotW = W - left - right;
  const slots = years.length;
  const { slotW, barW } = slotLayout(plotW, slots);
  const y = scaleLinear().domain([0, yMax]).range([BASE, PLOT_TOP]);
  const xSlot = (i: number) => i * slotW;
  const mode = yearLabelMode(slotW);
  const firstFy = years[0].fy;
  const lastFy = years[years.length - 1].fy;
  const termById = new Map(terms.map((t) => [t.termId, t]));
  const noteById = new Map(notes.map((x) => [x.id, x]));
  const groups = markerGroups(markers, firstFy, slots, slotW, PILL_GAP);

  const [open, setOpen] = useState<Open>(null);
  const tip = useTooltip<EncountersYear>();
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(null);
    const onDown = (e: PointerEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest("[data-enc-hit]")) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Tell the page which year this card is on (hover or an open card), so the removals card lights the same year.
  const openFy = open?.key.startsWith("b") ? Number(open.key.slice(1)) : null;
  useEffect(() => {
    onActiveFy(openFy);
  }, [openFy, onActiveFy]);
  useEffect(() => () => onActiveFy(null), [onActiveFy]);

  // Peak and low among finished years, labelled once each (rule 12). A preliminary year is neither.
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
  const openGroup = (i: number, pinned: boolean) => setOpen({ key: `g${i}`, pinned });
  const toggle = (key: string) => setOpen((o) => (o && o.key === key && o.pinned ? null : { key, pinned: true }));
  const cardLeft = (cx: number, w: number) => Math.max(0, Math.min(W - w, cx - w / 2));
  const barCardW = compact ? 250 : 300;
  const noteCardW = compact ? 260 : 340;

  let card: ReactNode = null;
  if (open?.key.startsWith("b")) {
    const yr = years.find((v) => `b${v.fy}` === open.key);
    if (yr && open.pinned) {
      card = <EncountersYearCard year={yr} scope={scope} terms={termById} notes={noteById} removals={removals.get(yr.fy)} width={barCardW} left={cardLeft(left + xSlot(years.indexOf(yr)) + slotW / 2, barCardW)} />;
    }
  } else if (open?.key.startsWith("g")) {
    const g = groups[Number(open.key.slice(1))];
    if (g) card = <EncountersMarkerCard markers={g.markers} width={noteCardW} left={cardLeft(left + g.at * slotW, noteCardW)} />;
  }

  const termSelect = useFyTermSelect((i) => years[Math.min(i, years.length - 1)].fy);
  const segs = termSegments(years, false);
  const aria = (yr: EncountersYear) => {
    const v = valueOf(yr);
    const what = only ? ENCOUNTER_SERIES.find((s) => s.key === only)!.short : "encounters";
    return v === null ? `FY${yr.fy}: ${what} not published` : `FY${yr.fy}: ${n(v)} ${what}${yr.preliminary ? `, preliminary, ${yr.months} months` : ""}${yr.detail === "usbp_only" && !only ? ", Border Patrol only, no port-of-entry figures" : ""}`;
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
          ariaLabel={`Bar chart of CBP border encounters by fiscal year, FY${firstFy} to FY${lastFy}${only ? `, ${ENCOUNTER_SERIES.find((s) => s.key === only)!.short} only` : ", split into Border Patrol apprehensions, port-of-entry inadmissibles and Title 42 expulsions"}. The table view lists the same figures.`}
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
                const active = open?.key === key || activeFy === yr.fy;
                const x = xSlot(i);
                const bx = x + (slotW - barW) / 2;
                const total = valueOf(yr);
                const segs2 = segments(yr, scope, only);
                return (
                  <g
                    key={yr.fy}
                    data-enc-hit
                    tabIndex={0}
                    role="button"
                    aria-label={aria(yr)}
                    aria-expanded={open?.key === key}
                    className="cursor-pointer outline-none"
                    onPointerEnter={(e) => e.pointerType === "mouse" && !open?.pinned && (openBar(yr.fy, false), tip.show(yr, e))}
                    onPointerMove={(e) => e.pointerType === "mouse" && tip.move(e)}
                    onPointerLeave={(e) => e.pointerType === "mouse" && setOpen((o) => (o && !o.pinned ? null : o))}
                    onFocus={(e) => e.currentTarget.matches(":focus-visible") && openBar(yr.fy, true)}
                    onClick={() => toggle(key)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggle(key);
                      }
                    }}
                  >
                    <rect x={x} y={PLOT_TOP} width={slotW} height={PLOT_H} rx={2} fill={active ? "var(--accent)" : "transparent"} fillOpacity={0.09} />
                    {segs2.map((s) => {
                      const top = y(s.from + s.value);
                      return <rect key={s.key} x={bx} y={top} width={barW} height={Math.max(0, y(s.from) - top)} style={{ fill: colorOf(s.key) }} />;
                    })}
                    {yr.preliminary && total !== null && total > 0 && <rect x={bx} y={y(total)} width={barW} height={BASE - y(total)} fill={`url(#${idBase}-hatch)`} />}
                    {yr.preliminary && total !== null && slotW >= 22 && (
                      <text x={Math.min(bx + barW / 2, plotW - 14)} y={y(total) - 5} textAnchor="middle" className="fill-ink-muted font-mono text-[9.5px]" pointerEvents="none">
                        {`${yr.months} mo.`}
                      </text>
                    )}
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

              {groups.map((g, i) => (
                <line key={g.label} x1={g.at * slotW} x2={g.at * slotW} y1={28} y2={BASE} stroke="var(--ink-muted)" strokeWidth={1} strokeDasharray="2 3" aria-hidden data-g={i} />
              ))}

              {mode === "four" && (
                <text x={-8} y={BASE + 17} textAnchor="end" className="fill-ink-faint font-mono text-[10.5px]">
                  FY
                </text>
              )}
              {years.map((v, i) => {
                const label = yearLabel(v.fy, mode);
                if (!label) return null;
                const bold = open?.key === `b${v.fy}` || activeFy === v.fy;
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

      {groups.map((g, i) => (
        <button
          key={g.label}
          type="button"
          data-enc-hit
          aria-label={g.markers.length === 1 ? `Note ${g.markers[0].n}: ${g.markers[0].title}` : `Notes ${g.label}: ${g.markers.map((m) => m.title).join("; ")}`}
          aria-expanded={open?.key === `g${i}`}
          onPointerEnter={(e) => e.pointerType === "mouse" && !open?.pinned && openGroup(i, false)}
          onPointerLeave={(e) => e.pointerType === "mouse" && setOpen((o) => (o && !o.pinned ? null : o))}
          onFocus={(e) => e.currentTarget.matches(":focus-visible") && openGroup(i, true)}
          onClick={() => toggle(`g${i}`)}
          className="absolute flex h-[22px] min-w-[22px] -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center whitespace-nowrap rounded-full border-0 bg-ink px-1.5 font-mono text-[11px] font-semibold text-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          style={{ left: Math.min(left + g.at * slotW, W - right - 18), top: MARKER_Y }}
        >
          {g.label}
        </button>
      ))}
      {card}
      <Tooltip state={open && !open.pinned && open.key.startsWith("b") ? tip.state : null}>{(yr) => <EncountersYearTip year={yr} scope={scope} only={only} terms={termById} removals={removals.get(yr.fy)} />}</Tooltip>
    </div>
  );
}

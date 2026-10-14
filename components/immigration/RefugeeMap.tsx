"use client";

import { useMemo, useRef, type PointerEvent } from "react";
import { MapCallouts } from "@/components/charts/MapCallouts";
import { Tooltip, useTooltip } from "@/components/charts/Tooltip";
import { useZoomPan } from "@/components/charts/use-zoom-pan";
import { ZoomControls } from "@/components/charts/ZoomControls";
import { GEO_NAME, GEO_STACK, type GeoGroup } from "@/lib/refugee-types";
import type { MapFeature } from "./RemovalsMap";
import { LAND, REGION_COLOR, n } from "./refugee-style";
import { LEGEND_ROW } from "@/components/charts/legend";

export interface RefugeeMapRow {
  key: string;
  name: string;
  value: number;
  /** Region of the country; only the refugee Regions view reads it. */
  group?: GeoGroup;
}

export type MapMode = "countries" | "regions";

const mix = (pct: number) => `color-mix(in oklab, var(--accent) ${pct}%, var(--surface))`;
/** Fixed absolute bins so the years compare while the year menu moves. */
const THRESHOLDS = [100, 1_000, 5_000, 10_000];
export const BIN_LABELS = ["1–99", "100–999", "1,000–4,999", "5,000–9,999", "10,000+"];
const BIN_MIX = [22, 38, 56, 76, 100];
export interface MapBins {
  /** Upper bounds of every bin but the last, ascending. */
  thresholds: readonly number[];
  labels: readonly string[];
  mix: readonly number[];
}
const REFUGEE_BINS: MapBins = { thresholds: THRESHOLDS, labels: BIN_LABELS, mix: BIN_MIX };
/** Wording that changes with the measure drawn (the green-card map reuses this component). */
export interface MapWords {
  /** Tooltip value prefix, "Admitted". */
  value: string;
  /** Tooltip text for a country with no count. */
  none: string;
  /** In the aria label: "refugees admitted by". */
  subject: string;
  /** After "by": "country of chargeability". */
  basis: string;
}
const REFUGEE_WORDS: MapWords = { value: "Admitted", none: "No refugees recorded", subject: "refugees admitted", basis: "country of chargeability" };
const classOf = (v: number, thresholds: readonly number[]) => {
  const i = thresholds.findIndex((t) => v < t);
  return i === -1 ? thresholds.length + 1 : i + 1;
};

/**
 * The country list as a world choropleth: refugees admitted by country of chargeability for the selected fiscal year, shaded on fixed
 * bins, with the three largest called out; zoom and pan like the other maps; click a country to pick it (the rest dim). In Regions mode
 * each country takes its region's colour instead and a click picks its region. Same chrome as the ICE removals map.
 */
export function RefugeeMap({
  features,
  rows,
  mode,
  country,
  region,
  onPickCountry,
  onPickRegion,
  fy,
  bins = REFUGEE_BINS,
  words = REFUGEE_WORDS,
}: {
  features: readonly MapFeature[];
  rows: readonly RefugeeMapRow[];
  mode: MapMode;
  country: string | null;
  region: GeoGroup | null;
  onPickCountry: (key: string | null) => void;
  onPickRegion: (group: GeoGroup | null) => void;
  fy: number;
  bins?: MapBins;
  words?: MapWords;
}) {
  const tip = useTooltip<{ title: string; value: number | null; group: GeoGroup | null }>();
  const svgRef = useRef<SVGSVGElement>(null);
  const zoom = useZoomPan({ svgRef, extent: 1, maxK: 8, getPlotBox: () => svgRef.current?.getBoundingClientRect() ?? null, onViewChange: tip.hide });
  const { k, cx, cy } = zoom.view;
  const [bx, by, bw, bh] = [0, 0, 1000, 446];
  const vb = { x: bx + ((cx + 1) / 2) * bw - bw / (2 * k), y: by + ((1 - cy) / 2) * bh - bh / (2 * k), w: bw / k, h: bh / k };
  const callouts = useMemo(
    () => (mode === "countries" ? [...rows].sort((a, b) => b.value - a.value).slice(0, 3).map((r) => ({ key: r.key, text: `${r.name.replace(/ \(.*\)$/, "")} ${n(r.value)}` })) : []),
    [rows, mode],
  );
  const byKey = useMemo(() => new Map(rows.map((r) => [r.key, r])), [rows]);
  const drawn = useMemo(() => new Set(features.map((f) => f.key)), [features]);
  const undrawn = rows.filter((r) => !drawn.has(r.key));
  const ordered = useMemo(() => [...features.filter((f) => f.key !== country), ...features.filter((f) => f.key === country)], [features, country]);

  const hitFor = (el: Element | null) => {
    const key = el?.closest("[data-k]")?.getAttribute("data-k");
    if (!key) return null;
    const row = byKey.get(key);
    return { key, title: row?.name ?? features.find((f) => f.key === key)?.name ?? key, value: row?.value ?? null, group: row?.group ?? null };
  };
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const h = hitFor(e.target as Element);
    if (h) tip.show(h, e);
    else tip.hide();
  };

  return (
    <div className="flex min-w-0 flex-col">
      <div className={LEGEND_ROW}>
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-[22px] rounded-[2px] border border-line" style={{ background: LAND }} />
          None
        </span>
        {mode === "countries"
          ? bins.labels.map((l, i) => (
              <span key={l} className="inline-flex items-center gap-1.5">
                <i className="inline-block h-2.5 w-[22px] rounded-[2px] border border-line" style={{ background: mix(bins.mix[i]) }} />
                {l}
              </span>
            ))
          : GEO_STACK.map((g) => (
              <span key={g} className="inline-flex items-center gap-1.5">
                <i className="inline-block h-2.5 w-[22px] rounded-[2px] border border-line" style={{ background: REGION_COLOR[g] }} />
                {GEO_NAME[g].short}
              </span>
            ))}
      </div>
      <div className="relative mt-2 flex flex-1 items-center justify-center">
        <div className="relative w-full">
          <svg
            ref={svgRef}
            viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
            role="img"
            aria-label={`Map of ${words.subject} by ${mode === "regions" ? "region" : words.basis}, FY${fy}. The ranked list and table carry the same figures.`}
            className="mx-auto block h-auto max-h-[19.5rem] w-full"
            preserveAspectRatio="xMidYMid meet"
            style={{ touchAction: zoom.zoomed ? "none" : "pan-y", cursor: zoom.zoomed ? "grab" : undefined }}
            {...zoom.svgProps}
            onPointerMove={(e) => {
              zoom.svgProps.onPointerMove(e);
              if (e.buttons === 0 || e.pointerType !== "mouse") onMove(e);
              else tip.hide();
            }}
            onPointerDown={(e) => {
              zoom.svgProps.onPointerDown(e);
              onMove(e);
            }}
            onPointerLeave={tip.hide}
            onClick={(e) => {
              const h = hitFor(e.target as Element);
              if (!h || h.value === null) return;
              if (mode === "regions") onPickRegion(h.group === region ? null : (h.group ?? null));
              else onPickCountry(h.key === country ? null : h.key);
            }}
          >
            {ordered.map((f) => {
              const row = byKey.get(f.key);
              const sel = mode === "countries" && f.key === country;
              const faded = mode === "countries" ? country !== null && !sel : region !== null && row !== undefined && row.group !== region;
              return (
                <path
                  key={f.key}
                  data-k={f.key}
                  d={f.d}
                  style={{
                    fill: row ? (mode === "regions" ? (row.group ? REGION_COLOR[row.group] : LAND) : mix(bins.mix[classOf(row.value, bins.thresholds) - 1])) : LAND,
                    stroke: sel ? "var(--accent)" : "var(--surface)",
                    strokeWidth: sel ? 1.7 : 0.5,
                    vectorEffect: "non-scaling-stroke",
                    opacity: faded ? 0.4 : 1,
                    cursor: row ? "pointer" : "default",
                    transition: "opacity .12s",
                  }}
                />
              );
            })}
            <MapCallouts svgRef={svgRef} entries={callouts} view={vb} />
          </svg>
          <ZoomControls onZoomIn={zoom.zoomIn} onZoomOut={zoom.zoomOut} onReset={zoom.reset} canZoomIn={zoom.canZoomIn} zoomed={zoom.zoomed} />
        </div>
      </div>
      <Tooltip state={tip.state}>
        {({ title, value, group }) => (
          <div className="flex min-w-[8rem] flex-col gap-0.5 text-[0.78rem]">
            <div className="font-medium">{title}, FY{fy}</div>
            <div>{value === null ? <span className="opacity-75">{words.none}</span> : <>{words.value} <span className="font-mono">{n(value)}</span></>}</div>
            {value !== null && group && mode === "regions" && <div className="opacity-75">{GEO_NAME[group].name}</div>}
          </div>
        )}
      </Tooltip>
      {undrawn.length > 0 && <p className="sr-only">{`Not drawn on the map: ${undrawn.map((r) => `${r.name} ${n(r.value)}`).join(", ")}.`}</p>}
    </div>
  );
}

/** Rows with no outline (former or unmapped states): counted for the Data note. */
export function undrawnRefugees(features: readonly MapFeature[], rows: readonly RefugeeMapRow[]) {
  const drawn = new Set(features.map((f) => f.key));
  const miss = rows.filter((r) => !drawn.has(r.key));
  return { names: miss.map((r) => r.name), total: miss.reduce((a, r) => a + r.value, 0) };
}

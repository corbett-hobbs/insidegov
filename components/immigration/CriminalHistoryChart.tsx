"use client";

import { Y_GUTTER } from "@/lib/chart-bars";
import { scaleLinear } from "d3-scale";
import { useMemo } from "react";
import { Axis } from "@/components/charts/Axis";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { TERM_BAND_H, TermBandSvg, termSegments } from "@/components/charts/TermBandSvg";
import { Tooltip, useStickyTooltip } from "@/components/charts/Tooltip";
import type { Criminality } from "@/lib/enforcement-entities";
import { axisLabel, gridValues, slotLayout, yearLabel, yearLabelMode } from "@/lib/immigration-chart";
import { convictedOnly, convictedOrPendingShare, type AgencyView, type CrimBar, type Measure } from "@/lib/immigration-breakdown";
import type { IceTerm, IceYear } from "@/lib/immigration-derive";
import { useElementWidth } from "@/lib/use-element-width";

const FALLBACK_W = 1084;
const PLOT_TOP = 24;
const PLOT_H = 200;
const BASE = PLOT_TOP + PLOT_H;
const BAND_Y = BASE + 30;
const SVG_H = BAND_Y + TERM_BAND_H + 4;

export const CRIM_LABEL: Record<Criminality, string> = {
  convicted: "Convicted",
  pending_charges: "Pending charges",
  other_immigration_violator: "No known record",
  not_convicted: "Not convicted (through FY2015)",
  convicted_or_pending: "Convicted or pending (FY2025, no split)",
};
export const CRIM_COLOR: Record<Criminality, string> = {
  convicted: "var(--crim-convicted)",
  pending_charges: "var(--crim-pending)",
  other_immigration_violator: "var(--crim-none)",
  not_convicted: "var(--crim-notconvicted)",
  // FY2025's combined figure is mostly convictions and sits on the "convicted" colour; it is dashed (preliminary) and named in the legend.
  convicted_or_pending: "var(--crim-convicted)",
};

const SHARE_TICKS = [0, 0.25, 0.5, 0.75, 1];
const n = (v: number) => v.toLocaleString("en-US");
const pct = (v: number) => `${Math.round(v * 100)}%`;
const compact = (v: number) => `${Math.round(v / 1000)}k`;

const VIEW_NOUN: Record<AgencyView, string> = { all: "all removals", ice: "removals of people first arrested by ICE", cbp: "removals of people first arrested by Border Patrol" };

/**
 * ICE removals by criminal history, one bar per fiscal year in the shown window, on the same year slots as the removals
 * chart above it (so the bars line up). One view at a time: everyone, only people ICE first arrested, or only people
 * Border Patrol first arrested; counts on one fixed scale shared by the three views (`yMax`) or shares of each bar's
 * own total. Years ICE prints no figure for are empty slots, never zero.
 */
export function CriminalHistoryChart({
  years,
  terms,
  bars,
  view,
  measure,
  yMax,
  pending,
  pendingFy,
  firstBarFy,
  selectedFy,
  onSelectFy,
}: {
  years: readonly IceYear[];
  terms: readonly IceTerm[];
  /** The view's bars, any years. */
  bars: readonly CrimBar[];
  view: AgencyView;
  measure: Measure;
  yMax: number;
  pending: boolean;
  pendingFy: number;
  /** First fiscal year this view has a figure for (any window). */
  firstBarFy: number;
  selectedFy?: number;
  onSelectFy?: (fy: number) => void;
}) {
  const [ref, measured] = useElementWidth<HTMLDivElement>();
  const W = measured || FALLBACK_W;
  const left = Y_GUTTER;
  const right = 8;
  const plotW = W - left - right;
  const slots = years.length + (pending ? 1 : 0);
  const { slotW, barW } = slotLayout(plotW, slots);
  const mode = yearLabelMode(slotW);
  const tip = useStickyTooltip<{ fy: number; bar: CrimBar | null }>();
  const share = measure === "share";
  const y = scaleLinear().domain([0, share ? 1 : yMax]).range([BASE, PLOT_TOP]);
  const barByFy = useMemo(() => new Map(bars.map((b) => [b.fy, b])), [bars]);
  const termById = useMemo(() => new Map(terms.map((t) => [t.termId, t])), [terms]);
  const shown = years.flatMap((yr) => (barByFy.has(yr.fy) ? [barByFy.get(yr.fy)!] : []));
  const heightOf = (b: CrimBar, v: number) => (share ? v / b.denominator : v);

  // Which bars carry a value label: all when few, else the tallest and the newest.
  const labelled = useMemo(() => {
    if (shown.length <= 8) return new Set(shown.map((b) => b.fy));
    const peak = shown.reduce((a, b) => (b.total > a.total ? b : a));
    return new Set([peak.fy, shown[shown.length - 1].fy]);
  }, [shown]);

  const segs = termSegments(slots, (i) => {
    const yr = years[Math.min(i, years.length - 1)];
    const t = termById.get(yr.termId);
    return t ? { id: t.termId, last: t.last, president: t.president, party: t.party } : null;
  });

  const leadBlank = years.filter((yr) => yr.fy < firstBarFy).length;
  const labelNoun = view === "all" ? "no ICE figure before" : "no split by agency before";

  const barLabel = (b: CrimBar) => {
    const parts = b.parts.map((p) => `${CRIM_LABEL[p.key]} ${n(p.value)}`).join(", ");
    return `FY${b.fy}: ${parts}`;
  };

  return (
    <div data-sticky-tip className="relative">
      <div ref={ref} className="-mx-3 sm:mx-0">
        <ChartFrame
          width={W}
          height={SVG_H}
          margin={{ top: 0, right, bottom: 0, left }}
          ariaLabel={`Bar chart of ${VIEW_NOUN[view]} by criminal history, FY${years[0].fy} to FY${years[years.length - 1].fy}, as ${share ? "shares of each bar" : "counts"}.`}
          className="block h-auto w-full max-w-full"
          svgProps={{ role: "group" }}
          onPointerLeave={tip.leave}
        >
          {() => (
            <>
              <Axis
                scale={y}
                orientation="left"
                ticks={share ? SHARE_TICKS : gridValues(yMax)}
                offset={0}
                gridExtent={plotW}
                format={share ? (v: number) => `${v * 100}%` : axisLabel}
                zeroAt={0}
              />

              {years.map((yr, i) => {
                const b = barByFy.get(yr.fy) ?? null;
                const x = i * slotW;
                const bx = x + (slotW - barW) / 2;
                const prelim = b?.status === "preliminary";
                const sel = yr.fy === selectedFy;
                const open = tip.state?.data.fy === yr.fy;
                let acc = 0;
                const top = b ? y(heightOf(b, b.total)) : BASE;
                return (
                  <g key={yr.fy}>
                    <rect x={x} y={PLOT_TOP} width={slotW} height={PLOT_H} rx={2} style={{ fill: sel ? "var(--surface-raised)" : open ? "var(--accent)" : "transparent", fillOpacity: sel ? 1 : 0.09, stroke: sel ? "var(--line-strong)" : "none" }} />
                    {b &&
                      b.parts.map((p) => {
                        const y0 = y(acc + heightOf(b, p.value));
                        const h = y(acc) - y0;
                        acc += heightOf(b, p.value);
                        return <rect key={p.key} x={bx} y={y0} width={barW} height={Math.max(0, h)} style={{ fill: CRIM_COLOR[p.key], fillOpacity: prelim ? 0.55 : 1 }} />;
                      })}
                    {b && prelim && <rect x={bx} y={top} width={barW} height={BASE - top} style={{ fill: "none", stroke: "var(--ink)", strokeWidth: 1.2, strokeDasharray: "4 3" }} />}
                    {b && labelled.has(yr.fy) && slotW >= 22 && (
                      <text x={Math.min(bx + barW / 2, plotW - 12)} y={top - 5} textAnchor="middle" className="fill-ink font-mono text-[10px] font-semibold">
                        {share ? pct(convictedOrPendingShare(b)) : slotW < 40 ? compact(b.total) : n(b.total)}
                      </text>
                    )}
                    {!b && yr.fy > firstBarFy && (
                      <text transform={`translate(${x + slotW / 2 + 3},${BASE - 6}) rotate(-90)`} className="fill-ink-faint text-[9.5px]">
                        {slotW >= 14 ? "no agency split" : ""}
                      </text>
                    )}
                    <rect
                      x={x}
                      y={PLOT_TOP}
                      width={slotW}
                      height={PLOT_H}
                      fill="transparent"
                      role="button"
                      tabIndex={0}
                      aria-label={b ? barLabel(b) : `FY${yr.fy}: no ICE figure`}
                      aria-pressed={sel}
                      className="cursor-pointer outline-none focus-visible:[stroke:var(--focus)] focus-visible:[stroke-width:2]"
                      onPointerDown={(e) => {
                        if (e.pointerType === "mouse") return;
                        tip.down(e, tip.state?.data.fy === yr.fy);
                        tip.show({ fy: yr.fy, bar: b }, e);
                      }}
                      onPointerEnter={(e) => e.pointerType === "mouse" && tip.show({ fy: yr.fy, bar: b }, e)}
                      onPointerMove={tip.move}
                      onPointerUp={tip.up}
                      onPointerCancel={tip.moved}
                      onClick={() => onSelectFy?.(yr.fy)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelectFy?.(yr.fy);
                        }
                      }}
                    />
                  </g>
                );
              })}

              {leadBlank > 0 && leadBlank * slotW >= 160 && (
                <text x={(leadBlank * slotW) / 2} y={PLOT_TOP + PLOT_H / 2} textAnchor="middle" className="fill-ink-faint text-[10.5px]">
                  {`${labelNoun} FY${firstBarFy}`}
                </text>
              )}

              {pending && (
                <text transform={`translate(${years.length * slotW + slotW / 2 + 4},${BASE - 10}) rotate(-90)`} className="fill-ink-muted text-[10.5px]">
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
                const bold = fy === selectedFy || tip.state?.data.fy === fy;
                return (
                  <text key={fy} x={i * slotW + slotW / 2} y={BASE + 17} textAnchor="middle" className={`font-mono text-[10.5px] ${bold ? "fill-ink font-bold" : "fill-ink-muted"}`}>
                    {label}
                  </text>
                );
              })}

              <TermBandSvg segments={segs} x0={0} step={slotW} y={BAND_Y} />
            </>
          )}
        </ChartFrame>
      </div>
      <Tooltip state={tip.state}>
        {({ fy, bar }) => <CrimTooltip fy={fy} bar={bar} view={view} />}
      </Tooltip>
    </div>
  );
}

function CrimTooltip({ fy, bar, view }: { fy: number; bar: CrimBar | null; view: AgencyView }) {
  if (!bar) {
    return (
      <>
        <div className="font-semibold">{`FY${fy}`}</div>
        <div className="opacity-80">{view === "all" ? "No ICE figure for this year." : "ICE prints no criminal-history split by agency for this year."}</div>
      </>
    );
  }
  const combined = bar.parts.some((p) => p.key === "convicted_or_pending");
  return (
    <>
      <div className="font-semibold">{`FY${fy}${bar.status === "preliminary" ? " · preliminary" : ""}`}</div>
      {view !== "all" && <div className="opacity-80">{view === "ice" ? "First arrested by ICE" : "First arrested by Border Patrol (derived)"}</div>}
      {bar.parts.map((p) => (
        <div key={p.key} className="mt-0.5 flex justify-between gap-3">
          <span className="opacity-80">{CRIM_LABEL[p.key].replace(/ \(.*\)$/, "")}</span>
          <span className="font-mono">{`${n(p.value)} · ${pct(p.value / bar.denominator)}`}</span>
        </div>
      ))}
      <div className="mt-1 flex justify-between gap-3 border-t border-current/25 pt-1">
        <span className="opacity-80">{combined ? "Of all removals" : view === "all" ? "Total removals" : "This group"}</span>
        <span className="font-mono">{n(combined ? bar.denominator : bar.total)}</span>
      </div>
      {combined && <div className="mt-1 opacity-80">Only a combined figure is published for FY2025 (DHS budget overview).</div>}
      {convictedOnly(bar) && <div className="mt-1 opacity-80">ICE reported convicted versus not convicted only.</div>}
    </>
  );
}

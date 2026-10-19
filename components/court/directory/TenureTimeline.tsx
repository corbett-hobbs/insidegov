"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { scaleLinear } from "d3-scale";
import { ChartCard } from "@/components/charts/ChartCard";
import { ChartNotesRow } from "@/components/charts/ChartNotesRow";
import { RangeReset } from "@/components/charts/RangeReset";
import { DotCardTooltips, useDotCard } from "@/components/charts/Tooltip";
import { ZoomControls } from "@/components/charts/ZoomControls";
import { LEGEND_ITEM, LEGEND_ROW } from "@/components/charts/legend";
import { TABLE_TOGGLE } from "@/components/charts/table-toggle";
import { MethodologyNote } from "@/components/MethodologyNote";
import { SourceLink } from "@/components/SourceLink";
import { useElementWidth } from "@/lib/use-element-width";
import {
  MIN_WINDOW,
  clampWindow,
  fmtRate,
  fmtYears,
  isFullWindow,
  panWindow,
  rowsInWindow,
  tenureYears,
  timelineDomain,
  timelineTakeaway,
  yearTicks,
  zoomWindow,
  type DirectoryRow,
  type Win,
} from "@/lib/justice-directory";
import { justicePath } from "@/lib/justice-url";

const ROW_H = 24;
const BAR_H = 12;
const AXIS_H = 22;
/** Pointer travel (px) before a press on the chart is a pan, not a tap. */
const DRAG_PX = 4;
const BUTTON_ZOOM = 1.6;
const FALLBACK_W = 1100;
const partyVar = (p: "D" | "R") => (p === "D" ? "var(--dem)" : "var(--rep)");

/**
 * Every justice's time on the Court, one bar each, oldest at the top. A bar is the party colour of the president who appointed the
 * justice (solid, rule 8). The names sit in a gutter at the left and are links to the profile, so a label never depends on the bar's
 * width. The window is the chart's own: drag to pan, Ctrl/⌘ + scroll, pinch, double-click or the buttons to zoom (rule 9), and, like
 * every filter on a time series, it narrows what is drawn (rule 4): only the justices who sat in the window are listed. A bar is a
 * named individual, so it follows rule 10t: hover previews, a click or tap pins the card, and the card carries the profile link.
 */
export function TenureTimeline({ rows, asOf }: { rows: readonly DirectoryRow[]; asOf: string }) {
  const router = useRouter();
  const domain = useMemo<Win>(() => timelineDomain(rows, new Date(`${asOf}T00:00:00Z`)), [rows, asOf]);
  const [win, setWinState] = useState<[number, number]>([domain[0], domain[1]]);
  const winRef = useRef(win);
  const setWin = useCallback((w: [number, number]) => {
    winRef.current = w;
    setWinState(w);
  }, []);
  const full = isFullWindow(win, domain);

  const [wrapRef, measuredW] = useElementWidth<HTMLDivElement>();
  const W = measuredW || FALLBACK_W;
  const gutter = W < 520 ? 74 : 104;
  const right = 12;
  const plotW = Math.max(40, W - gutter - right);
  const plotWRef = useRef(plotW);
  const clipId = `tenure-clip-${useId().replace(/:/g, "")}`;

  const card = useDotCard<DirectoryRow>((a, b) => a.id === b.id);
  const { leave: cardLeave, hide: cardHide } = card;

  const x = useMemo(() => scaleLinear().domain(win).range([gutter, gutter + plotW]), [win, gutter, plotW]);
  const visible = useMemo(() => rowsInWindow(rows, win), [rows, win]);
  const ticks = useMemo(() => yearTicks(win, plotW, W < 520 ? 38 : 46), [win, plotW, W]);
  const focusId = card.pinned?.data.id ?? null;

  // --- zoom and pan -------------------------------------------------------------------------------------------------
  useEffect(() => {
    plotWRef.current = plotW;
  });
  /** The plot fraction (0–1) under a client x. */
  const fractionAt = (clientX: number) => {
    const box = wrapRef.current?.getBoundingClientRect();
    if (!box) return 0.5;
    return Math.min(1, Math.max(0, (clientX - box.left - gutter) / plotW));
  };
  const zoomBy = (factor: number, f = 0.5) => {
    cardHide();
    setWin(zoomWindow(winRef.current, domain, factor, f));
  };

  const pointers = useRef(new Map<number, number>());
  const gesture = useRef<{ x0: number; base: [number, number]; moved: boolean; pinch?: { dist: number; f: number } } | null>(null);
  const justDragged = useRef(false);

  // Ctrl/⌘ + wheel (also a trackpad pinch) zooms at the cursor and a sideways swipe pans; a plain wheel still scrolls the page.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const w = winRef.current;
      const box = el.getBoundingClientRect();
      const f = Math.min(1, Math.max(0, (e.clientX - box.left - gutter) / plotWRef.current));
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setWin(zoomWindow(w, domain, Math.exp(e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.01)), f));
      } else if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && !isFullWindow(w, domain)) {
        e.preventDefault();
        setWin(panWindow(w, domain, (e.deltaX / plotWRef.current) * (w[1] - w[0])));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [wrapRef, domain, gutter, setWin]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.set(e.pointerId, e.clientX);
    const base = winRef.current;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { x0: 0, base, moved: true, pinch: { dist: Math.abs(a - b) || 1, f: fractionAt((a + b) / 2) } };
      return;
    }
    gesture.current = { x0: e.clientX, base, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || !pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, e.clientX);
    if (g.pinch) {
      if (pointers.current.size < 2) return;
      const [a, b] = [...pointers.current.values()];
      cardHide();
      setWin(zoomWindow(g.base, domain, g.pinch.dist / (Math.abs(a - b) || 1), g.pinch.f, fractionAt((a + b) / 2)));
      return;
    }
    const dx = e.clientX - g.x0;
    if (!g.moved) {
      // Nothing to pan at the full range: the press stays a plain click.
      if (Math.abs(dx) < DRAG_PX || isFullWindow(g.base, domain)) return;
      g.moved = true;
      cardLeave();
      cardHide();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // the pointer is already gone (a synthetic event); the pan still works without capture
      }
    }
    const span = g.base[1] - g.base[0];
    setWin(clampWindow([g.base[0] - (dx / plotW) * span, g.base[1] - (dx / plotW) * span], domain));
  };
  const endPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (pointers.current.size === 0) {
      justDragged.current = gesture.current?.moved ?? false;
      gesture.current = null;
      // A drag that ends off the chart makes no click; do not let the flag eat the next real one.
      if (justDragged.current) setTimeout(() => (justDragged.current = false), 0);
    }
  };

  const height = visible.length * ROW_H;
  const label = (r: DirectoryRow) => `${r.name}: ${tenureYears(r)}, ${fmtYears(r.yearsServed)} years`;
  const zoomedNote = full ? null : `${Math.round(win[0])}–${Math.round(win[1])}`;

  return (
    <ChartCard title="How long each justice served" takeaway={timelineTakeaway(rows)}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <ul className={`${LEGEND_ROW} m-0 list-none p-0`}>
          <li className={LEGEND_ITEM}>
            <span aria-hidden className="inline-block h-2.5 w-4 rounded-sm" style={{ background: "var(--dem)" }} />
            Appointed by a Democrat
          </li>
          <li className={LEGEND_ITEM}>
            <span aria-hidden className="inline-block h-2.5 w-4 rounded-sm" style={{ background: "var(--rep)" }} />
            Appointed by a Republican
          </li>
        </ul>
        {zoomedNote && (
          <p className="m-0 flex items-center gap-2 text-[0.75rem] text-ink-muted">
            Showing {zoomedNote}, {visible.length} of {rows.length} justices
            <RangeReset show onReset={() => setWin([domain[0], domain[1]])} ariaLabel="Reset the timeline to every year" />
          </p>
        )}
      </div>

      <div className="relative mt-2">
        <div
          ref={wrapRef}
          className="-mx-3 select-none sm:mx-0"
          style={{ touchAction: "pan-y" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          onDoubleClick={(e) => {
            if ((e.target as Element).closest("a")) return;
            zoomBy(1 / BUTTON_ZOOM, fractionAt(e.clientX));
          }}
          onClickCapture={(e) => {
            // The click that ends a drag must not pin a card or follow a link.
            if (justDragged.current) {
              justDragged.current = false;
              e.stopPropagation();
              e.preventDefault();
            }
          }}
        >
          {/* The year axis stays put while the rows scroll under it. */}
          <svg width={W} height={AXIS_H} viewBox={`0 0 ${W} ${AXIS_H}`} role="img" aria-label={`Year axis, ${Math.round(win[0])} to ${Math.round(win[1])}`} className="block max-w-full">
            {ticks.map((t) => (
              <text key={t} x={x(t)} y={AXIS_H - 6} textAnchor="middle" fontSize={11} className="fill-ink-muted">
                {t}
              </text>
            ))}
          </svg>
          <div
            tabIndex={0}
            role="group"
            aria-label="Justices, oldest first; scroll to see them all"
            className="touch-scroll relative max-h-[22rem] overflow-y-auto overscroll-contain border-t border-line sm:max-h-[36rem]"
          >
            {visible.length === 0 ? (
              <p className="m-0 p-4 text-sm text-ink-muted">No justice sat in these years.</p>
            ) : (
              <svg width={W} height={height} viewBox={`0 0 ${W} ${height}`} role="img" aria-label={`Bars of each justice's time on the Court, ${visible.length} justices`} className="block max-w-full">
                <defs>
                  <clipPath id={clipId}>
                    <rect x={gutter} y={0} width={plotW} height={height} />
                  </clipPath>
                </defs>
                {ticks.map((t) => (
                  <line key={t} x1={x(t)} x2={x(t)} y1={0} y2={height} stroke="var(--line)" strokeWidth={1} />
                ))}
                {visible.map((r, i) => {
                  const y = i * ROW_H;
                  const first = r.segments[0][0];
                  const last = r.segments[r.segments.length - 1][1];
                  const x0 = Math.max(gutter, x(first));
                  const x1 = Math.min(gutter + plotW, x(last));
                  const hitX = Math.min(x0, gutter + plotW - 24);
                  return (
                    <g key={r.id}>
                      {focusId === r.id && <rect x={0} y={y} width={W} height={ROW_H} fill="var(--line)" opacity={0.45} />}
                      <g clipPath={`url(#${clipId})`}>
                        {r.segments.map(([a, b], k) => {
                          const sx0 = x(Math.max(a, win[0]));
                          const sx1 = x(Math.min(b, win[1]));
                          if (sx1 <= sx0) return null;
                          return <rect key={k} x={sx0} y={y + (ROW_H - BAR_H) / 2} width={Math.max(2, sx1 - sx0)} height={BAR_H} rx={2} fill={partyVar(r.party)} />;
                        })}
                      </g>
                      {x1 > x0 && (
                        <rect
                          {...card.bind(r)}
                          x={hitX - 4}
                          y={y}
                          width={Math.max(24, x1 - x0) + 8}
                          height={ROW_H}
                          fill="transparent"
                          style={{ cursor: "pointer" }}
                          aria-hidden
                        />
                      )}
                      {/* The name is a plain link, so it is the keyboard route to a profile and never depends on the bar. */}
                      <Link href={justicePath(r)} aria-label={label(r)} className="outline-none [&:focus-visible>text]:underline">
                        <text x={gutter - 8} y={y + ROW_H / 2 + 4} textAnchor="end" fontSize={12} className="fill-ink hover:underline">
                          {r.short}
                        </text>
                      </Link>
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        </div>
        <ZoomControls
          onZoomIn={() => zoomBy(1 / BUTTON_ZOOM)}
          onZoomOut={() => zoomBy(BUTTON_ZOOM)}
          onReset={() => setWin([domain[0], domain[1]])}
          canZoomIn={win[1] - win[0] > MIN_WINDOW + 0.01}
          zoomed={!full}
          className="right-1.5 top-8 max-sm:right-0.5"
        />
      </div>

      <DotCardTooltips card={card} onActivate={(r) => router.push(justicePath(r))}>
        {(r) => (
          <>
            <b>{r.name}</b>
            <div>
              {r.chiefNow ? "Chief Justice" : r.chief ? "Served as Chief Justice" : "Associate Justice"} · appointed by {r.president} ({r.party})
            </div>
            <div className="tt-mono">
              {tenureYears(r)} · {fmtYears(r.yearsServed)} years
            </div>
            {r.majorityOpinions !== null && r.dissentRate !== null && (
              <div className="tt-mono">
                {r.majorityOpinions} majority opinions · {fmtRate(r.dissentRate)} dissent rate{r.partialRecord ? ", since 1946" : ""}
              </div>
            )}
          </>
        )}
      </DotCardTooltips>

      <ChartNotesRow>
        <MethodologyNote>
          <p>
            One bar per justice, from the first day on the Court to the last (to today for the {rows.filter((r) => r.sitting).length} sitting), in the colour of the party of the president who appointed them; Stone and Rehnquist, elevated to Chief Justice by another president, keep the colour of their first appointment. Charles Hughes&rsquo;s bar has a gap: he left in 1916 to run for president and returned as Chief Justice in 1930. Years served are completed years of service. Dates and appointments: <SourceLink id="fjc">Federal Judicial Center</SourceLink>.
          </p>
        </MethodologyNote>
        <details className="mt-0">
          <summary className={TABLE_TOGGLE}>View as table</summary>
          <div className="touch-scroll mt-2 max-h-[22rem] overflow-auto">
            <table className="w-full min-w-[34rem] border-collapse text-left text-[0.75rem] text-ink-muted">
              <thead>
                <tr className="text-ink">
                  <th className="py-1 pr-3 font-medium">Justice</th>
                  <th className="py-1 pr-3 font-medium">Appointed by</th>
                  <th className="py-1 pr-3 font-medium">First day</th>
                  <th className="py-1 pr-3 font-medium">Last day</th>
                  <th className="py-1 text-right font-medium">Years</th>
                </tr>
              </thead>
              <tbody>
                {[...rows].reverse().map((r) => (
                  <tr key={r.id} className="border-t border-line">
                    <td className="py-1 pr-3">
                      <Link href={justicePath(r)} className="text-ink underline-offset-2 hover:underline">
                        {r.name}
                      </Link>
                    </td>
                    <td className="py-1 pr-3">
                      {r.president} ({r.party})
                    </td>
                    <td className="py-1 pr-3 tabular-nums">{r.start}</td>
                    <td className="py-1 pr-3 tabular-nums">{r.end ?? "serving"}</td>
                    <td className="py-1 text-right tabular-nums">{fmtYears(r.yearsServed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </ChartNotesRow>
    </ChartCard>
  );
}

"use client";

import { useId, useMemo, type PointerEvent } from "react";
import { scaleLinear } from "d3-scale";
import { line as d3line } from "d3-shape";
import { useElementWidth } from "@/lib/use-element-width";
import { yGutter, yearLabelEvery } from "@/lib/chart-bars";
import { fmtAxis, fmtExact, fmtValue, extremesOf } from "@/lib/president-format";
import type { Party, SeriesPanel, SeriesPoint } from "@/lib/president-types";
import { ExtremeMarks, type ExtremeMark } from "@/components/charts/ExtremeMarks";
import { TERM_BAND_H, TermSpanSvg } from "@/components/charts/TermBandSvg";
import { Tooltip, useStickyTooltip } from "@/components/charts/Tooltip";
import { TipCard } from "@/components/charts/TipCard";

const MT = 16;
const AXIS_H = 18;
const GAP = 14;
/** Half the widest bar (40px) plus a little, so the first bar never covers the y-axis labels. */
const BAR_OVERHANG = 22;
const BAND_GAP = 6;

interface Hit {
  seg: number;
  i: number;
}

/**
 * One panel of a president-page card: the series clipped to the time in office, each term its own segment laid side by
 * side (Trump's two terms with a small gap), a year axis, and the president's term band under it (rule 10j; not tappable:
 * the page has no year window). Lines for monthly, quarterly and weekly series; bars, at 72% of a year (rule 10o), for
 * fiscal-year and per-year counts, hatched while preliminary (rule 10l). The highest and lowest reading carry a label
 * (rule 12). Hover or tap shows the reading; a tap keeps it open (rule 6a).
 */
export function TermSeriesChart({ panel, height, president }: { panel: SeriesPanel; height: number; president: { name: string; last: string; party: Party } }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const tip = useStickyTooltip<Hit>();
  const hatchId = `hatch${useId().replace(/:/g, "")}`;
  const bars = panel.kind === "bars";

  const geo = useMemo(() => {
    const values = [...panel.segments.flatMap((s) => s.points.map((p) => p.value)), ...(panel.parts ?? []).flatMap((p) => p.segments.flatMap((s) => s.points.map((x) => x.value)))];
    let lo = Math.min(...values);
    let hi = Math.max(...values);
    if (bars) {
      // Room for the peak and low labels beyond the bar ends.
      const pad = (Math.max(hi, 0) - Math.min(lo, 0)) * 0.14;
      lo = lo < 0 ? lo - pad : 0;
      hi = hi > 0 ? hi + pad : 0;
    }
    if (lo === hi) {
      lo -= 1;
      hi += 1;
    }
    const y = scaleLinear().domain([lo, hi]).range([height, 0]).nice(4);
    const ticks = y.ticks(4);
    // Bars are centred on their x, so the first one overhangs the plot edge by up to half its width; keep the tick labels clear of it.
    const ml = yGutter(ticks.map((t) => fmtAxis(t, panel.format))) + (bars ? BAR_OVERHANG : 0);
    const pw = Math.max(40, width - ml - 12);
    const spans = panel.segments.map((s) => s.x1 - s.x0);
    const total = spans.reduce((a, b) => a + b, 0);
    const avail = pw - GAP * (panel.segments.length - 1);
    const widths = spans.map((sp) => (sp / total) * avail);
    const segs = panel.segments.map((s, k) => {
      const w = widths[k];
      const left = ml + widths.slice(0, k).reduce((a, b) => a + b + GAP, 0);
      return { left, w, X: (x: number) => left + ((x - s.x0) / (s.x1 - s.x0)) * w, perYear: w / (s.x1 - s.x0) };
    });
    return { y, ticks, ml, pw, segs };
  }, [panel, height, width, bars]);

  const { y, ticks, ml, pw, segs } = geo;
  const axisY = MT + height;
  const bandY = axisY + AXIS_H + BAND_GAP;
  const H = bandY + TERM_BAND_H + 2;
  const Y = (v: number) => MT + y(v);
  const barW = (k: number) => Math.max(2, Math.min(40, segs[k].perYear * 0.72));

  const marks: ExtremeMark[] = useMemo(() => {
    if (width === 0) return [];
    const all: { p: SeriesPoint; k: number }[] = panel.segments.flatMap((s, k) => s.points.map((p) => ({ p, k })));
    const { peak, low } = extremesOf(all.map((a) => a.p));
    return [peak, low].flatMap((p, j) => {
      if (!p) return [];
      const a = all.find((x) => x.p === p)!;
      return [{ x: segs[a.k].X(p.x), y: Y(p.value), text: `${p.label}: ${fmtValue(p.value, panel.format)}`, kind: j === 0 ? ("peak" as const) : ("low" as const) }];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel, segs, width]);

  const hitAt = (clientX: number, box: DOMRect): Hit | null => {
    const px = clientX - box.left;
    let best: Hit | null = null;
    let bestD = Infinity;
    panel.segments.forEach((s, k) =>
      s.points.forEach((p, i) => {
        const d = Math.abs(segs[k].X(p.x) - px);
        if (d < bestD) {
          bestD = d;
          best = { seg: k, i };
        }
      }),
    );
    return best;
  };
  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const h = hitAt(e.clientX, (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect());
    if (!h) return;
    const open = tip.state?.data;
    if (open && (open.seg !== h.seg || open.i !== h.i)) tip.moved();
    tip.show(h, e);
  };

  const open = tip.state?.data ?? null;
  const openPoint = open ? panel.segments[open.seg].points[open.i] : null;
  const partAt = (pid: number, seg: number, x: number) => panel.parts?.[pid]?.segments.find((s) => s.termId === panel.segments[seg].termId)?.points.find((p) => p.x === x) ?? null;

  const yearTicks = segs.flatMap((g, k) => {
    const s = panel.segments[k];
    const every = yearLabelEvery(g.perYear);
    const out: { x: number; label: string }[] = [];
    // A year label needs about 14px either side; one that would overhang the segment's edge is skipped.
    for (let yr = Math.ceil(s.x0); yr <= Math.floor(s.x1); yr++) if ((yr % every === 0 || every === 1) && g.X(yr) - g.left >= 12 && g.left + g.w - g.X(yr) >= 12) out.push({ x: g.X(yr), label: String(yr) });
    return out;
  });

  const lineOf = (pts: readonly SeriesPoint[], k: number) =>
    d3line<SeriesPoint>()
      .x((p) => segs[k].X(p.x))
      .y((p) => Y(p.value))(pts as SeriesPoint[]) ?? "";

  return (
    <div ref={ref} className="-mx-3 sm:mx-0" data-sticky-tip>
      {width > 0 && (
        <svg width={width} height={H} className="block touch-pan-y" role="img" aria-label={`${panel.title}, ${panel.segments.map((s) => `${s.points[0]?.label} to ${s.points[s.points.length - 1]?.label}`).join("; ")}`}>
          <defs>
            <pattern id={hatchId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--surface)" strokeWidth="2.5" opacity="0.7" />
            </pattern>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={ml} x2={ml + pw} y1={Y(t)} y2={Y(t)} stroke={t === 0 && bars ? "var(--line-strong)" : "var(--line)"} />
              <text x={ml - (bars ? BAR_OVERHANG : 0) - 6} y={Y(t) + 3.5} textAnchor="end" className="fill-ink-muted font-mono text-[11px]">
                {fmtAxis(t, panel.format)}
              </text>
            </g>
          ))}
          {panel.segments.map((s, k) => (
            <g key={s.termId}>
              {bars
                ? s.points.map((p, i) => {
                    const top = Math.min(Y(p.value), Y(0));
                    const h = Math.max(1, Math.abs(Y(p.value) - Y(0)));
                    const x = segs[k].X(p.x) - barW(k) / 2;
                    const on = open !== null && open.seg === k && open.i === i;
                    return (
                      <g key={p.label} opacity={open && !on ? 0.55 : 1}>
                        {panel.stack && p.stack ? (
                          // Stacked by group, biggest group at the bottom; counts only, so every layer is positive.
                          p.stack.map((n, j) => {
                            const below = p.stack!.slice(0, j).reduce((a, b) => a + b, 0);
                            return n > 0 ? <rect key={panel.stack![j].id} x={x} y={Y(below + n)} width={barW(k)} height={Math.max(0.5, Y(below) - Y(below + n))} style={{ fill: panel.stack![j].color }} stroke="var(--surface)" strokeWidth={0.5} /> : null;
                          })
                        ) : (
                          <rect x={x} y={top} width={barW(k)} height={h} rx={1} style={{ fill: panel.color }} />
                        )}
                        {p.preliminary && <rect x={x} y={top} width={barW(k)} height={h} fill={`url(#${hatchId})`} />}
                      </g>
                    );
                  })
                : (
                  <>
                    {(panel.parts ?? []).map((part) => {
                      const ps = part.segments.find((x) => x.termId === s.termId);
                      return ps ? <path key={part.id} d={lineOf(ps.points, k)} fill="none" stroke={part.color} strokeWidth={1.75} strokeLinejoin="round" /> : null;
                    })}
                    <path d={lineOf(s.points, k)} fill="none" stroke={panel.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                  </>
                )}
              <line x1={segs[k].left} x2={segs[k].left + segs[k].w} y1={axisY} y2={axisY} stroke="var(--line-strong)" />
            </g>
          ))}
          {yearTicks.map((t) => (
            <g key={t.label + t.x}>
              <line x1={t.x} x2={t.x} y1={axisY} y2={axisY + 4} stroke="var(--line-strong)" />
              <text x={t.x} y={axisY + 15} textAnchor="middle" className="fill-ink-muted font-mono text-[11px]">
                {t.label}
              </text>
            </g>
          ))}
          {bars ? (
            <g pointerEvents="none" opacity={open !== null ? 0.25 : 1}>
              {marks.map((m) => {
                const below = m.y > Y(0);
                const w = m.text.length * 6.3;
                const cx = Math.min(Math.max(m.x, ml + w / 2 + 2), ml + pw - w / 2);
                return (
                  <text key={m.kind} x={cx} y={below ? m.y + 12 : m.y - 4} textAnchor="middle" className="fill-ink text-[11px] font-medium" style={{ stroke: "var(--surface)", strokeWidth: 3, paintOrder: "stroke" }}>
                    {m.text}
                  </text>
                );
              })}
            </g>
          ) : (
            <ExtremeMarks marks={marks} left={ml} right={ml + pw} top={MT - 4} bottom={axisY} faded={open !== null} />
          )}
          {openPoint && open && !bars && (
            <g pointerEvents="none">
              <line x1={segs[open.seg].X(openPoint.x)} x2={segs[open.seg].X(openPoint.x)} y1={MT} y2={axisY} stroke="var(--accent)" strokeWidth={1.5} />
              {(panel.parts ?? []).map((part, pid) => {
                const q = partAt(pid, open.seg, openPoint.x);
                return q ? <circle key={part.id} cx={segs[open.seg].X(q.x)} cy={Y(q.value)} r={3.5} fill={part.color} stroke="var(--surface)" strokeWidth={1.5} /> : null;
              })}
              <circle cx={segs[open.seg].X(openPoint.x)} cy={Y(openPoint.value)} r={4} fill={panel.color} stroke="var(--surface)" strokeWidth={1.5} />
            </g>
          )}
          <TermSpanSvg
            y={bandY}
            spans={panel.segments.map((s, k) => ({ id: s.termId, last: president.last, president: president.name, party: president.party, x0: segs[k].left, x1: segs[k].left + segs[k].w }))}
          />
          <rect
            x={ml}
            y={0}
            width={pw}
            height={axisY}
            fill="transparent"
            onPointerMove={onMove}
            onPointerDown={(e) => {
              const h = hitAt(e.clientX, (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect());
              tip.down(e, h !== null && open !== null && h.seg === open.seg && h.i === open.i);
              if (h) tip.show(h, e);
            }}
            onPointerUp={tip.up}
            onPointerLeave={tip.leave}
          />
        </svg>
      )}
      {width === 0 && <div style={{ height: H }} />}
      <Tooltip state={tip.state}>
        {(h) => {
          const p = panel.segments[h.seg].points[h.i];
          const rows = (panel.parts ?? []).flatMap((part, pid) => {
            const q = partAt(pid, h.seg, p.x);
            return q ? [{ key: part.id, label: part.title, value: fmtExact(q.value, panel.format), color: part.color }] : [];
          });
          if (panel.stack && p.stack) {
            // Largest layer first, empty layers left out.
            const layers = panel.stack.flatMap((g, j) => (p.stack![j] > 0 ? [{ key: g.id, label: g.label, value: fmtExact(p.stack![j], panel.format), color: g.color, n: p.stack![j] }] : []))
              .sort((a, b) => b.n - a.n);
            return <TipCard title={p.label} value={fmtExact(p.value, panel.format)} sub={p.preliminary ? "Preliminary" : undefined} rows={layers.map((l) => ({ key: l.key, label: l.label, value: l.value, color: l.color }))} />;
          }
          return <TipCard title={p.label} value={fmtExact(p.value, panel.format)} sub={p.preliminary ? "Preliminary" : undefined} rows={rows.length ? [{ key: "main", label: panel.lineTitle ?? panel.title, value: fmtExact(p.value, panel.format), color: panel.color }, ...rows] : undefined} />;
        }}
      </Tooltip>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { fmtDollars } from "@/lib/trade-products";
import { ENDUSE_GROUPS, enduseColor, enduseGroupIndex, OTHER_COLOR, type EnduseSeries } from "@/lib/trade-enduse";
import { MONTH_NAMES } from "@/lib/indicator-time";

const M = { top: 10, right: 8, bottom: 24, left: 46 };

/** Nice round dollar ticks (1, 2, 5 x 10^n) up to `max`, about four of them. */
function ticksFor(max: number): number[] {
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = 0; v < max + step; v += step) out.push(v);
  // Stop at the first tick at or above the tallest column, so no column overshoots the top gridline.
  out.length = out.findIndex((v) => v >= max) + 1;
  return out;
}

/**
 * The "By use" list over time: one stacked column per year (2010 on) for the flow on screen, as tall as that year's goods
 * total, split into Census's five end-use groups (one solid colour each, named in the card's legend and in each
 * segment's tooltip) and a grey "other & special" on top. A line marks the year the dropdown (and play) is
 * on; tapping a column picks its year. When a category is open in the list, the other groups fade and its own slice
 * is drawn in dark ink, inside its group, across every year. The year in progress is a partial column (January to
 * its last month), labelled in the readout, not annualised.
 */
export function EnduseYearsChart({
  series,
  year,
  onYear,
  code,
  codeName,
  focus,
}: {
  series: EnduseSeries;
  year: number;
  onYear: (y: number) => void;
  /** The open category's code, or null. */
  code: string | null;
  codeName: string | null;
  /** The open category's dollars per year of `series`. */
  focus: number[] | null;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const read = () => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.round(r.width), h: Math.round(r.height) });
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [hover, setHover] = useState<number | null>(null);
  const cols = series.years;
  const { w, h } = size;
  const plotW = Math.max(0, w - M.left - M.right);
  const plotH = Math.max(0, h - M.top - M.bottom);
  const max = Math.max(1, ...cols.map((s) => s.total));
  const ticks = ticksFor(max);
  const top = ticks[ticks.length - 1];
  const y = (v: number) => M.top + plotH - (v / top) * plotH;
  const slot = cols.length ? plotW / cols.length : 0;
  const barW = Math.max(2, Math.min(28, slot * 0.7));
  const every = slot >= 30 ? 1 : slot >= 17 ? 2 : 4;
  const shown = hover ?? year;
  const sel = cols.find((s) => s.year === shown);
  const partialOf = (s: { months: number }) => (s.months < 12 ? `January to ${MONTH_NAMES[s.months - 1]}` : null);
  const cx = (i: number) => M.left + slot * i + slot / 2;
  const yearIdx = cols.findIndex((s) => s.year === year);
  const groupIdx = code ? enduseGroupIndex(code) : -1; // the open category's group (-1: other goods, or none open)
  const faded = code !== null;
  const readout = (() => {
    if (!sel) return "";
    const i = cols.indexOf(sel);
    const mine = focus?.[i] ?? 0;
    return `${sel.year}${partialOf(sel) ? ` (${partialOf(sel)})` : ""}: ${fmtDollars(sel.total)}${code && mine > 0 ? ` · ${codeName ?? "category"} ${fmtDollars(mine)}` : ""}`;
  })();

  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex h-4 items-baseline justify-between gap-2 px-2 leading-4">
        <h3 className="m-0 shrink-0 font-mono text-[0.65rem] uppercase tracking-[0.06em] text-ink-muted">By year</h3>
        <span className="truncate text-[0.75rem] text-ink-muted" aria-live="polite">{readout}</span>
      </div>
      <div ref={wrap} className="relative mt-1 h-[16rem] lg:h-auto lg:min-h-[18rem] lg:flex-1">
        {w > 0 && h > 0 && (
          <svg width={w} height={h} className="absolute inset-0 block" role="img" aria-label={`U.S. goods by year, ${cols[0]?.year} to ${cols[cols.length - 1]?.year}, stacked by the five end-use groups and other${code ? `, with ${codeName} highlighted` : ""}`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={M.left} x2={w - M.right} y1={y(t)} y2={y(t)} className={t === 0 ? "zero-line" : "grid-line"} />
                <text className="axis-tick-label" x={M.left - 6} y={y(t) + 3.5} textAnchor="end">
                  {t === 0 ? "$0" : fmtDollars(t)}
                </text>
              </g>
            ))}
            {cols.map((s, i) => {
              const x = cx(i) - barW / 2;
              const f = Math.min(focus?.[i] ?? 0, groupIdx >= 0 ? s.parts[groupIdx] : s.other);
              // Bottom to top: the five groups, then other. The open category is carved out of its own group (or of other) and drawn in dark ink.
              const segs = [
                ...ENDUSE_GROUPS.flatMap((g, k) => {
                  const mine = k === groupIdx ? f : 0;
                  return [
                    { v: s.parts[k] - mine, color: enduseColor(k), name: g.name, dim: faded && k !== groupIdx },
                    ...(mine > 0 ? [{ v: mine, color: "var(--ink)", name: codeName ?? "Category", dim: false }] : []),
                  ];
                }),
                { v: s.other - (groupIdx < 0 ? f : 0), color: OTHER_COLOR, name: "Other & special", dim: faded },
                ...(groupIdx < 0 && f > 0 ? [{ v: f, color: "var(--ink)", name: codeName ?? "Category", dim: false }] : []),
              ];
              let acc = 0;
              return (
                <g key={s.year}>
                  {/* A full-height hit area per year (under the segments, which share its handlers), so a thin column is still easy to tap. */}
                  <rect x={cx(i) - slot / 2} y={M.top} width={slot} height={plotH} fill="transparent" className="cursor-pointer" onClick={() => onYear(s.year)} onMouseEnter={() => setHover(s.year)} onMouseLeave={() => setHover(null)} />
                  {segs.map((g) => {
                    const y0 = y(acc + g.v);
                    const hh = y(acc) - y0;
                    acc += g.v;
                    return hh > 0 ? (
                      <rect key={g.name} x={x} y={y0} width={barW} height={hh} fill={g.color} opacity={g.dim ? 0.28 : 1} className="cursor-pointer" onClick={() => onYear(s.year)} onMouseEnter={() => setHover(s.year)} onMouseLeave={() => setHover(null)}>
                        <title>{`${s.year}${partialOf(s) ? ` (${partialOf(s)})` : ""} · ${g.name}: ${fmtDollars(g.v)}`}</title>
                      </rect>
                    ) : null;
                  })}
                  {i % every === 0 || s.year === year ? (
                    <text className="axis-tick-label" x={cx(i)} y={h - 8} textAnchor="middle" fontWeight={s.year === year ? 700 : undefined}>
                      {slot >= 30 ? s.year : `’${String(s.year).slice(2)}`}
                    </text>
                  ) : null}
                </g>
              );
            })}
            {/* The year line: follows the dropdown and play. */}
            {yearIdx >= 0 && <line x1={cx(yearIdx)} x2={cx(yearIdx)} y1={M.top - 4} y2={M.top + plotH} stroke="var(--ink)" strokeWidth={1.5} pointerEvents="none" style={{ transition: "x1 0.3s ease, x2 0.3s ease" }} />}
          </svg>
        )}
      </div>
    </div>
  );
}

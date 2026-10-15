import { scaleLinear } from "d3-scale";
import type { CSSProperties } from "react";
import { EO_TOPICS, topicFill, type EoPayload } from "@/lib/executive-orders-types";

const W = 320;
const H = 200;
const M = { top: 6, right: 4, bottom: 4, left: 4 };

/**
 * Static snapshot of the executive-orders explorer: orders per year, stacked by
 * topic (count mode, no axes or interaction). `stretch` fills the height its
 * parent gives it (bars and baseline stretch; there is no text to distort).
 * `runningTotal` adds a gold line of the cumulative count across the years
 * (its own scale, so it climbs to the top-right corner). Each year's bars are
 * a `.hub-yr` group so the homepage can grow them in (globals.css).
 */
export function HubEoChart({
  data,
  stretch = false,
  runningTotal = false,
}: {
  data: EoPayload;
  stretch?: boolean;
  runningTotal?: boolean;
}) {
  const n = data.years.length;
  const max = Math.max(...data.years.map((y) => y.total));
  const y = scaleLinear().domain([0, max]).range([H - M.bottom, M.top]);
  const slot = (W - M.left - M.right) / n;
  const bw = slot * 0.8;
  const all = data.years.reduce((a, yr) => a + yr.total, 0);
  const yc = scaleLinear().domain([0, all]).range([H - M.bottom, M.top]);
  const trend = data.years
    .map((_, i) => {
      const cum = data.years.slice(0, i + 1).reduce((a, yr) => a + yr.total, 0);
      return `${i ? "L" : "M"}${(M.left + i * slot + slot / 2).toFixed(2)} ${yc(cum).toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio={stretch ? "none" : undefined}
      className={stretch ? "h-full min-h-[14rem] w-full" : "h-auto w-full"}
      role="img"
      aria-label={`Executive orders signed per year, ${data.years[0].year} to ${data.years[n - 1].year}, stacked by topic`}
    >
      {data.years.map((yr, i) => {
        let acc = 0;
        return (
          <g key={yr.year} className="hub-yr" style={{ "--k": i } as CSSProperties}>
            {EO_TOPICS.map((t) => {
              const v = yr.counts[t] ?? 0;
              if (!v) return null;
              const top = y(acc + v);
              const h = y(acc) - top;
              acc += v;
              return (
                <rect
                  key={t}
                  x={M.left + i * slot + (slot - bw) / 2}
                  y={top}
                  width={bw}
                  height={h}
                  style={{ fill: topicFill(t) }}
                />
              );
            })}
          </g>
        );
      })}
      {runningTotal && <path d={trend} pathLength={1} className="hub-trend" />}
      <line x1={M.left} x2={W - M.right} y1={H - M.bottom} y2={H - M.bottom} stroke="var(--line-strong)" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

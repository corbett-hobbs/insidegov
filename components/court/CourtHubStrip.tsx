import { scaleLinear } from "d3-scale";
import type { CSSProperties } from "react";
import { isSeated, scoreAt, type CourtPayload } from "@/lib/court-types";

const W = 320;
const H = 200;
const H_COMPACT = 130;
const PAD = 14;
const R = 7;

/**
 * Static snapshot of the Court explorer's "Where the justices stand" strip for
 * the latest term: one dot per sitting justice on the liberal–conservative
 * axis, coloured by appointing party. Dots that would overlap stack
 * vertically (placed left to right, smallest offset that clears). No labels —
 * the full chart names everyone. `compact` is a shorter strip for the
 * homepage card.
 */
export function CourtHubStrip({ data, compact = false }: { data: CourtPayload; compact?: boolean }) {
  const h = compact ? H_COMPACT : H;
  const reach = compact ? 40 : 60;
  const x = scaleLinear().domain(data.domain).range([PAD, W - PAD]);
  const seated = data.justices
    .filter((j) => isSeated(j, data.lastTerm))
    .map((j) => ({ j, cx: x(scoreAt(j, data.lastTerm)) }))
    .sort((a, b) => a.cx - b.cx);

  const axisY = h / 2;
  const placed: { cx: number; cy: number }[] = [];
  const dots = seated.map(({ j, cx }) => {
    let cy = axisY;
    for (let k = 1; placed.some((p) => Math.hypot(p.cx - cx, p.cy - cy) < 2 * R + 1); k++) {
      const off = Math.ceil(k / 2) * (2 * R + 1);
      cy = axisY + (k % 2 ? -off : off);
    }
    placed.push({ cx, cy });
    return { j, cx, cy };
  });
  const mx = x(data.terms[data.terms.length - 1].median);

  return (
    <svg
      viewBox={`0 0 ${W} ${h}`}
      className="h-auto w-full"
      role="img"
      aria-label="The Supreme Court's justices on a liberal to conservative axis, latest term"
    >
      <line x1={PAD} x2={W - PAD} y1={axisY} y2={axisY} stroke="var(--line-strong)" strokeWidth={1.5} />
      <line x1={mx} x2={mx} y1={axisY - reach} y2={axisY + reach} stroke="var(--ink)" strokeDasharray="3 3" opacity={0.5} />
      <text x={mx} y={axisY - reach - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--ink)">
        Median
      </text>
      {dots.map(({ j, cx, cy }, k) => (
        <circle
          key={j.id}
          className="hub-dot"
          style={{ "--dx": `${Math.round(W / 2 - cx)}px`, "--dy": "0px", "--k": k * 40 } as CSSProperties}
          cx={cx}
          cy={cy}
          r={R}
          fill={j.party === "D" ? "var(--dem)" : "var(--rep)"}
          stroke="var(--surface)"
          strokeWidth={1.5}
        />
      ))}
      <text x={PAD} y={h - 4} fontSize={11} fill="var(--ink-muted)">More liberal</text>
      <text x={W - PAD} y={h - 4} fontSize={11} fill="var(--ink-muted)" textAnchor="end">More conservative</text>
    </svg>
  );
}

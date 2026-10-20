import { scaleLinear } from "d3-scale";
import type { CSSProperties } from "react";
import type { HubTariff } from "@/lib/trade-hub";

const W = 320;
const H = 200;
const BAND = 7;
const M = { top: 8, right: 4, bottom: BAND + 4, left: 4 };

/**
 * Static snapshot of the trade page's tariff chart for the homepage Presidency card: the average duty rate on
 * imports each month (gold line, drawn in like the old running total) over a faint fill, with the presidential
 * terms as a party-coloured band along the bottom. No axes or interaction. `stretch` fills the height its parent
 * gives it (no text inside the SVG to distort; the term names are an HTML row the caller lays over the band).
 */
export function HubTariffChart({ data, stretch = false }: { data: HubTariff; stretch?: boolean }) {
  const n = data.rates.length;
  const max = Math.max(...data.rates.map((r) => r ?? 0));
  const x = (i: number) => M.left + (i / (n - 1)) * (W - M.left - M.right);
  const y = scaleLinear().domain([0, max]).nice().range([H - M.bottom, M.top]);

  let line = "";
  let pen = false;
  data.rates.forEach((r, i) => {
    if (r === null) {
      pen = false;
      return;
    }
    line += `${pen ? "L" : "M"}${x(i).toFixed(2)} ${y(r).toFixed(2)}`;
    pen = true;
  });
  const base = H - M.bottom;
  const area = `${line.replace(/^M/, `M${x(0).toFixed(2)} ${base}L`)}L${x(n - 1).toFixed(2)} ${base}Z`;
  const tw = (W - M.left - M.right) / n;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio={stretch ? "none" : undefined}
      className={stretch ? "h-full min-h-[14rem] w-full" : "h-auto w-full"}
      role="img"
      aria-label={`Average tariff on U.S. imports each month, ${data.first.slice(0, 4)} to ${data.latest.label}, with each president's term marked`}
    >
      <path d={area} className="hub-trend-lab" fill="#e8c877" fillOpacity={0.14} />
      {data.terms.map((t, k) => (
        <rect
          key={`${t.label}-${t.s}`}
          className="hub-yr"
          style={{ "--k": k * 4, fill: t.party === "R" ? "var(--rep)" : "var(--dem)" } as CSSProperties}
          x={M.left + t.s * tw}
          y={H - BAND}
          width={Math.max(0, (t.e - t.s) * tw - 0.6)}
          height={BAND}
        />
      ))}
      <line x1={M.left} x2={W - M.right} y1={base} y2={base} stroke="var(--line-strong)" vectorEffect="non-scaling-stroke" />
      <path d={line} pathLength={1} className="hub-trend" />
    </svg>
  );
}

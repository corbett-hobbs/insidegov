import { readFileSync } from "node:fs";
import { join } from "node:path";
import { scaleBand, scaleLinear, scaleUtc } from "d3-scale";
import { line } from "d3-shape";
import { ImageResponse } from "next/og";
import type { ReactNode } from "react";
import { fmtNumber, fmtUnit } from "./format";
import { releaseNote } from "./freshness";
import type { ChartSpec, DatasetId, Insight, UnitFormat } from "./types";

/**
 * The chart image for one insight, rendered node-side with `next/og` (the same renderer as app/opengraph-image.tsx).
 * Marks are an inline SVG (no text in it: the renderer has no fonts inside SVG images); every label is an absolutely
 * positioned div on top. 1200x675 (16:9), the shape Bluesky and most feeds show uncropped.
 *
 * One series, so no legend: the headline names it. The newest value is the accent colour, everything else neutral;
 * administrations are never colored by party. A news chart may add one comparison line (a country against all
 * countries), drawn lighter, with both lines named at their ends.
 */

export const WIDTH = 1200;
export const HEIGHT = 675;

const INK = "#1a2233";
const MUTED = "#5b6472";
const GRID = "#e3e7ec";
const LINE = "#3d4a63";
const NEUTRAL = "#b9c1cc";
const ACCENT = "#5c4b7a";
const SURFACE = "#ffffff";

const PLOT = { left: 128, right: 1140, top: 236, bottom: 580 };

const KICKER: Record<DatasetId, string> = {
  energy: "Energy",
  gas: "Gas prices",
  encounters: "Border encounters",
  ice: "Immigration enforcement",
  trade: "Trade",
  executive_orders: "Executive orders",
  laws: "Laws",
};

export const SITE_URL = (process.env.SOCIAL_SITE_URL ?? "https://insidegov.fyi").replace(/\/$/, "");

/** Tick labels: the series' unit scale and prefix, without the suffix (the axis label carries it). */
function tickText(v: number, unit: UnitFormat | null, step: number): string {
  if (!unit) return `${v > 0 ? "+" : ""}${fmtNumber(v, step < 1 ? 1 : 0)}%`;
  const scaledStep = step * unit.scale;
  const decimals = scaledStep >= 1 ? 0 : scaledStep >= 0.1 ? 1 : 2;
  return `${v < 0 ? "-" : ""}${unit.prefix ?? ""}${fmtNumber(Math.abs(v * unit.scale), decimals)}`;
}

/** A bar's value: the series format, keeping only a scale word of the suffix ("$1.87 trillion", "56.3"); the axis label has the unit. */
function barValueText(v: number, unit: UnitFormat | null): string {
  if (!unit) return `${v >= 0 ? "+" : "-"}${fmtNumber(Math.abs(v), Math.abs(v) < 10 ? 1 : 0)}%`;
  return fmtUnit(v, { ...unit, suffix: unit.suffix.match(/^(?: (?:thousand|million|billion|trillion)\b|[KMBT](?![a-z]))/)?.[0] ?? "" });
}

type Label = { x: number; y: number; text: string; align: "left" | "right" | "center"; size: number; color: string; bold?: boolean };

function LabelDiv({ l }: { l: Label }) {
  const pos =
    l.align === "left" ? { left: l.x } : l.align === "right" ? { right: WIDTH - l.x } : { left: l.x - 150, width: 300, justifyContent: "center" as const };
  return (
    <div style={{ position: "absolute", top: l.y, display: "flex", fontSize: l.size, color: l.color, fontWeight: l.bold ? 700 : 400, whiteSpace: "nowrap", ...pos }}>
      {l.text}
    </div>
  );
}

function svgImage(body: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">${body}</svg>`;
  // eslint-disable-next-line @next/next/no-img-element -- ImageResponse, not a page
  return <img src={`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`} width={WIDTH} height={HEIGHT} alt="" style={{ position: "absolute", top: 0, left: 0 }} />;
}

function lineChart(spec: Extract<ChartSpec, { type: "line" }>): { svg: string; labels: Label[] } {
  const dates = spec.points.map((p) => new Date(`${p.date}T00:00:00Z`));
  const x = scaleUtc().domain([dates[0]!, dates.at(-1)!]).range([PLOT.left, PLOT.right]);
  const cmp = spec.comparison?.points.filter((p) => p.date >= spec.points[0]!.date && p.date <= spec.points.at(-1)!.date) ?? [];
  const values = [...spec.points, ...cmp].map((p) => p.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.08;
  // Never pad a series that cannot go negative below zero (a rate starting at 0.1% should not get a -2 tick).
  const y = scaleLinear().domain([lo >= 0 ? Math.max(0, lo - pad) : lo - pad, hi + pad]).nice(5).range([PLOT.bottom, PLOT.top]);
  const ticks = y.ticks(5);
  const step = ticks.length > 1 ? ticks[1]! - ticks[0]! : 1;
  let svg = ticks.map((t) => `<line x1="${PLOT.left}" x2="${PLOT.right}" y1="${y(t)}" y2="${y(t)}" stroke="${GRID}" stroke-width="1.5"/>`).join("");
  const toPath = line<{ date: string; value: number }>()
    .x((p) => x(new Date(`${p.date}T00:00:00Z`)))
    .y((p) => y(p.value));
  if (cmp.length > 1) svg += `<path d="${toPath(cmp)}" fill="none" stroke="${NEUTRAL}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`;
  svg += `<path d="${toPath(spec.points)}" fill="none" stroke="${LINE}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`;

  const labels: Label[] = ticks.map((t) => ({ x: PLOT.left - 14, y: y(t) - 11, text: tickText(t, spec.unit, step), align: "right", size: 18, color: MUTED }));
  const spanYears = (dates.at(-1)!.getTime() - dates[0]!.getTime()) / (365.25 * 86_400_000);
  for (const t of x.ticks(spanYears > 3 ? 6 : 5)) {
    const text = spanYears > 3 ? String(t.getUTCFullYear()) : t.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
    labels.push({ x: x(t), y: PLOT.bottom + 12, text, align: "center", size: 18, color: MUTED });
    svg += `<line x1="${x(t)}" x2="${x(t)}" y1="${PLOT.bottom}" y2="${PLOT.bottom + 6}" stroke="${NEUTRAL}" stroke-width="1.5"/>`;
  }

  // Marks: dots for the comparison point and the newest value (drawn last, on top). Labels sit beside their dot,
  // above it, or below it when another label already holds that spot, so they never overlap each other.
  const marks = spec.marks.flatMap((m) => {
    const p = spec.points.find((q) => q.date === m.date);
    return p ? [{ ...m, cx: x(new Date(`${p.date}T00:00:00Z`)), cy: y(p.value) }] : [];
  });
  for (const m of [...marks].sort((a, b) => Number(a.emphasis) - Number(b.emphasis))) {
    svg += m.emphasis
      ? `<circle cx="${m.cx}" cy="${m.cy}" r="9" fill="${ACCENT}" stroke="${SURFACE}" stroke-width="3"/>`
      : `<circle cx="${m.cx}" cy="${m.cy}" r="7" fill="${SURFACE}" stroke="${LINE}" stroke-width="3"/>`;
  }
  // Labels: the newest value's above every dot near it (or below, at the top edge); the comparison point's on the
  // other side of its dot from that, and left out when the two dots are too close to label apart.
  const emph = marks.find((m) => m.emphasis);
  for (const m of [...marks].sort((a, b) => Number(b.emphasis) - Number(a.emphasis))) {
    const align = m.cx > PLOT.left + (PLOT.right - PLOT.left) * 0.6 ? "right" : "left";
    const near = marks.filter((o) => Math.abs(o.cx - m.cx) < 200);
    let ly: number;
    if (m.emphasis) {
      const top = Math.min(...near.map((o) => o.cy));
      ly = top - 46 >= PLOT.top - 30 ? top - 46 : Math.max(...near.map((o) => o.cy)) + 18;
    } else {
      if (emph && Math.abs(emph.cx - m.cx) < 80) continue;
      // Above or below the dot, whichever puts fewer points of the line inside the label's box.
      const width = m.label.length * 10.5;
      const x0 = align === "right" ? m.cx + 10 - width : m.cx - 10;
      const crossings = (top: number) => spec.points.filter((p) => {
        const px = x(new Date(`${p.date}T00:00:00Z`));
        const py = y(p.value);
        return px >= x0 - 4 && px <= x0 + width + 4 && py >= top - 6 && py <= top + 30;
      }).length;
      const above = m.cy - 46;
      const below = m.cy + 18;
      ly = above < PLOT.top - 30 ? below : crossings(below) < crossings(above) ? below : above;
    }
    labels.push({ x: align === "right" ? m.cx + 10 : m.cx - 10, y: ly, text: m.label, align, size: m.emphasis ? 24 : 20, color: m.emphasis ? INK : MUTED, bold: m.emphasis });
  }
  // Two lines: name both at their right ends. The comparison's name goes above or below its end, whichever crosses
  // fewer points of either line (and stays clear of the main line's end); the main line's name joins its newest-value
  // label, on the other side of its dot.
  if (spec.comparison && cmp.length > 1) {
    const cy = y(cmp.at(-1)!.value);
    const my = y(spec.points.at(-1)!.value);
    const text = spec.comparison.label;
    const width = text.length * 10.5;
    const all = [...spec.points, ...cmp].map((p) => ({ px: x(new Date(`${p.date}T00:00:00Z`)), py: y(p.value) }));
    const crossings = (top: number) => all.filter((p) => p.px >= PLOT.right - width - 4 && p.py >= top - 4 && p.py <= top + 28).length;
    const higher = cy <= my;
    const outside = higher ? cy - 40 : cy + 14;
    const between = higher ? cy + 14 : cy - 40;
    const betweenFits = higher ? between + 28 < my - 12 : between > my + 12;
    const ly = betweenFits && crossings(between) < crossings(outside) ? between : outside;
    labels.push({ x: PLOT.right, y: ly, text, align: "right", size: 20, color: MUTED });
    const main = labels.find((l) => l.bold && l.text === spec.marks.find((m) => m.emphasis)?.label);
    if (main) {
      main.text = `${spec.comparison.mainLabel}, ${main.text}`;
      main.y = higher ? my + 18 : my - 46;
    }
  }
  return { svg, labels };
}

function verticalBars(spec: Extract<ChartSpec, { type: "bars" }>): { svg: string; labels: Label[] } {
  const x = scaleBand<number>().domain(spec.bars.map((_, i) => i)).range([PLOT.left, PLOT.right]).padding(0.25);
  const hi = Math.max(0, ...spec.bars.map((b) => b.value));
  const lo = Math.min(0, ...spec.bars.map((b) => b.value));
  const y = scaleLinear().domain([lo, hi * 1.12]).nice(5).range([PLOT.bottom, PLOT.top]);
  const ticks = y.ticks(5);
  const step = ticks.length > 1 ? ticks[1]! - ticks[0]! : 1;
  let svg = ticks.map((t) => `<line x1="${PLOT.left}" x2="${PLOT.right}" y1="${y(t)}" y2="${y(t)}" stroke="${GRID}" stroke-width="1.5"/>`).join("");
  const labels: Label[] = ticks.map((t) => ({ x: PLOT.left - 14, y: y(t) - 11, text: tickText(t, spec.unit, step), align: "right", size: 18, color: MUTED }));
  const every = spec.bars.length > 12 ? 2 : 1;
  spec.bars.forEach((b, i) => {
    const bx = x(i)!;
    const top = y(Math.max(0, b.value));
    const h = Math.abs(y(b.value) - y(0));
    const r = Math.min(4, x.bandwidth() / 2, h);
    // Rounded data end, square at the baseline.
    svg += `<path d="M${bx},${top + h} V${top + r} Q${bx},${top} ${bx + r},${top} H${bx + x.bandwidth() - r} Q${bx + x.bandwidth()},${top} ${bx + x.bandwidth()},${top + r} V${top + h} Z" fill="${b.emphasis ? ACCENT : NEUTRAL}"/>`;
    const cx = bx + x.bandwidth() / 2;
    if (b.emphasis || (spec.bars.length - 1 - i) % every === 0) labels.push({ x: cx, y: PLOT.bottom + 12, text: b.label, align: "center", size: 18, color: b.emphasis ? INK : MUTED, bold: b.emphasis });
    if (b.emphasis) labels.push({ x: cx, y: top - 34, text: barValueText(b.value, spec.unit), align: "center", size: 22, color: INK, bold: true });
  });
  svg += `<line x1="${PLOT.left}" x2="${PLOT.right}" y1="${y(0)}" y2="${y(0)}" stroke="${MUTED}" stroke-width="1.5"/>`;
  return { svg, labels };
}

function horizontalBars(spec: Extract<ChartSpec, { type: "bars" }>): { svg: string; labels: Label[] } {
  const labelW = 170;
  const left = PLOT.left - 70 + labelW;
  const right = PLOT.right - 150;
  const hi = Math.max(0, ...spec.bars.map((b) => b.value));
  const lo = Math.min(0, ...spec.bars.map((b) => b.value));
  const x = scaleLinear().domain([lo, hi]).range([lo < 0 ? left + 110 : left, right]);
  const y = scaleBand<number>().domain(spec.bars.map((_, i) => i)).range([PLOT.top + 4, PLOT.bottom]).padding(0.28);
  let svg = "";
  const labels: Label[] = [];
  spec.bars.forEach((b, i) => {
    const by = y(i)!;
    const x0 = x(Math.min(0, b.value));
    const w = Math.max(2, Math.abs(x(b.value) - x(0)));
    const r = Math.min(4, y.bandwidth() / 2, w);
    const fill = b.emphasis ? ACCENT : NEUTRAL;
    svg +=
      b.value >= 0
        ? `<path d="M${x0},${by} H${x0 + w - r} Q${x0 + w},${by} ${x0 + w},${by + r} V${by + y.bandwidth() - r} Q${x0 + w},${by + y.bandwidth()} ${x0 + w - r},${by + y.bandwidth()} H${x0} Z" fill="${fill}"/>`
        : `<path d="M${x0 + w},${by} H${x0 + r} Q${x0},${by} ${x0},${by + r} V${by + y.bandwidth() - r} Q${x0},${by + y.bandwidth()} ${x0 + r},${by + y.bandwidth()} H${x0 + w} Z" fill="${fill}"/>`;
    const mid = by + y.bandwidth() / 2 - 13;
    labels.push({ x: PLOT.left - 70, y: mid, text: b.label, align: "left", size: 22, color: b.emphasis ? INK : MUTED, bold: b.emphasis });
    const valueText = barValueText(b.value, spec.unit);
    labels.push(
      b.value >= 0
        ? { x: x0 + w + 12, y: mid, text: valueText, align: "left", size: 22, color: INK, bold: b.emphasis }
        : { x: x0 - 12, y: mid, text: valueText, align: "right", size: 22, color: INK, bold: b.emphasis },
    );
  });
  svg += `<line x1="${x(0)}" x2="${x(0)}" y1="${PLOT.top}" y2="${PLOT.bottom}" stroke="${MUTED}" stroke-width="1.5"/>`;
  return { svg, labels };
}

let fonts: { serif: Buffer } | null = null;

export async function renderChart(insight: Insight): Promise<Buffer> {
  fonts ??= { serif: readFileSync(join(process.cwd(), "app/_og/Newsreader.ttf")) };
  const spec = insight.chart;
  const { svg, labels } = spec.type === "line" ? lineChart(spec) : spec.orientation === "vertical" ? verticalBars(spec) : horizontalBars(spec);
  // Lagged data says it is new, so a chart ending months ago does not read as old news (freshness.ts).
  const note = releaseNote(insight) ?? (insight.kind === "news" ? "In the news" : null);
  const headlineSize = insight.headline.length > 96 ? 36 : insight.headline.length > 70 ? 40 : 46;
  const content: ReactNode = (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", position: "relative", background: SURFACE, color: INK, padding: "34px 60px 0 60px" }}>
      {svgImage(svg)}
      <div style={{ display: "flex", alignItems: "baseline", fontSize: 18, letterSpacing: 3, color: MUTED, textTransform: "uppercase" }}>
        <div style={{ display: "flex", fontFamily: "Newsreader", fontSize: 30, letterSpacing: -0.5, color: INK, textTransform: "none", marginRight: 18 }}>InsideGov</div>
        {KICKER[insight.dataset]}
        {note ? (
          <div style={{ display: "flex", marginLeft: "auto", fontSize: 17, letterSpacing: 1.5, color: SURFACE, background: ACCENT, borderRadius: 4, padding: "4px 10px" }}>{note}</div>
        ) : null}
      </div>
      <div style={{ display: "flex", fontFamily: "Newsreader", fontSize: headlineSize, lineHeight: 1.12, letterSpacing: -0.5, marginTop: 10, maxWidth: 1080 }}>{insight.headline}</div>
      <div style={{ position: "absolute", top: PLOT.top - 44, left: 60, display: "flex", fontSize: 17, color: MUTED }}>{spec.axisLabel}</div>
      {labels.map((l, i) => (
        <LabelDiv key={i} l={l} />
      ))}
      <div style={{ position: "absolute", left: 60, right: 60, top: HEIGHT - 50, display: "flex", justifyContent: "space-between", fontSize: 18, color: MUTED }}>
        <div style={{ display: "flex" }}>Source: {insight.source}</div>
        <div style={{ display: "flex", color: INK }}>{`${SITE_URL.replace(/^https?:\/\//, "")}${insight.url}`}</div>
      </div>
    </div>
  );
  const res = new ImageResponse(content, { width: WIDTH, height: HEIGHT, fonts: [{ name: "Newsreader", data: fonts.serif, weight: 500, style: "normal" }] });
  return Buffer.from(await res.arrayBuffer());
}

import { ImageResponse } from "next/og";
import type { ReactNode } from "react";
import { ACCENT, INK, KICKER, LINE, LabelDiv, MUTED, NEUTRAL, SITE_URL, SURFACE, type Frame, chartLayer, sealSrc, serifFont, svgImage } from "./chart";
import { explainer } from "./explain";
import { releaseNote } from "./freshness";
import { type Moment, keyMoments } from "./moments";
import type { Insight } from "./types";

/**
 * The Instagram carousel for one insight: 4:5 slides, posted by hand. Each slide is laid out on a 720x900 canvas and
 * scaled 1.5x into a 1080x1350 PNG (Instagram's portrait size), so the chart code's label sizes read at phone size
 * and text stays sharp. Slides, in order, each only when it has something to say:
 *
 *   1. hook       the newest value, large, the headline, a small trend line
 *   2. chart      the draft's chart redrawn for the portrait frame (term band, marks, source)
 *   3. explainer  "How to read this" (explain.ts): what the series measures
 *   4. moments    "Key moments" (moments.ts): dated actions from the site's sourced timelines, and the latest reading
 *   5. end        where the full chart and data are, and the source
 *
 * Every number on a slide is one the chart or the verified facts already carry; the explainer has none.
 */

export const SLIDE_W = 1080;
export const SLIDE_H = 1350;
const W = 720;
const H = 900;
const SCALE = SLIDE_W / W;
const SIDE = 44;

const HEADER_H = 76;

/** The chart slide's headline size, by length. */
const chartHeadSize = (headline: string) => (headline.length > 90 ? 27 : headline.length > 60 ? 30 : 33);

/**
 * The chart's frame on a slide: the plot starts under the headline (its line count estimated from Newsreader's average
 * glyph width, about 0.47em) and ends above the term band and the source.
 */
export function portraitFrame(headline: string): Frame {
  const size = chartHeadSize(headline);
  const lines = Math.max(1, Math.ceil((headline.length * size * 0.47) / (W - 2 * SIDE)));
  const top = Math.round(HEADER_H + lines * size * 1.12 + 78);
  return { width: W, height: H, plot: { left: 104, right: W - SIDE, top, bottom: 760 }, bandedBottom: 730 };
}

export type SlideKind = "hook" | "chart" | "explainer" | "moments" | "end";

/**
 * The newest value, as written in the caption: the fact a hook shows large. A term comparison shows the level too, not
 * the current term's change, which would single out one term (the chart beside it shows them all).
 */
function headlineValue(insight: Insight): string | null {
  const ids = ["latest_value", "current_latest_value"];
  return insight.facts.find((f) => ids.includes(f.id))?.text ?? null;
}

/** One slide's 720x900 canvas. Every slide returns one (a fragment would be laid out as a row). */
function Slide({ children }: { children: ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", position: "relative", width: W, height: H, padding: `30px ${SIDE}px 0 ${SIDE}px`, color: INK, background: SURFACE }}>{children}</div>;
}

function Header({ insight, label }: { insight: Insight; label?: string }) {
  const note = releaseNote(insight) ?? (insight.kind === "news" ? "In the news" : null);
  return (
    <div style={{ display: "flex", alignItems: "center", fontSize: 14, letterSpacing: 2.5, color: MUTED, textTransform: "uppercase" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse, not a page */}
      <img src={sealSrc()} width={32} height={32} alt="" style={{ marginRight: 10 }} />
      <div style={{ display: "flex", fontFamily: "Newsreader", fontSize: 25, letterSpacing: -0.4, color: INK, textTransform: "none", marginRight: 14 }}>InsideGov</div>
      {label ?? KICKER[insight.dataset]}
      {note && label === undefined ? (
        <div style={{ display: "flex", marginLeft: "auto", fontSize: 12, letterSpacing: 1, color: SURFACE, background: ACCENT, borderRadius: 4, padding: "3px 8px", maxWidth: 260 }}>{note}</div>
      ) : null}
    </div>
  );
}

function Footer({ n, total, left }: { n: number; total: number; left?: string }) {
  return (
    <div style={{ position: "absolute", left: SIDE, right: SIDE, top: H - 48, display: "flex", justifyContent: "space-between", fontSize: 17, color: MUTED }}>
      <div style={{ display: "flex" }}>{left ?? ""}</div>
      <div style={{ display: "flex" }}>{`${n}/${total}`}</div>
    </div>
  );
}

/** A small trend line (or bars) for the hook: the chart's own points, the newest in the accent colour. */
function spark(insight: Insight, w: number, h: number): string {
  const spec = insight.chart;
  if (spec.type === "line") {
    const vals = spec.points.map((p) => p.value);
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const x = (i: number) => 6 + (i / (vals.length - 1)) * (w - 12);
    const y = (v: number) => 6 + (1 - (v - lo) / (hi - lo || 1)) * (h - 12);
    const d = vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
    return `<path d="${d}" fill="none" stroke="${LINE}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${x(vals.length - 1)}" cy="${y(vals.at(-1)!)}" r="8" fill="${ACCENT}" stroke="${SURFACE}" stroke-width="3"/>`;
  }
  const vals = spec.bars.map((b) => b.value);
  const hi = Math.max(0, ...vals);
  const lo = Math.min(0, ...vals);
  const bw = w / vals.length;
  const y = (v: number) => (1 - (v - lo) / (hi - lo || 1)) * h;
  return spec.bars.map((b, i) => `<rect x="${i * bw + bw * 0.15}" y="${Math.min(y(b.value), y(0))}" width="${bw * 0.7}" height="${Math.max(2, Math.abs(y(b.value) - y(0)))}" rx="2" fill="${b.emphasis ? ACCENT : NEUTRAL}"/>`).join("");
}

function hookSlide(insight: Insight, n: number, total: number): ReactNode {
  const value = headlineValue(insight);
  const sparkTop = 560;
  const sparkW = W - 2 * SIDE;
  const sparkH = 170;
  const headSize = insight.headline.length > 90 ? 32 : insight.headline.length > 60 ? 36 : 40;
  return (
    <Slide>
      {svgImage(`<g transform="translate(${SIDE},${sparkTop})">${spark(insight, sparkW, sparkH)}</g>`, W, H)}
      <Header insight={insight} />
      <div style={{ display: "flex", flexDirection: "column", position: "absolute", left: SIDE, right: SIDE, bottom: H - sparkTop + 36 }}>
        {value ? <div style={{ display: "flex", fontFamily: "Newsreader", fontSize: value.length > 10 ? 76 : 96, lineHeight: 1, letterSpacing: -2, marginBottom: 22 }}>{value}</div> : null}
        <div style={{ display: "flex", fontFamily: "Newsreader", fontSize: value ? headSize : headSize + 8, lineHeight: 1.15, letterSpacing: -0.4 }}>{insight.headline}</div>
      </div>
      <Footer n={n} total={total} left="Swipe for the full chart" />
    </Slide>
  );
}

function chartSlide(insight: Insight, n: number, total: number): ReactNode {
  const spec = insight.chart;
  const frame = portraitFrame(insight.headline);
  const { svg, labels } = chartLayer(spec, frame);
  const headSize = chartHeadSize(insight.headline);
  const path = `${SITE_URL.replace(/^https?:\/\//, "")}${insight.url}`;
  return (
    <Slide>
      {svgImage(svg, W, H)}
      <Header insight={insight} />
      <div style={{ display: "flex", fontFamily: "Newsreader", fontSize: headSize, lineHeight: 1.12, letterSpacing: -0.4, marginTop: 14 }}>{insight.headline}</div>
      <div style={{ position: "absolute", top: frame.plot.top - 40, left: SIDE, display: "flex", fontSize: 16, color: MUTED }}>{spec.axisLabel}</div>
      {labels.map((l, i) => (
        <LabelDiv key={i} l={l} width={W} />
      ))}
      <div style={{ position: "absolute", left: SIDE, right: SIDE, top: H - 74, display: "flex", fontSize: 15, color: MUTED }}>{`Source: ${insight.source}`}</div>
      <Footer n={n} total={total} left={path} />
    </Slide>
  );
}

function Title({ children }: { children: string }) {
  return <div style={{ display: "flex", fontFamily: "Newsreader", fontSize: 42, lineHeight: 1.1, letterSpacing: -0.6, marginTop: 64, marginBottom: 26 }}>{children}</div>;
}

function explainerSlide(insight: Insight, lines: string[], n: number, total: number): ReactNode {
  const size = lines.join(" ").length > 300 ? 25 : 28;
  return (
    <Slide>
      <Header insight={insight} label="How to read this" />
      <Title>What this measures</Title>
      {lines.map((t, i) => (
        <div key={i} style={{ display: "flex", fontFamily: "Newsreader", fontSize: size, lineHeight: 1.4, marginBottom: 22 }}>
          {t}
        </div>
      ))}
      <Footer n={n} total={total} />
    </Slide>
  );
}

export function momentDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function momentsSlide(insight: Insight, moments: Moment[], n: number, total: number): ReactNode {
  const latest = insight.chart.type === "line" ? insight.chart.marks.find((m) => m.emphasis)?.label : undefined;
  const rows = [...moments.map((m) => ({ when: momentDate(m.date), text: m.label, accent: false })), ...(latest ? [{ when: "Latest data", text: latest, accent: true }] : [])];
  return (
    <Slide>
      <Header insight={insight} label="Key moments" />
      <Title>Key moments</Title>
      <div style={{ display: "flex", flexDirection: "column", borderLeft: `3px solid ${NEUTRAL}`, paddingLeft: 22 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", marginBottom: 24 }}>
            <div style={{ display: "flex", fontSize: 14, letterSpacing: 1.5, textTransform: "uppercase", color: r.accent ? ACCENT : MUTED, marginBottom: 4 }}>{r.when}</div>
            <div style={{ display: "flex", fontFamily: "Newsreader", fontSize: 27, lineHeight: 1.25, color: INK }}>{r.text}</div>
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: SIDE, right: SIDE, top: H - 124, display: "flex", fontSize: 16, lineHeight: 1.4, color: MUTED }}>
        {"Government actions on this topic, by date, from the timeline on insidegov.fyi with its sources. Listed in order, not as causes of the chart's changes."}
      </div>
      <Footer n={n} total={total} />
    </Slide>
  );
}

function endSlide(insight: Insight, n: number, total: number): ReactNode {
  const path = `${SITE_URL.replace(/^https?:\/\//, "")}${insight.url}`;
  return (
    <Slide>
      <Header insight={insight} label="" />
      <div style={{ display: "flex", flexDirection: "column", position: "absolute", left: SIDE, right: SIDE, top: 230 }}>
        <div style={{ display: "flex", fontFamily: "Newsreader", fontSize: 46, lineHeight: 1.1, letterSpacing: -0.6 }}>The full chart, the data and its sources</div>
        <div style={{ display: "flex", fontSize: 26, color: INK, marginTop: 34 }}>{path}</div>
        <div style={{ display: "flex", fontFamily: "Newsreader", fontSize: 28, color: INK, marginTop: 12 }}>Link in bio.</div>
        <div style={{ display: "flex", fontSize: 18, lineHeight: 1.45, color: MUTED, marginTop: 44 }}>{`Source: ${insight.source}`}</div>
        <div style={{ display: "flex", fontFamily: "Newsreader", fontSize: 26, lineHeight: 1.3, color: INK, marginTop: 70, paddingTop: 26, borderTop: `2px solid ${NEUTRAL}` }}>
          New charts when new government data comes out.
        </div>
      </div>
      <Footer n={n} total={total} />
    </Slide>
  );
}

/** Which slides an insight gets, in order (pure: the hook, chart and end always; the others when they have content). */
export function slidePlan(insight: Insight): { kind: SlideKind; lines?: string[]; moments?: Moment[] }[] {
  const lines = explainer(insight);
  const moments = keyMoments(insight);
  return [
    { kind: "hook" },
    { kind: "chart" },
    ...(lines.length ? [{ kind: "explainer" as const, lines }] : []),
    ...(moments.length ? [{ kind: "moments" as const, moments }] : []),
    { kind: "end" },
  ];
}

export async function renderCarousel(insight: Insight): Promise<Buffer[]> {
  const serif = serifFont();
  const plan = slidePlan(insight);
  const out: Buffer[] = [];
  for (const [i, s] of plan.entries()) {
    const n = i + 1;
    const body =
      s.kind === "hook"
        ? hookSlide(insight, n, plan.length)
        : s.kind === "chart"
          ? chartSlide(insight, n, plan.length)
          : s.kind === "explainer"
            ? explainerSlide(insight, s.lines!, n, plan.length)
            : s.kind === "moments"
              ? momentsSlide(insight, s.moments!, n, plan.length)
              : endSlide(insight, n, plan.length);
    // Laid out at 720x900, scaled into 1080x1350: the renderer keeps text and the SVG sharp at the larger size.
    const content = (
      <div style={{ display: "flex", width: SLIDE_W, height: SLIDE_H, background: SURFACE }}>
        <div style={{ display: "flex", width: W, height: H, transform: `scale(${SCALE})`, transformOrigin: "top left" }}>{body}</div>
      </div>
    );
    const res = new ImageResponse(content, { width: SLIDE_W, height: SLIDE_H, fonts: [{ name: "Newsreader", data: serif, weight: 500, style: "normal" }] });
    out.push(Buffer.from(await res.arrayBuffer()));
  }
  return out;
}

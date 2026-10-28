import { ImageResponse } from "next/og";
import type { ReactNode } from "react";
import { ACCENT, Badge, INK, LINE, LabelDiv, MUTED, NEUTRAL, SITE_URL, SURFACE, type Branch, BRANCHES, type Frame, backdropFor, backdropSrc, badgeOf, chartLayer, kickerFor, paleOf, sealSrc, serifFont, svgImage } from "./chart";
import { explainer } from "./explain";
import { signedFact } from "./research";
import { type Moment, keyMoments } from "./moments";
import type { Insight } from "./types";

/**
 * The Instagram carousel for one insight: 4:5 slides, posted by hand. Each slide is laid out on a 720x900 canvas and
 * scaled 1.5x into a 1080x1350 PNG (Instagram's portrait size), so the chart code's label sizes read at phone size
 * and text stays sharp. Slides, in order, each only when it has something to say:
 *
 *   1. hook       the newest value, large, the headline, a small trend line
 *   2. chart      the draft's chart redrawn for the portrait frame (term band, marks, source)
 *   3. why        "Why it went up" (research.ts): the reasons, in words, from named sources
 *   4. breakdown  "What drove it" (breakdown.ts): each source's or partner's part of the change, as bars
 *   5. explainer  "How to read this" (explain.ts): what the series measures, only when there is no why or breakdown slide
 *   6. moments    "Key moments" (moments.ts): dated actions from the site's sourced timelines, and the latest reading
 *   7. end        where the full chart and data are, and the source
 *
 * Every number on a slide is one the chart or the verified facts already carry; the why and explainer slides have none.
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

export type SlideKind = "hook" | "chart" | "why" | "breakdown" | "explainer" | "moments" | "end";

/**
 * The newest value, as written in the caption: the fact a hook shows large. A term comparison shows the level too, not
 * the current term's change, which would single out one term (the chart beside it shows them all).
 */
function headlineValue(insight: Insight): string | null {
  const ids = ["latest_value", "current_latest_value"];
  return insight.facts.find((f) => ids.includes(f.id))?.text ?? null;
}

/** One slide's 720x900 canvas. Every slide returns one (a fragment would be laid out as a row). */
function Slide({ children, color = INK }: { children: ReactNode; color?: string }) {
  return <div style={{ display: "flex", flexDirection: "column", position: "relative", width: W, height: H, padding: `30px ${SIDE}px 0 ${SIDE}px`, color }}>{children}</div>;
}

/** A draft's header: its dataset and, on the hook and chart, the release or news badge. */
const headerOf = (insight: Insight, label?: string) => ({
  kicker: label ?? kickerFor(insight),
  badge: label === undefined ? badgeOf(insight) : null,
});

function Header({ kicker, badge, ink = INK, muted = MUTED }: { kicker: string; badge?: ReturnType<typeof badgeOf> | null; ink?: string; muted?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", fontSize: 14, letterSpacing: 2.5, color: muted, textTransform: "uppercase" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse, not a page */}
      <img src={sealSrc()} width={32} height={32} alt="" style={{ marginRight: 10 }} />
      <div style={{ display: "flex", fontFamily: "Newsreader", fontSize: 25, letterSpacing: -0.4, color: ink, textTransform: "none", marginRight: 14 }}>InsideGov</div>
      {kicker}
      {badge ? <Badge {...badge} size={12} /> : null}
    </div>
  );
}

function Footer({ n, total, left, muted = MUTED }: { n: number; total: number; left?: string; muted?: string }) {
  return (
    <div style={{ position: "absolute", left: SIDE, right: SIDE, top: H - 48, display: "flex", justifyContent: "space-between", fontSize: 17, color: muted }}>
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
  const headSize = insight.title.length > 90 ? 32 : insight.title.length > 60 ? 36 : 40;
  return (
    <Slide>
      {svgImage(`<g transform="translate(${SIDE},${sparkTop})">${spark(insight, sparkW, sparkH)}</g>`, W, H)}
      <Header {...headerOf(insight)} />
      <div style={{ display: "flex", flexDirection: "column", position: "absolute", left: SIDE, right: SIDE, bottom: H - sparkTop + 36 }}>
        {value ? <div style={{ display: "flex", fontFamily: "Newsreader", fontSize: value.length > 10 ? 76 : 96, lineHeight: 1, letterSpacing: -2, marginBottom: 22 }}>{value}</div> : null}
        <div style={{ display: "flex", fontFamily: "Newsreader", fontSize: value ? headSize : headSize + 8, lineHeight: 1.15, letterSpacing: -0.4 }}>{insight.title}</div>
      </div>
      <Footer n={n} total={total} left="Swipe for the full chart" />
    </Slide>
  );
}

function chartSlide(insight: Insight, n: number, total: number): ReactNode {
  const spec = insight.chart;
  const frame = portraitFrame(insight.title);
  const { svg, labels } = chartLayer(spec, frame);
  const headSize = chartHeadSize(insight.title);
  const path = `${SITE_URL.replace(/^https?:\/\//, "")}${insight.url}`;
  return (
    <Slide>
      {svgImage(svg, W, H)}
      <Header {...headerOf(insight)} />
      <div style={{ display: "flex", fontFamily: "Newsreader", fontSize: headSize, lineHeight: 1.12, letterSpacing: -0.4, marginTop: 14 }}>{insight.title}</div>
      <div style={{ position: "absolute", top: frame.plot.top - 40, left: SIDE, display: "flex", fontSize: 16, color: MUTED }}>{spec.axisLabel}</div>
      {labels.map((l, i) => (
        <LabelDiv key={i} l={l} width={W} />
      ))}
      <div style={{ position: "absolute", left: SIDE, right: SIDE, top: H - 74, display: "flex", fontSize: 15, color: MUTED }}>{`Source: ${insight.source}${insight.note ? ` · ${insight.note}` : ""}`}</div>
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
      <Header {...headerOf(insight, "How to read this")} />
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

function whySlide(insight: Insight, n: number, total: number): ReactNode {
  const why = insight.why!;
  const len = why.paragraphs.join(" ").length;
  const size = len > 620 ? 21 : len > 480 ? 23 : 25;
  return (
    <Slide>
      <Header {...headerOf(insight, "The reasons")} />
      <Title>{why.title}</Title>
      {why.paragraphs.map((t, i) => (
        <div key={i} style={{ display: "flex", fontFamily: "Newsreader", fontSize: size, lineHeight: 1.36, marginBottom: 16 }}>
          {t}
        </div>
      ))}
      {/* Anchored by its bottom edge, so a long list grows upward instead of into the page number. */}
      <div style={{ position: "absolute", left: SIDE, right: SIDE, bottom: 64, display: "flex", fontSize: 15, lineHeight: 1.4, color: MUTED }}>{`Sources: ${why.sources.map((s) => s.name).join("; ")}.`}</div>
      <Footer n={n} total={total} />
    </Slide>
  );
}

const NAME_W = 150;
const VALUE_W = 124;
const BAR_W = W - 2 * SIDE - NAME_W - VALUE_W;

/** One block's rows: a bar per row from a shared zero line, the signed value beside it, and the total under them. */
function BreakdownBlock({ insight, label, rows, total }: { insight: Insight; label: string; rows: { name: string; fact: string }[]; total?: { name: string; fact: string } }) {
  const value = (id: string) => insight.facts.find((f) => f.id === id)!.value as number;
  const vals = rows.map((r) => value(r.fact));
  const hi = Math.max(0, ...vals);
  const lo = Math.min(0, ...vals);
  const scale = BAR_W / (hi - lo || 1);
  const zero = -lo * scale;
  // One line per row: "South Korea (Republic of Korea)" shows as "South Korea".
  const names = rows.map((r) => r.name.replace(/\s*\(.*\)\s*$/, ""));
  const long = names.some((n) => n.length > 11);
  return (
    <div style={{ display: "flex", flexDirection: "column", marginBottom: 24 }}>
      <div style={{ display: "flex", fontSize: 14, letterSpacing: 1.5, textTransform: "uppercase", color: MUTED, marginBottom: 10 }}>{label}</div>
      {rows.map((r, i) => {
        const v = vals[i]!;
        const w = Math.max(2, Math.abs(v) * scale);
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", height: 34 }}>
            <div style={{ display: "flex", width: NAME_W, fontFamily: "Newsreader", fontSize: long ? 19 : 23, whiteSpace: "nowrap", overflow: "hidden" }}>{names[i]}</div>
            <div style={{ display: "flex", position: "relative", width: BAR_W, height: 34 }}>
              <div style={{ position: "absolute", left: zero, top: 0, width: 1, height: 34, background: MUTED, display: "flex" }} />
              <div style={{ position: "absolute", left: v < 0 ? zero - w : zero, top: 9, width: w, height: 16, borderRadius: 2, background: v < 0 ? NEUTRAL : ACCENT, display: "flex" }} />
            </div>
            <div style={{ display: "flex", width: VALUE_W, justifyContent: "flex-end", fontSize: 19, color: INK }}>{signedFact(insight, r.fact)}</div>
          </div>
        );
      })}
      {total ? (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 19, color: INK, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${NEUTRAL}` }}>
          <div style={{ display: "flex" }}>{total.name}</div>
          <div style={{ display: "flex" }}>{signedFact(insight, total.fact)}</div>
        </div>
      ) : null}
    </div>
  );
}

function breakdownSlide(insight: Insight, n: number, total: number): ReactNode {
  const b = insight.breakdown!;
  return (
    <Slide>
      <Header {...headerOf(insight, "What drove it")} />
      <Title>{b.title}</Title>
      {b.blocks.map((blk, i) => (
        <BreakdownBlock key={i} insight={insight} label={blk.label} rows={blk.rows} total={blk.total} />
      ))}
      <div style={{ position: "absolute", left: SIDE, right: SIDE, top: H - 104, display: "flex", fontSize: 15, lineHeight: 1.4, color: MUTED }}>{b.note}</div>
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
      <Header {...headerOf(insight, "Key moments")} />
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
      <Header kicker="" />
      <div style={{ display: "flex", flexDirection: "column", position: "absolute", left: SIDE, right: SIDE, top: 230 }}>
        <div style={{ display: "flex", fontFamily: "Newsreader", fontSize: 46, lineHeight: 1.1, letterSpacing: -0.6 }}>The full chart, the data and its sources</div>
        <div style={{ display: "flex", fontSize: 26, color: INK, marginTop: 34 }}>{path}</div>
        <div style={{ display: "flex", fontFamily: "Newsreader", fontSize: 28, color: INK, marginTop: 12 }}>Link in bio.</div>
        <div style={{ display: "flex", fontSize: 18, lineHeight: 1.45, color: MUTED, marginTop: 44 }}>{`Source: ${insight.source}${insight.note ? ` · ${insight.note}` : ""}`}</div>
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
  const lines = insight.why || insight.breakdown ? [] : explainer(insight);
  const moments = keyMoments(insight);
  return [
    { kind: "hook" },
    { kind: "chart" },
    ...(insight.why ? [{ kind: "why" as const }] : []),
    ...(insight.breakdown ? [{ kind: "breakdown" as const }] : []),
    ...(lines.length ? [{ kind: "explainer" as const, lines }] : []),
    ...(moments.length ? [{ kind: "moments" as const, moments }] : []),
    { kind: "end" },
  ];
}

export async function renderCarousel(insight: Insight): Promise<Buffer[]> {
  const plan = slidePlan(insight);
  return renderSlides(
    plan.map((s, i) => {
      const n = i + 1;
      return s.kind === "hook"
        ? hookSlide(insight, n, plan.length)
        : s.kind === "chart"
          ? chartSlide(insight, n, plan.length)
          : s.kind === "why"
            ? whySlide(insight, n, plan.length)
            : s.kind === "breakdown"
              ? breakdownSlide(insight, n, plan.length)
              : s.kind === "explainer"
            ? explainerSlide(insight, s.lines!, n, plan.length)
            : s.kind === "moments"
              ? momentsSlide(insight, s.moments!, n, plan.length)
              : endSlide(insight, n, plan.length);
    }),
    { src: await backdropSrc(insight.url, SLIDE_W, BACKDROP_H), height: BACKDROP_H },
  );
}

const BACKDROP_H = 380;

/** A slide's backdrop (chart.tsx backdropFor): the image, how much of the slide it covers, and the colour under it. */
type Backdrop = { src: string; height: number; bg?: string };

/** Each slide (a <Slide>) to a 1080x1350 PNG, over its branch backdrop (one for all, or one per slide). */
async function renderSlides(bodies: ReactNode[], backdrops?: Backdrop | Backdrop[]): Promise<Buffer[]> {
  const serif = serifFont();
  const out: Buffer[] = [];
  for (const [i, body] of bodies.entries()) {
    const backdrop = Array.isArray(backdrops) ? backdrops[i] : backdrops;
    // Laid out at 720x900, scaled into 1080x1350: the renderer keeps text and the SVG sharp at the larger size.
    const content = (
      <div style={{ display: "flex", position: "relative", width: SLIDE_W, height: SLIDE_H, background: backdrop?.bg ?? SURFACE }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse, not a page */}
        {backdrop ? <img src={backdrop.src} width={SLIDE_W} height={backdrop.height} alt="" style={{ position: "absolute", top: 0, left: 0 }} /> : null}
        <div style={{ display: "flex", width: W, height: H, transform: `scale(${SCALE})`, transformOrigin: "top left" }}>{body}</div>
      </div>
    );
    const res = new ImageResponse(content, { width: SLIDE_W, height: SLIDE_H, fonts: [{ name: "Newsreader", data: serif, weight: 500, style: "normal" }] });
    out.push(Buffer.from(await res.arrayBuffer()));
  }
  return out;
}

/**
 * The account's intro carousel (intro.ts holds the words): a cover with small trend lines from real series, then text
 * and list slides. Same canvas, header and footer as a draft's slides.
 */
export type IntroSlide =
  | { kind: "cover"; title: string; sub: string; sparks: { label: string; points: number[] }[] }
  | { kind: "text"; kicker: string; title: string; paragraphs: string[]; sign?: string }
  | { kind: "list"; kicker: string; title: string; items: string[] };

/** The intro cycles through the three branches, so each slide differs from its neighbours (presidency, Supreme Court, Congress). */
export const INTRO_BRANCHES: Branch[] = ["presidency", "supreme-court", "congress"];

/** The gold the share cards use on a deep ground (app/_og/topic-card.tsx). */
const GOLD = "#e8c877";

type Look = {
  branch: Branch;
  dark: boolean;
  ink: string;
  muted: string;
  /** Bullets, rules and the sign-off. */
  accent: string;
  /** The ground and the faded photo over it (chart.tsx backdropFor). */
  backdrop: (width: number, height: number) => Promise<Backdrop>;
};

/**
 * One intro slide's look. A pale slide has the branch's photo in greyscale washed in its colour over a pale tint of it,
 * the whole way down; a dark one (the cover) sits on the share card's deep branch ground with the photo lifted out of it,
 * white type and gold marks. `darkCover` false makes the cover pale like the rest.
 */
export function introLook(i: number, darkCover = true): Look {
  const branch = INTRO_BRANCHES[i % INTRO_BRANCHES.length]!;
  const b = BRANCHES[branch];
  if (i === 0 && darkCover) {
    return {
      branch,
      dark: true,
      ink: "#ffffff",
      muted: "rgba(255,255,255,0.74)",
      accent: GOLD,
      backdrop: async (width, height) => ({ src: await backdropFor(branch, width, height, { base: b.deep, tint: b.light, opacity: 0.42 }), height, bg: b.deep }),
    };
  }
  const pale = paleOf(b.accent);
  return {
    branch,
    dark: false,
    ink: INK,
    muted: MUTED,
    accent: b.accent,
    backdrop: async (width, height) => ({ src: await backdropFor(branch, width, height, { base: pale, opacity: 0.3 }), height, bg: pale }),
  };
}

function sparkPath(vals: number[], w: number, h: number, line = LINE, dot = ACCENT, ring = SURFACE): string {
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const x = (i: number) => 6 + (i / (vals.length - 1)) * (w - 12);
  const y = (v: number) => 6 + (1 - (v - lo) / (hi - lo || 1)) * (h - 12);
  const d = vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return `<path d="${d}" fill="none" stroke="${line}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${x(vals.length - 1)}" cy="${y(vals.at(-1)!)}" r="7" fill="${dot}" stroke="${ring}" stroke-width="3"/>`;
}

function introSlide(s: IntroSlide, n: number, total: number, look: Look): ReactNode {
  if (s.kind === "cover") {
    const rowTop = 470;
    const rowH = 118;
    const sparkW = W - 2 * SIDE;
    const [line, dot, ring] = look.dark ? ["#ffffff", GOLD, BRANCHES[look.branch].deep] : [LINE, look.accent, SURFACE];
    const svg = s.sparks.map((sp, i) => `<g transform="translate(${SIDE},${rowTop + i * rowH + 26})">${sparkPath(sp.points, sparkW, rowH - 44, line, dot, ring)}</g>`).join("");
    return (
      <Slide color={look.ink}>
        {svgImage(svg, W, H)}
        <Header kicker="" ink={look.ink} muted={look.muted} />
        <div style={{ display: "flex", fontFamily: "Newsreader", fontSize: 64, lineHeight: 1.04, letterSpacing: -1.5, marginTop: 92 }}>{s.title}</div>
        <div style={{ display: "flex", fontFamily: "Newsreader", fontSize: 24, lineHeight: 1.35, color: look.muted, marginTop: 22 }}>{s.sub}</div>
        {s.sparks.map((sp, i) => (
          <div key={i} style={{ position: "absolute", left: SIDE, top: rowTop + i * rowH, display: "flex", fontSize: 14, letterSpacing: 1.5, textTransform: "uppercase", color: look.muted }}>
            {sp.label}
          </div>
        ))}
        <Footer n={n} total={total} left="Swipe" muted={look.muted} />
      </Slide>
    );
  }
  const body =
    s.kind === "list" ? (
      s.items.map((t, i) => (
        <div key={i} style={{ display: "flex", alignItems: "flex-start", marginBottom: 24 }}>
          <div style={{ display: "flex", width: 10, height: 10, borderRadius: 2, background: look.accent, marginTop: 13, marginRight: 18, flexShrink: 0 }} />
          <div style={{ display: "flex", fontFamily: "Newsreader", fontSize: 28, lineHeight: 1.35 }}>{t}</div>
        </div>
      ))
    ) : (
      s.paragraphs.map((t, i) => (
        <div key={i} style={{ display: "flex", fontFamily: "Newsreader", fontSize: s.paragraphs.join(" ").length > 380 ? 26 : 29, lineHeight: 1.4, marginBottom: 20 }}>
          {t}
        </div>
      ))
    );
  return (
    <Slide color={look.ink}>
      <Header kicker={s.kicker} ink={look.ink} muted={look.muted} />
      <Title>{s.title}</Title>
      {body}
      {s.kind === "text" && s.sign ? (
        <div style={{ display: "flex", fontSize: 20, color: look.accent, marginTop: 10, paddingTop: 20, borderTop: `2px solid ${NEUTRAL}` }}>{s.sign}</div>
      ) : null}
      <Footer n={n} total={total} muted={look.muted} />
    </Slide>
  );
}

export async function renderIntroCarousel(slides: IntroSlide[], opts: { darkCover?: boolean } = {}): Promise<Buffer[]> {
  const looks = slides.map((_, i) => introLook(i, opts.darkCover));
  return renderSlides(
    slides.map((s, i) => introSlide(s, i + 1, slides.length, looks[i]!)),
    await Promise.all(looks.map((l) => l.backdrop(SLIDE_W, SLIDE_H))),
  );
}

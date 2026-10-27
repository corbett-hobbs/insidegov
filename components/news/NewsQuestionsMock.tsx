"use client";

import { useEffect, useId, useRef, useState } from "react";
import { SectionPills, type SectionNavItem } from "@/components/SectionNav";

/**
 * MOCKUP ONLY: the page-level "In the news" row and "Questions" list, with no data wiring. Each page passes its own sample
 * items (Economy: `economy/EconomyExtrasMock`, Immigration: `immigration/ImmigrationExtrasMock`). Every item points back up
 * to one chart by the chart's DOM id (`target`); the sparkline behind a headline is that chart's real recent data.
 */

/** One point of a sparkline: any x (a day, a fiscal year) and its value. */
export type SparkPoint = { x: number; value: number };

/** The one chart a headline points to, the best fit when a story touches several. */
/** `asOf` is the latest reading's date, worded as the chart's own readout words it ("week of Oct 12, 2026", "FY2025"). */
export type NewsChart = { target: string; label: string; value: string; asOf: string; pts: SparkPoint[]; bars?: boolean };
/** AllSides Media Bias Rating of the outlet's news coverage, as published; "Data" marks an agency's own data release. */
export type Lean = "Data" | "Left" | "Lean Left" | "Center" | "Lean Right" | "Right";
/** One outlet's headline on the story. `mark` is the fallback initials for a source with no icon on file. */
export type Headline = { outlet: string; mark: string; lean: Lean; title: string };
/**
 * One story as each side headlined it, over the chart it is about: the data release first (the facts), then the outlets
 * from left to right. A story only gets a card when it has a left-of-center and a right-of-center headline, and shows at
 * most three (the release, or a center outlet, plus one from each side), each clamped to two lines, so the cards in a row
 * come out close to one height and the sparkline band, not empty space, takes up the difference.
 */
export type NewsItem = { date: string; topic: string; chart: NewsChart; headlines: Headline[] };

export type QuestionChart = { target: string; label: string };
export type Question = { q: string; a: string; source: string; charts: QuestionChart[] };
/** Questions grouped under the page's own row or section names, in the page's order. */
export type QuestionGroup = { row: string; items: Question[] };

/**
 * The two entries every page's navigation gets after its own sections: unnumbered, page-wide, not data sections. "FAQs" in
 * the nav, where it has to be recognised at a glance; the section itself is headed "Frequently asked questions".
 */
export const NEWS_ID = "in-the-news";
export const QUESTIONS_ID = "faq";
export const EXTRA_NAV: readonly SectionNavItem[] = [
  { id: NEWS_ID, label: "In the news", short: "News" },
  { id: QUESTIONS_ID, label: "FAQs" },
];

/**
 * The same two links for a page without numbered sections (Economy), in the header where a sectioned page has its
 * pills, so they look the same on every page. A pill is absent when its section is.
 */
export function NewsQuestionsPills({ news, groups }: { news: readonly NewsItem[]; groups: readonly QuestionGroup[] }) {
  const extras = EXTRA_NAV.filter((it) => (it.id === NEWS_ID ? news.length > 0 : groups.length > 0));
  return <SectionPills items={[]} extras={extras} numbered={false} />;
}

/** The two sections' headings: the serif section-heading style (Immigration's `SectionHeading`, unnumbered), not the mono row labels the chart rows use. */
const HEADING = "m-0 flex flex-1 items-center gap-3 font-serif text-[clamp(1.35rem,2.6vw,1.6rem)] font-medium leading-[1.2] tracking-[-0.01em] text-ink";

/**
 * The full-width band both sections sit in, a shade off the page background, so the page reads as data above and context
 * below. It is the page's branch colour (`--accent`: Presidency blue, Congress green, Court red) mixed lightly into the
 * background, so it follows the branch and its dark-mode shade on its own. It spans the viewport with a wide box-shadow
 * clipped to its own height, which adds no width to the page.
 */
export function NewsAndFaqBand({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{ "--band": "color-mix(in srgb, var(--accent) 12%, var(--bg))" } as React.CSSProperties}
      className="mt-4 flex flex-col gap-10 bg-[var(--band)] py-9 shadow-[0_0_0_100vmax_var(--band)] [clip-path:inset(0_-100vmax)]"
    >
      {children}
    </div>
  );
}
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/** Scrolls up to a chart and, once it has arrived, rings it in the accent colour so the reader sees where they landed. */
export function jumpToChart(target: string) {
  const el = document.getElementById(target);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  el.animate(
    [{ boxShadow: "0 0 0 2px var(--accent)" }, { boxShadow: "0 0 0 2px var(--accent)", offset: 0.6 }, { boxShadow: "0 0 0 2px transparent" }],
    { duration: 1800, delay: 550, easing: "ease-out" },
  );
}

function MockBadge() {
  return <span className="rounded-sm border border-dashed border-line-strong px-1.5 py-px font-mono text-[0.6rem] tracking-[0.05em] text-ink-faint">SAMPLE</span>;
}

/**
 * The single link at the end of a chart's notes row, "2 questions · 1 in the news ↓". Absent when the chart has neither.
 * It scrolls to the first section that has something for this chart and highlights that chart's items.
 */
export function ChartJumpLink({ target, news, groups, onJump }: { target: string; news: readonly NewsItem[]; groups: readonly QuestionGroup[]; onJump: (target: string) => void }) {
  const q = groups.flatMap((g) => g.items).filter((x) => x.charts.some((c) => c.target === target)).length;
  const n = news.filter((x) => x.chart.target === target).length;
  if (!q && !n) return null;
  const parts = [q && `${q} question${q > 1 ? "s" : ""}`, n && `${n} in the news`].filter(Boolean).join(" · ");
  return (
    <button
      type="button"
      onClick={() => {
        onJump(target);
        if (!n) return document.getElementById(QUESTIONS_ID)?.scrollIntoView({ behavior: "smooth", block: "start" });
        document.getElementById(NEWS_ID)?.scrollIntoView({ behavior: "smooth", block: "start" });
        // Bring the first matching headline into the row's view.
        document.querySelector(`[data-news-for="${target}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
      }}
      className={`cursor-pointer border-0 bg-transparent p-0 text-[0.75rem] text-ink-faint hover:text-ink-muted ${FOCUS}`}
    >
      {parts} ↓
    </button>
  );
}

const W = 240;
const H = 44;

/**
 * Where a sparkline's points sit, as fractions of its box: x runs left to right (bars keep half a bar clear of each edge),
 * and y keeps the line to the top half (10% to 55%), right under the headlines, so the shaded area fills down from it and
 * a tall band reads as chart rather than empty space, with the bottom clear for the reading.
 */
function sparkScale(pts: SparkPoint[], bars: boolean) {
  const vals = pts.map((p) => p.value);
  const lo = Math.min(...vals, bars ? 0 : Infinity);
  const hi = Math.max(...vals, bars ? 0 : -Infinity);
  const x0 = pts[0].x;
  const x1 = pts[pts.length - 1].x;
  const pad = bars ? 0.5 / pts.length : 0;
  return {
    x: (d: number) => pad + ((d - x0) / (x1 - x0 || 1)) * (1 - 2 * pad),
    y: (v: number) => 0.55 - ((v - lo) / (hi - lo || 1)) * 0.45,
    barW: bars ? 1 / pts.length - 4 / W : 0,
  };
}

/** The sparkline as a faded wash: an accent line over an area that fades out downward (bars where the chart has bars). */
function FadedSpark({ pts, bars }: { pts: SparkPoint[]; bars: boolean }) {
  const grad = useId();
  const s = sparkScale(pts, bars);
  const line = pts.map((p) => `${(s.x(p.x) * W).toFixed(1)},${(s.y(p.value) * H).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 block size-full" aria-hidden>
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.16" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {bars ? (
        pts.map((p) => {
          const top = Math.min(s.y(p.value), s.y(0)) * H;
          return <rect key={p.x} x={(s.x(p.x) - s.barW / 2) * W} y={top} width={s.barW * W} height={Math.max(1, Math.abs(s.y(p.value) - s.y(0)) * H)} fill="var(--accent)" opacity="0.14" />;
        })
      ) : (
        <>
          <polygon points={`0,${H} ${line} ${W},${H}`} fill={`url(#${grad})`} />
          <polyline points={line} fill="none" stroke="var(--accent)" strokeOpacity="0.4" strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </>
      )}
    </svg>
  );
}

/**
 * The faded sparkline in a band straight under the headlines, edge to edge on the left, filling whatever height the card
 * has left so no gap opens below the last headline. The latest reading sits in the bottom-right corner, "Diesel $6.18" over
 * its date,
 * tied to the line's last point by a dot and a straight vertical rule. Decoration only: the card's "See chart ↑" does the
 * jump, and hovering it brings the line up to full strength.
 */
function SparkBand({ chart }: { chart: NewsChart }) {
  const s = sparkScale(chart.pts, !!chart.bars);
  const last = chart.pts[chart.pts.length - 1];
  const at = { left: `${s.x(last.x) * 100}%`, top: `${s.y(last.value) * 100}%` };
  return (
    <div aria-hidden className="relative -mx-3 -mb-3 mt-1 min-h-[5rem] flex-1">
      {/* The plot ends 16px in from the right edge, where the reading's right edge is, so the rule drops straight onto it. */}
      <span className="absolute inset-y-0 left-0 right-4">
        <span className="absolute inset-0 opacity-70 transition-opacity group-has-[[data-see-chart]:hover]/card:opacity-100">
          <FadedSpark pts={chart.pts} bars={!!chart.bars} />
        </span>
        <span className="absolute bottom-[2.3rem] w-px -translate-x-1/2 bg-ink-faint" style={at} />
        <span className="absolute size-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent" style={at} />
      </span>
      {/* The reading, and under it the date it is for: often earlier than the story's (a weekly price lags a few days). */}
      <span className="absolute bottom-2 right-3 flex flex-col items-end rounded-sm bg-surface/80 px-1 font-mono text-[0.64rem] leading-tight text-ink-muted">
        <span className="flex items-baseline gap-1.5">
          {chart.label}
          <span className="text-ink">{chart.value}</span>
        </span>
        <span className="text-[0.58rem] text-ink-faint">{chart.asOf}</span>
      </span>
    </div>
  );
}

/** "See chart ↑" beside the card's title: back up to the chart, which then rings itself (in-page, so ↑, never ↗). */
function SeeChart({ chart }: { chart: NewsChart }) {
  return (
    <button
      type="button"
      data-see-chart=""
      onClick={() => jumpToChart(chart.target)}
      aria-label={`See the ${chart.label} chart, latest ${chart.value}, ${chart.asOf}`}
      className={`flex-none cursor-pointer border-0 bg-transparent p-0 text-[0.75rem] font-medium text-accent underline decoration-line-strong underline-offset-2 hover:decoration-accent ${FOCUS}`}
    >
      See chart ↑
    </button>
  );
}

/** "↑ Gas price": the plain chip the questions use to point back up to a chart. */
function ChartChip({ chart }: { chart: QuestionChart }) {
  return (
    <button
      type="button"
      onClick={() => jumpToChart(chart.target)}
      className={`cursor-pointer rounded-full border border-line bg-surface-raised px-2 py-px font-mono text-[0.66rem] text-ink-muted hover:border-ink-faint hover:text-ink ${FOCUS}`}
    >
      ↑ {chart.label}
    </button>
  );
}

/** ‹ › at the right of the heading row: scroll the row by one card, greyed out at either end. */
function RowArrows({ row }: { row: React.RefObject<HTMLUListElement | null> }) {
  const [ends, setEnds] = useState({ start: true, end: false });
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const update = () => setEnds({ start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 });
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [row]);
  // Lines up the next (or previous) card with the row's left edge, so a card is never left half cut.
  const step = (dir: 1 | -1) => {
    const el = row.current;
    if (!el) return;
    const left = el.getBoundingClientRect().left;
    const offs = [...el.querySelectorAll("li")].map((li) => li.getBoundingClientRect().left - left);
    const off = dir === 1 ? offs.find((o) => o > 4) : offs.findLast((o) => o < -4);
    if (off !== undefined) el.scrollTo({ left: el.scrollLeft + off, behavior: "smooth" });
  };
  const btn = `grid size-7 cursor-pointer place-items-center rounded-full border border-line bg-surface text-[0.95rem] leading-none text-ink hover:border-ink-faint disabled:cursor-default disabled:text-ink-faint disabled:hover:border-line ${FOCUS}`;
  return (
    <div className="hidden gap-1.5 sm:flex">
      <button type="button" aria-label="Earlier headlines" disabled={ends.start} onClick={() => step(-1)} className={btn}>‹</button>
      <button type="button" aria-label="More headlines" disabled={ends.end} onClick={() => step(1)} className={btn}>›</button>
    </div>
  );
}

const LEANS: readonly Lean[] = ["Data", "Left", "Lean Left", "Center", "Lean Right", "Right"];

/**
 * Each source's own site icon, downloaded once into `public/mock-logos/` and served from our site, so readers' browsers
 * never ask the publishers' servers for it (they would learn who reads the page). Used only to name the source.
 */
const OUTLET_LOGOS: Record<string, string> = {
  HuffPost: "huffpost",
  "The Guardian": "guardian",
  "New York Times": "nytimes",
  "NBC News": "nbcnews",
  "CBS News": "cbsnews",
  "Wall Street Journal": "wsj",
  "BBC News": "bbc",
  "The Hill": "thehill",
  "Washington Examiner": "washingtonexaminer",
  "Washington Times": "washingtontimes",
  "Fox Business": "foxbusiness",
  "Fox News": "foxnews",
  "New York Post": "nypost",
  "Freddie Mac": "freddiemac",
  "U.S. Treasury": "treasury",
  "Bureau of Labor Statistics": "bls",
  "U.S. Customs and Border Protection": "cbp",
  "Federal Register": "federalregister",
};

/** The source's site icon, or its initials in a small square when there is no icon on file. */
function OutletMark({ outlet, mark, data }: { outlet: string; mark: string; data: boolean }) {
  const logo = OUTLET_LOGOS[outlet];
  // eslint-disable-next-line @next/next/no-img-element -- an 18px icon from our own public folder; next/image adds nothing here
  if (logo) return <img src={`/mock-logos/${logo}.png`} alt="" width={18} height={18} className="size-[18px] flex-none rounded-[4px] object-contain" />;
  return (
    <span aria-hidden className={`grid h-[18px] min-w-[18px] flex-none place-items-center rounded-[4px] px-[3px] font-mono text-[0.55rem] font-semibold tracking-[0.02em] ${data ? "bg-ink text-surface" : "border border-line-strong bg-surface-raised text-ink"}`}>
      {mark}
    </span>
  );
}

/**
 * The AllSides label in plain words with a five-step scale beside it, the outlet's step filled in ink: where it sits, with
 * no red or blue to colour the reading. A data release says so instead.
 */
function LeanTag({ lean }: { lean: Lean }) {
  if (lean === "Data") return <span className="ml-auto flex-none font-mono text-[0.62rem] uppercase tracking-[0.05em] text-ink-muted">Data release</span>;
  const at = LEANS.indexOf(lean) - 1;
  return (
    <span className="ml-auto flex flex-none items-center gap-1.5" title={`AllSides Media Bias Rating: ${lean}`}>
      <span className="font-mono text-[0.62rem] uppercase tracking-[0.05em] text-ink-muted">{lean}</span>
      <span aria-hidden className="flex gap-[2px]">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className={`h-[7px] w-[4px] rounded-[1px] ${i === at ? "bg-ink" : "bg-line-strong"}`} />
        ))}
      </span>
    </span>
  );
}

const lit = (on: boolean) => (on ? "bg-accent/10 border-accent" : "border-line");

/**
 * Three to six stories, newest first, each a card of headlines from across the spectrum over a faded sparkline of its chart.
 * One row that scrolls sideways: three cards (two on a tablet) and a peek of the next, with arrows; a swipe on phones.
 * Hidden when there are none.
 */
export function InTheNews({ items, focus = null }: { items: readonly NewsItem[]; focus?: string | null }) {
  const row = useRef<HTMLUListElement>(null);
  if (!items.length) return null;
  return (
    <section id={NEWS_ID} aria-labelledby={`${NEWS_ID}-h`} className="flex scroll-mt-32 flex-col gap-3">
      <div className="flex items-center gap-3">
        <h2 id={`${NEWS_ID}-h`} className={`${HEADING} whitespace-nowrap`}>
          In the news
          <MockBadge />
        </h2>
        <RowArrows row={row} />
      </div>
      {/* Edge to edge on phones; scroll-px keeps a snapped card inside the page gutter. The scrollbar is hidden: the peek and the arrows show there is more. */}
      <ul
        ref={row}
        className="-mx-4 my-0 flex snap-x snap-mandatory scroll-px-4 list-none gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:scroll-px-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => (
          <li
            key={item.headlines[0].title}
            data-news-for={item.chart.target}
            className={`group/card relative flex w-[86%] shrink-0 snap-start flex-col overflow-hidden rounded-[10px] border bg-surface p-3 transition-colors duration-500 sm:w-[calc((100%-0.75rem)/2.15)] lg:w-[calc((100%-1.5rem)/3.15)] ${lit(focus === item.chart.target)}`}
          >
            {/* The story's subject at a glance, in our words (a plain topic, never a take): "Oct 24 · Diesel prices". */}
            <div className="flex items-baseline gap-3 px-1">
              <h3 className="m-0 flex min-w-0 flex-1 items-baseline gap-2 font-serif text-[1.05rem] font-medium leading-snug text-ink">
                <span className="flex-none font-mono text-[0.68rem] font-normal text-ink-muted">{item.date} ·</span>
                {item.topic}
              </h3>
              <SeeChart chart={item.chart} />
            </div>
            <ol className="m-0 mt-1.5 flex list-none flex-col p-0">
              {[...item.headlines].sort((a, b) => LEANS.indexOf(a.lean) - LEANS.indexOf(b.lean)).map((h) => (
                <li key={h.outlet} className="flex flex-col gap-1 border-t border-line px-1 py-2 first:border-t-0 first:pt-1">
                  <span className="flex items-center gap-2 text-[0.7rem] text-ink-muted">
                    <OutletMark outlet={h.outlet} mark={h.mark} data={h.lean === "Data"} />
                    <span className="min-w-0 truncate font-medium text-ink">{h.outlet}</span>
                    <LeanTag lean={h.lean} />
                  </span>
                  <a
                    href="#"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.preventDefault()}
                    title={h.title}
                    className={`line-clamp-2 text-[0.86rem] leading-[1.38] text-ink no-underline hover:underline ${FOCUS}`}
                  >
                    {h.title}
                    <span aria-hidden className="ml-1 whitespace-nowrap text-[0.78rem] text-ink-muted">↗</span>
                    <span className="sr-only"> (opens the article on {h.outlet}&rsquo;s site)</span>
                  </a>
                </li>
              ))}
            </ol>
            <SparkBand chart={item.chart} />
          </li>
        ))}
      </ul>
      <span className="text-[0.72rem] text-ink-faint">Each story as outlets across the spectrum headlined it, with the agency’s own release first · leans are AllSides Media Bias Ratings · updated Oct 27 · sparklines show the last 3 years of weekly and monthly figures and the last 12 years of yearly ones · “See chart ↑” goes to the chart, ↗ opens the article</span>
    </section>
  );
}

/** Evergreen "why it matters, and to whom" questions, grouped by the page's rows or sections and closed by default. */
export function Questions({ groups, focus = null }: { groups: readonly QuestionGroup[]; focus?: string | null }) {
  if (!groups.length) return null;
  return (
    <section id={QUESTIONS_ID} aria-labelledby={`${QUESTIONS_ID}-h`} className="flex scroll-mt-32 flex-col gap-3">
      <h2 id={`${QUESTIONS_ID}-h`} className={HEADING}>
        Frequently asked questions
        <MockBadge />
      </h2>
      <div className="rounded-[10px] border border-line bg-surface px-5 py-2 sm:px-6">
        {groups.map((g) => (
          <div key={g.row} className="border-b border-line py-2 last:border-b-0">
            <h3 className="m-0 pb-1 pt-2 font-mono text-[0.62rem] font-medium uppercase tracking-[0.08em] text-ink-faint">{g.row}</h3>
            {g.items.map((item) => {
              const on = focus !== null && item.charts.some((c) => c.target === focus);
              return (
                <details key={item.q} open={on || undefined} className={`group -mx-2 rounded-md px-2 transition-colors duration-500 ${on ? "bg-accent/10" : ""}`}>
                  <summary className={`flex cursor-pointer list-none items-start gap-3 py-2.5 font-serif text-[1.05rem] leading-snug text-ink [&::-webkit-details-marker]:hidden ${FOCUS}`}>
                    <span aria-hidden className="mt-[0.2rem] font-mono text-[0.75rem] text-ink-faint transition-transform group-open:rotate-90">›</span>
                    <span className="flex-1">{item.q}</span>
                  </summary>
                  <div className="pb-3 pl-6 text-[0.875rem] leading-[1.55] text-ink">
                    <p className="m-0">{item.a}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.75rem] text-ink-muted">
                      <span>Source: {item.source}</span>
                      {item.charts.map((c) => (
                        <ChartChip key={c.target} chart={c} />
                      ))}
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

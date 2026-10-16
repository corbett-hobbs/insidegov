import Link from "next/link";
import {
  TIMELINE_START,
  buildSpans,
  changePoints,
  fracYear,
  leanSide,
  powerIndex,
  yearsByStatus,
} from "@/lib/timeline-derive";
import type { TimelinePayload } from "@/lib/timeline-types";

const FIRST_YEAR = 1933;
const ROWS = [
  { key: "one", label: "One party", h: 10 },
  { key: "P", label: "President", h: 30 },
  { key: "S", label: "Senate", h: 36 },
  { key: "H", label: "House", h: 36 },
  { key: "C", label: "Court", h: 60 },
] as const;
type RowKey = (typeof ROWS)[number]["key"];

const VB = 1000;
const side = (p: "D" | "R" | "T" | "N" | "O") => (p === "D" ? "var(--dem)" : p === "R" ? "var(--rep)" : "var(--oth)");
/** A party colour mixed toward the card's own background: "held the White House and Congress, not the Court". */
const tint = (p: "D" | "R") => `color-mix(in oklab, ${side(p)} 38%, var(--card-from))`;

/**
 * The homepage's fourth card: a light, compact /timeline. The one-party strip and four rows (President, Senate, House, Court
 * by median lean), no event markers and no filters, plus one headline stat taken from the page's own derive functions
 * (`buildSpans` + `yearsByStatus` in the default Lean measure), so it always matches the chart's lede. Neutral colours, the
 * same structure as `HomeBranchCard`: title across the top, chart and stat on the left, blurb and a link on the right. Each row
 * is its own SVG so the card's draw-in (`.tl-row` in globals.css) can wipe it in from the left.
 */
export function HomeTimelineCard({ data }: { data: TimelinePayload }) {
  const idx = powerIndex(data);
  const spans = buildSpans(idx, changePoints(data), "lean");
  const maxYear = Number(data.today.slice(0, 4));
  const years = yearsByStatus(spans, FIRST_YEAR, maxYear);
  const total = years.all4 + years.tri + years.split;

  const t0 = fracYear(TIMELINE_START);
  const t1 = fracYear(data.today);
  const pos = (iso: string) => Math.max(0, Math.min(VB, ((fracYear(iso) - t0) / (t1 - t0)) * VB));
  const span = (from: string, to: string | null) => {
    const a = pos(from);
    return { x: a, w: Math.max(0, pos(to ?? data.today) - a) };
  };
  const ticks = [1933, 1950, 1970, 1990, 2010].map((y) => ({ y, left: (pos(`${y}-01-01`) / VB) * 100 }));

  const shareRow = (cells: { from: string; to: string; seats: [number, number, number] }[]) =>
    cells.map(({ from, to, seats }) => {
      const { x, w } = span(from, to);
      const tot = seats[0] + seats[1] + seats[2];
      const h = 36;
      const hd = (h * seats[0]) / tot;
      const hr = (h * seats[1]) / tot;
      return (
        <g key={from}>
          <rect x={x} y={0} width={w + 0.4} height={h} fill="var(--oth)" />
          <rect x={x} y={h - hd} width={w + 0.4} height={hd} fill="var(--dem)" />
          <rect x={x} y={0} width={w + 0.4} height={hr} fill="var(--rep)" />
        </g>
      );
    });

  const mid = 30;
  const lean = (v: number) => mid - (Math.max(-1.6, Math.min(1.6, v)) / 1.6) * mid;
  const drawn: Record<RowKey, React.ReactNode> = {
    one: spans
      .filter((s) => s.st.status !== "split")
      .map((s) => {
        const { x, w } = span(s.from, s.to);
        return <rect key={s.from} x={x} y={0} width={w + 0.4} height={10} fill={s.st.status === "all4" ? side(s.st.P) : tint(s.st.P)} />;
      }),
    P: data.presidents.map((p) => {
      const { x, w } = span(p.start, p.end);
      return (
        <g key={p.start}>
          <rect x={x + 0.8} y={0} width={Math.max(0, w - 1.6)} height={30} fill={tint(p.party)} />
          <rect x={x + 0.8} y={0} width={Math.max(0, w - 1.6)} height={3} fill={side(p.party)} />
        </g>
      );
    }),
    S: shareRow(
      data.congresses.flatMap((c) => c.senateMaj.map(([from], i) => ({ from, to: c.senateMaj[i + 1]?.[0] ?? c.end, seats: c.senate }))),
    ),
    H: shareRow(data.congresses.map((c) => ({ from: c.start, to: c.end, seats: c.house }))),
    C: (
      <>
        <rect x={0} y={0} width={VB} height={60} fill="rgba(255,255,255,0.08)" />
        {data.lean.map((l) => {
          const { x, w } = span(`${l[0]}-10-01`, `${l[0] + 1}-10-01`);
          const y = lean(l[1]);
          return <rect key={l[0]} x={x} y={Math.min(mid, y)} width={Math.max(0, w - 0.5)} height={Math.abs(y - mid)} fill={side(leanSide(l))} />;
        })}
        <line x1={0} x2={VB} y1={mid} y2={mid} stroke="var(--ink-faint)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      </>
    ),
  };

  return (
    <section
      data-branch="timeline"
      aria-labelledby="hub-timeline"
      data-home-reveal=""
      className="home-card overflow-hidden rounded-2xl"
    >
      <div className="grid gap-x-11 gap-y-5 p-6 lg:grid-cols-[7fr_5fr] lg:grid-rows-[auto_1fr] lg:p-8 lg:[grid-template-areas:'head_head'_'chart_text']">
        <div className="flex flex-col gap-2 lg:[grid-area:head]">
          <div className="font-mono text-[0.68rem] font-medium uppercase tracking-[0.14em] text-accent">IV · Across the branches</div>
          <h2 id="hub-timeline" className="font-serif text-[2.1rem] font-medium leading-[1.05] tracking-tight">
            <Link href="/timeline" className="home-sweep">
              Who Held Power When It Happened?
            </Link>
          </h2>
        </div>

        <Link
          href="/timeline"
          aria-label="Who Held Power When It Happened?: open the timeline"
          className="relative flex flex-col gap-2 rounded-xl bg-white/10 p-3.5 lg:[grid-area:chart]"
        >
          <div role="img" aria-label={`The presidency, Senate, House and Supreme Court, ${FIRST_YEAR} to ${maxYear}, with the stretches when one party held them all filled in`} className="flex flex-col gap-1.5">
            {ROWS.map(({ key, label, h }, k) => (
              <div key={key} className="grid grid-cols-[3.4rem_1fr] items-center gap-2 sm:grid-cols-[4.6rem_1fr]">
                <span className="text-right font-mono text-[0.62rem] leading-none text-ink-muted sm:text-[0.66rem]">{label}</span>
                <svg
                  viewBox={`0 0 ${VB} ${h}`}
                  preserveAspectRatio="none"
                  width="100%"
                  height={h}
                  aria-hidden="true"
                  className="tl-row block overflow-hidden rounded-[2px]"
                  style={{ "--k": k } as React.CSSProperties}
                >
                  {drawn[key]}
                </svg>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-[3.4rem_1fr] gap-2 sm:grid-cols-[4.6rem_1fr]" aria-hidden="true">
            <span />
            <div className="relative h-3.5 font-mono text-[0.62rem] text-ink-faint">
              {ticks.map((t) => (
                <span key={t.y} className={`absolute top-0 ${t.y === 1950 ? "max-sm:hidden" : ""}`} style={{ left: `${t.left}%`, transform: t.y === FIRST_YEAR ? undefined : "translateX(-50%)" }}>
                  {t.y}
                </span>
              ))}
              <span className="absolute right-0 top-0">now</span>
            </div>
          </div>
          <ul className="mt-0.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[0.62rem] text-ink-muted sm:text-[0.66rem]" aria-hidden="true">
            <li className="flex items-center gap-1.5">
              <i className="inline-block size-2.5 rounded-[2px]" style={{ background: "var(--dem)" }} /> Democratic · liberal Court
            </li>
            <li className="flex items-center gap-1.5">
              <i className="inline-block size-2.5 rounded-[2px]" style={{ background: "var(--rep)" }} /> Republican · conservative Court
            </li>
          </ul>
        </Link>

        <div className="flex flex-col gap-4 lg:[grid-area:text]">
          <p className="text-[0.95rem] leading-relaxed text-ink-muted">
            Every landmark law and Supreme Court case since 1933, set against who held the White House, the Senate, the House and the Court the day it
            happened. Sometimes one party held everything and the big change followed. Just as often it didn&rsquo;t: Roe came from a Court of Republican
            appointees.
          </p>
          <div className="mt-auto flex flex-col gap-1">
            <span className="font-serif text-[2.1rem] font-medium leading-[1.05] tracking-tight text-accent">
              {Math.round(years.all4)} of {Math.round(total)} years
            </span>
            <span className="text-[0.85rem] leading-snug text-ink-muted">
              one party held the White House and Congress with the Court leaning its way, {FIRST_YEAR} to today
            </span>
          </div>
          <Link href="/timeline" className="font-medium text-accent">
            <span className="home-sweep">Explore the timeline</span> <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

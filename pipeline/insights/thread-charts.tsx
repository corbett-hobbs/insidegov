import { ImageResponse } from "next/og";
import type { ReactNode } from "react";
import { ACCENT, Badge, HEIGHT, INK, MUTED, NEUTRAL, SITE_URL, SURFACE, WIDTH, backdropSrc, badgeOf, kickerFor, sealSrc, serifFont } from "./chart";
import { rowValue } from "./research";
import type { Insight } from "./types";

/**
 * The charts in an X and Bluesky thread (thread.ts) that are not the draft's own chart: one 1200x675 card per
 * breakdown block ("What drove it"), drawn in the same frame as the chart card (header, backdrop, source line) so the
 * images sit together in a timeline. The carousel's breakdown slide (carousel.tsx) shows both blocks in one portrait
 * slide; a thread gives each block its own post. Every value is a verified fact (breakdown.ts).
 */

const PAD = 60;
const NAME_W = 250;
const VALUE_W = 190;
const BAR_W = WIDTH - 2 * PAD - NAME_W - VALUE_W;
const ROW_H = 54;
const BACKDROP_H = 270;

type Block = NonNullable<Insight["breakdown"]>["blocks"][number];

function Rows({ insight, block, rowH = ROW_H }: { insight: Insight; block: Block; rowH?: number }) {
  const value = (id: string) => insight.facts.find((f) => f.id === id)!.value as number;
  const vals = block.rows.map((r) => value(r.fact));
  const hi = Math.max(0, ...vals);
  const lo = Math.min(0, ...vals);
  const scale = BAR_W / (hi - lo || 1);
  const zero = -lo * scale;
  const names = block.rows.map((r) => r.name.replace(/\s*\(.*\)\s*$/, ""));
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {block.rows.map((r, i) => {
        const v = vals[i]!;
        const w = Math.max(3, Math.abs(v) * scale);
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", height: rowH }}>
            <div style={{ display: "flex", width: NAME_W, fontFamily: "Newsreader", fontSize: rowH < ROW_H ? 28 : 32, whiteSpace: "nowrap", overflow: "hidden" }}>{names[i]}</div>
            <div style={{ display: "flex", position: "relative", width: BAR_W, height: rowH }}>
              <div style={{ position: "absolute", left: zero, top: 0, width: 1.5, height: rowH, background: MUTED, display: "flex" }} />
              <div style={{ position: "absolute", left: v < 0 ? zero - w : zero, top: Math.round((rowH - 28) / 2), width: w, height: 28, borderRadius: 3, background: v < 0 ? NEUTRAL : ACCENT, display: "flex" }} />
            </div>
            <div style={{ display: "flex", width: VALUE_W, justifyContent: "flex-end", fontSize: 28, color: INK }}>{rowValue(insight, r.fact)}</div>
          </div>
        );
      })}
      {block.total ? (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28, color: INK, marginTop: 10, paddingTop: 10, borderTop: `1.5px solid ${NEUTRAL}` }}>
          <div style={{ display: "flex" }}>{block.total.name}</div>
          <div style={{ display: "flex" }}>{rowValue(insight, block.total.fact)}</div>
        </div>
      ) : null}
    </div>
  );
}

function Card({ insight, blocks, backdrop }: { insight: Insight; blocks: Block[]; backdrop: string }): ReactNode {
  // Several blocks on one card (levels) are set tighter.
  const rowH = blocks.length > 1 ? 40 : ROW_H;
  const b = insight.breakdown!;
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", position: "relative", background: SURFACE, color: INK, padding: `28px ${PAD}px 0 ${PAD}px` }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse, not a page */}
      <img src={backdrop} width={WIDTH} height={BACKDROP_H} alt="" style={{ position: "absolute", top: 0, left: 0 }} />
      <div style={{ display: "flex", alignItems: "center", fontSize: 18, letterSpacing: 3, color: MUTED, textTransform: "uppercase" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse, not a page */}
        <img src={sealSrc()} width={42} height={42} alt="" style={{ marginRight: 12 }} />
        <div style={{ display: "flex", fontFamily: "Newsreader", fontSize: 32, letterSpacing: -0.5, color: INK, textTransform: "none", marginRight: 18 }}>InsideGov</div>
        {kickerFor(insight)}
        <Badge {...badgeOf(insight)} size={19} />
      </div>
      <div style={{ display: "flex", fontFamily: "Newsreader", fontSize: 46, lineHeight: 1.12, letterSpacing: -0.5, marginTop: 10 }}>{b.title}</div>
      {blocks.map((block, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 19, letterSpacing: 2.5, textTransform: "uppercase", color: MUTED, marginTop: i === 0 ? 16 : 12, marginBottom: 8 }}>{block.label}</div>
          <Rows insight={insight} block={block} rowH={rowH} />
        </div>
      ))}
      <div style={{ position: "absolute", left: PAD, right: PAD, top: HEIGHT - 76, display: "flex", fontSize: 16, lineHeight: 1.35, color: MUTED }}>{b.note}</div>
      <div style={{ position: "absolute", left: PAD, right: PAD, top: HEIGHT - 32, display: "flex", justifyContent: "flex-end", fontSize: 18, color: INK }}>{`${SITE_URL.replace(/^https?:\/\//, "")}${insight.url}`}</div>
    </div>
  );
}

/** One PNG per breakdown block, in the block order (the replies' `chart` index). */
export async function renderBreakdownCharts(insight: Insight): Promise<Buffer[]> {
  const b = insight.breakdown;
  if (!b) return [];
  const serif = serifFont();
  const backdrop = await backdropSrc(insight.url, WIDTH, BACKDROP_H);
  const out: Buffer[] = [];
  // Levels are one card for every block; a change breakdown is one card per block.
  for (const blocks of b.levels ? [b.blocks] : b.blocks.map((blk) => [blk])) {
    const res = new ImageResponse(<Card insight={insight} blocks={blocks} backdrop={backdrop} />, { width: WIDTH, height: HEIGHT, fonts: [{ name: "Newsreader", data: serif, weight: 500, style: "normal" }] });
    out.push(Buffer.from(await res.arrayBuffer()));
  }
  return out;
}

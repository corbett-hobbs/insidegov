"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { scaleLinear } from "d3-scale";
import { ChartCard } from "@/components/charts/ChartCard";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { DotCardTooltips, useDotCard } from "@/components/charts/Tooltip";
import { MethodologyNote } from "@/components/MethodologyNote";
import { SourceLink } from "@/components/SourceLink";
import { fmtScore, partyLabel } from "@/lib/court-types";
import { layoutStrip, STRIP_GEOMETRY, type Box } from "@/lib/court-strip-layout";
import type { BenchJustice, BenchRole } from "@/lib/decision-page-types";
import { useElementWidth } from "@/lib/use-element-width";

const FALLBACK_W = 640;
const { height: H, axisY, dotR, labelH, fontSize, padX } = STRIP_GEOMETRY;
const textWidth = (s: string) => s.length * 7.0;
const partyVar = (p: "D" | "R") => (p === "D" ? "var(--dem)" : "var(--rep)");
const LINK = "text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/** Majority-opinion author first, then concurrence or dissent writers, then justices who joined without writing. */
const ROLE_RANK: Record<BenchRole, number> = { 1: 0, 2: 1, 3: 1, 4: 2, 0: 2 };
const VOTE_WORD = { 0: "Did not take part", 1: "In the majority", 2: "In dissent", 3: "Equally divided Court" } as const;
const ROLE_TEXT: Record<BenchRole, string | null> = { 0: null, 1: "Wrote the majority opinion", 2: "Wrote a concurrence", 3: "Wrote a dissent", 4: "Joined the majority" };

/** What a justice wrote, or which side they joined without writing. */
const roleText = (j: BenchJustice): string => ROLE_TEXT[j.role] ?? (j.vote === 1 ? "Joined the majority" : j.vote === 2 ? "Joined a dissent" : VOTE_WORD[j.vote]);

function Face({ j }: { j: BenchJustice }) {
  return j.photoSrc ? (
    // A pre-sized static portrait from public/, as on the justice pages.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={j.photoSrc} alt="" width={20} height={24} className="h-6 w-5 flex-none rounded-[3px] bg-surface object-cover object-top" />
  ) : (
    <span aria-hidden className="h-6 w-5 flex-none" />
  );
}

function SideList({ title, justices, filled, onHover }: { title: string; justices: readonly BenchJustice[]; filled: boolean; onHover: (id: number | null) => void }) {
  return (
    <div className="min-w-0 lg:w-[16rem] lg:flex-none">
      <h3 className="m-0 mb-1.5 flex items-center gap-1.5 text-[0.85rem] font-medium text-ink">
        <i aria-hidden className={`inline-block size-2.5 rounded-full ${filled ? "bg-ink" : "border-[1.5px] border-ink"}`} />
        {title}
        <span className="font-normal tabular-nums text-ink-muted">{`(${justices.length})`}</span>
      </h3>
      <ul className="m-0 list-none rounded-md border border-line bg-surface p-0" onPointerLeave={() => onHover(null)}>
        {justices.length === 0 && <li className="px-3 py-2 text-[0.82rem] text-ink-muted">None.</li>}
        {justices.map((j) => (
          <li
            key={j.id}
            className="flex items-center gap-x-2 border-b border-line px-3 py-1.5 text-[0.82rem] last:border-b-0 hover:bg-surface-raised"
            onPointerEnter={() => onHover(j.id)}
            onFocus={() => onHover(j.id)}
            onBlur={() => onHover(null)}
          >
            <Face j={j} />
            <span className="min-w-0 flex-1">
              <Link href={j.path} className={LINK}>
                {j.name}
              </Link>
              {j.vote !== 3 && <span className="block text-[0.75rem] text-ink-muted">{roleText(j)}</span>}
            </span>
            <i aria-hidden className="inline-block size-2 flex-none rounded-full" style={{ background: partyVar(j.party) }} title={`Appointed by ${j.appointedBy} (${partyLabel(j.party)})`} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * "How the justices voted": the bench on the Martin-Quinn axis for the case's term, one dot per justice in the appointing
 * president's party colour, filled for the majority and hollow for a dissent (a justice who sat out is not drawn), with the
 * Court's median. Beside it on desktop, under it on a phone: the majority and the dissent, each justice with what they wrote, writers first.
 * The strip is the Court page's layout (`lib/court-strip-layout.ts`), so labels never drop.
 */
export function BenchCard({
  bench,
  median,
  domain,
  term,
  maj,
  min,
  provisional,
}: {
  bench: readonly BenchJustice[];
  median: number | null;
  domain: [number, number];
  term: number;
  maj: number;
  min: number;
  provisional: { source: string; url: string; published: string } | null;
}) {
  const scoreWord = provisional ? `provisional Martin–Quinn ideology score for the ${term} term` : `Martin–Quinn ideology score for the ${term} term`;
  const [wrapRef, measuredW] = useElementWidth<HTMLDivElement>();
  const W = measuredW || FALLBACK_W;
  const router = useRouter();
  // A click or tap on a seat pins the justice's card; the card links to their profile (ARCHITECTURE_MAP 10t).
  const card = useDotCard<BenchJustice>((a, b) => a.id === b.id);
  const [hoverId, setHoverId] = useState<number | null>(null);
  const divided = bench.some((j) => j.vote === 3);
  // Lists rank by what each justice wrote (opinion author, then separate writers, then those who joined); ties keep the
  // bench's liberal-to-conservative order (Array.sort is stable).
  const majority = bench.filter((j) => j.vote === 1).sort((a, b) => ROLE_RANK[a.role] - ROLE_RANK[b.role]);
  const dissent = bench.filter((j) => j.vote === 2).sort((a, b) => ROLE_RANK[a.role] - ROLE_RANK[b.role]);
  const tookPart = bench.filter((j) => j.vote === 3);
  const out = bench.filter((j) => j.vote === 0);
  const plotted = useMemo(() => bench.filter((j) => j.vote !== 0 && j.score !== null), [bench]);

  const { layout, medianX } = useMemo(() => {
    const x = scaleLinear().domain(domain).range([padX, W - padX]);
    const mx = median === null ? -999 : x(median);
    const fixed: Box[] = [
      ...(median === null ? [] : [{ x0: mx - 26, x1: mx + 26, y0: 0, y1: 16 }]),
      { x0: padX, x1: padX + 76, y0: H - 19, y1: H },
      { x0: W - padX - 108, x1: W - padX, y0: H - 19, y1: H },
    ];
    const items = plotted.map((j) => ({ id: j.id, x: x(j.score as number), label: j.short }));
    return { medianX: mx, layout: layoutStrip(items, { width: W, height: H, axisY, dotR, labelH, medianX: mx, fixed, textWidth }) };
  }, [plotted, domain, median, W]);

  const byId = new Map(bench.map((j) => [j.id, j]));
  const labelFor = new Map(layout.labels.map((l) => [l.id, l]));
  const mClamped = Math.max(26, Math.min(W - 26, medianX));
  const filled = (j: BenchJustice) => j.vote === 1 || j.vote === 3;

  return (
    <ChartCard
      title="How the justices voted"
      lede={
        divided
          ? `The Court split evenly, ${maj}–${min}, which leaves the lower court’s decision in place without an opinion. Each justice who took part is placed by their ${scoreWord}.`
          : `Each justice who took part, placed by their ${scoreWord}. Filled: the ${majority.length} in the majority. Hollow: the ${dissent.length} in dissent. Colour is the party of the president who appointed them.`
      }
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-x-5">
        <div ref={wrapRef} className="min-w-0 lg:flex-1">
          {plotted.length > 0 ? (
            <ChartFrame width={W} height={H} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} ariaLabel={`The justices in the ${term} term on a liberal to conservative axis, filled for the majority and hollow for a dissent`} svgProps={{ style: { height: H } }}>
              {() => (
                <>
                  <line x1={padX} x2={W - padX} y1={axisY} y2={axisY} stroke="var(--line-strong)" strokeWidth={1.5} />
                  <text x={padX} y={H - 6} fill="var(--ink-muted)" fontSize={12}>
                    More liberal
                  </text>
                  <text x={W - padX} y={H - 6} fill="var(--ink-muted)" fontSize={12} textAnchor="end">
                    More conservative
                  </text>
                  {median !== null && (
                    <>
                      <line x1={medianX} x2={medianX} y1={20} y2={H - 30} stroke="var(--ink)" strokeDasharray="3 3" strokeWidth={1} opacity={0.55} />
                      <text x={mClamped} y={12} textAnchor="middle" fill="var(--ink)" fontSize={12} fontWeight={600}>
                        Median
                      </text>
                    </>
                  )}
                  <g>
                    {layout.dots.map((d) => {
                      const j = byId.get(d.id)!;
                      const l = labelFor.get(d.id);
                      if (!l) return null;
                      let leader: React.ReactNode = null;
                      if (l.ring > 0) {
                        const ex = Math.max(l.box.x0, Math.min(l.box.x1, d.cx));
                        const ey = Math.max(l.box.y0, Math.min(l.box.y1, d.cy));
                        const dx = ex - d.cx;
                        const dy = ey - d.cy;
                        const len = Math.hypot(dx, dy) || 1;
                        leader = <line x1={d.cx + (dx / len) * (dotR + 1)} y1={d.cy + (dy / len) * (dotR + 1)} x2={ex} y2={ey} stroke="var(--line-strong)" strokeWidth={1} />;
                      }
                      return (
                        <g key={j.id}>
                          {leader}
                          <text x={l.tx} y={l.ty} textAnchor={l.anchor} fill="var(--ink)" fontSize={fontSize} fontWeight={hoverId === j.id || filled(j) ? 600 : 400}>
                            {j.short}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                  <g>
                    {layout.dots.map((d) => {
                      const j = byId.get(d.id)!;
                      const on = filled(j);
                      return (
                        <g
                          key={j.id}
                          className="court-dot"
                          style={{ cursor: "pointer" }}
                          tabIndex={0}
                          role="button"
                          aria-label={`${j.name}, ${VOTE_WORD[j.vote]}, score ${fmtScore(j.score as number)}`}
                          {...card.bind(j)}
                          onPointerEnter={(e) => {
                            card.bind(j).onPointerEnter(e);
                            setHoverId(j.id);
                          }}
                          onPointerLeave={() => {
                            card.leave();
                            setHoverId(null);
                          }}
                          onKeyDown={card.onKey(j)}
                        >
                          {(hoverId === j.id || card.pinned?.data.id === j.id) && <circle cx={d.cx} cy={d.cy} r={dotR + 5} fill="none" stroke="var(--accent)" strokeWidth={2.5} />}
                          <circle cx={d.cx} cy={d.cy} r={dotR} fill={on ? partyVar(j.party) : "var(--surface)"} stroke={on ? "var(--surface)" : partyVar(j.party)} strokeWidth={on ? 1.5 : 2.5} />
                        </g>
                      );
                    })}
                  </g>
                </>
              )}
            </ChartFrame>
          ) : (
            <p className="m-0 py-6 text-[0.85rem] text-ink-muted">No Martin–Quinn scores for this term.</p>
          )}
          <DotCardTooltips card={card} onActivate={(j) => router.push(j.path)}>
            {(j) => (
              <>
                <b>{j.name}</b>
                <div>
                  Appointed by {j.appointedBy} ({partyLabel(j.party)})
                </div>
                <div>{roleText(j)}</div>
                {j.score !== null && <div className="tt-mono">{`Score ${term}${provisional ? " (provisional)" : ""}: ${fmtScore(j.score)}`}</div>}
              </>
            )}
          </DotCardTooltips>
        </div>
        {divided ? (
          <SideList title="Took part" justices={tookPart} filled onHover={setHoverId} />
        ) : (
          <>
            <SideList title="Majority" justices={majority} filled onHover={setHoverId} />
            <SideList title="Dissent" justices={dissent} filled={false} onHover={setHoverId} />
          </>
        )}
      </div>
      {out.length > 0 && (
        <p className="m-0 mt-3 text-[0.82rem] text-ink-muted">
          {"Did not take part: "}
          {out.map((j, i) => (
            <span key={j.id}>
              {i > 0 ? ", " : ""}
              <Link href={j.path} className={LINK}>
                {j.name}
              </Link>
            </span>
          ))}
          .
        </p>
      )}
      <MethodologyNote>
        <p>
          Each justice’s vote and what they wrote are from the justice-centered file of the <SourceLink id="scdb">Supreme Court Database</SourceLink>. “Wrote a concurrence” means the justice sided with the majority and wrote separately; a justice who dissented in part is counted on the side they took overall, and one who agreed with the result but not the reasoning counts in the majority. A justice who wrote nothing is listed as joining their side.
        </p>
        <p>
          Positions are each justice’s <SourceLink id="martin-quinn">Martin–Quinn score</SourceLink> for the case’s term{provisional ? "" : ", the same scores as the Ideology page"}: negative is more liberal, positive more conservative. A score sums up a justice’s votes across the whole term, so it says where they usually sit, not why they voted as they did here. The median line is the Court’s median justice that term.
        </p>
        {provisional && (
          <p>
            <b>The {term} scores are provisional.</b> The official Martin–Quinn release does not cover this term yet, so the scores are copied from <SourceLink href={provisional.url}>{provisional.source}</SourceLink>, published {provisional.published}. They will be replaced by the official scores when those come out, and may change. The median line is the middle of these nine scores.
          </p>
        )}
      </MethodologyNote>
    </ChartCard>
  );
}

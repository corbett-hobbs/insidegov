"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChartCard } from "@/components/charts/ChartCard";
import { PillGroup } from "@/components/charts/PillGroup";
import { ScatterPlot } from "@/components/charts/ScatterPlot";
import { CompassPanel } from "@/components/senate/CompassPanel";
import { MethodologyNote } from "@/components/MethodologyNote";
import type { LawChamberVotesView, LawVoter } from "@/lib/law-votes-types";
import { partyFillClass } from "@/lib/party-palette";
import { MemberFace, MemberPhoto } from "@/components/MemberPhoto";
import { Dot, LINK } from "./LawPeople";

const CAST_WORD = { yea: "Voted yea", nay: "Voted nay", present: "Voted present", absent: "Did not vote", none: "Not recorded on this vote" } as const;

const group = (v: LawVoter) => (v.side === "D" ? "dem" : v.side === "R" ? "rep" : "other");

/** One list row; also rendered invisibly (see `VoterList`) so the lists keep one width across chambers. */
function VoterRow({ v, linked = true }: { v: LawVoter; linked?: boolean }) {
  return (
    <>
      <MemberFace bioguideId={v.id} hasPhoto={v.hasPhoto} current={v.path !== null} />
      {v.path && linked ? (
        <Link href={v.path} className={LINK}>
          {v.name}
        </Link>
      ) : (
        <span className="text-ink">{v.name}</span>
      )}
      <span className="text-ink-faint">{v.label}</span>
    </>
  );
}

const ROW = "flex items-center gap-x-2 whitespace-nowrap border-b border-line px-3 py-1.5 text-[0.82rem] last:border-b-0";

/**
 * One party's yea voters, a capped, scrollable list in compass order (most liberal first). `sizers` are the same party's voters in the
 * other chamber(s): drawn invisibly at zero height so the list is as wide as the widest of them and does not resize on the House / Senate toggle.
 */
function VoterList({ title, side, voters, sizers, onHover }: { title: string; side: "D" | "R"; voters: readonly LawVoter[]; sizers: readonly LawVoter[]; onHover: (id: string | null) => void }) {
  return (
    <div className="flex min-h-0 min-w-0 flex-col lg:h-[var(--plot-h)] lg:flex-none">
      <h3 className="m-0 mb-1.5 flex items-center gap-1.5 text-[0.85rem] font-medium text-ink">
        <Dot party={side} />
        {title}
        <span className="font-normal tabular-nums text-ink-muted">{`(${voters.length})`}</span>
      </h3>
      <ul
        tabIndex={0}
        aria-label={`${title}, scrollable`}
        onPointerLeave={() => onHover(null)}
        className="touch-scroll m-0 max-h-64 min-h-0 list-none overflow-y-auto overscroll-contain rounded-md border border-line bg-surface p-0 lg:max-h-none lg:flex-1"
      >
        {voters.length === 0 && <li className="px-3 py-2 text-[0.82rem] text-ink-muted">None.</li>}
        {voters.map((v) => (
          <li key={v.id} className={`${ROW} hover:bg-surface-raised`} onPointerEnter={() => onHover(v.id)} onFocus={() => onHover(v.id)} onBlur={() => onHover(null)}>
            <VoterRow v={v} />
          </li>
        ))}
        <li aria-hidden className="pointer-events-none invisible block h-0 overflow-hidden">
          {sizers.map((v) => (
            <div key={v.id} className={ROW}>
              <VoterRow v={v} linked={false} />
            </div>
          ))}
        </li>
      </ul>
    </div>
  );
}

/**
 * "Who voted for it": the chamber's ideology compass for the law's Congress with the members who voted yea on final passage highlighted
 * and everyone else faded, then two capped, scrollable lists of the yea voters stacked to its right on desktop (Democrats above Republicans), below it on a phone. A
 * House / Senate toggle appears when both chambers have a recorded member vote.
 */
export function LawVotesCard({ chambers, congressLabel }: { chambers: readonly LawChamberVotesView[]; congressLabel: string }) {
  const router = useRouter();
  const [which, setWhich] = useState<"House" | "Senate">(chambers[0]!.chamber);
  const view = chambers.find((c) => c.chamber === which) ?? chambers[0]!;
  const yea = useMemo(() => view.voters.filter((v) => v.cast === "yea"), [view]);
  const dem = yea.filter((v) => v.side === "D");
  const rep = yea.filter((v) => v.side === "R");
  const other = yea.length - dem.length - rep.length;
  const nay = view.voters.filter((v) => v.cast === "nay").length;
  const rest = view.voters.filter((v) => v.cast !== "yea" && v.cast !== "nay" && v.cast !== "none").length;
  const plotted = useMemo(() => view.voters.filter((v) => v.dim1 !== null && v.dim2 !== null), [view]);
  const [hoverId, setHoverId] = useState<string | null>(null);
  // The other chamber(s)' yea voters by party, so each list keeps the width of its widest chamber.
  const otherYea = (side: "D" | "R") => chambers.filter((c) => c !== view).flatMap((c) => c.voters.filter((v) => v.cast === "yea" && v.side === side));
  const yeaIds = useMemo(() => yea.map((v) => v.id), [yea]);
  const plotRef = useRef<HTMLDivElement>(null);
  const [plotH, setPlotH] = useState<number | null>(null);
  // The party lists end level with the bottom of the plot itself (not the axis captions under it); the compass keeps its aspect ratio as it widens.
  useEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    const measure = () => {
      const svg = el.querySelector("svg[aria-label^='Scatter']");
      if (svg) setPlotH(svg.getBoundingClientRect().bottom - el.getBoundingClientRect().top);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [which]);
  const noun = view.chamber === "House" ? "representatives" : "senators";
  return (
    <ChartCard
      title="Who voted for it"
      lede={`Every ${view.chamber === "House" ? "House member" : "senator"} of the ${congressLabel} Congress on the ideology compass. Highlighted: the ${yea.length} who voted yea on final passage. Faded: everyone else, including those who voted nay, did not vote, or had not yet taken office.`}
      action={
        chambers.length > 1 ? (
          <PillGroup ariaLabel="Chamber" value={which} onChange={setWhich} options={chambers.map((c) => ({ value: c.chamber, label: c.chamber }))} />
        ) : undefined
      }
    >
      <p className="m-0 mb-3 flex flex-wrap gap-x-5 gap-y-1 text-[0.85rem] text-ink-muted">
        <span>
          <span className="font-medium tabular-nums text-ink">{yea.length}</span> yea
        </span>
        <span>
          <span className="font-medium tabular-nums text-ink">{nay}</span> nay
        </span>
        {rest > 0 && (
          <span>
            <span className="font-medium tabular-nums text-ink">{rest}</span> present or did not vote
          </span>
        )}
      </p>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-x-5" style={plotH ? ({ "--plot-h": `${plotH}px` } as React.CSSProperties) : undefined}>
        <div ref={plotRef} className="min-w-0 lg:flex-1">
          <CompassPanel congress={Number.parseInt(congressLabel, 10)}>
            <ScatterPlot<LawVoter>
              points={plotted}
              ariaLabel={`Scatter plot of ${noun} by DW-NOMINATE ideology score; those who voted yea are highlighted`}
              width={640}
              height={520}
              margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
              x={(v) => v.dim1 as number}
              y={(v) => v.dim2 as number}
              id={(v) => v.id}
              colorClass={(v) => partyFillClass({ partyCode: v.partyCode, group: group(v) })}
              radius={(_v, s) => (s.highlighted ? 5.2 : 3.6)}
              highlightedIds={yeaIds}
              ringId={hoverId}
              dimUnfocused
              isSelectable={(v) => v.path !== null}
              onSelect={(v) => v.path && router.push(v.path)}
              selectHint="Open profile →"
              renderTooltip={(v) => (
                <div className="tt-body">
                  {(v.hasPhoto || v.path !== null) && <MemberPhoto key={v.id} bioguideId={v.id} hasPhoto={v.hasPhoto} size="small" className="tt-photo" />}
                  <div>
                    <b>{v.name}</b>
                    <br />
                    {v.label}
                    <br />
                    <span className="tt-mono">{CAST_WORD[v.cast]}</span>
                  </div>
                </div>
              )}
              zoomable
            />
          </CompassPanel>
        </div>
        <VoterList title="Democrats who voted yea" side="D" voters={dem} sizers={otherYea("D")} onHover={setHoverId} />
        <VoterList title="Republicans who voted yea" side="R" voters={rep} sizers={otherYea("R")} onHover={setHoverId} />
      </div>
      <MethodologyNote>
        <p>
          {`The ${view.chamber}’s recorded vote on the final version of the law (roll call ${view.roll} in Voteview), matched to the vote the record cites and checked against its totals. `}
          Positions are each member’s DW-NOMINATE score for that Congress, as on the Ideology page; left to right is more liberal to more conservative. Paired and announced yea votes count as yea. Lists follow the compass, most liberal first.
          {other > 0 ? ` ${other} yea vote${other === 1 ? " was" : "s were"} cast by members of neither major party and ${other === 1 ? "is" : "are"} highlighted on the compass but not listed.` : ""} A name links to a profile only for members of the current Congress. A law passed by voice vote or unanimous consent has no member list, and neither does a vote Voteview has not yet recorded.
        </p>
      </MethodologyNote>
    </ChartCard>
  );
}

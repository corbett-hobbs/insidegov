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
import { SourceLink } from "@/components/SourceLink";

const CAST_WORD = { yea: "Voted yea", nay: "Voted nay", present: "Voted present", absent: "Did not vote", none: "Not recorded on this vote" } as const;

/** The three ways to look at the vote: yea, nay, or everyone who was present or did not vote (the counts in the card's header are the control). */
type Show = "yea" | "nay" | "rest";

const inShow = (v: LawVoter, show: Show) => (show === "rest" ? v.cast === "present" || v.cast === "absent" : v.cast === show);

/** The phrase a list title and the lede use for each: "Democrats who voted yea", "Democrats who were present or did not vote". */
const SHOW_PHRASE: Record<Show, string> = { yea: "who voted yea", nay: "who voted nay", rest: "who were present or did not vote" };
/** The shorter form for a list title, so a long one never makes the list wider than its rows. */
const TITLE_PHRASE: Record<Show, string> = { ...SHOW_PHRASE, rest: "present or absent" };

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

/**
 * One of the three vote tiles above the lists, in the site's tile style (rule 10p, as `committee/legislation/StageTiles`): serif count, name, share of the
 * chamber and a share bar under a 3px top edge. It is a toggle button; the picked tile takes an ink outline. Yea, nay and not voting reuse the amendments card's agreed (green), rejected (rose) and withdrawn (amber) colours:
 * outcome colours, never party red and blue, which belong to the lists and the compass.
 */
function VoteTile({ count, total, label, short, color, on, onClick }: { count: number; total: number; label: string; short?: string; color: string; on: boolean; onClick: () => void }) {
  const share = total > 0 ? count / total : 0;
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`min-w-0 flex-1 rounded-md border border-t-[3px] px-2.5 pb-1.5 pt-1 text-left hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${on ? "border-ink bg-surface-raised shadow-[inset_0_0_0_1px_var(--ink)]" : "border-line bg-surface"}`}
      style={{ borderTopColor: color }}
    >
      <span className="block font-serif text-[1.1rem] font-medium leading-[1.15] tabular-nums">{count}</span>
      <span className="block truncate text-[0.72rem] leading-tight text-ink">
        {short ? (
          <>
            <span className="sm:hidden">{short}</span>
            <span className="max-sm:hidden">{label}</span>
          </>
        ) : (
          label
        )}
      </span>
      <span className="mt-px block text-[0.66rem] tabular-nums text-ink-muted">{`${(share * 100).toFixed(share > 0 && share < 0.1 ? 1 : 0)}%`}</span>
      <span aria-hidden className="mt-1 block h-1 overflow-hidden rounded-sm bg-line">
        <i className="block h-full" style={{ width: `${count > 0 ? Math.max(share * 100, 2) : 0}%`, background: color }} />
      </span>
    </button>
  );
}

const ROW = "flex items-center gap-x-2 whitespace-nowrap border-b border-line px-3 py-1.5 text-[0.82rem] last:border-b-0";

/**
 * One party's voters for the vote shown (yea, nay, or present / did not vote), a capped, scrollable list in compass order (most liberal first). `sizers` are the party's widest row across chambers and views:
 * drawn invisibly at zero height so the list is as wide as the widest of them and does not resize when the card is toggled.
 */
function VoterList({ title, side, voters, sizers, onHover }: { title: string; side: "D" | "R"; voters: readonly LawVoter[]; sizers: readonly LawVoter[]; onHover: (id: string | null) => void }) {
  return (
    <div className="flex min-h-0 min-w-0 flex-col lg:flex-none">
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
 * "Who voted for it": the chamber's ideology compass for the law's Congress with the members who voted yea (or, by the toggle, nay or present / did not vote) on final passage highlighted
 * and everyone else faded, then two capped, scrollable lists of those members stacked to its right on desktop (Democrats above Republicans), below it on a phone. A
 * House / Senate toggle appears when both chambers have a recorded member vote.
 */
export function LawVotesCard({ chambers, congressLabel }: { chambers: readonly LawChamberVotesView[]; congressLabel: string }) {
  const router = useRouter();
  const [which, setWhich] = useState<"House" | "Senate">(chambers[0]!.chamber);
  const view = chambers.find((c) => c.chamber === which) ?? chambers[0]!;
  const [pick, setPick] = useState<Show>("yea");
  const counts = useMemo(() => ({ yea: view.voters.filter((v) => inShow(v, "yea")).length, nay: view.voters.filter((v) => inShow(v, "nay")).length, rest: view.voters.filter((v) => inShow(v, "rest")).length }), [view]);
  const voteTotal = counts.yea + counts.nay + counts.rest;
  // "Present or did not vote" is offered only where someone is in it; a chamber without it falls back to yea.
  const show: Show = pick === "rest" && counts.rest === 0 ? "yea" : pick;
  const shown = useMemo(() => view.voters.filter((v) => inShow(v, show)), [view, show]);
  const dem = shown.filter((v) => v.side === "D");
  const rep = shown.filter((v) => v.side === "R");
  const other = shown.length - dem.length - rep.length;
  const plotted = useMemo(() => view.voters.filter((v) => v.dim1 !== null && v.dim2 !== null), [view]);
  const [hoverId, setHoverId] = useState<string | null>(null);
  // The longest row (name and label) of each party across both chambers and all three views, so the lists keep one width however the card is toggled.
  const widest = useMemo(() => {
    const pick = (side: "D" | "R") => {
      const rows = chambers.flatMap((c) => c.voters.filter((v) => v.side === side && v.cast !== "none"));
      return rows.length ? [rows.reduce((a, b) => (b.name.length + b.label.length > a.name.length + a.label.length ? b : a))] : [];
    };
    return { D: pick("D"), R: pick("R") };
  }, [chambers]);
  const shownIds = useMemo(() => shown.map((v) => v.id), [shown]);
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
      lede={`Every ${view.chamber === "House" ? "House member" : "senator"} of the ${congressLabel} Congress on the ideology compass. Highlighted: the ${shown.length} ${SHOW_PHRASE[show]} on final passage. Faded: everyone else${show === "yea" ? ", including those who voted nay, did not vote, or had not yet taken office" : show === "nay" ? ", including those who voted yea, did not vote, or had not yet taken office" : ", including those who voted yea or nay or had not yet taken office"}.`}
      action={
        chambers.length > 1 ? (
          <PillGroup ariaLabel="Chamber" value={which} onChange={setWhich} options={chambers.map((c) => ({ value: c.chamber, label: c.chamber }))} />
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-x-5" style={plotH ? ({ "--plot-h": `${plotH}px` } as React.CSSProperties) : undefined}>
        <div ref={plotRef} className="min-w-0 lg:flex-1">
          <CompassPanel congress={Number.parseInt(congressLabel, 10)}>
            <ScatterPlot<LawVoter>
              points={plotted}
              ariaLabel={`Scatter plot of ${noun} by DW-NOMINATE ideology score; those who ${SHOW_PHRASE[show].replace("who ", "")} are highlighted`}
              width={640}
              height={520}
              margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
              x={(v) => v.dim1 as number}
              y={(v) => v.dim2 as number}
              id={(v) => v.id}
              colorClass={(v) => partyFillClass({ partyCode: v.partyCode, group: group(v) })}
              radius={(_v, s) => (s.highlighted ? 5.2 : 3.6)}
              highlightedIds={shownIds}
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
        <div className="flex min-h-0 min-w-0 flex-col gap-3 lg:h-[var(--plot-h)] lg:flex-none">
          <div>
            <div className="mb-1.5">
              <span className="font-mono text-[0.62rem] uppercase tracking-[0.06em] text-ink-faint">Vote on final passage</span>
            </div>
            <div role="group" aria-label="Which votes to show" className="flex gap-2">
              <VoteTile count={counts.yea} total={voteTotal} label="Yea" color="var(--topic-energy_environment)" on={show === "yea"} onClick={() => setPick("yea")} />
              <VoteTile count={counts.nay} total={voteTotal} label="Nay" color="var(--topic-health_education)" on={show === "nay"} onClick={() => setPick("nay")} />
              {counts.rest > 0 && <VoteTile count={counts.rest} total={voteTotal} label="Present or did not vote" short="Not voting" color="var(--topic-economy_labor)" on={show === "rest"} onClick={() => setPick("rest")} />}
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:gap-x-5">
            <VoterList title={`Democrats ${TITLE_PHRASE[show]}`} side="D" voters={dem} sizers={widest.D} onHover={setHoverId} />
            <VoterList title={`Republicans ${TITLE_PHRASE[show]}`} side="R" voters={rep} sizers={widest.R} onHover={setHoverId} />
          </div>
        </div>
      </div>
      <MethodologyNote>
        <p>
          {`The ${view.chamber}’s recorded vote on the final version of the law (roll call ${view.roll} in `}<SourceLink id="voteview">Voteview</SourceLink>{`), matched to the vote the record cites and checked against its totals. `}
          Positions are each member’s DW-NOMINATE score for that Congress, as on the Ideology page; left to right is more liberal to more conservative. Paired and announced yea votes count as yea. The counts above the compass switch it between yea, nay, and members who were present or did not vote (including any who had not yet taken office or left it that year). Lists follow the compass, most liberal first.
          {other > 0 ? ` ${other} ${other === 1 ? "member" : "members"} of neither major party ${other === 1 ? "is" : "are"} among those highlighted on the compass but not listed.` : ""} A name links to a profile only for members of the current Congress. A law passed by voice vote or unanimous consent has no member list, and neither does a vote Voteview has not yet recorded.
        </p>
      </MethodologyNote>
    </ChartCard>
  );
}

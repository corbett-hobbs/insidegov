"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ChartCard } from "@/components/charts/ChartCard";
import { PillGroup } from "@/components/charts/PillGroup";
import { ScatterPlot } from "@/components/charts/ScatterPlot";
import { CompassPanel } from "@/components/senate/CompassPanel";
import { MethodologyNote } from "@/components/MethodologyNote";
import type { LawChamberVotesView, LawVoter } from "@/lib/law-votes-types";
import { partyFillClass } from "@/lib/party-palette";
import { Dot, LINK } from "./LawPeople";

const CAST_WORD = { yea: "Voted yea", nay: "Voted nay", present: "Voted present", absent: "Did not vote", none: "Not recorded on this vote" } as const;

const group = (v: LawVoter) => (v.side === "D" ? "dem" : v.side === "R" ? "rep" : "other");

/** One party's yea voters, a capped, scrollable list in compass order (most liberal first). */
function VoterList({ title, side, voters }: { title: string; side: "D" | "R"; voters: readonly LawVoter[] }) {
  return (
    <div className="min-w-0">
      <h3 className="m-0 mb-1.5 flex items-center gap-1.5 text-[0.85rem] font-medium text-ink">
        <Dot party={side} />
        {title}
        <span className="font-normal tabular-nums text-ink-muted">{`(${voters.length})`}</span>
      </h3>
      <ul tabIndex={0} aria-label={`${title}, scrollable`} className="touch-scroll m-0 max-h-64 list-none overflow-y-auto overscroll-contain rounded-md border border-line bg-surface p-0">
        {voters.length === 0 && <li className="px-3 py-2 text-[0.82rem] text-ink-muted">None.</li>}
        {voters.map((v) => (
          <li key={v.id} className="flex flex-wrap items-center gap-x-2 border-b border-line px-3 py-1.5 text-[0.82rem] last:border-b-0">
            {v.path ? (
              <Link href={v.path} className={LINK}>
                {v.name}
              </Link>
            ) : (
              <span className="text-ink">{v.name}</span>
            )}
            <span className="text-ink-faint">{v.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * "Who voted for it": the chamber's ideology compass for the law's Congress with the members who voted yea on final passage highlighted
 * and everyone else faded, then two capped, scrollable lists of the yea voters, Democrats on the left and Republicans on the right. A
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
  const yeaIds = useMemo(() => yea.map((v) => v.id), [yea]);
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
      <CompassPanel congress={Number.parseInt(congressLabel, 10)}>
        <ScatterPlot<LawVoter>
          points={plotted}
          ariaLabel={`Scatter plot of ${noun} by DW-NOMINATE ideology score; those who voted yea are highlighted`}
          width={640}
          height={470}
          margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
          x={(v) => v.dim1 as number}
          y={(v) => v.dim2 as number}
          id={(v) => v.id}
          colorClass={(v) => partyFillClass({ partyCode: v.partyCode, group: group(v) })}
          radius={(_v, s) => (s.highlighted ? 5.2 : 3.6)}
          highlightedIds={yeaIds}
          dimUnfocused
          isSelectable={(v) => v.path !== null}
          onSelect={(v) => v.path && router.push(v.path)}
          selectHint="Open profile →"
          renderTooltip={(v) => (
            <div className="tt-body">
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
      <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        <VoterList title="Democrats who voted yea" side="D" voters={dem} />
        <VoterList title="Republicans who voted yea" side="R" voters={rep} />
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

"use client";

import { useEffect, useState, type UIEvent } from "react";
import { ChartCard } from "@/components/charts/ChartCard";
import { MethodologyNote } from "@/components/MethodologyNote";
import { SourceLink } from "@/components/SourceLink";
import { fmtInt } from "@/lib/decisions-derive";
import { lawPath } from "@/lib/law-url";
import { pctWith, type MemberVotes } from "@/lib/member-votes";

const PAGE = 120;
const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
const BADGE = "inline-block whitespace-nowrap rounded-full border px-1.5 py-px align-baseline text-[0.66rem] font-medium";

type Pick = "all" | "against" | "split";

/** One member's votes, fetched once on mount. */
function useMemberVotes(bioguideId: string): { votes: MemberVotes | null | undefined; failed: boolean } {
  const [state, setState] = useState<{ id: string; votes: MemberVotes | null | undefined; failed: boolean }>({ id: bioguideId, votes: undefined, failed: false });
  useEffect(() => {
    let live = true;
    fetch(`/data/members/${bioguideId}/votes`)
      .then((r) => (r.ok ? (r.json() as Promise<MemberVotes | null>) : Promise.reject(new Error(String(r.status)))))
      .then(
        (votes) => live && setState({ id: bioguideId, votes, failed: false }),
        () => live && setState({ id: bioguideId, votes: undefined, failed: true }),
      );
    return () => {
      live = false;
    };
  }, [bioguideId]);
  return state.id === bioguideId ? state : { votes: undefined, failed: false };
}

function Tile({ value, label, on, onClick }: { value: string; label: string; on?: boolean; onClick?: () => void }) {
  const body = (
    <>
      <b className="block text-[1.15rem] font-medium tabular-nums">{value}</b>
      <span className="block text-[0.72rem] leading-[1.35] text-ink-muted">{label}</span>
    </>
  );
  if (!onClick) return <div className="rounded-lg border border-line bg-surface px-3 py-2 text-left">{body}</div>;
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`flex flex-col items-start justify-start rounded-lg border px-3 py-2 text-left hover:bg-surface-raised ${FOCUS_RING} ${on ? "border-ink bg-surface-raised shadow-[inset_0_0_0_1px_var(--ink)]" : "border-line bg-surface"}`}
    >
      {body}
    </button>
  );
}

const CAST_LABEL = ["", "Yea", "Nay", "Present", "Did not vote"] as const;

/**
 * The member page's voting record: the member's final-passage vote on every enacted law since 1973, newest first, with how often
 * they voted with their party's majority. The two count tiles beside the headline stat filter the list (votes against the party;
 * votes where the two parties' majorities opposed each other). Rows come from `/data/members/[id]/votes`.
 */
export function MemberVotesCard({ bioguideId, name }: { bioguideId: string; name: string }) {
  const { votes, failed } = useMemberVotes(bioguideId);
  const [pick, setPick] = useState<Pick>("all");
  const [shown, setShown] = useState<{ pick: Pick; n: number }>({ pick: "all", n: PAGE });
  const n = shown.pick === pick ? shown.n : PAGE;

  const rows = votes ? votes.rows.filter((r) => (pick === "against" ? r[3] === 0 : pick === "split" ? r[4] === 1 : true)) : [];
  const grow = (e: UIEvent<HTMLElement>) => {
    const el = e.currentTarget;
    if (n < rows.length && el.scrollTop + el.clientHeight > el.scrollHeight - 240) setShown({ pick, n: n + PAGE });
  };

  const loaded = votes !== undefined;
  const partyName = votes?.party === "D" ? "Democrats" : votes?.party === "R" ? "Republicans" : null;
  const all = votes ? pctWith(votes.all) : null;
  const split = votes ? pctWith(votes.split) : null;
  const toggle = (p: Pick) => setPick(pick === p ? "all" : p);

  return (
    <ChartCard
      more={{ href: "/congress/laws", label: "Laws page" }}
      title={`${name}'s voting record on laws`}
      lede={`How ${name} voted on final passage of every public law since 1973 that came to a recorded vote in their chamber, newest first, and how often that vote matched ${partyName ? `a majority of ${partyName}` : "their party"}. Only bills that became law appear, so this is not their whole voting record.`}>
      {votes && partyName && all !== null && (
        <>
          <div className="mb-1.5">
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.06em] text-ink-faint">Select a tile to filter</span>
          </div>
          <div role="group" aria-label={`Filter ${name}'s votes`} className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Tile value={`${all}%`} label={`of ${fmtInt(votes.all.with + votes.all.against)} votes with their party`} />
            <Tile value={split === null ? "n/a" : `${split}%`} label={`with their party when the parties split (${fmtInt(votes.split.with + votes.split.against)} votes)`} />
            <Tile value={fmtInt(votes.all.against)} label="votes against their party" on={pick === "against"} onClick={() => toggle("against")} />
            <Tile value={fmtInt(votes.split.with + votes.split.against)} label="party-split votes" on={pick === "split"} onClick={() => toggle("split")} />
          </div>
        </>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.78rem] text-ink-muted" aria-live="polite">
        <span className="tabular-nums text-ink">{loaded ? (votes ? `${fmtInt(rows.length)} vote${rows.length === 1 ? "" : "s"}` : "No recorded votes") : failed ? "Votes unavailable" : "Loading votes…"}</span>
        {pick !== "all" && (
          <button type="button" onClick={() => setPick("all")} className={`rounded text-[0.78rem] text-ink-muted underline underline-offset-2 hover:text-ink ${FOCUS_RING}`}>
            Clear filter
          </button>
        )}
      </div>
      <div tabIndex={0} aria-label={`${name}'s votes, scrollable`} onScroll={grow} className="touch-scroll relative mt-2 max-h-[32rem] overflow-y-auto overscroll-contain rounded-md border border-line">
        {failed ? (
          <p className="m-0 px-4 py-8 text-center text-[0.82rem] text-ink-muted">The votes could not be loaded. Reload the page to try again.</p>
        ) : loaded && !votes ? (
          <p className="m-0 px-4 py-8 text-center text-[0.82rem] text-ink-muted">{`${name} has no recorded final-passage vote on a law since 1973.`}</p>
        ) : loaded && rows.length === 0 ? (
          <p className="m-0 px-4 py-8 text-center text-[0.82rem] text-ink-muted">No votes match this filter.</p>
        ) : (
          <ol className="m-0 list-none p-0">
            {votes &&
              rows.slice(0, n).map((r) => {
                const [lawId, chamber, cast, wp, isSplit, py, pn] = r;
                const [title, date] = votes.laws[lawId]!;
                const against = wp === 0;
                return (
                  <li key={`${lawId}-${chamber}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line px-3 py-2.5 last:border-b-0">
                    <span className="w-[4.6rem] shrink-0 font-mono text-[0.72rem] tabular-nums text-ink-faint">{date}</span>
                    <a href={lawPath(lawId, title)} className={`min-w-0 flex-1 basis-[16rem] text-[0.86rem] leading-[1.35] text-ink underline-offset-2 hover:underline ${FOCUS_RING}`}>
                      {title}
                    </a>
                    <span className="flex flex-wrap items-baseline gap-1.5">
                      <span className={`${BADGE} ${cast === 1 ? "border-transparent bg-ink text-surface" : "border-line-strong bg-surface-raised text-ink"}`}>
                        {chamber === 0 ? "House" : "Senate"}: {CAST_LABEL[cast]}
                      </span>
                      {wp !== 2 && (
                        <span className={`${BADGE} ${against ? "border-ink text-ink" : "border-line text-ink-muted"}`}>{against ? "Against party" : "With party"}</span>
                      )}
                      {isSplit === 1 && <span className={`${BADGE} border-line text-ink-muted`}>Party split</span>}
                      {wp !== 2 && partyName && (
                        <span className="text-[0.7rem] tabular-nums text-ink-faint">{`${votes.party}: ${fmtInt(py)} yea, ${fmtInt(pn)} nay`}</span>
                      )}
                    </span>
                  </li>
                );
              })}
          </ol>
        )}
      </div>
      <MethodologyNote>
        <p>
          Final-passage roll calls on public laws from the 93rd Congress (1973) on, member by member, from <SourceLink id="voteview">Voteview</SourceLink> matched to laws from <SourceLink id="congress-gov">Congress.gov</SourceLink>. Laws passed by voice vote or unanimous consent have no member-by-member record and are left out, as are bills that failed and every amendment and motion. &ldquo;With party&rdquo; means the vote matched the way a majority of the member&rsquo;s party colleagues voting yea or nay went that day; independents who caucus with a party count with it. &ldquo;Party split&rdquo; marks roll calls where a majority of Democrats and a majority of Republicans voted opposite ways. Absences, &ldquo;present&rdquo; votes and evenly divided parties are not counted.
        </p>
      </MethodologyNote>
    </ChartCard>
  );
}

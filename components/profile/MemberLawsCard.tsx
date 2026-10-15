"use client";

import { useEffect, useMemo, useState, type UIEvent } from "react";
import { ChartCard } from "@/components/charts/ChartCard";
import { LawRow } from "@/components/laws/LawsListCard";
import { useLawsSearchIndex } from "@/components/laws/useLawsSearchIndex";
import { MethodologyNote } from "@/components/MethodologyNote";
import { fmtInt } from "@/lib/decisions-derive";
import type { MemberLaws } from "@/lib/laws-types";
import { NO_LAW_FILTER, filterLaws, isFiltered, tileCounts, type LawFilter, type RoleFilter } from "@/lib/member-laws-filter";

const PAGE = 120;

/** One member's laws, fetched once on mount. */
function useMemberLaws(bioguideId: string): { laws: MemberLaws | null; failed: boolean } {
  const [state, setState] = useState<{ id: string; laws: MemberLaws | null; failed: boolean }>({ id: bioguideId, laws: null, failed: false });
  useEffect(() => {
    let live = true;
    fetch(`/data/members/${bioguideId}/laws`)
      .then((r) => (r.ok ? (r.json() as Promise<MemberLaws>) : Promise.reject(new Error(String(r.status)))))
      .then(
        (laws) => live && setState({ id: bioguideId, laws, failed: false }),
        () => live && setState({ id: bioguideId, laws: null, failed: true }),
      );
    return () => {
      live = false;
    };
  }, [bioguideId]);
  return state.id === bioguideId ? state : { laws: null, failed: false };
}

const BADGE =
  "inline-block whitespace-nowrap rounded-full border px-1.5 py-px align-baseline text-[0.66rem] font-medium";

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/**
 * A count tile that is also a filter (the committee page's stage-tile pattern): a click picks it, a second click clears
 * it. A tile that would show no laws is greyed and inert unless it is the one picked, so the pick can always be undone.
 */
function Tile({ value, label, on, onClick }: { value: number; label: string; on: boolean; onClick: () => void }) {
  const off = value === 0 && !on;
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={off}
      onClick={onClick}
      className={`flex flex-col items-start justify-start rounded-lg border px-3 py-2 text-left ${FOCUS_RING} ${
        on ? "border-ink bg-surface-raised shadow-[inset_0_0_0_1px_var(--ink)]" : "border-line bg-surface"
      } ${off ? "cursor-not-allowed opacity-45" : "hover:bg-surface-raised"}`}
    >
      <b className="block text-[1.15rem] font-medium tabular-nums">{fmtInt(value)}</b>
      <span className="block text-[0.72rem] leading-[1.35] text-ink-muted">{label}</span>
    </button>
  );
}

/**
 * The member page's last card: every public law since 1973 the member sponsored or cosponsored, newest first, in the Laws page's
 * rows (the same `LawRow`), each tagged with the member's part in it. The rows come from `/data/members/[id]/laws`, the Laws list
 * cut down to this member. Rows are added as the box scrolls. The three count tiles are the filters (sponsored and
 * cosponsored pick one; major laws toggles on its own and combines), and the search box narrows them all.
 */
export function MemberLawsCard({ bioguideId, name }: { bioguideId: string; name: string }) {
  const { laws, failed } = useMemberLaws(bioguideId);
  const [role, setRole] = useState<RoleFilter>("all");
  const [major, setMajor] = useState(false);
  const [query, setQuery] = useState("");
  const terms = useMemo(() => query.toLowerCase().split(/\s+/).filter(Boolean), [query]);
  const { summaryHas } = useLawsSearchIndex(laws?.searchVersion ?? "", laws !== null && !!laws.searchVersion && terms.length > 0);
  const filter = useMemo<LawFilter>(() => ({ role, major, terms, summaryHas }), [role, major, terms, summaryHas]);

  // Each tile shows what picking it would leave of the rest of the selection (see `tileCounts`).
  const counts = useMemo(() => (laws ? tileCounts(laws, filter) : { sponsored: 0, cosponsored: 0, major: 0 }), [laws, filter]);
  const rows = useMemo(() => (laws ? filterLaws(laws, filter) : []), [laws, filter]);
  const clear = () => {
    setRole(NO_LAW_FILTER.role);
    setMajor(NO_LAW_FILTER.major);
    setQuery("");
  };

  const sig = `${role}|${major}|${terms.join(" ")}`;
  const [shown, setShown] = useState<{ sig: string; n: number }>({ sig, n: PAGE });
  const n = shown.sig === sig ? shown.n : PAGE;
  const grow = (e: UIEvent<HTMLElement>) => {
    const el = e.currentTarget;
    if (n < rows.length && el.scrollTop + el.clientHeight > el.scrollHeight - 240) setShown({ sig, n: n + PAGE });
  };

  const total = laws?.rows.length ?? 0;
  const oldest = total ? laws!.rows[total - 1]![2].slice(0, 4) : null;
  const newest = total ? laws!.rows[0]![2].slice(0, 4) : null;
  const span = oldest === null ? "" : oldest === newest ? ` in ${oldest}` : ` from ${oldest} to ${newest}`;
  return (
    <ChartCard
      tight
      title={`Laws ${name} sponsored or cosponsored`}
      action={
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, bill, area or summary"
          aria-label={`Search ${name}'s laws by name, bill, policy area or summary`}
          className="w-full rounded-md border border-line-strong bg-surface-raised px-2.5 py-1 text-[0.82rem] text-ink placeholder:text-ink-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:w-60"
        />
      }
      lede={`Every public law${span} that ${name} sponsored or cosponsored, newest first. Each law shows the part ${name} played, the policy area, and its closest recorded final-passage vote. Only bills that became law appear: most bills a member sponsors never do.`}>
      {laws && total > 0 && (
        <>
          <div className="mb-1.5">
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.06em] text-ink-faint">Select a tile to filter</span>
          </div>
          <div role="group" aria-label={`Filter ${name}'s laws`} className="mb-3 grid grid-cols-3 gap-2">
            <Tile value={counts.sponsored} label="laws sponsored" on={role === "sponsored"} onClick={() => setRole(role === "sponsored" ? "all" : "sponsored")} />
            <Tile value={counts.cosponsored} label="laws cosponsored" on={role === "cosponsored"} onClick={() => setRole(role === "cosponsored" ? "all" : "cosponsored")} />
            <Tile value={counts.major} label="major laws" on={major} onClick={() => setMajor(!major)} />
          </div>
        </>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.78rem] text-ink-muted" aria-live="polite">
        <span className="tabular-nums text-ink">{laws ? `${fmtInt(rows.length)} law${rows.length === 1 ? "" : "s"}` : failed ? "Laws unavailable" : "Loading laws…"}</span>
        {laws && isFiltered(filter) && (
          <button type="button" onClick={clear} className={`rounded text-[0.78rem] text-ink-muted underline underline-offset-2 hover:text-ink ${FOCUS_RING}`}>
            Clear filters
          </button>
        )}
      </div>
      <div key={sig} tabIndex={0} aria-label={`${name}'s laws, scrollable`} onScroll={grow} className="touch-scroll relative mt-2 max-h-[32rem] overflow-y-auto overscroll-contain rounded-md border border-line">
        {failed ? (
          <p className="m-0 px-4 py-8 text-center text-[0.82rem] text-ink-muted">The laws could not be loaded. Reload the page to try again.</p>
        ) : laws && total === 0 ? (
          <p className="m-0 px-4 py-8 text-center text-[0.82rem] text-ink-muted">{`No bill ${name} sponsored or cosponsored has become law since 1973.`}</p>
        ) : laws && rows.length === 0 ? (
          <p className="m-0 px-4 py-8 text-center text-[0.82rem] text-ink-muted">No laws match these filters.</p>
        ) : (
          <ol className="m-0 list-none p-0">
            {laws &&
              rows.slice(0, n).map((i) => {
                const r = laws.rows[i]!;
                const sponsor = laws.roles[i] === 1;
                return (
                  <LawRow
                    key={`${r[0]}-${r[1]}`}
                    r={r}
                    data={laws}
                    list={laws}
                    extraBadge={<span className={`${BADGE} ${sponsor ? "border-transparent bg-ink text-surface" : "border-line-strong bg-surface-raised text-ink"}`}>{sponsor ? "Sponsor" : "Cosponsor"}</span>}
                  />
                );
              })}
          </ol>
        )}
      </div>
      <MethodologyNote>
        <p>
          Public laws from the 93rd Congress (1973) on, from Congress.gov and GovInfo bill data, listed under the bill that was enacted. Cosponsors who withdrew are not counted. &ldquo;Major&rdquo; follows David Mayhew&rsquo;s list of important enactments, which stops at the 118th Congress; later laws are not yet assessed. Votes and policy areas are as on the Laws page.
        </p>
      </MethodologyNote>
    </ChartCard>
  );
}

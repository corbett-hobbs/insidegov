"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ListSearch } from "@/components/ListSearch";
import { MemberFace } from "@/components/MemberPhoto";
import { memberTitleAbbr, type ChamberView } from "@/lib/chamber";
import { congressSpan, ordinal } from "@/lib/demographics-chart";
import { listMembers, sortMembers, type ListMember, type ListOrder } from "@/lib/demographics-list";
import type { CaucusGroup, DemoCongress, DemoRoster } from "@/lib/demographics-types";
import { memberPath } from "@/lib/member-url";

/** What `useRoster` hands the three lists. */
export interface RosterState {
  roster: DemoRoster | null;
  failed: boolean;
}

const CAUCUS_COLOR: Record<CaucusGroup, string> = { D: "var(--dem)", R: "var(--rep)", O: "var(--oth)" };
const CAUCUS_ABBR: Record<CaucusGroup, string> = { D: "D", R: "R", O: "Oth" };
const CAUCUS_WORD: Record<CaucusGroup, string> = { D: "Democratic", R: "Republican", O: "other-party" };

const fmtDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** What the header says about the order, by lens and direction: the order, then its detail (dropped on phones where it is long). */
function orderText(order: ListOrder, reverse: boolean, row: DemoCongress): [string, string] {
  if (order === "age") return [`${reverse ? "Youngest" : "Oldest"} first`, `, age on ${fmtDay(row.date)}`];
  return [`${reverse ? "Newest members" : "Longest-serving"} first`, ", years counting this Congress"];
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg aria-hidden viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={dir === "left" ? "M7.5 2.5 4 6l3.5 3.5" : "M4.5 2.5 8 6 4.5 9.5"} />
    </svg>
  );
}

const ICON_BUTTON =
  "inline-flex size-6 flex-none items-center justify-center rounded border border-line-strong bg-surface-raised text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-default disabled:opacity-40 disabled:hover:text-ink-muted";

/**
 * The members behind a demographics chart: everyone who held a seat in one Congress (the pinned one, else the latest in the
 * years shown), ordered and filtered by the card's question. The header names the Congress and has ‹ › to step the pin
 * through the Congresses shown. The count is the chart's own seat count, because both come from the same roster.
 */
export function MemberList({
  roster,
  failed,
  row,
  rows,
  view,
  order,
  women = false,
  party,
  onPin,
}: {
  roster: DemoRoster | null;
  failed: boolean;
  /** The Congress listed; null when no Congress is in the years shown. */
  row: DemoCongress | null;
  /** The Congresses in the years shown, oldest first: the stepper's range. */
  rows: readonly DemoCongress[];
  view: ChamberView;
  order: ListOrder;
  /** Only women (the Women card). */
  women?: boolean;
  /** Only this caucus (null = all): the page's party pick, set by the pinned bar's dropdown and the legends. */
  party: CaucusGroup | null;
  onPin: (congress: number) => void;
}) {
  const [reverse, setReverse] = useState(false);
  const [q, setQ] = useState("");
  // Everyone the card's question covers in the listed Congress, before the party filter.
  const base = useMemo<ListMember[]>(() => (roster && row ? listMembers(roster, row, view).filter((m) => !women || m.female) : []), [roster, row, view, women]);
  const sorted = useMemo<ListMember[]>(() => sortMembers(party ? base.filter((m) => m.caucus === party) : base, order, reverse), [base, party, order, reverse]);
  if (!row) return null;

  const needle = q.trim().toLowerCase();
  // Rank is the place in the full ordering, so searching a name still says where that member stands.
  const shown = sorted.map((m, i) => ({ m, rank: i + 1 })).filter(({ m }) => !needle || m.name.toLowerCase().includes(needle));
  // Photos exist for current members and for former ones who served in the 100th Congress or later, so an older list has
  // few. Keep their gutter whenever any row has one, so every name starts in the same place.
  const faces = sorted.some((m) => m.photo || m.profile !== null);
  const noun = (n: number) => `${party ? `${CAUCUS_WORD[party]} ` : ""}${women ? (n === 1 ? "woman" : "women") : n === 1 ? "member" : "members"}`;
  const at = rows.findIndex((r) => r.congress === row.congress);
  const step = (d: -1 | 1) => rows[at + d] && onPin(rows[at + d].congress);

  return (
    <div className="mt-4 border-t border-line">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 pt-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <div className="flex flex-none items-center gap-1.5">
            <button type="button" className={ICON_BUTTON} onClick={() => step(-1)} disabled={at <= 0} aria-label="Previous Congress" title="Previous Congress">
              <Chevron dir="left" />
            </button>
            <button type="button" className={ICON_BUTTON} onClick={() => step(1)} disabled={at < 0 || at >= rows.length - 1} aria-label="Next Congress" title="Next Congress">
              <Chevron dir="right" />
            </button>
          </div>
        </div>
        <div className="flex flex-none items-center gap-2">
          <button
            type="button"
            className={ICON_BUTTON}
            onClick={() => setReverse((r) => !r)}
            aria-label={order === "age" ? (reverse ? "Show oldest first" : "Show youngest first") : reverse ? "Show longest-serving first" : "Show newest members first"}
            title="Reverse the order"
          >
            <svg aria-hidden viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 10V2M2 4l2-2 2 2M8 2v8M6 8l2 2 2-2" />
            </svg>
          </button>
          <ListSearch value={q} onChange={setQ} label={`Search ${noun(2)} by name`} />
        </div>
      </div>
      <p className="m-0 pb-2 pt-1.5 text-[0.78rem] leading-snug text-ink-muted" aria-live="polite">
        <span className="font-medium text-ink">{congressSpan(row)}</span> · {orderText(order, reverse, row)[0]}
        <span className="max-sm:hidden">{orderText(order, reverse, row)[1]}</span>
        {roster && (
          <>
            {" "}
            · {shown.length === sorted.length ? sorted.length : `${shown.length} of ${sorted.length}`} {noun(shown.length === sorted.length ? sorted.length : 2)}
          </>
        )}
      </p>
      <div className="relative h-[18rem]">
        <div tabIndex={0} aria-label={`${noun(2)[0].toUpperCase()}${noun(2).slice(1)} of the ${ordinal(row.congress)} Congress`} className="absolute inset-0 overflow-y-auto overscroll-contain touch-scroll">
          {!roster ? (
            <p className="py-2 text-[0.75rem] text-ink-faint">{failed ? "The member list couldn’t be loaded. Reload the page to try again." : "Loading members…"}</p>
          ) : shown.length === 0 ? (
            <p className="py-2 text-[0.75rem] text-ink-faint">{sorted.length === 0 ? `No ${noun(2)} in this Congress.` : "No match."}</p>
          ) : (
            <ol className="m-0 list-none p-0">
              {shown.map(({ m, rank }) => (
                <li key={m.id}>
                  <Row m={m} rank={rank} order={order} faces={faces} />
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

/** One member: rank, caucus dot, photo, name and seat, then the figure the order is about. Links to the profile where one exists. */
function Row({ m, rank, order, faces }: { m: ListMember; rank: number; order: ListOrder; faces: boolean }) {
  const body = (
    <>
      <span className="w-6 flex-none text-right sm:w-7 font-mono text-[0.7rem] tabular-nums text-ink-faint">{rank}</span>
      <span aria-hidden className="size-[0.45rem] flex-none rounded-full max-sm:hidden" style={{ background: CAUCUS_COLOR[m.caucus] }} />
      {m.photo || m.profile !== null ? <MemberFace bioguideId={m.id} hasPhoto={m.photo} current={m.profile !== null} /> : faces && <span aria-hidden className="h-6 w-5 flex-none" />}
      <span className="min-w-0 truncate text-ink" title={m.name}>
        {memberTitleAbbr(m.chamber)} {m.name}
      </span>
      <span className="flex-none text-ink-faint">
        {CAUCUS_ABBR[m.caucus]}-{m.state}
      </span>
      <span className="flex-1" />
      {/* Wide screens: the other two cards' figures for the same member, so the gap beside the name carries data. */}
      {order === "age" ? (
        <>
          <span className="hidden w-16 flex-none text-right text-[0.7rem] tabular-nums text-ink-faint md:inline">{m.born === null ? "" : `born ${m.born}`}</span>
          <span className="hidden w-[4.5rem] flex-none text-right text-[0.7rem] tabular-nums text-ink-faint md:inline">since {m.since}</span>
          <span className="w-12 flex-none text-right font-mono text-[0.7rem] tabular-nums text-ink-muted" title={m.ageWhole === null ? "No birthdate on record" : undefined}>{m.ageWhole === null ? "n/a" : `${m.ageWhole} yrs`}</span>
        </>
      ) : (
        <>
          <span className="hidden w-14 flex-none text-right text-[0.7rem] tabular-nums text-ink-faint md:inline">{m.ageWhole === null ? "" : `age ${m.ageWhole}`}</span>
          <span className="hidden w-[4.5rem] flex-none text-right text-[0.7rem] tabular-nums text-ink-faint sm:inline">since {m.since}</span>
          <span className="w-12 flex-none text-right font-mono text-[0.7rem] tabular-nums text-ink-muted">{m.served * 2} yrs</span>
        </>
      )}
    </>
  );
  const cls = "-mx-1 flex items-center gap-2 rounded px-1 py-[0.3rem] text-[0.8rem] sm:gap-2.5";
  return m.profile ? (
    <Link href={memberPath({ bioguideId: m.id, chamber: m.profile, name: m.name })} className={`${cls} hover:bg-surface-raised`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

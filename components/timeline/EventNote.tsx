"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { eraLabel, fmtDate, wikiUrl, type CourtMode, type PowerState } from "@/lib/timeline-derive";
import type { Side, TlEvent, TlLink, TlTally } from "@/lib/timeline-types";
import { DirectionTag } from "../decisions/DirectionTag";
import { FOCUS_RING, numberBadge, partyColor } from "./shared";

function VoteRow({ label, yes, no, party }: { label: string; yes: number; no: number; party: Side }) {
  const pct = yes + no ? Math.round((100 * yes) / (yes + no)) : 0;
  return (
    <div className="mt-[3px] grid grid-cols-[5.4rem_1fr_2.6rem] items-center gap-1.5 text-[0.72rem]">
      <span>{label}</span>
      <span aria-hidden className="h-[7px] overflow-hidden rounded-sm bg-line">
        <i className="block h-full" style={{ width: `${pct}%`, background: partyColor(party) }} />
      </span>
      <span className="text-right font-mono">
        {yes}–{no}
      </span>
    </div>
  );
}

function Votes({ e }: { e: TlEvent }) {
  if (e.kind === "case") {
    return (
      <div className="mt-1.5 text-[0.75rem] text-ink-muted">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <b className="font-semibold text-ink">{e.vote}</b>
          {e.direction && <DirectionTag outcome direction={e.direction} areaId={e.areaId ?? null} />}
          {e.author && <span>opinion by {e.author}</span>}
        </div>
        <div>
          Share of each party&rsquo;s appointees in the majority
        </div>
        {(["D", "R"] as const).map((p) => {
          const y = e.majority?.[p] ?? 0;
          const n = e.dissent?.[p] ?? 0;
          return y + n > 0 ? <VoteRow key={p} label={`${p} appointees`} yes={y} no={n} party={p} /> : null;
        })}
      </div>
    );
  }
  if (!e.split) {
    return (
      <div className="mt-1.5 text-[0.75rem] text-ink-muted">
        {e.override && "Passed over a veto. "}
        No recorded roll-call vote by party.
      </div>
    );
  }
  const rows: [string, TlTally | undefined][] = [
    ["House", e.split.house],
    ["Senate", e.split.senate],
  ];
  return (
    <div className="mt-1.5 text-[0.75rem] text-ink-muted">
      <div>
        Share of each party voting yes{e.override && " (veto override)"}
      </div>
      {rows.map(([ch, t]) => t && (["D", "R"] as const).map((p) => <VoteRow key={ch + p} label={`${ch} ${p}`} yes={t[p][0]} no={t[p][1]} party={p} />))}
    </div>
  );
}

function Links({ e, byId, onJump }: { e: TlEvent; byId: ReadonlyMap<string, TlEvent>; onJump: (no: number) => void }) {
  const cap = (t: string) => t[0]!.toUpperCase() + t.slice(1);
  const btn = (l: TlLink) => {
    const t = byId.get(l.id)!;
    return (
      <button type="button" onClick={(ev) => (ev.stopPropagation(), onJump(t.no))} className={`rounded-[5px] border border-line bg-surface py-0 pl-[3px] pr-1.5 text-left text-[0.74rem] text-ink hover:border-line-strong hover:bg-surface-raised ${FOCUS_RING}`}>
        <span className={`${numberBadge(t.kind)} !h-4 !min-w-4 !text-[0.6rem]`}>{t.no}</span>
        {t.name}
      </button>
    );
  };
  const year = (l: TlLink) => byId.get(l.id)!.date.slice(0, 4);
  // A later event reads "Dobbs (2022) overruled it."; an earlier one "Roe v. Wade (1973): Overruled it."
  const later = (l: TlLink) => (
    <div key={l.id} className="mt-[3px] first-of-type:mt-0">
      {btn(l)} <span>({year(l)}) {l.text}.</span>
    </div>
  );
  const earlier = (l: TlLink) => (
    <div key={l.id} className="mt-[3px] first-of-type:mt-0">
      {btn(l)} <span>({year(l)}): {cap(l.text)}.</span>
    </div>
  );
  const sections: [string, ReactNode[]][] = [
    ["Ruled on", e.ruledOn ? [earlier(e.ruledOn)] : []],
    ["Earlier cases", (e.earlierCases ?? []).map(earlier)],
    ["Tested in court", e.tested ? [later(e.tested)] : []],
    ["Later cases", (e.laterCases ?? []).map(later)],
  ];
  return (
    <>
      {sections.map(([label, rows]) =>
        rows.length ? (
          <div key={label} className="mt-[7px] text-[0.75rem] leading-[1.6] text-ink-muted">
            <span className="block font-mono text-[0.6rem] font-medium uppercase tracking-[0.08em] text-ink-faint">{label}</span>
            {rows}
          </div>
        ) : null,
      )}
    </>
  );
}

/**
 * Who held power during the events that follow: the era's own sentence on a band in the party's colour (neutral when the
 * White House and Congress were split). The note shows one band before the first event and another wherever the era changes, so the events read in context.
 */
function EraBand({ st, mode, first }: { st: PowerState; mode: CourtMode; first: boolean }) {
  const color = st.status === "split" ? "var(--ink-muted)" : partyColor(st.P);
  return (
    <div
      className={`-mx-3 border-y px-3 py-1.5 text-[0.78rem] font-medium leading-snug ${first ? "-mt-2.5 mb-2.5 border-t-0 pr-9" : "my-2.5"}`}
      style={{ background: `color-mix(in oklab, ${color} 14%, var(--surface))`, borderColor: `color-mix(in oklab, ${color} 45%, transparent)`, color: `color-mix(in oklab, ${color} 72%, var(--ink))` }}
    >
      {eraLabel(st, mode)}
    </div>
  );
}

/**
 * The note card's content for one marker: every event it holds, newest first as on the Era by era card, each with its date (right of the title on a
 * desktop, under it on a phone), one line, the vote (party yes-vote bars for a law, appointing-party bars and the
 * conservative / liberal pill for a case) and its links to other events on the list. The title is the link: the law's page
 * here, a case's decision page here (cases before the 1946 term have none), else its Wikipedia article. With `stateOf`, a full-width band
 * saying who held power opens the note and returns wherever the era changes between events.
 */
export function EventNotes({
  items,
  focus,
  byId,
  onJump,
  stateOf,
  mode,
}: {
  items: readonly TlEvent[];
  focus: number | null;
  byId: ReadonlyMap<string, TlEvent>;
  onJump: (no: number) => void;
  stateOf?: (e: TlEvent) => PowerState;
  mode?: CourtMode;
}) {
  const sorted = [...items].sort((a, b) => b.date.localeCompare(a.date) || b.no - a.no);
  const labels = sorted.map((e) => (stateOf && mode ? eraLabel(stateOf(e), mode) : null));
  return (
    <>
      {sorted.map((e, i) => {
        const st = stateOf && mode ? stateOf(e) : null;
        const band = st && mode && labels[i] !== labels[i - 1];
        const date = `${e.kind === "law" ? "Signed" : "Decided"} ${fmtDate(e.date)}`;
        const linkCls = `font-semibold text-ink underline decoration-line-strong underline-offset-2 hover:text-accent ${FOCUS_RING}`;
        return (
          <div key={e.no}>
            {band && <EraBand st={st} mode={mode!} first={i === 0} />}
            <div
              data-no={e.no}
              className={`${i > 0 && !band ? "mt-2.5 border-t border-line pt-2.5" : ""} ${focus === e.no && sorted.length > 1 ? "-mx-1.5 rounded-md bg-[color-mix(in_oklab,var(--accent)_10%,transparent)] px-1.5" : ""}`}
            >
              <div className="pr-6 sm:flex sm:items-baseline sm:justify-between sm:gap-3">
                <div>
                  <span className={numberBadge(e.kind)}>{e.no}</span>
                  {e.lawPath ?? e.casePath ? (
                    <Link href={(e.lawPath ?? e.casePath)!} target="_blank" rel="noreferrer" className={linkCls}>
                      {e.name} ↗
                    </Link>
                  ) : (
                    <a href={wikiUrl(e.wiki)} target="_blank" rel="noreferrer" className={linkCls}>
                      {e.name} ↗
                    </a>
                  )}
                </div>
                <div className="whitespace-nowrap font-mono text-[0.7rem] text-ink-faint max-sm:hidden">{date}</div>
              </div>
              <div className="font-mono text-[0.7rem] text-ink-faint sm:hidden">{date}</div>
              <p className="m-0 mt-[3px] text-ink-muted">{e.what}</p>
              <Votes e={e} />
              <Links e={e} byId={byId} onJump={onJump} />
            </div>
          </div>
        );
      })}
    </>
  );
}

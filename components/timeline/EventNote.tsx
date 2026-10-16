"use client";

import type { ReactNode } from "react";
import { fmtDate, lastName, statusNames, wikiUrl, type CourtMode, type PowerState } from "@/lib/timeline-derive";
import type { Side, TlEvent, TlLink, TlTally } from "@/lib/timeline-types";
import { FOCUS_RING, PARTY_ADJ, PARTY_PLURAL, STATUS_COLOR, numberBadge, partyColor } from "./shared";

const seats = (s: readonly [number, number, number]) => (s[0] >= s[1] ? `${s[0]}–${s[1]}` : `${s[1]}–${s[0]}`);

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
        <div>
          <b className="font-semibold text-ink">{e.vote}</b>
          {e.author && ` · opinion by ${e.author}`}
          <br />
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
        {e.date < "1973" ? "Vote by party: not in our data before 1973." : "No recorded roll-call vote by party."}
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
        {e.splitHand && " · typed in from the record"}
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

/** Who held power that day: a law gets the President and both chambers as chips; a case one muted line on the elected branches (the Court is in its vote). */
function HeldPower({ e, st, mode }: { e: TlEvent; st: PowerState; mode: CourtMode }) {
  const status = statusNames(mode)[st.status].name;
  const tag = (
    <span className="mt-1.5 inline-block rounded border px-1.5 py-0.5 font-mono text-[0.62rem] font-medium uppercase tracking-[0.06em] text-ink" style={{ borderColor: STATUS_COLOR[st.status] }}>
      {status}
    </span>
  );
  if (e.kind === "law") {
    const chip = (p: Side, t: string) => (
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-[5px] border border-line px-1.5 py-px text-[0.7rem] text-ink">
        <i aria-hidden className="inline-block h-2 w-2 rounded-sm" style={{ background: partyColor(p) }} />
        {t}
      </span>
    );
    return (
      <>
        <div className="mt-[7px] flex flex-wrap gap-1">
          {chip(st.P, `${lastName(st.pres.name)} signed`)}
          {chip(st.S, `Senate ${seats(st.cong.senate)}`)}
          {chip(st.H, `House ${seats(st.cong.house)}`)}
        </div>
        {tag}
      </>
    );
  }
  const cong = st.S === st.H ? `${PARTY_PLURAL[st.S]} held the Senate and House` : `${PARTY_PLURAL[st.S]} held the Senate, ${PARTY_PLURAL[st.H]} the House`;
  return (
    <>
      <p className="m-0 mt-[7px] text-[0.74rem] text-ink-faint">
        Elected branches that day: {lastName(st.pres.name)} ({PARTY_ADJ[st.P]}) was president; {cong}.
      </p>
      {tag}
    </>
  );
}

/**
 * The note card's content for one marker: every event it holds, each with its date, Wikipedia link, one line, the vote
 * (party yes-vote bars for a law, appointing-party bars for a case), its links to other events on the list, and who held
 * power that day.
 */
export function EventNotes({
  items,
  focus,
  stateOf,
  mode,
  byId,
  onJump,
}: {
  items: readonly TlEvent[];
  focus: number | null;
  stateOf: (e: TlEvent) => PowerState;
  mode: CourtMode;
  byId: ReadonlyMap<string, TlEvent>;
  onJump: (no: number) => void;
}) {
  return (
    <>
      {items.map((e) => (
        <div
          key={e.no}
          data-no={e.no}
          className={`[&+&]:mt-2.5 [&+&]:border-t [&+&]:border-line [&+&]:pt-2.5 ${focus === e.no && items.length > 1 ? "-mx-1.5 rounded-md bg-[color-mix(in_oklab,var(--accent)_10%,transparent)] px-1.5" : ""}`}
        >
          <div>
            <span className={numberBadge(e.kind)}>{e.no}</span>
            <span className="font-semibold text-ink">{e.name}</span>
          </div>
          <div className="font-mono text-[0.7rem] text-ink-faint">
            {e.kind === "law" ? "Signed" : "Decided"} {fmtDate(e.date)} ·{" "}
            <a href={wikiUrl(e.wiki)} target="_blank" rel="noreferrer" className={`underline underline-offset-2 hover:text-ink ${FOCUS_RING}`}>
              Wikipedia ↗
            </a>
          </div>
          <p className="m-0 mt-[3px] text-ink-muted">{e.what}</p>
          <Votes e={e} />
          <Links e={e} byId={byId} onJump={onJump} />
          <HeldPower e={e} st={stateOf(e)} mode={mode} />
        </div>
      ))}
    </>
  );
}

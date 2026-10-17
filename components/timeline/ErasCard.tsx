"use client";

import { useEffect, useRef, useState } from "react";
import { EventNotes } from "./EventNote";

import { ChartCard } from "../charts/ChartCard";
import { ListSearch } from "../ListSearch";
import { eraLabel, lastName, matchesQuery, type CourtMode, type CourtSide, type Era, type PowerStatus } from "@/lib/timeline-derive";
import type { TlEvent } from "@/lib/timeline-types";
import { FOCUS_RING, numberBadge, partyColor } from "./shared";

export const ERAS_ID = "eras";

const COURT_TEXT: Record<CourtMode, Record<CourtSide, string>> = {
  lean: { D: "lib", R: "con", T: "ctr", N: "n/a" },
  appt: { D: "D", R: "R", T: "tie", N: "n/a" },
};
const GRID = "grid grid-cols-[minmax(0,1fr)] gap-1 sm:grid-cols-[8.6rem_9.4rem_minmax(0,1fr)] sm:gap-3";

/**
 * "Era by era": each row a stretch when no institution changed hands, newest first (rule 15a), with the events of the
 * stretch as buttons. A button opens the event's note under its era row (the same note as the chart's); links inside the note open the linked event there too. Its own search box filters the rows to eras with a matching event and
 * highlights the matching markers on the chart.
 */
export function ErasCard({
  eras,
  mode,
  range,
  status,
  events,
  query,
  onQuery,
  today,
  byId,
}: {
  eras: readonly Era[];
  mode: CourtMode;
  range: [number, number];
  status: PowerStatus | null;
  /** The events the Events filter lets through (status and window are applied here). */
  events: readonly TlEvent[];
  query: string;
  onQuery: (q: string) => void;
  today: string;
  byId: ReadonlyMap<string, TlEvent>;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const byNo = new Map(events.map((e) => [e.no, e]));
  const noteRef = useRef<HTMLDivElement>(null);
  // A link inside the note opens the linked event under its own era row: bring that row into view in the box.
  useEffect(() => {
    if (picked !== null) noteRef.current?.scrollIntoView({ block: "nearest" });
  }, [picked]);
  const q = query.trim();
  const inWindow = (iso: string) => {
    const y = Number(iso.slice(0, 4));
    return y >= range[0] && y <= range[1];
  };
  const hits = q ? events.filter((e) => inWindow(e.date) && matchesQuery(e, q)) : [];
  const rows = eras
    .filter((er) => er.to > `${range[0]}-01-01` && er.from < `${range[1] + 1}-01-01` && (!status || er.st.status === status))
    .map((er) => ({ er, evs: events.filter((e) => e.date >= er.from && e.date < er.to && matchesQuery(e, q)).reverse() }))
    .filter((r) => !q || r.evs.length > 0)
    .reverse();
  const chip = (k: "President" | "Senate" | "House" | "Court", p: CourtSide) => (
    <span title={k} className="min-w-8 rounded-[3px] px-1 py-0.5 text-center font-mono text-[0.62rem] font-semibold text-white" style={{ background: partyColor(p) }}>
      {k[0]} {k === "Court" ? COURT_TEXT[mode][p] : p}
    </span>
  );
  return (
    <ChartCard
      title={<span id={ERAS_ID} className="scroll-mt-32">Era by era</span>}
      action={<ListSearch value={query} onChange={onQuery} label="Search laws and cases" />}
      lede={
        <>
          Each row is a stretch when no institution changed hands, newest first. Tap an event to read about it.
          {q && (
            <>
              {" "}
              <span className="font-medium text-ink">
                {hits.length} event{hits.length === 1 ? "" : "s"} match.
              </span>{" "}
              <button type="button" onClick={() => onQuery("")} className={`text-[0.74rem] text-accent hover:underline ${FOCUS_RING}`}>
                Clear search
              </button>
            </>
          )}
        </>
      }
    >
      <div className={`${GRID} px-0.5 pb-1 font-mono text-[0.6rem] font-medium uppercase tracking-[0.08em] text-ink-faint max-sm:hidden`}>
        <span>Years</span>
        <span>{mode === "lean" ? "President · Senate · House · Court lean" : "President · Senate · House · Court"}</span>
        <span>Who held power, and what happened</span>
      </div>
      <div tabIndex={0} aria-label="Eras, scrollable" className="touch-scroll relative max-h-[26rem] overflow-y-auto overscroll-contain border-t border-line sm:max-h-[34rem]">
        {rows.length === 0 && (
          <div className="px-0.5 py-2.5 text-[0.72rem] text-ink-faint">{q ? `Nothing matches “${q}” in the years and events shown.` : "No eras match."}</div>
        )}
        {rows.map(({ er, evs }) => (
          <div key={er.from} className={`${GRID} items-start border-b border-line px-0.5 py-2.5`}>
            <div>
              <div className="font-mono text-[0.8rem] font-medium">
                {er.to >= today ? `${er.from.slice(0, 4)}–now` : er.from.slice(0, 4) === er.to.slice(0, 4) ? er.from.slice(0, 4) : `${er.from.slice(0, 4)}–${er.to.slice(0, 4)}`}
              </div>
              <div className="text-[0.72rem] text-ink-muted">{er.presidents.map(lastName).join(", ")}</div>
            </div>
            <div className="flex flex-wrap gap-[3px]">
              {chip("President", er.st.P)}
              {chip("Senate", er.st.S)}
              {chip("House", er.st.H)}
              {chip("Court", er.st.C)}
            </div>
            <div>
              <div className="text-[0.82rem] font-medium text-ink">{eraLabel(er.st, mode)}</div>
              {evs.length ? (
                <div className="mt-1 flex flex-wrap gap-x-1.5 gap-y-1">
                  {evs.map((e) => (
                    <button
                      key={e.no}
                      type="button"
                      aria-expanded={picked === e.no}
                      onClick={() => setPicked(picked === e.no ? null : e.no)}
                      className={`rounded-[5px] border ${picked === e.no ? "border-accent bg-surface-raised" : "border-line bg-surface"} py-px pl-[3px] pr-1.5 text-left text-[0.72rem] text-ink hover:border-line-strong hover:bg-surface-raised ${FOCUS_RING}`}
                    >
                      <span className={`${numberBadge(e.kind)} !h-4 !min-w-4 !text-[0.6rem]`}>{e.no}</span>
                      {e.name}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-[0.72rem] text-ink-faint">No hand-picked events in this stretch</div>
              )}
              {picked !== null && evs.some((e) => e.no === picked) && byNo.has(picked) && (
                <div ref={noteRef} className="relative mt-2 rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-[0.8rem] leading-[1.45] shadow-[0_4px_14px_rgba(26,34,51,0.12)]">
                  <EventNotes items={[byNo.get(picked)!]} focus={null} byId={byId} onJump={(no) => setPicked(no)} />
                  <button type="button" aria-label="Close" onClick={() => setPicked(null)} className={`absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded text-[1rem] leading-none text-ink-muted hover:text-ink ${FOCUS_RING}`}>
  ×
</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}

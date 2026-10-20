"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { LEGEND_ITEM, LEGEND_ROW } from "@/components/charts/legend";
import { PowerChart, type OpenNote } from "@/components/timeline/PowerChart";
import { FOCUS_RING, numberBadge, partyColor, partyTint } from "@/components/timeline/shared";
import { dateLabel } from "@/lib/president-derive";
import { fmtInt } from "@/lib/president-format";
import type { PresidentRef, PresidentTimeline } from "@/lib/president-types";
import { buildSpans, changePoints, powerIndex, wikiUrl } from "@/lib/timeline-derive";
import type { PowerState } from "@/lib/timeline-derive";
import type { TlEvent } from "@/lib/timeline-types";
import { CardShell, MiniVote } from "./PresidentCards";
import { NOTES } from "./notes";

const MODE = "lean" as const;

/**
 * The Timeline page's chart for one president's years in office (the same `PowerChart`, a fixed window with no zoom), with the
 * landmark laws and Supreme Court cases in those years listed under it, newest first. A marker's note opens on the chart; the
 * numbers are the Timeline's, so an event keeps its number on both pages. The Timeline page has the Court measure switch and the
 * year zoom.
 */
export function PresidentTimelineCard({ p, timeline }: { p: PresidentRef; timeline: PresidentTimeline }) {
  const { payload, from, to, eventNos } = timeline;
  const [open, setOpen] = useState<OpenNote | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const idx = useMemo(() => powerIndex(payload), [payload]);
  const spans = useMemo(() => buildSpans(idx, changePoints(payload), MODE), [idx, payload]);
  const byId = useMemo(() => new Map(payload.events.map((e) => [e.id, e])), [payload.events]);
  const states = useMemo(() => new Map(payload.events.map((e) => [e.no, idx.stateAt(e.date, MODE)])), [payload.events, idx]);
  const stateOf = useCallback((e: TlEvent): PowerState => states.get(e.no)!, [states]);
  const events = useMemo(() => eventNos.map((no) => payload.events[no - 1]!), [eventNos, payload.events]);
  const list = useMemo(() => [...events].reverse(), [events]);
  const nLaws = events.filter((e) => e.kind === "law").length;
  const nCases = events.length - nLaws;
  const y0 = Number(from.slice(0, 4));
  const y1 = Number(to.slice(0, 4));

  const jump = useCallback((no: number) => {
    setOpen({ no, pinned: true, focus: no });
    card.current?.scrollIntoView({ behavior: "instant", block: "nearest" });
  }, []);

  const takeaway =
    nLaws === 0 && nCases === 0
      ? `No landmark laws or Supreme Court cases on the Timeline fall in ${p.last}'s time in office.`
      : `${fmtInt(nLaws)} landmark law${nLaws === 1 ? "" : "s"} and ${fmtInt(nCases)} Supreme Court case${nCases === 1 ? "" : "s"} from ${p.last}'s time in office: the few the era is best remembered for, picked by hand for the Timeline page and set against who held Congress and the Court.`;

  return (
    <CardShell title="Landmark laws and cases" takeaway={takeaway} wide notes={NOTES.timeline} more={{ href: "/timeline", label: "Timeline" }}>
      <div ref={card} className="flex min-w-0 flex-col gap-2">
        <PowerChart
          data={payload}
          idx={idx}
          spans={spans}
          mode={MODE}
          range={[y0, y1]}
          minYear={y0}
          maxYear={y1}
          onRange={() => {}}
          events={events}
          open={open}
          setOpen={setOpen}
          stateOf={stateOf}
          byId={byId}
          onJump={jump}
          startIso={from}
          endIso={to}
        />
        <div className={LEGEND_ROW}>
          <span className={LEGEND_ITEM}>
            <i aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: partyColor("D") }} />
            Democratic · Court median leans liberal
          </span>
          <span className={LEGEND_ITEM}>
            <i aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: partyColor("R") }} />
            Republican · Court median leans conservative
          </span>
          <span className={LEGEND_ITEM}>
            <i aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: partyTint("D", 30) }} />
            White House and Congress, one party
          </span>
          <span className={LEGEND_ITEM}>
            <i aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm bg-ink" />
            Law
          </span>
          <span className={LEGEND_ITEM}>
            <i aria-hidden className="inline-block h-2.5 w-2.5 rounded-full bg-ink" />
            Court case
          </span>
        </div>
      </div>

      {list.length > 0 && (
        <>
          <div className="flex items-center gap-3 text-[0.68rem] font-medium uppercase tracking-[0.06em] text-ink-faint">
            <span>Passage votes and Court votes</span>
          </div>
          <ul tabIndex={0} aria-label="Landmark laws and cases, scrollable" className="m-0 flex max-h-[28rem] list-none flex-col overflow-x-hidden overflow-y-auto overscroll-contain p-0 touch-scroll">
            {list.map((e) => (
              <EventRow key={e.id} e={e} onOpen={jump} />
            ))}
          </ul>
        </>
      )}
    </CardShell>
  );
}

function EventRow({ e, onOpen }: { e: TlEvent; onOpen: (no: number) => void }) {
  const href = e.kind === "law" ? e.lawPath : e.casePath;
  const title = href ? (
    <Link href={href} className="min-w-0 text-ink underline decoration-line-strong underline-offset-2 hover:decoration-accent">
      {e.name}
    </Link>
  ) : (
    <a href={wikiUrl(e.wiki)} target="_blank" rel="noopener noreferrer" className="min-w-0 text-ink underline decoration-line-strong underline-offset-2 hover:decoration-accent">
      {e.name}
      <span className="sr-only"> (Wikipedia, opens in a new tab)</span>
    </a>
  );
  return (
    <li className="grid grid-cols-1 gap-x-3 gap-y-0.5 border-t border-line py-2 text-[0.82rem] first:border-t-0 sm:grid-cols-[6.5rem_minmax(0,1fr)]">
      <span className="font-mono text-[0.7rem] leading-[1.7] text-ink-muted">{dateLabel(e.date)}</span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <button type="button" onClick={() => onOpen(e.no)} aria-label={`Show ${e.name} on the chart`} className={`${numberBadge(e.kind)} cursor-pointer ${FOCUS_RING}`}>
            {e.no}
          </button>
          {title}
          {e.override && <span className="text-[0.68rem] text-ink-muted">· passed over a veto</span>}
        </span>
        <span className="mt-0.5 block text-[0.75rem] leading-[1.45] text-ink-muted">{e.what}</span>
        {e.kind === "law" ? (
          <span className="mt-1 flex gap-3">
            <MiniVote chamber="House" t={e.tally?.house ? [0, e.tally.house[0], e.tally.house[1]] : null} />
            <MiniVote chamber="Senate" t={e.tally?.senate ? [0, e.tally.senate[0], e.tally.senate[1]] : null} />
          </span>
        ) : (
          <span className="mt-1 block font-mono text-[0.7rem] text-ink-muted">
            Court vote {e.vote}
            {e.author && ` · opinion by ${e.author}`}
          </span>
        )}
      </span>
    </li>
  );
}

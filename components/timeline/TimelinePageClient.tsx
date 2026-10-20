"use client";

import { useCallback, useMemo, useRef, useState, type MouseEvent } from "react";
import { ChartCard } from "../charts/ChartCard";
import { ChartNotesRow } from "../charts/ChartNotesRow";
import { LEGEND_ITEM, LEGEND_ROW } from "../charts/legend";
import { TABLE_TOGGLE } from "../charts/table-toggle";
import { HowToRead } from "../HowToRead";
import { MethodologyNote } from "../MethodologyNote";
import { PageHeader } from "../PageHeader";
import { PageShortcuts } from "../PageShortcuts";
import { SourceLink } from "../SourceLink";
import { isPicked, setPicked, type Picked } from "@/lib/multi-select";
import { docUrl } from "@/lib/site-info";
import {
  buildEras,
  buildSpans,
  changePoints,
  fmtDate,
  inYears,
  lastName,
  powerIndex,
  seatsLabel,
  tileCounts,
  yearsByStatus,
  type CourtMode,
  type Kind,
  type PowerState,
  type PowerStatus,
} from "@/lib/timeline-derive";
import type { TimelinePayload, TlEvent } from "@/lib/timeline-types";
import { ERAS_ID, ErasCard } from "./ErasCard";
import { PowerChart, type OpenNote } from "./PowerChart";
import { partyColor, partyTint } from "./shared";
import { StatusTiles } from "./StatusTiles";
import { TimelineFilterBar } from "./TimelineFilterBar";

const MIN_YEAR = 1933;
const ALL_KINDS: readonly Kind[] = ["law", "case"];

/**
 * /timeline, "Who Held Power When It Happened?": the pinned filter bar, the page header, the four-row chart with its status
 * tiles, and the era list. One page-level state: the years shown, the event kinds, the Court measure, a status tile, the era
 * search and the open note. Everything that reads the Court (strip, tiles, eras, notes) follows the measure picked.
 */
export function TimelinePageClient({ data }: { data: TimelinePayload }) {
  const maxYear = Number(data.today.slice(0, 4));
  const [range, setRangeState] = useState<[number, number]>([MIN_YEAR, maxYear]);
  const [kinds, setKinds] = useState<Picked<Kind>>(null);
  const [mode, setModeState] = useState<CourtMode>("lean");
  const [status, setStatus] = useState<PowerStatus | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<OpenNote | null>(null);
  const chartCard = useRef<HTMLElement>(null);

  const idx = useMemo(() => powerIndex(data), [data]);
  const cuts = useMemo(() => changePoints(data), [data]);
  const spans = useMemo(() => buildSpans(idx, cuts, mode), [idx, cuts, mode]);
  const eras = useMemo(() => buildEras(spans), [spans]);
  const states = useMemo(() => new Map(data.events.map((e) => [e.no, idx.stateAt(e.date, mode)])), [data.events, idx, mode]);
  const stateOf = useCallback((e: TlEvent): PowerState => states.get(e.no)!, [states]);
  const byId = useMemo(() => new Map(data.events.map((e) => [e.id, e])), [data.events]);

  const kindOn = useMemo(() => new Set(ALL_KINDS.filter((k) => isPicked(kinds, k))), [kinds]);
  const shown = useMemo(() => data.events.filter((e) => kindOn.has(e.kind)), [data.events, kindOn]);
  const visible = useMemo(() => shown.filter((e) => !status || states.get(e.no)!.status === status), [shown, status, states]);
  const tiles = useMemo(() => tileCounts(data.events, (e) => stateOf(e).status, kindOn, range[0], range[1]), [data.events, stateOf, kindOn, range]);
  // The takeaway describes the whole timeline (rule 7c), in the Court measure picked.
  const years = useMemo(() => yearsByStatus(spans, MIN_YEAR, maxYear), [spans, maxYear]);
  const tileYears = useMemo(() => yearsByStatus(spans, range[0], range[1]), [spans, range]);

  const setRange = useCallback((r: [number, number]) => {
    setRangeState(r);
    setOpen(null);
  }, []);
  const setMode = (m: CourtMode) => {
    setModeState(m);
    setOpen(null);
    // A tile that no event falls under in the other measure clears.
    if (status && !data.events.some((e) => idx.stateAt(e.date, m).status === status)) setStatus(null);
  };

  /** Find an event on the timeline: widen the window, turn its kind back on and drop a status tile as needed, then pin its note. */
  const jumpTo = useCallback(
    (no: number) => {
      const e = data.events[no - 1]!;
      if (!inYears(e, range[0], range[1])) setRangeState([MIN_YEAR, maxYear]);
      if (!isPicked(kinds, e.kind)) setKinds(setPicked(kinds, e.kind, true, ALL_KINDS));
      if (status && states.get(no)!.status !== status) setStatus(null);
      setOpen({ no, pinned: true, focus: no });
      chartCard.current?.scrollIntoView({ behavior: "instant", block: "start" });
    },
    [data.events, range, maxYear, kinds, status, states],
  );

  const total = years.all4 + years.tri + years.split;
  const pct = (v: number) => `${Math.round((100 * v) / total)}%`;
  const nLaws = data.events.filter((e) => e.kind === "law").length;
  const nCases = data.events.length - nLaws;
  const jumpToEras = (ev: MouseEvent<HTMLAnchorElement>) => {
    const el = document.getElementById(ERAS_ID);
    if (!el) return;
    ev.preventDefault();
    const bar = document.querySelector<HTMLElement>("[data-pinned-bar]");
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - (bar?.offsetHeight ?? 0) - 12, behavior: calm ? "auto" : "smooth" });
  };

  const table = visible.filter((e) => inYears(e, range[0], range[1])).reverse();

  return (
    <>
      <TimelineFilterBar
        data={data}
        minYear={MIN_YEAR}
        maxYear={maxYear}
        range={range}
        onRange={setRange}
        kinds={kinds}
        onKinds={(k) => (setKinds(k), setOpen(null))}
        mode={mode}
        onMode={setMode}
      />
      <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-4 pb-16 pt-7 sm:px-6">
        <PageHeader title="Who Held Power When It Happened?">
          <p>
            Every landmark law and Supreme Court case since 1933, set against who held the White House, each chamber of Congress and the Court that
            day. Sometimes one party held everything and the big change followed. Just as often it didn&rsquo;t: Roe came from a Court of Republican
            appointees, and Dobbs from that Court&rsquo;s successors while Democrats held the White House and Congress.
          </p>
          <HowToRead>
            <p>
              The top four rows are the four institutions. The White House shows who was president; the Senate and House show the share of seats
              each party held at the start of each Congress (Democrats from the bottom, Republicans from the top, the dashed line is half); the
              Court shows which way its median justice leaned each term (bar down for liberal, up for conservative, grey near the centre). Set{" "}
              <i>Court</i> to <i>By appointing president</i> to see how many sitting justices each party&rsquo;s presidents appointed instead.
            </p>
            <p>
              The thin strip above them is filled when one party held the White House and both chambers and the Court leaned its way (liberal for
              Democrats, conservative for Republicans), and lightly tinted when the Court didn&rsquo;t. With <i>By appointing president</i>, the Court counts
              with the party that appointed most of it.
            </p>
            <p>
              Tap a president&rsquo;s name to zoom to their years in office; tap it again to see every year. Once zoomed in, markers with room
              beside them carry the law or case name.
            </p>
            <p>
              Numbered squares are laws and circles are Court cases, numbered in date order. Tap one to see the vote and who held power that day.
              Where events sit too close to tell apart, one marker holds them: &ldquo;22+4&rdquo; is event 22 and four more.
            </p>
          </HowToRead>
          <PageShortcuts>
            <p>
              <a
                href={`#${ERAS_ID}`}
                onClick={jumpToEras}
                className="font-medium text-accent underline decoration-line-strong underline-offset-2 hover:decoration-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                Browse all {data.events.length} events, era by era ↓
              </a>
            </p>
          </PageShortcuts>
        </PageHeader>

        <ChartCard
          ref={chartCard}
          className="scroll-mt-32"
          title="Who held each branch"
          lede={
            <span className="text-[0.875rem] text-ink">
              From {MIN_YEAR} to today, {mode === "lean" ? "one party held the White House and Congress with the Court leaning its way" : "one party held all four"} for{" "}
              <b className="font-semibold">{Math.round(years.all4)} years</b> ({pct(years.all4)}), the White House and Congress but not the Court for{" "}
              <b className="font-semibold">{Math.round(years.tri)}</b>, and power was divided for <b className="font-semibold">{Math.round(years.split)}</b>.
            </span>
          }
        >
          <StatusTiles tiles={tiles} years={tileYears} mode={mode} kinds={{ law: kindOn.has("law"), case: kindOn.has("case") }} pick={status} onPick={(s) => (setStatus(s), setOpen(null))} />
          <PowerChart
            data={data}
            idx={idx}
            spans={spans}
            mode={mode}
            range={range}
            minYear={MIN_YEAR}
            maxYear={maxYear}
            onRange={setRange}
            events={visible}
            kinds={kinds}
            query={query}
            open={open}
            setOpen={setOpen}
            stateOf={stateOf}
            byId={byId}
            onJump={jumpTo}
          />
          <div className={`${LEGEND_ROW} mt-1.5`}>
            <span className={LEGEND_ITEM}>
              <i aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: partyColor("D") }} />
              {mode === "lean" ? "Democratic · Court median leans liberal (bar down)" : "Democratic"}
            </span>
            <span className={LEGEND_ITEM}>
              <i aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: partyColor("R") }} />
              {mode === "lean" ? "Republican · Court median leans conservative (bar up)" : "Republican"}
            </span>
            <span className={LEGEND_ITEM}>
              <i aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: partyColor("T") }} />
              {mode === "lean" ? "Court at the centre" : "Court split evenly"}
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
          <ChartNotesRow>
            <MethodologyNote>
              <p>
                Seats are each party&rsquo;s count at the start of each Congress, from the{" "}
                <SourceLink id="house-party-division">House historian</SourceLink> and the{" "}
                <SourceLink id="senate-party-division">Senate Historical Office</SourceLink>; senators who caucused with a party count with it, and
                the tied Senates of 2001 and 2021 follow the vice president&rsquo;s vote. A justice counts with the party of the president who first
                appointed them, and a seat empty for under six months with the justice who left it. The Court&rsquo;s lean is the median
                justice&rsquo;s <SourceLink id="martin-quinn">Martin-Quinn score</SourceLink> each term, from October 1937; within 0.15 of zero is the
                centre. Case votes are from the <SourceLink id="scdb">Supreme Court Database</SourceLink> (from 1946), law votes from{" "}
                <SourceLink id="voteview">Voteview</SourceLink> (from 1973); earlier ones are typed in by hand. Full method in the{" "}
                <SourceLink href={docUrl("docs/TIMELINE_METHODOLOGY.md")}>timeline methodology</SourceLink>.
              </p>
            </MethodologyNote>
            <details>
              <summary className={TABLE_TOGGLE}>View as table</summary>
              <div className="touch-scroll relative mt-1.5 max-h-64 overflow-auto rounded-md border border-line" tabIndex={0} aria-label="Events table, scrollable">
                <table className="w-full min-w-[40rem] border-collapse text-[0.74rem]">
                  <thead>
                    <tr>
                      {["#", "Date", "Event", "President", "Senate", "House", "Court", "Vote"].map((h) => (
                        <th key={h} className="sticky top-0 border-b border-line-strong bg-surface-raised px-2 py-1 text-left text-[0.66rem] font-semibold uppercase tracking-[0.05em] text-ink-faint">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.map((e) => {
                      const s = states.get(e.no)!;
                      const court = mode === "lean" ? (s.lean ? `${{ D: "Liberal", R: "Conservative", T: "Centre", N: "—" }[s.C]} (${s.lean[1].toFixed(2)})` : "No score") : `${s.court.D}D–${s.court.R}R`;
                      const vote = e.kind === "case" ? e.vote : e.split?.house ? `${e.split.house.D[0] + e.split.house.R[0]}–${e.split.house.D[1] + e.split.house.R[1]} House` : "—";
                      return (
                        <tr key={e.no} className="font-mono text-ink [&>td]:whitespace-nowrap [&>td]:border-b [&>td]:border-line [&>td]:px-2 [&>td]:py-[3px]">
                          <td>{e.no}</td>
                          <td>{e.date}</td>
                          <td className="font-sans">{e.name}</td>
                          <td>
                            {lastName(s.pres.name)} ({s.P})
                          </td>
                          <td>
                            {s.S} {seatsLabel(s.cong.senate)}
                          </td>
                          <td>
                            {s.H} {seatsLabel(s.cong.house)}
                          </td>
                          <td>{court}</td>
                          <td>{vote}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </details>
          </ChartNotesRow>
        </ChartCard>

        <ErasCard eras={eras} mode={mode} range={range} status={status} events={shown} query={query} onQuery={(q) => (setQuery(q), setOpen(null))} onJump={jumpTo} today={data.today} byId={byId} />

        <p className="m-0 text-[0.8rem] leading-[1.6] text-ink-muted">
          Source: {nLaws} laws and {nCases} Supreme Court cases picked by hand (list last reviewed {fmtDate(data.reviewed)}), each linked to its{" "}
          <SourceLink id="wikipedia">Wikipedia</SourceLink> article. Party control and seats from the{" "}
          <SourceLink id="house-party-division">House</SourceLink> and <SourceLink id="senate-party-division">Senate</SourceLink> historians;
          justices&rsquo; service and appointing presidents from the <SourceLink id="fjc">Federal Judicial Center</SourceLink>; Court lean from{" "}
          <SourceLink id="martin-quinn">Martin-Quinn scores</SourceLink>; case votes from the <SourceLink id="scdb">Supreme Court Database</SourceLink>;
          law dates from <SourceLink id="congress-gov">Congress.gov</SourceLink> and votes from <SourceLink id="voteview">Voteview</SourceLink>.
        </p>
      </main>
    </>
  );
}

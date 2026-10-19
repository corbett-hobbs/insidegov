"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChartNotesRow } from "@/components/charts/ChartNotesRow";
import { MethodologyNote } from "@/components/MethodologyNote";
import { TABLE_TOGGLE } from "@/components/charts/table-toggle";
import { LEGEND_ITEM, LEGEND_ROW } from "@/components/charts/legend";
import { useMediaQuery } from "@/lib/use-media-query";
import { dateLabel, ordinalWord } from "@/lib/president-derive";
import { fmtExact, fmtInt, fmtValue } from "@/lib/president-format";
import type { AppointedJustice, CongressSummary, CountBreakdown, Party, SeriesPanel } from "@/lib/president-types";
import { TermSeriesChart } from "./TermSeriesChart";

/** Plot height of one panel; a card with fewer panels than its neighbour stretches its plots to match. */
const PLOT_H = 120;
/** Caption line, top margin, year axis and term band around each plot (TermSeriesChart's fixed parts), plus the gap between panels. */
const PANEL_CHROME = 22 + 16 + 18 + 6 + 22 + 16;

export interface PresidentLite {
  name: string;
  last: string;
  party: Party;
}

/**
 * The card chrome every president-page card shares. From `md` it is a subgrid over four row tracks (title, takeaway, body,
 * notes) that the pair shares, so two cards side by side keep their titles, plots and notes rows level (rule 10r); `wide`
 * spans both columns when a card has no partner. Below `md` it is a plain column.
 */
export function CardShell({ title, takeaway, wide, children, notes, table }: { title: string; takeaway: ReactNode; wide?: boolean; children: ReactNode; notes: ReactNode; table?: ReactNode }) {
  return (
    <section className={`flex min-w-0 flex-col rounded-[10px] border border-line bg-surface p-[1.1rem_1.1rem_0.9rem] md:row-span-4 md:grid md:grid-rows-subgrid md:gap-y-0 ${wide ? "md:col-span-2" : ""}`}>
      <h3 className="m-0 font-serif text-[1.3rem] font-medium leading-tight">{title}</h3>
      <p className="m-0 mt-1.5 text-[0.875rem] leading-[1.5] text-ink">{takeaway}</p>
      <div className="mt-3 flex min-w-0 flex-col gap-4">{children}</div>
      <ChartNotesRow className="mt-auto pt-3 md:w-full md:self-end">
        <MethodologyNote>{notes}</MethodologyNote>
        {table}
      </ChartNotesRow>
    </section>
  );
}

/** "Jan 2009 7.8% → Jan 2017 4.7%" for each term of a panel. */
function StartEnd({ panel }: { panel: SeriesPanel }) {
  return (
    <div className="flex flex-col items-end text-right font-mono text-[0.72rem] leading-[1.35] text-ink-muted">
      {panel.segments.map((s) => {
        const a = s.points[0];
        const b = s.points[s.points.length - 1];
        return (
          <span key={s.termId} className="whitespace-nowrap">
            {a.label} <span className="font-medium text-ink">{fmtValue(a.value, panel.format)}</span>
            {s.points.length > 1 && (
              <>
                {" → "}
                {b.label} <span className="font-medium text-ink">{fmtValue(b.value, panel.format)}</span>
              </>
            )}
          </span>
        );
      })}
    </div>
  );
}

function Panel({ panel, plotH, president }: { panel: SeriesPanel; plotH: number; president: PresidentLite }) {
  return (
    <div className="min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 text-[0.8rem] font-medium leading-tight text-ink">{panel.title}</p>
          {panel.coverage && <p className="m-0 mt-0.5 text-[0.72rem] text-ink-muted">{panel.coverage}</p>}
        </div>
        <StartEnd panel={panel} />
      </div>
      <TermSeriesChart panel={panel} height={plotH} president={president} />
      {panel.parts && (
        <div className={`${LEGEND_ROW} mt-1`}>
          <span className={LEGEND_ITEM}>
            <i aria-hidden className="inline-block size-2.5 rounded-[2px]" style={{ background: panel.color }} />
            {panel.lineTitle ?? panel.title}
          </span>
          {panel.parts.map((p) => (
            <span key={p.id} className={LEGEND_ITEM}>
              <i aria-hidden className="inline-block size-2.5 rounded-[2px]" style={{ background: p.color }} />
              {p.title}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Every value of every panel, one table per panel. */
function PanelTables({ panels }: { panels: readonly SeriesPanel[] }) {
  return (
    <details>
      <summary className={TABLE_TOGGLE}>View as table</summary>
      <div className="mt-2 flex max-h-72 flex-col gap-3 overflow-auto">
        {panels.map((p) => (
          <table key={p.id} className="w-full border-collapse text-left text-[0.75rem] tabular-nums">
            <caption className="pb-1 text-left text-[0.72rem] font-medium text-ink">{p.title}</caption>
            <thead className="sticky top-0 bg-surface-raised">
              <tr className="font-mono text-[0.65rem] uppercase tracking-[0.05em] text-ink-muted">
                <th scope="col" className="px-2 py-1.5">Period</th>
                <th scope="col" className="px-2 py-1.5">{p.lineTitle ?? "Value"}</th>
                {p.parts?.map((x) => (
                  <th key={x.id} scope="col" className="px-2 py-1.5">{x.title}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {p.segments.flatMap((s) =>
                s.points.map((pt) => (
                  <tr key={`${s.termId}-${pt.label}`} className="border-t border-line">
                    <th scope="row" className="px-2 py-1 font-normal">{pt.label}{pt.preliminary ? " (preliminary)" : ""}</th>
                    <td className="px-2 py-1">{fmtExact(pt.value, p.format)}</td>
                    {p.parts?.map((x) => {
                      const q = x.segments.find((g) => g.termId === s.termId)?.points.find((y) => y.x === pt.x);
                      return <td key={x.id} className="px-2 py-1">{q ? fmtExact(q.value, p.format) : "—"}</td>;
                    })}
                  </tr>
                )),
              )}
            </tbody>
          </table>
        ))}
      </div>
    </details>
  );
}

/** A card of one or two series panels; `slots` is the most panels either card in the row has. */
export function SeriesCard({ title, takeaway, panels, slots, wide, president, notes, footer }: { title: string; takeaway: ReactNode; panels: SeriesPanel[]; slots: number; wide?: boolean; president: PresidentLite; notes: ReactNode; footer?: ReactNode }) {
  const md = useMediaQuery("(min-width: 768px)");
  const extra = md ? slots - panels.length : 0;
  const plotH = PLOT_H + (extra > 0 ? (extra * (PLOT_H + PANEL_CHROME)) / panels.length : 0);
  return (
    <CardShell title={title} takeaway={takeaway} wide={wide} notes={notes} table={<PanelTables panels={panels} />}>
      {panels.map((p) => (
        <Panel key={p.id} panel={p} plotH={plotH} president={president} />
      ))}
      {footer}
    </CardShell>
  );
}

/** A ranked list of counts with a bar each, coloured like the matching page's charts. */
function Breakdown({ items, label }: { items: readonly CountBreakdown[]; label: string }) {
  const max = Math.max(1, ...items.map((i) => i.n));
  const total = items.reduce((a, b) => a + b.n, 0);
  return (
    <div>
      <p className="m-0 mb-1.5 text-[0.8rem] font-medium leading-tight text-ink">{label}</p>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {items.map((i) => (
          <li key={i.id} className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)_3.5rem] items-center gap-2 text-[0.78rem]">
            <span className="flex min-w-0 items-center gap-1.5">
              <i aria-hidden className="inline-block size-2.5 flex-none rounded-[2px]" style={{ background: i.color }} />
              <span className="truncate">{i.label}</span>
            </span>
            <span className="h-2.5 rounded-[2px]" style={{ width: `${(i.n / max) * 100}%`, background: i.color }} />
            <span className="text-right font-mono tabular-nums text-ink-muted">
              {fmtInt(i.n)}
              <span className="sr-only"> ({Math.round((i.n / total) * 100)}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Laws or executive orders: bars per year in office, then the split by topic. */
export function CountCard({ title, takeaway, panel, slots, breakdown, breakdownLabel, president, notes, coverage, wide }: { title: string; takeaway: ReactNode; panel: SeriesPanel; slots: number; breakdown: CountBreakdown[]; breakdownLabel: string; president: PresidentLite; notes: ReactNode; coverage?: string; wide?: boolean }) {
  return (
    <SeriesCard
      title={title}
      takeaway={takeaway}
      panels={[{ ...panel, coverage }]}
      slots={slots}
      wide={wide}
      president={president}
      notes={notes}
      footer={<Breakdown items={breakdown} label={breakdownLabel} />}
    />
  );
}

const partyName = (p: Party) => (p === "D" ? "Democrats" : "Republicans");
const chipStyle = (p: Party) => ({ background: `color-mix(in oklab, var(${p === "D" ? "--dem" : "--rep"}) 16%, var(--surface))`, borderLeft: `3px solid var(${p === "D" ? "--dem" : "--rep"})` });

function Chip({ chamber, party, seats }: { chamber: string; party: Party; seats: [number, number, number] }) {
  return (
    <span className="flex min-w-0 flex-col rounded-[3px] px-2 py-1 text-[0.75rem] leading-tight" style={chipStyle(party)}>
      <span className="font-medium text-ink">
        {chamber}: {party === "D" ? "Dem." : "Rep."}
      </span>
      <span className="font-mono text-[0.68rem] text-ink-muted">
        {seats[0]} D · {seats[1]} R{seats[2] ? ` · ${seats[2]} other` : ""}
      </span>
    </span>
  );
}

/** Who held the House and Senate in each Congress that sat during the time in office. */
export function CongressCard({ congress, takeaway, notes, wide }: { congress: CongressSummary; takeaway: ReactNode; notes: ReactNode; wide?: boolean }) {
  return (
    <CardShell title="Party control of Congress" takeaway={takeaway} wide={wide} notes={notes}>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {[...congress.rows].reverse().map((r) => (
          <li key={r.n} className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2">
            <span className="text-[0.8rem] leading-tight">
              <span className="font-medium text-ink">{ordinalWord(r.n)} Congress</span>
              <span className="block font-mono text-[0.68rem] text-ink-muted">
                {r.start.slice(0, 4) === r.end.slice(0, 4) ? r.start.slice(0, 4) : `${r.start.slice(0, 4)}–${r.end.slice(0, 4)}`}
              </span>
            </span>
            <Chip chamber="House" party={r.house} seats={r.houseSeats} />
            <Chip chamber={r.senateChanged ? "Senate*" : "Senate"} party={r.senate} seats={r.senateSeats} />
          </li>
        ))}
      </ul>
      {congress.rows.some((r) => r.senateChanged) && (
        <p className="m-0 text-[0.72rem] text-ink-muted">* The Senate majority changed hands during this Congress; the chip shows the party that held it longer while this president was in office.</p>
      )}
      <p className="m-0 text-[0.72rem] text-ink-muted">Seats are at the start of each Congress. {partyName("D")} and {partyName("R")} include the independents who caucused with them.</p>
    </CardShell>
  );
}

/** The justices the president put on the Court, newest first, each linking to the justice's page. */
export function JusticesCard({ justices, takeaway, notes, wide }: { justices: AppointedJustice[]; takeaway: ReactNode; notes: ReactNode; wide?: boolean }) {
  return (
    <CardShell title="Supreme Court appointments" takeaway={takeaway} wide={wide} notes={notes}>
      {justices.length === 0 ? (
        <p className="m-0 text-[0.85rem] text-ink-muted">No Supreme Court seat came open during this time in office.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {justices.map((j) => (
            <li key={`${j.id}-${j.role}`} className="flex items-center gap-3">
              {j.photo ? (
                // A pre-sized static asset from public/.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={j.photo} alt="" width={36} height={45} className="h-[45px] w-9 flex-none rounded-[4px] border border-line object-cover object-top" />
              ) : (
                <span aria-hidden className="h-[45px] w-9 flex-none rounded-[4px] border border-line bg-surface-raised" />
              )}
              <span className="min-w-0 text-[0.82rem] leading-snug">
                {j.path ? (
                  <Link href={j.path} className="font-medium text-ink underline decoration-line-strong underline-offset-2 hover:decoration-accent">
                    {j.name}
                  </Link>
                ) : (
                  <span className="font-medium text-ink">{j.name}</span>
                )}
                <span className="text-ink-muted"> · {j.elevated ? "Elevated to chief justice" : j.role}</span>
                <span className="block font-mono text-[0.68rem] text-ink-muted">
                  Nominated {dateLabel(j.nominated)}
                  {j.vote ? ` · confirmed ${j.vote.ayes}–${j.vote.nays}` : j.confirmed ? " · confirmed by voice vote" : ""}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </CardShell>
  );
}

/** The signed laws on David Mayhew's list of important enactments, newest first, in a scroll box. */
export function MajorLawsCard({ laws, notes, takeaway }: { laws: { title: string; date: string; path: string }[]; notes: ReactNode; takeaway: ReactNode }) {
  return (
    <CardShell title="Major laws signed" takeaway={takeaway} wide notes={notes}>
      <ul tabIndex={0} aria-label="Major laws, scrollable" className="m-0 flex max-h-[22rem] list-none flex-col overflow-y-auto overscroll-contain p-0 touch-scroll">
        {laws.map((l) => (
          <li key={l.path} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 border-t border-line py-1.5 text-[0.8rem] first:border-t-0">
            <span className="font-mono text-[0.7rem] leading-[1.6] text-ink-muted">{dateLabel(l.date)}</span>
            <Link href={l.path} className="line-clamp-2 text-ink underline decoration-line-strong underline-offset-2 hover:decoration-accent">
              {l.title}
            </Link>
          </li>
        ))}
      </ul>
    </CardShell>
  );
}


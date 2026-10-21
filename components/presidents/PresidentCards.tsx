"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ChartNotesRow } from "@/components/charts/ChartNotesRow";
import { MethodologyNote } from "@/components/MethodologyNote";
import { TABLE_TOGGLE } from "@/components/charts/table-toggle";
import { LEGEND_ITEM, LEGEND_ROW } from "@/components/charts/legend";
import { useMediaQuery } from "@/lib/use-media-query";
import { dateLabel, ordinalWord } from "@/lib/president-derive";
import { fmtExact, fmtInt, fmtValue } from "@/lib/president-format";
import type { AppointedJustice, CongressSummary, CountBreakdown, Party, SeriesPanel } from "@/lib/president-types";
import { HelpTip } from "@/components/charts/FilterBarParts";
import { TermSeriesChart } from "./TermSeriesChart";
import { methodText, yeaShare } from "@/lib/law-details-derive";
import type { ChamberTally } from "@/lib/laws-types";
import type { EarlyMajorLaw } from "@/lib/president-types";
import { EO_TOPIC_LABELS, type EoListItem } from "@/lib/executive-orders-types";
import { TopicSwatch } from "@/components/executive-orders/TopicSwatch";

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
/** Where a card's data comes from on the site, linked quietly at the end of its notes row. */
export interface MoreLink {
  href: string;
  label: string;
}

export function CardShell({ title, takeaway, wide, children, notes, table, more, className = "" }: { title: string; takeaway: ReactNode; wide?: boolean; className?: string; children: ReactNode; notes: ReactNode; table?: ReactNode; more?: MoreLink }) {
  return (
    <section className={`flex min-w-0 flex-col rounded-[10px] border border-line bg-surface p-[1.1rem_1.1rem_0.9rem] md:row-span-4 md:grid md:grid-rows-subgrid md:gap-y-0 ${wide ? "md:col-span-2" : ""} ${className}`}>
      <h3 className="m-0 font-serif text-[1.3rem] font-medium leading-tight">{title}</h3>
      <p className="m-0 mt-1.5 text-[0.875rem] leading-[1.5] text-ink">{takeaway}</p>
      <div className="mt-3 flex min-w-0 flex-col gap-4">{children}</div>
      <ChartNotesRow className="mt-auto pt-3 md:w-full md:self-end">
        <MethodologyNote>{notes}</MethodologyNote>
        {table}
        {more && (
          <Link href={more.href} className="ml-auto text-[0.75rem] text-ink-muted underline decoration-line-strong underline-offset-2 hover:text-ink hover:decoration-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
            {more.label} →
          </Link>
        )}
      </ChartNotesRow>
    </section>
  );
}

/** "Jan 2009 7.8% → Jan 2017 4.7%" for each term of a panel; a panel that draws several lines gets one row per line, led by its colour. */
function StartEnd({ panel }: { panel: SeriesPanel }) {
  const series = [
    { id: panel.id, color: panel.color, segments: panel.segments },
    ...(panel.parts ?? []),
  ];
  const multi = series.length > 1;
  return (
    <div className="flex max-w-full flex-col items-start text-left font-mono sm:items-end sm:text-right text-[0.72rem] leading-[1.35] text-ink-muted">
      {series.flatMap((line) =>
        line.segments.map((s) => {
          const a = s.points[0];
          const b = s.points[s.points.length - 1];
          if (!a) return null;
          return (
            <span key={`${line.id}-${s.termId}`} className="sm:whitespace-nowrap">
              {multi && <i aria-hidden className="mr-1.5 inline-block size-2 rounded-[2px] align-middle" style={{ background: line.color }} />}
              <span className="whitespace-nowrap">
                {a.label} <span className="font-medium text-ink">{fmtValue(a.value, panel.format)}</span>
              </span>
              {s.points.length > 1 && (
                <>
                  {" → "}
                  <span className="whitespace-nowrap">
                    {b.label} <span className="font-medium text-ink">{fmtValue(b.value, panel.format)}</span>
                  </span>
                </>
              )}
            </span>
          );
        }),
      )}
    </div>
  );
}

function Panel({ panel, plotH, president }: { panel: SeriesPanel; plotH: number; president: PresidentLite }) {
  return (
    <div className="min-w-0">
      {/* Wraps (StartEnd drops under the title) instead of squeezing the title when the card is narrow. */}
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div>
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
      <div className="relative mt-2 flex max-h-72 flex-col gap-3 overflow-auto">
        {panels.map((p) => (
          <table key={p.id} className="w-full border-collapse text-left text-[0.75rem] tabular-nums">
            <caption className="pb-1 text-left text-[0.72rem] font-medium text-ink">{p.title}</caption>
            <thead className="sticky top-0 bg-surface-raised">
              <tr className="font-mono text-[0.65rem] uppercase tracking-[0.05em] text-ink-muted">
                <th scope="col" className="px-2 py-1.5">Period</th>
                <th scope="col" className="px-2 py-1.5">{p.lineTitle ?? (p.stack ? "Total" : "Value")}</th>
                {p.stack?.map((g) => (
                  <th key={g.id} scope="col" className="px-2 py-1.5">{g.label}</th>
                ))}
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
                    {p.stack?.map((g, j) => (
                      <td key={g.id} className="px-2 py-1">{fmtExact(pt.stack?.[j] ?? 0, p.format)}</td>
                    ))}
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
export function SeriesCard({ title, takeaway, panels, slots, wide, president, notes, footer, more }: { title: string; takeaway: ReactNode; panels: SeriesPanel[]; slots: number; wide?: boolean; president: PresidentLite; notes: ReactNode; footer?: ReactNode; more?: MoreLink }) {
  const md = useMediaQuery("(min-width: 768px)");
  const extra = md ? slots - panels.length : 0;
  const plotH = PLOT_H + (extra > 0 ? (extra * (PLOT_H + PANEL_CHROME)) / panels.length : 0);
  return (
    <CardShell title={title} takeaway={takeaway} wide={wide} notes={notes} table={<PanelTables panels={panels} />} more={more}>
      {panels.map((p) => (
        <Panel key={p.id} panel={p} plotH={plotH} president={president} />
      ))}
      {footer}
    </CardShell>
  );
}

/** A ranked list of counts with a bar each, coloured like the matching page's charts. With `onSelect`, a row is a button that filters the card to that group (tap again to clear). */
function Breakdown({ items, label, selected, onSelect }: { items: readonly CountBreakdown[]; label: string; selected?: string | null; onSelect?: (id: string | null) => void }) {
  const max = Math.max(1, ...items.map((i) => i.n));
  const total = items.reduce((a, b) => a + b.n, 0);
  return (
    <div>
      <p className="m-0 mb-1.5 text-[0.8rem] font-medium leading-tight text-ink">
        {label}
        {onSelect && (
          <span className="ml-2 text-[0.72rem] font-normal text-ink-muted">
            {selected ? (
              <button type="button" onClick={() => onSelect(null)} className="cursor-pointer border-0 bg-transparent p-0 font-[inherit] text-accent underline underline-offset-2">
                Show all
              </button>
            ) : (
              "select one to filter"
            )}
          </span>
        )}
      </p>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {items.map((i) => {
          const dim = selected != null && selected !== i.id;
          const row = (
            <>
              <span className="flex min-w-0 items-center gap-1.5">
                <i aria-hidden className="inline-block size-2.5 flex-none rounded-[2px]" style={{ background: i.color }} />
                <span className="truncate">{i.label}</span>
              </span>
              <span className="h-2.5 rounded-[2px]" style={{ width: `${(i.n / max) * 100}%`, background: i.color }} />
              <span className="text-right font-mono tabular-nums text-ink-muted">
                {fmtInt(i.n)}
                <span className="sr-only"> ({Math.round((i.n / total) * 100)}%)</span>
              </span>
            </>
          );
          const grid = "grid w-full grid-cols-[minmax(0,11rem)_minmax(0,1fr)_3.5rem] items-center gap-2 text-[0.78rem]";
          return (
            <li key={i.id} className={dim ? "opacity-40" : ""}>
              {onSelect ? (
                <button type="button" aria-pressed={selected === i.id} onClick={() => onSelect(selected === i.id ? null : i.id)} className={`${grid} cursor-pointer rounded-[3px] border-0 bg-transparent p-0 text-left font-[inherit] text-inherit hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${selected === i.id ? "font-medium" : ""}`}>
                  {row}
                </button>
              ) : (
                <div className={grid}>{row}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The panel narrowed to one stacked group: its layer becomes the whole bar, so the axis rescales to it. */
function filterPanel(panel: SeriesPanel, group: string | null): SeriesPanel {
  const j = group ? (panel.stack?.findIndex((g) => g.id === group) ?? -1) : -1;
  if (j < 0 || !panel.stack) return panel;
  return {
    ...panel,
    stack: [panel.stack[j]],
    segments: panel.segments.map((seg) => ({
      ...seg,
      points: seg.points.map((pt) => ({
        ...pt,
        value: pt.stack?.[j] ?? 0,
        stack: [pt.stack?.[j] ?? 0],
      })),
    })),
  };
}

const chipStyle = (p: Party) => ({
  background: `color-mix(in oklab, var(${p === "D" ? "--dem" : "--rep"}) 16%, var(--surface))`,
  borderLeft: `3px solid var(${p === "D" ? "--dem" : "--rep"})`,
});

function Chip({ chamber, party, seats }: { chamber: string; party: Party; seats: [number, number, number] }) {
  return (
    <span className="flex h-full min-w-0 flex-col rounded-[3px] px-2 py-1 text-[0.75rem] leading-tight" style={chipStyle(party)}>
      <span className="whitespace-nowrap font-medium text-ink">
        {chamber}: {party === "D" ? "Dem." : "Rep."}
      </span>
      <span className="font-mono text-[0.68rem] text-ink-muted">
        {seats[0]} D · {seats[1]} R{seats[2] ? ` · ${seats[2]} other` : ""}
      </span>
    </span>
  );
}

/** Who held the House and Senate in each Congress that sat during the time in office. */
export function CongressCard({ congress, takeaway, notes, wide, more }: { congress: CongressSummary; takeaway: ReactNode; notes: ReactNode; wide?: boolean; more?: MoreLink }) {
  return (
    <CardShell title="Party control of Congress" takeaway={takeaway} wide={wide} notes={notes} more={more}>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {[...congress.rows].reverse().map((r) => (
          <li key={r.n} className="grid grid-cols-2 items-stretch gap-x-2 gap-y-1 sm:grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_minmax(0,1fr)] sm:items-center">
            {/* On a phone the label sits on its own line above the two chips, so both chips are the same width and height in every row. */}
            <span className="col-span-2 flex items-baseline gap-2 text-[0.8rem] leading-tight sm:col-span-1 sm:block">
              <span className="font-medium text-ink">{ordinalWord(r.n)} Congress</span>
              <span className="font-mono text-[0.68rem] text-ink-muted sm:block">{r.start.slice(0, 4) === r.end.slice(0, 4) ? r.start.slice(0, 4) : `${r.start.slice(0, 4)}–${r.end.slice(0, 4)}`}</span>
            </span>
            <Chip chamber="House" party={r.house} seats={r.houseSeats} />
            <Chip chamber={r.senateChanged ? "Senate*" : "Senate"} party={r.senate} seats={r.senateSeats} />
          </li>
        ))}
      </ul>
      {congress.rows.some((r) => r.senateChanged) && <p className="m-0 text-[0.72rem] text-ink-muted">* The Senate majority changed hands during this Congress; the chip shows the party that held it longer while this president was in office.</p>}
    </CardShell>
  );
}

/** The justices the president put on the Court, newest first, each linking to the justice's page. */
export function JusticesCard({ justices, takeaway, notes, wide, more }: { justices: AppointedJustice[]; takeaway: ReactNode; notes: ReactNode; wide?: boolean; more?: MoreLink }) {
  return (
    <CardShell title="Supreme Court appointments" takeaway={takeaway} wide={wide} notes={notes} more={more}>
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

/** The signed laws marked as important enactments, newest first, in a scroll box: summary sentence and passage votes under each title, as on the Laws page. */
/** Yea and nay are not party colours (the tallies are totals only); muted greys so the votes stay secondary to the titles. */
const YEA = "var(--ink-muted)";
const NAY = "var(--line)";

/** One chamber's passage vote: a small yea/nay bar and the tally, or how it passed when there was no recorded vote (null: a law before 1973 that passed without a roll call). */
export function MiniVote({ chamber, t }: { chamber: string; t: ChamberTally | null }) {
  const share = t && yeaShare(t[1], t[2]);
  return (
    <span className="inline-flex flex-none items-center gap-1.5 whitespace-nowrap text-[0.68rem] text-ink-muted sm:w-[9.25rem]">
      <span className="w-[2.3rem] flex-none sm:w-[2.6rem]">{chamber}</span>
      {t && t[0] === 0 && share !== null ? (
        <>
          <span aria-hidden className="flex h-1.5 w-8 flex-none overflow-hidden rounded-full sm:w-10" style={{ background: NAY }}>
            <span style={{ width: `${share * 100}%`, background: YEA }} />
          </span>
          <span className="whitespace-nowrap font-mono tabular-nums">{`${t[1]}–${t[2]}`}</span>
          <span className="sr-only">{` (${t[1]} yea, ${t[2]} nay)`}</span>
        </>
      ) : (
        <span className="truncate">{t ? methodText(t) : "No roll call"}</span>
      )}
    </span>
  );
}

/** One major law: the date and policy area on the top line (area at the right), then the title with its summary running on and wrapping, then the votes. */
function LawRow({ date, title, summary, area, house, senate }: { date: string; title: ReactNode; summary: string; area?: { label: string; color: string }; house: ChamberTally | null; senate: ChamberTally | null }) {
  return (
    <li className="border-b border-line py-2 text-[0.82rem] last:border-b-0">
      <span className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[0.7rem] leading-[1.7] text-ink-muted">{date}</span>
        {area && (
          <span className="inline-flex flex-none items-center gap-1 whitespace-nowrap text-[0.68rem] text-ink-muted">
            <i aria-hidden className="inline-block size-2 flex-none rounded-[2px]" style={{ background: area.color }} />
            {area.label}
          </span>
        )}
      </span>
      <span className="mt-0.5 block text-[0.75rem] leading-[1.55] text-ink-muted">
        <span className="text-[0.82rem]">{title}</span>
        {summary && <span className="ml-2">{summary}</span>}
      </span>
      <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
        <MiniVote chamber="House" t={house} />
        <MiniVote chamber="Senate" t={senate} />
      </span>
    </li>
  );
}

/**
 * The combined count card: bars per year in office with the split by group underneath, stacked on the left; a list of the items
 * behind the count on the right (same height as the left column, scrolls inside). Picking a group in the breakdown filters the
 * bars (axis rescales) and the list together; pick it again or "Show all" to clear. Laws signed and Executive orders signed use it.
 * `renderList(group, beside)` returns the list for the picked group id (null = all); `beside` says it sits in the right column.
 */
function CountListCard({
  title,
  takeaway,
  panel,
  coverage,
  breakdown,
  breakdownLabel,
  president,
  notes,
  more,
  wide,
  className,
  renderList,
}: {
  title: string;
  takeaway: ReactNode;
  panel: SeriesPanel;
  coverage?: string;
  breakdown: CountBreakdown[];
  breakdownLabel: string;
  president: PresidentLite;
  notes: ReactNode;
  more?: MoreLink;
  wide?: boolean;
  className?: string;
  renderList: (group: string | null) => ReactNode;
}) {
  const [group, setGroup] = useState<string | null>(null);
  return (
    <CardShell title={title} takeaway={takeaway} wide={wide} className={className} notes={notes} table={<PanelTables panels={[{ ...panel, coverage }]} />} more={more}>
      <div className="grid min-w-0 grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:gap-8">
        <div className="flex min-w-0 flex-col gap-4">
          <Panel panel={{ ...filterPanel(panel, group), coverage }} plotH={PLOT_H} president={president} />
          <Breakdown items={breakdown} label={breakdownLabel} selected={group} onSelect={setGroup} />
        </div>
        <div className="relative min-w-0 md:min-h-[26rem]">{renderList(group)}</div>
      </div>
    </CardShell>
  );
}

type MajorLawRow = {
  title: string;
  date: string;
  path: string;
  summary: string;
  votes: string;
  house: ChamberTally;
  senate: ChamberTally;
  area: { label: string; color: string };
  group: string;
};

/**
 * Laws signed, one card: the bars per year in office and the split by policy area (from 1973), beside the major laws, newest first, each
 * with its summary and passage votes (rule: one card per subject, so the count and the list behind it read together). Before 1973 only
 * the list. `listNote` is the note behind the list's "?": what "major" means and how it differs from the landmark card above.
 */
export function LawsCard({
  title,
  takeaway,
  count,
  president,
  major,
  early,
  listNote,
  notes,
  more,
}: {
  title: string;
  takeaway: ReactNode;
  count: {
    panel: SeriesPanel;
    coverage?: string;
    breakdown: CountBreakdown[];
  } | null;
  president: PresidentLite;
  major: MajorLawRow[];
  early: EarlyMajorLaw[];
  listNote: string;
  notes: ReactNode;
  more?: MoreLink;
}) {
  // A policy area narrows the list; pre-1973 laws have no area, so they drop out while one is picked.
  const buildList = (group: string | null) => {
    const shownMajor = group ? major.filter((l) => l.group === group) : major;
    const shownEarly = group ? [] : early;
    const n = shownMajor.length + shownEarly.length;
    // With the count beside it, the list is as tall as that column (the right side fills it, no white space under either side) and scrolls inside; alone it is capped.
    const beside = count !== null;
    return (
      (n > 0 || group !== null) && (
        <div className={`flex min-w-0 flex-col gap-2 ${beside ? "md:absolute md:inset-0" : ""}`}>
          <div className="relative flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center gap-2">
              <p className="m-0 text-[0.8rem] font-medium leading-tight text-ink">
                Major laws <span className="font-mono text-[0.72rem] font-normal text-ink-muted">{fmtInt(n)}</span>
              </p>
              <HelpTip label="What is a major law?" text={listNote} />
            </span>
            <span className="flex items-center gap-3 text-[0.68rem] font-medium uppercase tracking-[0.06em] text-ink-faint sm:ml-auto">
              <span>Passage votes</span>
              <span className="inline-flex items-center gap-1.5 normal-case tracking-normal">
                <i aria-hidden className="inline-block size-2 rounded-sm" style={{ background: YEA }} />
                Yea
              </span>
              <span className="inline-flex items-center gap-1.5 normal-case tracking-normal">
                <i aria-hidden className="inline-block size-2 rounded-sm" style={{ background: NAY }} />
                Nay
              </span>
            </span>
          </div>
          <ul tabIndex={0} aria-label="Major laws, scrollable" className={`relative m-0 flex list-none flex-col overflow-x-hidden overflow-y-auto overscroll-contain border-t border-line p-0 pr-3 touch-scroll ${beside ? "max-h-[30rem] md:max-h-none md:min-h-0 md:flex-1" : "max-h-[30rem]"}`}>
            {n === 0 && <li className="py-3 text-[0.8rem] text-ink-muted">No major laws in this policy area.</li>}
            {shownMajor.map((l) => (
              <LawRow
                key={l.path}
                date={dateLabel(l.date)}
                title={
                  <Link href={l.path} className="text-ink underline decoration-line-strong underline-offset-2 hover:decoration-accent">
                    {l.title}
                  </Link>
                }
                summary={l.summary}
                area={l.area}
                house={l.house}
                senate={l.senate}
              />
            ))}
            {shownEarly.map((l) => (
              <LawRow
                key={l.title}
                date={l.year !== null ? String(l.year) : l.congress ? `${ordinalWord(l.congress)} Congress` : ""}
                title={
                  l.href ? (
                    <a href={l.href} target="_blank" rel="noopener noreferrer" className="text-ink underline decoration-line-strong underline-offset-2 hover:decoration-accent">
                      {l.title}
                      <span className="sr-only"> (Wikipedia, opens in a new tab)</span>
                    </a>
                  ) : (
                    <span className="text-ink">{l.title}</span>
                  )
                }
                summary={l.summary}
                house={l.house}
                senate={l.senate}
              />
            ))}
          </ul>
        </div>
      )
    );
  };
  if (count) {
    return <CountListCard title={title} takeaway={takeaway} wide className="md:mt-6" panel={count.panel} coverage={count.coverage} breakdown={count.breakdown} breakdownLabel="By policy area" president={president} notes={notes} more={more} renderList={(g) => buildList(g) || <p className="m-0 text-[0.8rem] text-ink-muted">No major laws assessed for this term yet.</p>} />;
  }
  return (
    <CardShell title={title} takeaway={takeaway} wide className="md:mt-6" notes={notes} more={more}>
      {buildList(null)}
    </CardShell>
  );
}

/**
 * Executive orders signed, one card laid out like the laws card: the bars per year in office and the split by topic stacked on the
 * left, the term's orders newest first on the right in a box that scrolls inside the column.
 */
export function EosCard({ title, takeaway, panel, coverage, breakdown, orders: allOrders, president, notes, more }: { title: string; takeaway: ReactNode; panel: SeriesPanel; coverage?: string; breakdown: CountBreakdown[]; orders: EoListItem[]; president: PresidentLite; notes: ReactNode; more?: MoreLink }) {
  return (
    <CountListCard
      title={title}
      takeaway={takeaway}
      wide
      panel={panel}
      coverage={coverage}
      breakdown={breakdown}
      breakdownLabel="By topic"
      president={president}
      notes={notes}
      more={more}
      renderList={(topic) => {
        const orders = topic ? allOrders.filter((o) => o.topic === topic) : allOrders;
        return (
          <div className="flex min-w-0 flex-col gap-2 md:absolute md:inset-0">
            <p className="m-0 text-[0.8rem] font-medium leading-tight text-ink">
              Orders <span className="font-mono text-[0.72rem] font-normal text-ink-muted">{fmtInt(orders.length)}</span>
            </p>
            <ul tabIndex={0} aria-label="Executive orders, scrollable" className="relative m-0 flex max-h-[30rem] list-none flex-col overflow-x-hidden overflow-y-auto overscroll-contain border-t border-line p-0 pr-3 touch-scroll md:max-h-none md:min-h-0 md:flex-1">
              {orders.map((o) => (
                <li key={o.n} className="border-b border-line py-2 text-[0.82rem] last:border-b-0">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-mono text-[0.7rem] leading-[1.7] text-ink-muted">{dateLabel(o.signed)}</span>
                    <span className="inline-flex flex-none items-center gap-1 whitespace-nowrap text-[0.68rem] text-ink-muted">
                      <TopicSwatch topic={o.topic} size={8} />
                      {EO_TOPIC_LABELS[o.topic]}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-[0.75rem] leading-[1.55] text-ink-muted">
                    <a href={`https://www.federalregister.gov/d/${o.doc}`} target="_blank" rel="noopener noreferrer" className="text-[0.82rem] text-ink underline decoration-line-strong underline-offset-2 hover:decoration-accent">
                      <span className="font-mono text-[0.75rem] text-ink-muted">EO {o.n}:</span> {o.title}
                      <span className="sr-only"> (Federal Register, opens in a new tab)</span>
                    </a>
                    {o.summary && <span className="ml-2">{o.summary}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      }}
    />
  );
}

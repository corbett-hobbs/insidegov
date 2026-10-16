"use client";

import { TABLE_TOGGLE } from "@/components/charts/table-toggle";
import { useMemo, useState, type ReactNode } from "react";
import { FilterCaption } from "@/components/charts/FilterBarParts";
import { ChartCard } from "@/components/charts/ChartCard";
import { MultiSelectFilter, type MultiOption } from "@/components/charts/MultiSelectFilter";
import { PillGroup } from "@/components/charts/PillGroup";
import { RangeReset } from "@/components/charts/RangeReset";
import { RangeSelector } from "@/components/charts/RangeSelector";
import { TermBand, type BandTerm } from "@/components/charts/TermBand";
import { StackedBars, type StackBand, type StackColumn, type StackSeries } from "@/components/charts/StackedBars";
import { PageHeader } from "@/components/PageHeader";
import {
  EO_TOPICS,
  EO_TOPIC_LABELS,
  topicFill,
  type EoAdmin,
  type EoPayload,
  type EoTopic,
  type EoListItem,
  type EoYear,
} from "@/lib/executive-orders-types";
import { isOnly, isPicked, pickLabel, toggleOnly, type Picked } from "@/lib/multi-select";
import { sameRange, termYearRange, type YearRange } from "@/lib/year-range";
import { LegendToggle } from "@/components/charts/LegendToggle";
import { LEGEND_ROW_CAPPED } from "@/components/charts/legend";
import { TopicSwatch } from "./TopicSwatch";
import { MethodologyNote } from "@/components/MethodologyNote";
import { ChartNotesRow } from "@/components/charts/ChartNotesRow";
import { SourceLink } from "@/components/SourceLink";

type Mode = "count" | "share";

const MODES = [
  { value: "count", label: "Count" },
  { value: "share", label: "Share of year" },
] as const;

const TOPIC_ITEMS = EO_TOPICS.map((t) => ({ id: t, label: EO_TOPIC_LABELS[t] }));
const SERIES: StackSeries[] = EO_TOPICS.map((t) => ({ id: t, label: EO_TOPIC_LABELS[t], fill: topicFill(t) }));

const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const lastName = (name: string) => name.split(" ").pop() ?? name;
const pct = (n: number, d: number) => `${Math.round((n / (d || 1)) * 100)}%`;

/** A date as a column index: whole years from the first column plus the fraction of that year elapsed. */
function dateIndex(iso: string, firstYear: number): number {
  const d = new Date(`${iso}T00:00:00Z`);
  const y = d.getUTCFullYear();
  const start = Date.UTC(y, 0, 1);
  const days = (Date.UTC(y + 1, 0, 1) - start) / 86_400_000;
  return y - firstYear + (d.getTime() - start) / 86_400_000 / days;
}

function termBands(admins: readonly EoAdmin[], firstYear: number, columns: number): StackBand[] {
  return admins.flatMap((a) => {
    const from = Math.max(0, dateIndex(a.start, firstYear));
    const to = a.end
      ? Math.min(columns, dateIndex(new Date(Date.parse(`${a.end}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10), firstYear))
      : columns;
    return to > from ? [{ id: a.termId, label: lastName(a.president), from, to, fill: a.party === "Democratic" ? "var(--dem)" : "var(--rep)" }] : [];
  });
}

export function ExecutiveOrdersPageClient({ data }: { data: EoPayload }) {
  const [mode, setMode] = useState<Mode>("count");
  // Ticked topics (null = all). The chart draws only these; Share of year then reads "share of the year's orders".
  const [topics, setTopics] = useState<Picked<EoTopic>>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const first = data.years[0].year;
  const adminById = useMemo(() => new Map(data.administrations.map((a) => [a.termId, a])), [data.administrations]);
  const columns = useMemo<(StackColumn & { year: EoYear })[]>(
    () =>
      data.years.map((y) => ({
        key: String(y.year),
        label: String(y.year),
        sublabel: y.partial ? "YTD" : undefined,
        total: y.total,
        values: y.counts,
        year: y,
      })),
    [data.years],
  );
  const [range, setRange] = useState<YearRange | null>(null);
  const lastYear = data.years[data.years.length - 1].year;
  const full: YearRange = [first, lastYear];
  const [from, to] = range ?? full;
  const termRange = (a: EoAdmin) => termYearRange(Number(a.start.slice(0, 4)), a.end ? Number(a.end.slice(0, 4)) : null, first, lastYear);
  // The window reads as a president only when it is exactly their years (YearList's "clear" chip).
  const president = data.administrations.find((a) => sameRange(termRange(a), [from, to]))?.termId ?? null;
  const setWindow = (r: YearRange) => setRange(sameRange(r, full) ? null : r);
  const bandTerms = useMemo<BandTerm[]>(
    () =>
      data.administrations.map((a) => {
        const [tf, tt] = termRange(a);
        return { id: a.termId, label: `${a.president}, ${a.start.slice(0, 4)}–${a.end ? a.end.slice(0, 4) : "present"}`, last: lastName(a.president), initials: a.president.split(" ").map((w) => w[0]).join(""), party: a.party === "Democratic" ? "D" : "R", from: tf, to: tt };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.administrations, first, lastYear],
  );
  const series = useMemo(() => SERIES.filter((s) => isPicked(topics, s.id as EoTopic)), [topics]);
  const visible = useMemo(
    () =>
      columns
        .filter((c) => c.year.year >= from && c.year.year <= to)
        .map((c) => ({ ...c, total: EO_TOPICS.reduce((n, t) => n + (isPicked(topics, t) ? c.year.counts[t] : 0), 0), denom: c.year.total })),
    [columns, from, to, topics],
  );
  // The control's rows: orders per topic in the years shown, so each row says what ticking it would add.
  const topicOptions = useMemo<MultiOption<EoTopic>[]>(
    () => EO_TOPICS.map((t) => ({ id: t, label: EO_TOPIC_LABELS[t], swatch: topicFill(t), count: data.years.filter((y) => y.year >= from && y.year <= to).reduce((n, y) => n + y.counts[t], 0).toLocaleString("en-US") })),
    [data.years, from, to],
  );
  const bands = useMemo(() => termBands(data.administrations, from, visible.length), [data.administrations, from, visible.length]);
  const selectedYear = data.years.find((y) => String(y.year) === selected) ?? null;
  const last = data.years[data.years.length - 1];

  return (
    <>
      <div className="sticky top-0 z-40 border-b border-line-strong bg-surface/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1180px] flex-col px-4 py-2.5 sm:flex-row sm:items-center sm:px-6">
          {/* Phones: Topic alone on its row, so its label sits beside it (rule 5a); the slider and term band below. */}
          <div className="flex min-w-0 items-center gap-2">
            <FilterCaption phone>Topic</FilterCaption>
            <MultiSelectFilter label="Topic" noun="topics" options={topicOptions} value={topics} onChange={setTopics} className="flex-1 sm:w-[13rem] sm:flex-none" />
          </div>
          <RangeSelector
            min={first}
            max={lastYear}
            value={[from, to]}
            onChange={setWindow}
            format={String}
            ariaLabel="Years shown"
            below={<TermBand terms={bandTerms} min={first} max={lastYear} value={[from, to]} onChange={setWindow} />}
            action={<RangeReset show={!sameRange([from, to], full)} onReset={() => setRange(null)} className="mt-0.5 font-sans leading-none" />}
            className="mt-1.5 min-w-0 flex-1 sm:ml-5 sm:mt-0 sm:min-w-[240px]"
          />
        </div>
      </div>
      <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-4 pb-16 pt-7 sm:px-6">
        <PageHeader eyebrow="Presidency · Executive orders" title="How Many Executive Orders Does Each President Sign?">
          <p>
            Every executive order signed since 1994, counted by year and sorted
            by topic. Orders let a president direct the federal government
            without a new law, so how many each one signs, and on what, shows
            where they chose to act alone. Presidents act first through orders,
            and the economy, energy, immigration, trade, foreign aid and
            national security pages track what changed afterward.
          </p>
        </PageHeader>

        <ChartCard
          title="Executive orders signed per year, by topic"
          lede={`${data.total.toLocaleString("en-US")} orders signed ${first}–${last.year}, counted in the year they were signed. ${last.year} is year to date, through ${fmtDate(data.throughDate)}.`}
          action={<PillGroup ariaLabel="Chart view" options={MODES} value={mode} onChange={setMode} />}
        >
          {/* The topic key is the highlight control, in the shared legend style (rule 10g). Below `sm` it stays two rows tall and scrolls sideways (LEGEND_ROW_CAPPED), so the chart isn't pushed down the page. */}
          <div role="group" aria-label="Show only a topic" className={`${LEGEND_ROW_CAPPED} mb-3`}>
            {EO_TOPICS.map((t) => (
              <LegendToggle key={t} active={isOnly(topics, t)} dimmed={!isPicked(topics, t)} onClick={() => setTopics(toggleOnly(topics, t))} title={isOnly(topics, t) ? "Click to show every topic again" : "Click to show only this topic"}>
                <TopicSwatch topic={t} size={10} />
                {EO_TOPIC_LABELS[t]}
              </LegendToggle>
            ))}
          </div>

          <StackedBars
            columns={visible}
            series={series}
            mode={mode}
            highlight={null}
            selectedKey={selected}
            onSelect={setSelected}
            bands={bands}
            yAxisLabel={mode === "share" ? "SHARE OF YEAR’S ORDERS" : "EXECUTIVE ORDERS"}
            ariaLabel={`Stacked columns of executive orders signed per year, ${from} to ${to}, by topic. Select a column to list that year's orders.`}
            renderTooltip={(c) => <YearTooltip col={c} admins={adminById} mode={mode} topics={topics} throughDate={data.throughDate} />}
          />

          <YearList year={selectedYear} years={data.years} range={[from, to]} president={president} onClearPresident={() => setRange(null)} topics={topics} admins={adminById} onClearTopics={() => setTopics(null)} throughDate={data.throughDate} />

          <ChartNotesRow>
            <MethodologyNote>
              <p>
                Orders are counted in the year signed, each with one primary topic, so a year&rsquo;s columns sum to its total; in a transition year, orders before and after Inauguration Day go to the outgoing and incoming president. Topics are classifier-assisted: a language model read each title and issuing agencies, and orders that only amend or revoke another take its topic. A person checked a random sample of 100 and confirmed all of them; the rest are unreviewed. Counts show how many orders touched a subject, not how significant they were.
              </p>
              <p>
                The sentence under each order signed since January 2009 says what the order does (earlier orders have none yet). Claude (an AI model) wrote it from the order&rsquo;s full text in the <SourceLink id="federal-register-eo">Federal Register</SourceLink>, leading with the order&rsquo;s operative provisions (what it directs, establishes, amends or revokes) rather than its stated reasons. Each one is kept only if Claude also quoted, word for word, the clause of the order it rests on, every number in it appears in the order, and most of its words are the order&rsquo;s own. They are not reviewed by a person; the order itself, linked from its title, is the authority.
              </p>
            </MethodologyNote>
            <TableFallback years={data.years} />
          </ChartNotesRow>
        </ChartCard>


        <p className="m-0 text-[0.8rem] leading-[1.6] text-ink-muted">
            Source:{" "}
            <SourceLink id="federal-register-eo">Federal Register</SourceLink>{" "}
            (federalregister.gov API), executive orders signed {first} to present. Each order links to its
            Federal Register page.
        </p>
      </main>
    </>
  );
}

function YearTooltip({
  col,
  admins,
  mode,
  topics,
  throughDate,
}: {
  col: StackColumn & { year: EoYear };
  admins: Map<string, EoAdmin>;
  mode: Mode;
  topics: Picked<EoTopic>;
  throughDate: string;
}) {
  const y = col.year;
  return (
    <div className="flex min-w-[13rem] flex-col gap-1.5 text-[0.78rem]">
      <div>
        <div className="font-serif text-[0.95rem] font-medium">{y.year}</div>
        <div className="opacity-75">
          {y.total} executive orders{y.partial ? ` · year to date, through ${fmtDate(throughDate)}` : ""}
        </div>
      </div>
      {y.byTerm.length > 1 && (
        <div className="opacity-75">
          {y.byTerm
            .map((t) => `${lastName(admins.get(t.termId)?.president ?? "")} ${t.total}`)
            .join(" · ")}
        </div>
      )}
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
        {EO_TOPICS.filter((t) => y.counts[t] > 0 && isPicked(topics, t)).map((t) => (
          <li key={t} className="flex items-center gap-1.5">
            <TopicSwatch topic={t} size={10} backed />
            <span className="flex-1">{EO_TOPIC_LABELS[t]}</span>
            <span className="font-mono tabular-nums">{mode === "share" ? pct(y.counts[t], y.total) : y.counts[t]}</span>
            {mode === "share" && <span className="font-mono tabular-nums opacity-60">({y.counts[t]})</span>}
          </li>
        ))}
      </ul>
      <div className="opacity-60">Select to list these orders</div>
    </div>
  );
}

function YearList({
  year,
  years,
  range,
  president,
  onClearPresident,
  topics,
  admins,
  onClearTopics,
  throughDate,
}: {
  year: EoYear | null;
  years: readonly EoYear[];
  /** The years shown in the chart, inclusive. */
  range: readonly [number, number];
  president: string | null;
  onClearPresident: () => void;
  topics: Picked<EoTopic>;
  admins: Map<string, EoAdmin>;
  onClearTopics: () => void;
  throughDate: string;
}) {
  const topicText = pickLabel(topics, TOPIC_ITEMS, "topics");
  if (president) {
    const a = admins.get(president);
    const scope = year ? [year] : years;
    const all = scope.flatMap((y) => y.items).filter((i) => i.termId === president).sort((a, b) => b.n - a.n);
    const items = topics ? all.filter((i) => isPicked(topics, i.topic)) : all;
    return (
      <section aria-live="polite" aria-label={`Executive orders signed by ${a?.president ?? "this president"}`} className="mt-4 overflow-hidden rounded-lg border border-line">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line px-5 py-3">
          <h2 className="font-serif text-[1.05rem] font-medium">
            {a?.president}: {items.length} executive orders{year ? ` signed in ${year.year}` : ""}
          </h2>
          <button type="button" onClick={onClearPresident} className="text-[0.78rem] font-medium text-accent hover:underline">
            Show all presidents
          </button>
        </div>
        <ListNote items={items}>
          Newest first.
          {(topics || year) && ` Also filtered by${year ? ` year ${year.year}` : ""}${topics ? `${year ? " and" : ""} topic: ${topicText}` : ""}.`}
        </ListNote>
        <OrderRows items={items} showPresident={false} admins={admins} />
      </section>
    );
  }
  if (!year && topics) {
    // A topic with no year selected: every order on that topic in the years the chart shows, newest first.
    const items = years.filter((y) => y.year >= range[0] && y.year <= range[1]).flatMap((y) => y.items).filter((i) => isPicked(topics, i.topic)).sort((a, b) => b.n - a.n);
    return (
      <section aria-live="polite" aria-label={`Executive orders on ${topicText}`} className="mt-4 overflow-hidden rounded-lg border border-line">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line px-5 py-3">
          <h2 className="font-serif text-[1.05rem] font-medium">
            {topicText}: {items.length} executive orders, {range[0]}–{range[1]}
          </h2>
          <button type="button" onClick={onClearTopics} className="text-[0.78rem] font-medium text-accent hover:underline">
            Show all topics
          </button>
        </div>
        <ListNote items={items}>Newest first. Select a year in the chart to narrow the list to that year.</ListNote>
        <OrderRows items={items} showPresident admins={admins} />
      </section>
    );
  }
  if (!year) {
    // Nothing selected: every order in the years the chart shows, newest first.
    const items = years.filter((y) => y.year >= range[0] && y.year <= range[1]).flatMap((y) => y.items).sort((a, b) => b.n - a.n);
    return (
      <section aria-live="polite" aria-label="Executive orders in the years shown" className="mt-4 overflow-hidden rounded-lg border border-line">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line px-5 py-3">
          <h2 className="font-serif text-[1.05rem] font-medium">
            All executive orders: {items.length}, {range[0]}–{range[1]}
          </h2>
        </div>
        <ListNote items={items}>Newest first. Select a year or a topic in the chart to narrow the list.</ListNote>
        <OrderRows items={items} showPresident admins={admins} />
      </section>
    );
  }
  const items = topics ? year.items.filter((i) => isPicked(topics, i.topic)) : year.items;
  return (
    <section aria-live="polite" aria-label={`Executive orders signed in ${year.year}`} className="mt-4 overflow-hidden rounded-lg border border-line">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line px-5 py-3">
        <h2 className="font-serif text-[1.05rem] font-medium">
          {year.year}: {year.total} executive orders
          {year.partial && <span className="text-ink-muted"> (year to date, through {fmtDate(throughDate)})</span>}
        </h2>
        <div className="text-[0.78rem] text-ink-muted">
          {year.byTerm.map((t) => `${admins.get(t.termId)?.president ?? ""}: ${t.total}`).join(" · ")}
        </div>
      </div>
      <ListNote items={items}>
        Newest first.
        {topics && (
          <>
            {" "}Showing {items.length} of {year.total}, topic: {topicText}.{" "}
            <button type="button" onClick={onClearTopics} className="font-medium text-accent hover:underline">
              Show all topics
            </button>
          </>
        )}
      </ListNote>
      <OrderRows items={items} showPresident={year.byTerm.length > 1} admins={admins} />
    </section>
  );
}

/** The chart as a plain table (collapsed), as on the wealth scatter. */
function TableFallback({ years }: { years: readonly EoYear[] }) {
  return (
    <details className="mt-3">
      <summary className={TABLE_TOGGLE}>View as table</summary>
      <div className="mt-2 max-h-80 overflow-auto rounded-md border border-line">
        <table className="w-full border-collapse text-[0.78rem]">
          <thead className="sticky top-0 bg-surface-raised">
            <tr>
              {["Year", "Total", ...EO_TOPICS.map((t) => EO_TOPIC_LABELS[t])].map((h) => (
                <th key={h} scope="col" className="border-b border-line px-2 py-1.5 text-left font-mono text-[0.65rem] uppercase tracking-[0.05em] text-ink-faint">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {years.map((y) => (
              <tr key={y.year} className="border-b border-line last:border-0">
                <th scope="row" className="px-2 py-1 text-left font-medium">
                  {y.year}
                  {y.partial ? " (YTD)" : ""}
                </th>
                <td className="px-2 py-1 tabular-nums">{y.total}</td>
                {EO_TOPICS.map((t) => (
                  <td key={t} className="px-2 py-1 tabular-nums">
                    {y.counts[t]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/**
 * The order list is a fixed-height box that scrolls inside the card (every width): a long list can't
 * stretch the page, and `overscroll-contain` keeps a finger drag at the list's end from chaining into
 * the page. The page scrolls normally anywhere outside the box.
 */
function OrderRows({ items, showPresident, admins }: { items: EoYear["items"]; showPresident: boolean; admins: Map<string, EoAdmin> }) {
  return (
    <ol tabIndex={0} aria-label="Executive orders, scrollable" className="touch-scroll relative m-0 max-h-[32rem] list-none overflow-y-auto overscroll-contain p-0">
      {items.map((i) => (
        <li key={i.n} className="grid grid-cols-1 gap-x-3 gap-y-1 border-b border-line px-5 py-2.5 last:border-0 sm:grid-cols-[1fr_auto]">
          <div className="min-w-0">
            <a
              href={`https://www.federalregister.gov/d/${i.doc}`}
              className="text-[0.88rem] leading-snug text-ink hover:text-accent hover:underline"
            >
              <span className="font-mono text-[0.78rem] text-ink-faint">EO {i.n}:</span> {i.title}
              <span className="sr-only"> (Federal Register)</span>
            </a>
            <div className="mt-0.5 text-[0.72rem] text-ink-faint">
              Signed {fmtDate(i.signed)}
              {showPresident ? ` · ${admins.get(i.termId)?.president ?? ""}` : ""}
            </div>
            {i.summary && <OrderSummary text={i.summary} />}
          </div>
          <span className="flex items-center gap-1.5 text-[0.74rem] text-ink-muted sm:justify-end">
            <TopicSwatch topic={i.topic} size={10} />
            {EO_TOPIC_LABELS[i.topic]}
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * What the order does, in one or two sentences Claude wrote from the order's Federal Register text (the list's note above the rows
 * says they are AI-written; the Data notes say how they are checked). On phones it holds to three lines and a tap opens the rest; wider screens show it whole (≤300 characters).
 */
function OrderSummary({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <p className="m-0 mt-1 text-[0.78rem] leading-[1.45] text-ink-muted">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={`block w-full cursor-pointer border-0 bg-transparent p-0 text-left font-[inherit] text-inherit sm:cursor-text ${open ? "" : "max-sm:line-clamp-3"} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus`}
      >
        {text}
      </button>
    </p>
  );
}

/**
 * The strip above an order list: how it is sorted and filtered, plus, when any listed order has a summary, that the summaries are
 * AI-written. It says so once here rather than on every row; it rides along in every list view so narrowing the list never drops it.
 */
function ListNote({ items, children }: { items: readonly EoListItem[]; children: ReactNode }) {
  return (
    <div className="border-b border-line bg-surface-raised px-5 py-2 text-[0.78rem] text-ink-muted">
      {children}
      {items.some((i) => i.summary) && " The summary under each order is AI-written from the order's text in the Federal Register; see Data notes."}
    </div>
  );
}

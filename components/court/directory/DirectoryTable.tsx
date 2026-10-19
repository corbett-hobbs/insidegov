"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChartCard } from "@/components/charts/ChartCard";
import { ChartNotesRow } from "@/components/charts/ChartNotesRow";
import { ListSearch } from "@/components/ListSearch";
import { MethodologyNote } from "@/components/MethodologyNote";
import { SourceLink } from "@/components/SourceLink";
import { fmtScore } from "@/lib/court-types";
import {
  FIRST_DIR,
  MIN_VOTES_FOR_RATE,
  filterRows,
  fmtRate,
  fmtYears,
  sortRows,
  tableTakeaway,
  tenureYears,
  type DirectoryRow,
  type SortDir,
  type SortKey,
} from "@/lib/justice-directory";
import { justicePath } from "@/lib/justice-url";

const partyVar = (p: "D" | "R") => (p === "D" ? "var(--dem)" : "var(--rep)");

/** Justice, Served, Appointed by, Years, Opinions, Dissent rate, Latest, Career: one grid for the header and every row from `lg`. */
const COLS = "lg:grid-cols-[minmax(9rem,1.3fr)_6.5rem_minmax(8rem,1fr)_4rem_5.25rem_5.25rem_4.75rem_4.75rem]";

const COLUMNS: { key: SortKey; label: string; short: string; title?: string; right?: boolean }[] = [
  { key: "name", label: "Justice", short: "Name" },
  { key: "start", label: "Served", short: "First day on the Court" },
  { key: "years", label: "Years", short: "Years served", right: true },
  { key: "opinions", label: "Opinions", short: "Majority opinions", title: "Majority opinions written, argued cases since the 1946 term", right: true },
  { key: "dissent", label: "Dissent %", short: "Dissent rate", title: "Share of the cases the justice voted in where they dissented", right: true },
  { key: "latest", label: "Latest", short: "Latest score", title: "Martin–Quinn score in the justice's latest term (negative is more liberal)", right: true },
  { key: "career", label: "Career", short: "Career score", title: "Average of the justice's Martin–Quinn scores across their terms", right: true },
];

const num = (n: number | null, partial: boolean) => (n === null ? "—" : `${n}${partial ? "†" : ""}`);

/**
 * "Every justice": all 49 as a sortable list. From `lg` it is a table (click a heading to sort, again to reverse); on a phone each
 * justice is a short card with the same figures and a sort menu. Long list, so it scrolls in a fixed-height box (rule 7).
 */
export function DirectoryTable({ rows }: { rows: readonly DirectoryRow[] }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "start", dir: "desc" });
  const [query, setQuery] = useState("");
  const shown = useMemo(() => sortRows(filterRows(rows, query), sort.key, sort.dir), [rows, query, sort]);
  const pick = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: FIRST_DIR[key] }));

  return (
    <ChartCard
      title="Every justice"
      takeaway={tableTakeaway(rows)}
      action={<ListSearch value={query} onChange={setQuery} label="Search justices by name or appointing president" />}
    >
      {/* Phones: the headings are not on screen, so the sort is a menu. */}
      <div className="mb-1 flex items-center gap-2 lg:hidden">
        <label htmlFor="justice-sort" className="font-mono text-[0.68rem] uppercase tracking-[0.08em] text-ink-faint">
          Sort by
        </label>
        <select
          id="justice-sort"
          value={sort.key}
          onChange={(e) => setSort({ key: e.target.value as SortKey, dir: FIRST_DIR[e.target.value as SortKey] })}
          className="h-8 min-w-0 flex-1 rounded border border-line-strong bg-surface-raised px-2 text-[0.8rem] text-ink"
        >
          {COLUMNS.map((c) => (
            <option key={c.key} value={c.key}>
              {c.short}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setSort((s) => ({ ...s, dir: s.dir === "asc" ? "desc" : "asc" }))}
          aria-label={`Sorted ${sort.dir === "asc" ? "ascending" : "descending"}; reverse`}
          className="h-8 rounded border border-line-strong bg-surface-raised px-2.5 font-mono text-[0.8rem] text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {sort.dir === "asc" ? "↑" : "↓"}
        </button>
      </div>

      <div role="row" className={`hidden items-end gap-x-3 border-b border-line-strong pb-1.5 font-mono text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint lg:grid ${COLS}`}>
        {[COLUMNS[0], COLUMNS[1]].map((c) => (
          <HeadButton key={c.key} c={c} sort={sort} onPick={pick} />
        ))}
        <span>Appointed by</span>
        {COLUMNS.slice(2).map((c) => (
          <HeadButton key={c.key} c={c} sort={sort} onPick={pick} />
        ))}
      </div>

      <div tabIndex={0} aria-label="Every justice; scroll to see them all" className="touch-scroll relative max-h-[28rem] overflow-y-auto overscroll-contain lg:max-h-[34rem]">
        {shown.length === 0 ? (
          <p className="m-0 py-4 text-sm text-ink-muted">No justice matches &ldquo;{query}&rdquo;.</p>
        ) : (
          <ol className="m-0 list-none p-0">
            {shown.map((r) => (
              <li key={r.id} className={`border-b border-line py-2.5 last:border-b-0 lg:grid lg:items-center lg:gap-x-3 lg:py-1.5 ${COLS}`}>
                <div className="min-w-0">
                  <Link href={justicePath(r)} className="font-serif text-[1rem] font-medium text-ink underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
                    {r.name}
                  </Link>
                  {r.chiefNow ? <span className="ml-1.5 font-mono text-[0.62rem] uppercase tracking-[0.06em] text-ink-faint">Chief Justice</span> : r.chief ? <span className="ml-1.5 font-mono text-[0.62rem] uppercase tracking-[0.06em] text-ink-faint">Former Chief</span> : null}
                  <p className="m-0 text-[0.78rem] text-ink-muted lg:hidden">
                    {tenureYears(r)} · <Party r={r} />
                  </p>
                </div>
                <span className="hidden text-[0.82rem] tabular-nums text-ink-muted lg:block">{tenureYears(r)}</span>
                <span className="hidden text-[0.82rem] text-ink-muted lg:block">
                  <Party r={r} />
                </span>
                <dl className="m-0 mt-1.5 grid grid-cols-5 gap-x-2 gap-y-1 text-[0.82rem] lg:contents">
                  <Stat label="Years" value={fmtYears(r.yearsServed)} />
                  <Stat label="Opinions" title="Majority opinions written, argued cases since the 1946 term" value={num(r.majorityOpinions, r.partialRecord)} />
                  <Stat label="Dissent" title="Share of the cases voted in where the justice dissented" value={r.dissentRate === null ? "—" : `${fmtRate(r.dissentRate)}${r.partialRecord ? "†" : ""}`} />
                  <Stat label="Latest" title={`Martin–Quinn score, ${r.latestTerm} term`} value={fmtScore(r.latestScore)} />
                  <Stat label="Career" title="Average Martin–Quinn score across terms" value={fmtScore(r.careerScore)} />
                </dl>
              </li>
            ))}
          </ol>
        )}
      </div>

      <ChartNotesRow>
        <MethodologyNote>
          <p>
            Opinions and dissents come from the justice-centered <SourceLink id="scdb">Supreme Court Database</SourceLink>: argued cases from the 1946 term on, so justices who sat earlier have no counts (—), and those who sat before and after show a partial record (†). Opinions are majority opinions the justice wrote. The dissent rate is dissenting votes divided by cases where the justice took a side; an equally divided Court or a recusal counts as neither. The takeaway compares only justices with {MIN_VOTES_FOR_RATE}+ such votes. Scores are <SourceLink id="martin-quinn">Martin–Quinn</SourceLink>, negative more liberal, the latest term and the average of all of a justice&rsquo;s terms. Years served are completed years.
          </p>
        </MethodologyNote>
      </ChartNotesRow>
    </ChartCard>
  );
}

function Party({ r }: { r: DirectoryRow }) {
  return (
    <>
      <span aria-hidden className="mr-1 inline-block size-[0.5rem] rounded-full align-baseline" style={{ background: partyVar(r.party) }} />
      <span className="sr-only">{r.party === "D" ? "Democratic" : "Republican"} appointee: </span>
      {r.president}
    </>
  );
}

function Stat({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div title={title} className="min-w-0 lg:text-right">
      <dt className="font-mono text-[0.62rem] uppercase tracking-[0.06em] text-ink-faint lg:sr-only">{label}</dt>
      <dd className="m-0 tabular-nums text-ink">{value}</dd>
    </div>
  );
}

function HeadButton({ c, sort, onPick }: { c: (typeof COLUMNS)[number]; sort: { key: SortKey; dir: SortDir }; onPick: (k: SortKey) => void }) {
  const active = sort.key === c.key;
  return (
    <button
      type="button"
      role="columnheader"
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      title={c.title ?? `Sort by ${c.short.toLowerCase()}`}
      onClick={() => onPick(c.key)}
      className={`flex items-center gap-1 uppercase tracking-[0.06em] hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${c.right ? "justify-end" : ""} ${active ? "text-ink" : ""}`}
    >
      {c.label}
      <span aria-hidden className="w-2 text-[0.6rem]">
        {active ? (sort.dir === "asc" ? "↑" : "↓") : ""}
      </span>
    </button>
  );
}

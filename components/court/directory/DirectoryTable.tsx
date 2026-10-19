"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChartCard } from "@/components/charts/ChartCard";
import { ChartNotesRow } from "@/components/charts/ChartNotesRow";
import { ListSearch } from "@/components/ListSearch";
import { MethodologyNote } from "@/components/MethodologyNote";
import { SourceLink } from "@/components/SourceLink";
import { LeanGlyph } from "./LeanGlyph";
import {
  FIRST_DIR,
  MIN_VOTES_FOR_RATE,
  filterRows,
  fmtRate,
  fmtYears,
  sortRows,
  tableTakeaway,
  tenureYears,
  votingLean,
  type DirectoryRow,
  type SortDir,
  type SortKey,
} from "@/lib/justice-directory";
import { justicePath } from "@/lib/justice-url";

const partyVar = (p: "D" | "R") => (p === "D" ? "var(--dem)" : "var(--rep)");

/** Justice, Served, Appointed by, Years, Opinions, Dissent rate, Voting lean: one grid for the header and every row from `lg`. */
const COLS = "xl:grid-cols-[minmax(12rem,1.2fr)_6.25rem_minmax(7.5rem,1fr)_3.25rem_4.75rem_5.75rem_minmax(19.5rem,1.4fr)]";

const COLUMNS: { key: SortKey; label: string; short: string; title?: string; right?: boolean }[] = [
  { key: "name", label: "Justice", short: "Name" },
  { key: "start", label: "Served", short: "First day on the Court" },
  { key: "years", label: "Years", short: "Years served", right: true },
  { key: "opinions", label: "Opinions", short: "Majority opinions", title: "Majority opinions written, argued cases since the 1946 term", right: true },
  { key: "dissent", label: "Dissent %", short: "Dissent rate", title: "Share of the cases the justice voted in where they dissented", right: true },
  { key: "lean", label: "Voting lean", short: "Voting lean", title: "Where the justice's votes fall on a left–right scale, and whether that moved from their first terms to their latest (sorts by the latest term, most conservative first)" },
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
      <div className="mb-1 flex items-center gap-2 xl:hidden">
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

      <div role="row" className={`hidden items-end gap-x-3 border-b border-line-strong pb-1.5 font-mono text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint xl:grid ${COLS}`}>
        {[COLUMNS[0], COLUMNS[1]].map((c) => (
          <HeadButton key={c.key} c={c} sort={sort} onPick={pick} />
        ))}
        <span>Appointed by</span>
        {COLUMNS.slice(2).map((c) => (
          <HeadButton key={c.key} c={c} sort={sort} onPick={pick} />
        ))}
      </div>

      <div tabIndex={0} aria-label="Every justice; scroll to see them all" className="touch-scroll relative max-h-[28rem] overflow-y-auto overscroll-contain xl:max-h-[34rem]">
        {shown.length === 0 ? (
          <p className="m-0 py-4 text-sm text-ink-muted">No justice matches &ldquo;{query}&rdquo;.</p>
        ) : (
          <ol className="m-0 list-none p-0">
            {shown.map((r) => (
              <li key={r.id} className={`border-b border-line py-2.5 last:border-b-0 xl:grid xl:items-center xl:gap-x-3 xl:py-1.5 ${COLS}`}>
                <div className="flex min-w-0 items-center gap-3">
                  <Portrait r={r} />
                  <div className="min-w-0">
                    <Link href={justicePath(r)} className="font-serif text-[1rem] font-medium text-ink underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
                      {r.name}
                    </Link>
                    {r.chiefNow ? <span className="ml-1.5 font-mono text-[0.62rem] uppercase tracking-[0.06em] text-ink-faint">Chief Justice</span> : r.chief ? <span className="ml-1.5 font-mono text-[0.62rem] uppercase tracking-[0.06em] text-ink-faint">Former Chief</span> : null}
                    <p className="m-0 text-[0.78rem] text-ink-muted xl:hidden">
                      {tenureYears(r)} · <Party r={r} />
                    </p>
                  </div>
                </div>
                <span className="hidden text-[0.82rem] tabular-nums text-ink-muted xl:block">{tenureYears(r)}</span>
                <span className="hidden text-[0.82rem] text-ink-muted xl:block">
                  <Party r={r} />
                </span>
                <dl className="m-0 mt-2.5 grid grid-cols-3 text-center text-[0.82rem] xl:contents xl:text-left">
                  <Stat label="Years" value={fmtYears(r.yearsServed)} />
                  <Stat label="Opinions" title="Majority opinions written, argued cases since the 1946 term" value={num(r.majorityOpinions, r.partialRecord)} />
                  <Stat label="Dissent" title="Share of the cases voted in where the justice dissented" value={r.dissentRate === null ? "—" : `${fmtRate(r.dissentRate)}${r.partialRecord ? "†" : ""}`} />
                  <div
                    title={`Martin–Quinn scores: first terms ${r.firstScore.toFixed(2)}, ${r.latestTerm} term ${r.latestScore.toFixed(2)} (negative is more liberal)`}
                    className="col-span-3 mt-2.5 min-w-0 border-t border-dashed border-line pt-2 xl:col-span-1 xl:mt-0 xl:border-t-0 xl:pt-0"
                  >
                    <dt className="font-mono text-[0.62rem] uppercase tracking-[0.06em] text-ink-faint xl:sr-only">Voting lean</dt>
                    <dd className="m-0 mt-1.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-left xl:mt-0 xl:flex-nowrap xl:justify-start xl:gap-2.5">
                      <span className="min-w-10 max-w-[7.5rem] flex-initial basis-16 xl:w-[4.5rem] xl:max-w-none xl:flex-none xl:basis-auto">
                        <LeanGlyph row={r} />
                      </span>
                      {/* The slot is as wide as the longest phrase, so the glyph and text start at the same x on every row (the glyph is what you compare down the list) and never wrap. */}
                      <span className="grid flex-none whitespace-nowrap leading-snug text-ink">
                        <span aria-hidden className="invisible col-start-1 row-start-1">From right of center to conservative</span>
                        <span className="col-start-1 row-start-1">{votingLean(r)}</span>
                      </span>
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ol>
        )}
      </div>

      <ChartNotesRow>
        <MethodologyNote>
          <p>
            Opinions and dissents come from the justice-centered <SourceLink id="scdb">Supreme Court Database</SourceLink>: argued cases from the 1946 term on, so justices who sat earlier have no counts (—), and those who sat before and after show a partial record (†). Opinions are majority opinions the justice wrote. The dissent rate is dissenting votes divided by cases where the justice took a side; an equally divided Court or a recusal counts as neither. The takeaway compares only justices with {MIN_VOTES_FOR_RATE}+ such votes. Voting lean is measured from how justices vote, not from stated views, using <SourceLink id="martin-quinn">Martin–Quinn</SourceLink> scores: the average of the first three scored terms against the latest term, put into fixed bands from liberal to conservative. A change under 0.6 points, or one that stays in the same band, reads &ldquo;throughout&rdquo;; fewer than four scored terms gives only a position. Years served are completed years.
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

/** A justice's portrait with a bottom stripe in the appointing president's party colour, the same stripe the Court-today cards carry; initials when there is no portrait. */
function Portrait({ r }: { r: DirectoryRow }) {
  return (
    <span className="relative block h-[4.25rem] w-[3.25rem] shrink-0 overflow-hidden rounded border border-line-strong bg-surface-raised xl:h-[3.6rem] xl:w-11">
      {r.photoSrc ? (
        // Pre-sized static assets from public/; see JusticeHeader for why this is not next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={r.photoSrc} alt="" width={330} height={440} loading="lazy" className="size-full object-cover object-top" />
      ) : (
        <span aria-hidden className="flex size-full items-center justify-center font-serif text-lg text-ink-faint">
          {r.short[0]}
        </span>
      )}
      <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: partyVar(r.party) }} />
    </span>
  );
}

function Stat({ label, value, title, left }: { label: string; value: string; title?: string; left?: boolean }) {
  return (
    <div title={title} className={`min-w-0 ${left ? "" : "xl:text-right"}`}>
      <dt className="font-mono text-[0.62rem] uppercase tracking-[0.06em] text-ink-faint xl:sr-only">{label}</dt>
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
      className={`flex items-center gap-1 whitespace-nowrap uppercase tracking-[0.06em] hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${c.right ? "justify-end" : ""} ${active ? "text-ink" : ""}`}
    >
      {c.label}
      <span aria-hidden className="w-2 text-[0.6rem]">
        {active ? (sort.dir === "asc" ? "↑" : "↓") : ""}
      </span>
    </button>
  );
}

import Link from "next/link";
import { MethodologyNote } from "@/components/MethodologyNote";
import { PageHeader } from "@/components/PageHeader";
import { SourceLink } from "@/components/SourceLink";
import { controlLabel, ordinalWord, sparkPaths, termYears, yearsOfDays } from "@/lib/president-derive";
import { fmtInt, tenureText } from "@/lib/president-format";
import { presidentPath } from "@/lib/president-url";
import type { Party, PresidentSummary } from "@/lib/president-types";
import type { TimelinePayload } from "@/lib/timeline-types";
import { JusticeFaces } from "./JusticeFaces";
import { PresidentsPowerChart } from "./PresidentsPowerChart";
import { PresidentPortrait } from "./PresidentPortrait";
import { UpNext } from "@/components/UpNext";

const HEAD = "font-mono text-[0.65rem] uppercase tracking-[0.06em] text-ink-muted";
const COLS = "md:grid-cols-[3rem_minmax(0,1.5fr)_minmax(0,0.95fr)_minmax(0,1.05fr)_minmax(0,1.1fr)_minmax(0,1.15fr)_minmax(0,1fr)]";
const LABEL = "text-[0.68rem] leading-tight text-ink-muted md:sr-only";

function partyVar(p: Party) {
  return `var(${p === "D" ? "--dem" : "--rep"})`;
}

/** Major laws: the count, and the biggest one under it. */
function MajorLaws({ r }: { r: PresidentSummary }) {
  const note = r.noLawsData ? "data from 1973" : r.major === null ? "not yet assessed" : !r.majorFromStart ? "from 1973" : r.majorPartial ? "later term not yet assessed" : null;
  return (
    <span className="flex min-w-0 flex-col">
      <span className={LABEL}>Major laws</span>
      <span className="font-mono text-[0.95rem] tabular-nums text-ink">{r.major === null ? "—" : fmtInt(r.major)}</span>
      {r.majorTop && <span className="line-clamp-2 text-[0.7rem] leading-tight text-ink-muted">incl. {r.majorTop.title}</span>}
      {note && <span className="text-[0.66rem] leading-tight text-ink-faint">{note}</span>}
    </span>
  );
}

/** A thin three-state bar: days the president's party held both chambers, one, or neither. */
function CongressBar({ r }: { r: PresidentSummary }) {
  const { both, one, neither } = r.control;
  const total = both + one + neither;
  const pct = (n: number) => `${(n / total) * 100}%`;
  return (
    <span className="flex min-w-0 flex-col gap-1">
      <span className={LABEL}>Congress on their side</span>
      <span role="img" aria-label={`${controlLabel(r.control)}; ${yearsOfDays(one)} yrs one chamber; ${yearsOfDays(neither)} yrs neither`} className="flex h-2 w-full overflow-hidden rounded-full" style={{ background: NEITHER }}>
        <span style={{ width: pct(both), background: partyVar(r.party) }} />
        <span style={{ width: pct(one), background: `color-mix(in oklab, ${partyVar(r.party)} 40%, var(--surface))` }} />
      </span>
      <span className="font-mono text-[0.72rem] leading-tight text-ink-muted">{controlLabel(r.control)}</span>
    </span>
  );
}

const NEITHER = "var(--line-strong)";

/** Misery index across the time in office, start → end. Conditions during the term, not a grade. */
function Economy({ r }: { r: PresidentSummary }) {
  const m = r.misery;
  if (!m) {
    return (
      <span className="hidden min-w-0 flex-col md:flex">
        <span className="font-mono text-[0.95rem] text-ink">—</span>
        <span className="text-[0.66rem] leading-tight text-ink-faint">data from 1948</span>
      </span>
    );
  }
  const paths = sparkPaths(m.segments, 64, 22, 2);
  return (
    <span className="hidden min-w-0 flex-col gap-0.5 md:flex">
      <svg role="img" aria-label={`Misery index ${m.first.toFixed(1)} at the start, ${m.last.toFixed(1)} at the end`} viewBox="0 0 64 22" width="64" height="22" className="overflow-visible">
        {paths.map((d, i) => (
          <polyline key={i} points={d} fill="none" stroke="var(--ink)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        ))}
      </svg>
      <span className="font-mono text-[0.8rem] tabular-nums text-ink">
        {m.first.toFixed(1)} → {m.last.toFixed(1)}
      </span>
    </span>
  );
}

function Key({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <i aria-hidden className="inline-block h-2 w-4 rounded-full" style={{ background: swatch }} />
      {label}
    </span>
  );
}

/**
 * The Presidents directory: one row per president, newest first (lists with dates run newest first, rule 15a), with party,
 * dates, time in office, major laws signed, how long Congress was on their side, the justices they appointed and the economy through their term. The whole row opens the president's page.
 */
export function PresidentsDirectory({ rows, timeline }: { rows: PresidentSummary[]; timeline: TimelinePayload }) {
  const oldest = rows[rows.length - 1];
  return (
    <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-7 px-4 pb-16 pt-9 sm:px-6 sm:pt-11">
      <PageHeader eyebrow="Presidency · Presidents" title="Who has held the presidency?">
        <p>
          Every president since {oldest.name}, newest first. Each page takes the site&rsquo;s data on the economy, immigration, trade, foreign aid, troops abroad, energy, laws, executive orders, the Supreme Court and Congress, and shows only that president&rsquo;s time in office.
        </p>
      </PageHeader>

      <PresidentsPowerChart data={timeline} />

      <section aria-label="Presidents" className="rounded-[10px] border border-line bg-surface">
        <div className={`hidden gap-3 border-b border-line px-4 py-2 md:grid ${COLS}`}>
          <span />
          <span className={HEAD}>President</span>
          <span className={HEAD}>In office</span>
          <span className={HEAD}>Major laws</span>
          <span className={HEAD}>Congress on their side</span>
          <span className={HEAD}>Justices appointed</span>
          <span className={HEAD}>Misery, in → out</span>
        </div>
        <p className="m-0 flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-2 text-[0.72rem] text-ink-muted">
          <span>Congress bar:</span>
          <Key swatch="linear-gradient(90deg, var(--dem) 50%, var(--rep) 50%)" label="their party held both chambers" />
          <Key swatch="linear-gradient(90deg, color-mix(in oklab, var(--dem) 40%, var(--surface)) 50%, color-mix(in oklab, var(--rep) 40%, var(--surface)) 50%)" label="one chamber" />
          <Key swatch={NEITHER} label="neither chamber" />
          <span className="inline-flex items-center gap-1.5">
            <i aria-hidden className="inline-block size-[7px] rounded-full bg-ink" />
            justice still serving
          </span>
        </p>
        <ol className="m-0 list-none p-0">
          {rows.map((r) => (
            <li key={r.slug} className={`relative grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 border-t border-line px-4 py-3 first:border-t-0 hover:bg-surface-raised md:grid ${COLS}`}>
              <PresidentPortrait president={r} size="sm" />
              <span className="min-w-0">
                <Link href={presidentPath(r.slug)} className="font-serif text-[1.1rem] font-medium leading-tight text-ink underline decoration-line-strong underline-offset-2 after:absolute after:inset-0 hover:decoration-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
                  {r.name}
                </Link>
                <span className="mt-0.5 flex items-center gap-1.5 text-[0.78rem] text-ink-muted">
                  <span aria-hidden className="inline-block size-[0.5rem] rounded-full" style={{ background: `var(${r.party === "D" ? "--dem" : "--rep"})` }} />
                  {r.terms.map((t) => ordinalWord(t.ordinal)).join(" & ")} · {r.party === "D" ? "Democrat" : "Republican"}
                </span>
                <span className="block font-mono text-[0.75rem] text-ink-muted md:hidden">
                  {r.terms.map(termYears).join(", ")} · {tenureText(r.days)}
                </span>
              </span>
              <span className="hidden min-w-0 flex-col md:flex">
                <span className="font-mono text-[0.85rem] text-ink">{r.terms.map(termYears).join(", ")}</span>
                <span className="text-[0.72rem] text-ink-muted">{tenureText(r.days)}</span>
              </span>
              <span className="col-span-2 grid grid-cols-2 gap-x-3 gap-y-2 md:contents">
                <MajorLaws r={r} />
                <span className="order-3 col-span-2 md:order-none md:col-span-1">
                  <CongressBar r={r} />
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className={LABEL}>Justices appointed</span>
                  <JusticeFaces justices={r.justices} />
                </span>
                <Economy r={r} />
              </span>
            </li>
          ))}
        </ol>
      </section>

      <MethodologyNote className="-mt-3">
        <p>
          <strong>Major laws</strong> counts the laws the president signed that David Mayhew lists as important enactments (his lists for 1947&ndash;2022 cover the 80th to the 118th Congress, and the site holds public laws from 1973, so earlier presidents show a dash and Nixon counts from 1973). Mayhew has not assessed Congresses after the 118th, so Trump&rsquo;s current term is not yet in the count. The law named under the count is the one Mayhew prints in capitals, his mark for the most important; a law that stands alone in its capitals entry beats one in a shared entry (the sixteen Congressional Review Act repeals, the five COVID packages), and among equals the earliest signed is named.
        </p>
        <p>
          <strong>Congress on their side</strong> shows the share of days in office on which the president&rsquo;s party held the House and the Senate, only one of them, or neither, using the party that held each chamber&rsquo;s majority on the day. <strong>Justices appointed</strong> are the president&rsquo;s nominees who joined the Court, leaving out a justice raised to chief justice; tap a face for the name, and a dot marks a justice still serving. <strong>Misery index</strong> is the unemployment rate plus the year-over-year inflation rate, from the first month in office to the last (or the latest month published), so Trump&rsquo;s line has a gap between terms; it runs from 1948 and shows conditions during a presidency, not an effect of the president.
        </p>
        <p>
          None of these is a grade. Divided government is common, many major laws pass with votes from both parties, and the economy responds to far more than one office. Executive orders are on each president&rsquo;s own page.
        </p>
      </MethodologyNote>

      <UpNext />
      <p className="m-0 text-[0.8rem] leading-[1.6] text-ink-muted">
        Source: major laws from David Mayhew&rsquo;s <SourceLink id="mayhew">Divided We Govern</SourceLink> lists, matched to public laws from <SourceLink id="congress-gov">Congress.gov</SourceLink>; party control of Congress from the <SourceLink id="house-party-division">House</SourceLink> and <SourceLink id="senate-party-division">Senate</SourceLink> historians; appointments from the <SourceLink id="fjc">Federal Judicial Center</SourceLink>; unemployment and inflation from the Bureau of Labor Statistics via <SourceLink id="fred-unrate">FRED</SourceLink>. Portraits: public domain, via <SourceLink href="https://commons.wikimedia.org/">Wikimedia Commons</SourceLink>.
      </p>
    </main>
  );
}

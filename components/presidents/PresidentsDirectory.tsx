import Link from "next/link";
import type { ReactNode } from "react";
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
import { MAJOR_LAW_DEFINITION } from "./notes";
import { UpNext } from "@/components/UpNext";

const HEAD = "font-mono text-[0.65rem] uppercase leading-4 tracking-[0.06em] text-ink-muted";
const COLS = "md:grid-cols-[3rem_minmax(0,1.5fr)_minmax(0,0.95fr)_minmax(0,1.05fr)_minmax(0,1.1fr)_minmax(0,1.15fr)_minmax(0,1fr)]";
const LABEL = "text-[0.68rem] leading-tight text-ink-muted md:sr-only";

function partyVar(p: Party) {
  return `var(${p === "D" ? "--dem" : "--rep"})`;
}

/** Major laws: the count, and the one the president is best known for under it. */
function MajorLaws({ r }: { r: PresidentSummary }) {
  const note = r.majorNote;
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
      <span role="img" aria-label={`Both chambers ${yearsOfDays(both)} years; one chamber ${yearsOfDays(one)} years; neither chamber ${yearsOfDays(neither)} years`} className="flex h-2 w-full overflow-hidden rounded-full" style={{ background: NEITHER }}>
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

/** A column header whose key opens on hover or keyboard focus (and on a tap, which focuses it); the key is for desktop, where the headers show. */
function HeadTip({ label, children, end }: { label: string; children: ReactNode; end?: boolean }) {
  return (
    <span className="group relative flex">
      <span tabIndex={0} className={`${HEAD} cursor-help underline decoration-dotted decoration-line-strong underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus`}>
        {label}
      </span>
      <span className={`pointer-events-none invisible absolute ${end ? "right-0" : "left-0"} top-full z-30 mt-1.5 flex w-max max-w-[15rem] flex-col gap-1.5 rounded-md border border-line-strong bg-surface px-3 py-2 text-[0.72rem] normal-case leading-snug tracking-normal text-ink-muted opacity-0 shadow-[0_8px_24px_rgba(26,34,51,0.22)] group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100`}>
        {children}
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
  return (
    <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-7 px-4 pb-16 pt-9 sm:px-6 sm:pt-11">
      <PageHeader eyebrow="Presidency · Presidents" title="Who has held the presidency?">
        <p>
            Track every U.S. president since FDR, newest first. Each profile breaks down party control, major legislation, court appointments, and economic indicators strictly across that specific term in office.
          </p>
      </PageHeader>

      <PresidentsPowerChart data={timeline} />

      <section aria-label="Presidents" className="rounded-[10px] border border-line bg-surface">
        <div className={`hidden items-center gap-3 border-b border-line px-4 py-2 md:grid ${COLS}`}>
          <span />
          <span className={HEAD}>President</span>
          <span className={HEAD}>In office</span>
          <HeadTip label="Major laws">
            <span>{MAJOR_LAW_DEFINITION}</span>
          </HeadTip>
          <HeadTip label="Congress on their side">
            <Key swatch="linear-gradient(90deg, var(--dem) 50%, var(--rep) 50%)" label="their party held both chambers" />
            <Key swatch="linear-gradient(90deg, color-mix(in oklab, var(--dem) 40%, var(--surface)) 50%, color-mix(in oklab, var(--rep) 40%, var(--surface)) 50%)" label="one chamber" />
            <Key swatch={NEITHER} label="neither chamber" />
          </HeadTip>
          <HeadTip label="Justices appointed">
            <span className="inline-flex items-center gap-1.5">
              <i aria-hidden className="inline-block size-[7px] rounded-full bg-ink" />
              justice still serving
            </span>
          </HeadTip>
          <HeadTip label="Misery, in → out" end>
            <span>The misery index: the unemployment rate plus the year-over-year inflation rate. The line runs from the president&rsquo;s first month in office to the last; the numbers are the start and the end.</span>
          </HeadTip>
        </div>
        <p className="m-0 flex md:hidden flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-2 text-[0.72rem] text-ink-muted">
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
          <strong>Major laws</strong> counts the laws the president signed that David Mayhew lists as important enactments (his lists cover the 80th to the 118th Congress, 1947&ndash;2024, so Franklin Roosevelt shows a dash (his page lists the Timeline page&rsquo;s landmark laws instead) and Truman counts from 1947). A law enacted over a veto, a treaty and a constitutional amendment on his lists are not counted as signed. Mayhew has not assessed Congresses after the 118th, so Trump&rsquo;s current term is not yet in the count. The law named under the count is the one on his list the president is best known for: our editorial pick (the Americans with Disabilities Act for George H. W. Bush, NAFTA for Clinton), not a ranking in Mayhew&rsquo;s data, whose mark for the most important laws favours budget bills few people link to a president.
        </p>
        <p>
          <strong>Congress on their side</strong> shows the share of days in office on which the president&rsquo;s party held the House and the Senate, only one of them, or neither, using the party that held each chamber&rsquo;s majority on the day. <strong>Justices appointed</strong> are the president&rsquo;s nominees who joined the Court, leaving out a justice raised to chief justice; tap a face for the name, and a dot marks a justice still serving. <strong>Misery index</strong> is the unemployment rate plus the year-over-year inflation rate, from the first month in office to the last (or the latest month published), so Trump&rsquo;s line has a gap between terms; it runs from 1948 and shows conditions during a presidency, not an effect of the president.
        </p>
        <p>
          Executive orders are on each president&rsquo;s own page.
        </p>
      </MethodologyNote>

      <UpNext />
      <p className="m-0 text-[0.8rem] leading-[1.6] text-ink-muted">
        Source: major laws from David Mayhew&rsquo;s <SourceLink id="mayhew">Divided We Govern</SourceLink> lists, matched to public laws from <SourceLink id="congress-gov">Congress.gov</SourceLink>; party control of Congress from the <SourceLink id="house-party-division">House</SourceLink> and <SourceLink id="senate-party-division">Senate</SourceLink> historians; appointments from the <SourceLink id="fjc">Federal Judicial Center</SourceLink>; unemployment and inflation from the Bureau of Labor Statistics via <SourceLink id="fred-unrate">FRED</SourceLink>. Portraits: public domain, via <SourceLink href="https://commons.wikimedia.org/">Wikimedia Commons</SourceLink>.
      </p>
    </main>
  );
}

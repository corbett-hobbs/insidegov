import Link from "next/link";
import { HowToRead } from "@/components/HowToRead";
import { PageHeader } from "@/components/PageHeader";
import { SourceLink } from "@/components/SourceLink";
import { ordinalWord, termYears } from "@/lib/president-derive";
import { fmtInt, tenureText } from "@/lib/president-format";
import { presidentPath } from "@/lib/president-url";
import type { PresidentSummary } from "@/lib/president-types";
import { PresidentPortrait } from "./PresidentPortrait";

const HEAD = "font-mono text-[0.65rem] uppercase tracking-[0.06em] text-ink-muted";
const COLS = "md:grid-cols-[3rem_minmax(0,1.6fr)_minmax(0,1.1fr)_repeat(3,minmax(0,0.8fr))]";

function Num({ value, note, label }: { value: number | null; note?: string; label: string }) {
  return (
    <span className="flex min-w-0 flex-col md:items-end">
      <span className="text-[0.68rem] leading-tight text-ink-muted md:sr-only">{label}</span>
      <span className="font-mono text-[0.95rem] tabular-nums text-ink">{value === null ? "—" : fmtInt(value)}</span>
      {note && <span className="text-[0.66rem] leading-tight text-ink-faint">{note}</span>}
    </span>
  );
}

/**
 * The Presidents directory: one row per president, newest first (lists with dates run newest first, rule 15a), with party,
 * dates, time in office and three counts. The whole row opens the president's page.
 */
export function PresidentsDirectory({ rows }: { rows: PresidentSummary[] }) {
  const oldest = rows[rows.length - 1];
  return (
    <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-7 px-4 pb-16 pt-9 sm:px-6 sm:pt-11">
      <PageHeader eyebrow="Presidency · Presidents" title="Who has held the presidency?">
        <p>
          Every president since {oldest.name}, newest first. Each page takes the site&rsquo;s data on the economy, immigration, trade, foreign aid, troops abroad, energy, laws, executive orders, the Supreme Court and Congress, and shows only that president&rsquo;s time in office.
        </p>
        <HowToRead>
          <p>
            Laws signed are public laws enacted during the term and not over a veto, from 1973 on; executive orders are counted from the Federal Register&rsquo;s electronic record, which begins in 1994. Where a count starts partway through a presidency it says so; before that it shows a dash. Justices appointed counts the president&rsquo;s nominees who joined the Court.
          </p>
          <p>
            Counts are not grades. How many laws a president signs depends on Congress, and one executive order can do far more than another.
          </p>
        </HowToRead>
      </PageHeader>

      <section aria-label="Presidents" className="rounded-[10px] border border-line bg-surface">
        <div className={`hidden gap-3 border-b border-line px-4 py-2 md:grid ${COLS}`}>
          <span />
          <span className={HEAD}>President</span>
          <span className={HEAD}>In office</span>
          <span className={`${HEAD} text-right`}>Laws signed</span>
          <span className={`${HEAD} text-right`}>Executive orders</span>
          <span className={`${HEAD} text-right`}>Justices appointed</span>
        </div>
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
              <span className="col-span-2 grid grid-cols-3 gap-3 md:contents">
                <Num label="Laws signed" value={r.laws} note={r.laws === null ? "data from 1973" : r.lawsPartial ? "from 1973" : undefined} />
                <Num label="Executive orders" value={r.eos} note={r.eos === null ? "data from 1994" : r.eosPartial ? "from 1994" : undefined} />
                <Num label="Justices" value={r.justices} />
              </span>
            </li>
          ))}
        </ol>
      </section>

      <p className="m-0 text-[0.8rem] leading-[1.6] text-ink-muted">
        Source: laws from <SourceLink id="congress-gov">Congress.gov</SourceLink>; executive orders from the <SourceLink id="federal-register-eo">Federal Register</SourceLink>; appointments from the <SourceLink id="fjc">Federal Judicial Center</SourceLink>. Portraits: public domain, via <SourceLink href="https://commons.wikimedia.org/">Wikimedia Commons</SourceLink>.
      </p>
    </main>
  );
}

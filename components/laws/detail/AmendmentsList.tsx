"use client";

import { useMemo, useState } from "react";
import { AMENDMENT_STATUSES, longDate } from "@/lib/law-details-derive";
import type { AmendmentStatus, LawAmendmentEntry } from "@/lib/law-details-types";
import { Dot, LINK, Person } from "./LawPeople";

const LABEL = Object.fromEntries(AMENDMENT_STATUSES.map((s) => [s.value, s.label])) as Record<AmendmentStatus, string>;
const BADGE = "inline-flex flex-none items-center rounded-full border px-2 py-px text-[0.68rem] font-medium whitespace-nowrap";
const COLOR: Record<AmendmentStatus, string> = {
  agreed: "var(--topic-energy_environment)",
  rejected: "var(--topic-health_education)",
  withdrawn: "var(--topic-economy_labor)",
  out_of_order: "var(--topic-immigration_justice)",
  fell: "var(--topic-foreign_policy)",
  offered: "var(--topic-national_security)",
  other: "var(--topic-civil_rights_civic)",
};
/** Agreed to reads as the outcome that changed the bill; the rest stay neutral (the word is the cue, not the colour). */
const badgeClass = (s: AmendmentStatus) => (s === "agreed" ? `${BADGE} border-ink bg-surface text-ink` : `${BADGE} border-line-strong text-ink-muted`);

const sponsorKey = (a: LawAmendmentEntry) => `${a.sponsor?.name}|${a.sponsor?.label}`;

/** Amendments to the bill in a scrollable list: label, sponsor, what it does, its last recorded step, and a status column filtered by a dropdown. */
export function AmendmentsList({ amendments }: { amendments: readonly LawAmendmentEntry[] }) {
  const [status, setStatus] = useState<AmendmentStatus | "all">("all");
  const [sponsor, setSponsor] = useState("all");
  // Members who offered at least one amendment, A-Z by last name; a committee or other non-member sponsor is not listed.
  const sponsors = useMemo(() => {
    const m = new Map<string, { name: string; label: string; n: number }>();
    for (const a of amendments) {
      if (!a.sponsor) continue;
      const k = sponsorKey(a);
      const e = m.get(k) ?? { name: a.sponsor.name, label: a.sponsor.label, n: 0 };
      e.n++;
      m.set(k, e);
    }
    const last = (n: string) => n.replace(/^(Rep\.|Sen\.|Del\.|Resident Commissioner)\s+/, "").split(" ").slice(-1)[0] ?? n;
    return [...m].sort((x, y) => last(x[1].name).localeCompare(last(y[1].name)) || x[1].name.localeCompare(y[1].name));
  }, [amendments]);
  const bySponsor = useMemo(() => (sponsor === "all" ? amendments : amendments.filter((a) => a.sponsor && sponsorKey(a) === sponsor)), [amendments, sponsor]);
  const counts = useMemo(() => {
    const c = new Map<AmendmentStatus, number>();
    for (const a of bySponsor) c.set(a.status, (c.get(a.status) ?? 0) + 1);
    return c;
  }, [bySponsor]);
  const options = AMENDMENT_STATUSES.filter((s) => amendments.some((a) => a.status === s.value));
  const shown = status === "all" ? bySponsor : bySponsor.filter((a) => a.status === status);
  return (
    <div>
      {sponsors.length > 1 && (
        <div className="mb-3 flex items-center gap-2 text-[0.8rem] text-ink-muted">
          <label htmlFor="amdt-sponsor" className="font-mono text-[0.62rem] uppercase tracking-[0.06em] text-ink-faint">
            Offered by
          </label>
          <select id="amdt-sponsor" value={sponsor} onChange={(e) => setSponsor(e.target.value)} className="min-w-0 max-w-full flex-1 rounded-md border border-line-strong bg-surface px-2 py-1 text-[0.85rem] text-ink sm:max-w-[22rem] sm:flex-none">
            <option value="all">{`All members (${sponsors.length})`}</option>
            {sponsors.map(([k, p]) => (
              <option key={k} value={k}>{`${p.name} (${p.label}) · ${p.n}`}</option>
            ))}
          </select>
        </div>
      )}
      {options.length > 1 && (
        <div className="mb-3">
          <div className="mb-2">
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.06em] text-ink-faint">Where each amendment ended up</span>
          </div>
          <div role="group" aria-label="Filter by status" className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(8.5rem,1fr))] max-sm:grid-cols-2">
            {options.map((o) => {
              const v = counts.get(o.value) ?? 0;
              const on = status === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setStatus(on ? "all" : o.value)}
                  className={`cursor-pointer rounded-md border border-t-[3px] px-2.5 pb-2 pt-1.5 text-left hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${on ? "border-ink bg-surface-raised shadow-[inset_0_0_0_1px_var(--ink)]" : "border-line bg-surface"}`}
                  style={{ borderTopColor: COLOR[o.value] }}
                >
                  <span className="block font-serif text-[1.3rem] font-medium leading-[1.15] tabular-nums max-sm:text-[1.1rem]">{v.toLocaleString("en-US")}</span>
                  <span className="mt-px block text-[0.72rem] leading-tight text-ink">{o.label}</span>
                  <span className="mt-px block text-[0.66rem] tabular-nums text-ink-muted">{`${Math.round((v / (bySponsor.length || 1)) * 100) || (v > 0 ? "<1" : 0)}%`}</span>
                  <span aria-hidden className="mt-1.5 block h-1 overflow-hidden rounded-sm bg-line">
                    <i className="block h-full" style={{ width: `${v > 0 ? Math.max((v / (bySponsor.length || 1)) * 100, 2) : 0}%`, background: COLOR[o.value] }} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <ul tabIndex={0} aria-label="Amendments, scrollable" className="touch-scroll m-0 max-h-[26rem] list-none overflow-y-auto overscroll-contain rounded-md border border-line p-0">
        {shown.map((a) => (
          <li key={a.label} className="flex items-start gap-3 border-b max-sm:flex-col max-sm:gap-1.5 border-line px-3 py-2 text-[0.82rem] leading-[1.45] last:border-b-0">
            <div className="min-w-0 flex-1 max-sm:w-full">
              <p className="m-0 flex flex-wrap items-center gap-x-2">
                <a href={a.url} target="_blank" rel="noreferrer" title="Read the amendment text on Congress.gov" className={`${LINK} font-medium`}>
                  {a.label}
                </a>
                <span className="text-ink-faint">{a.chamber}</span>
                {a.sponsor ? (
                  <span className="inline-flex items-center gap-1">
                    <Dot party={a.sponsor.party} />
                    <Person p={a.sponsor} />
                    <span className="text-ink-faint">{a.sponsor.label}</span>
                  </span>
                ) : (
                  a.sponsorText && <span className="text-ink-muted">{a.sponsorText}</span>
                )}
                {a.submitted && <span className="text-ink-faint">{`· offered ${longDate(a.submitted)}`}</span>}
              </p>
              {a.purpose && <p className="m-0 mt-0.5 text-ink">{a.purpose}</p>}
              {a.latest && (
                <p className="m-0 mt-0.5 text-ink-muted">
                  {a.latest.date ? `${longDate(a.latest.date)}: ` : ""}
                  {a.latest.text}
                </p>
              )}
            </div>
            <span className={`${badgeClass(a.status)} max-sm:order-first`}>{LABEL[a.status]}</span>
          </li>
        ))}
        {shown.length === 0 && <li className="px-3 py-2 text-[0.82rem] text-ink-muted">None.</li>}
      </ul>
    </div>
  );
}

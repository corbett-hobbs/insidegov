"use client";

import { useState } from "react";
import { MethodologyNote } from "@/components/MethodologyNote";
import { PARTY_NAME, longDate, partySplit } from "@/lib/law-details-derive";
import type { LawPerson } from "@/lib/law-details-types";
import { Dot, LINK, Person } from "./LawPeople";

/**
 * The cosponsors in the law page's header, styled like the Sponsor line: the first one or two by name, then "+N others" that opens the full list (party dot, name,
 * "D-NY-12"). Names link only for current members. The party counts and the two caveats sit in the open list.
 */
export function CosponsorsHeader({ people, unresolved, withdrawn = [] }: { people: readonly LawPerson[]; unresolved: number; withdrawn?: readonly LawPerson[] }) {
  const [open, setOpen] = useState(false);
  if (people.length === 0) {
    return (
      <p className="m-0">
        <span className="text-ink-faint">Cosponsors: </span>None
      </p>
    );
  }
  const split = partySplit(people.map((p) => p.party));
  const toggle = (rest: number, cls: string) =>
    rest > 0 && (
      <button type="button" aria-expanded={open} aria-controls="law-cosponsors" onClick={() => setOpen((o) => !o)} className={`${LINK} cursor-pointer ${cls}`}>
        {open ? "Show fewer" : `+${rest} other${rest === 1 ? "" : "s"}`}
      </button>
    );
  // Same look as the Sponsor line: faint "Cosponsors (N): " then the names. One name always shows (it wraps if it must); a second
  // joins from xl up, where the votes column leaves room. The "+N others" count is the total minus the names shown at that width.
  const rest1 = people.length - 1;
  const rest2 = people.length - 2;
  return (
    <div className="m-0">
      <p className="m-0">
        <span className="text-ink-faint">{`Cosponsors (${people.length}): `}</span>
        {people.slice(0, 2).map((p, i) => (
          <span key={`${p.name}-${i}`} className={i === 1 ? "hidden xl:inline" : undefined}>
            <span className="inline-flex items-center gap-1">
              <Dot party={p.party} />
              <Person p={p} />
            </span>
            {i === 0 ? (people.length > 1 ? ", " : "") : rest2 > 0 ? ", " : ""}
          </span>
        ))}
        {toggle(rest1, "xl:hidden")}
        {toggle(rest2, "max-xl:hidden")}
      </p>
      {open && (
        <div id="law-cosponsors" className="mt-2">
          <p className="m-0 flex flex-wrap gap-x-4 gap-y-1 text-[0.8rem]">
            {split.map((s) => (
              <span key={s.party} className="inline-flex items-center gap-1.5">
                <Dot party={s.party} />
                <span className="font-medium tabular-nums text-ink">{s.n}</span>
                <span className="text-ink-muted">{PARTY_NAME[s.party]}</span>
              </span>
            ))}
          </p>
          <ul tabIndex={0} aria-label="Cosponsors, scrollable" className="touch-scroll m-0 mt-2 max-h-60 list-none overflow-y-auto overscroll-contain rounded-md border border-line bg-surface p-0">
            {people.map((p, i) => (
              <li key={`${p.name}-${i}`} className="flex flex-wrap items-center gap-x-2 border-b border-line px-3 py-1.5 text-[0.82rem] last:border-b-0">
                <Dot party={p.party} />
                <Person p={p} />
                <span className="text-ink-faint">{p.label}</span>
                {p.joined !== undefined && (
                  <span className="ml-auto whitespace-nowrap text-[0.75rem] text-ink-faint">
                    {p.original ? "Original cosponsor" : p.joined ? `Joined ${longDate(p.joined)}` : ""}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <MethodologyNote>
            <p>
              {withdrawn.length > 0
                ? `Cosponsors who withdrew are not counted or listed: ${withdrawn.map((w) => `${w.name}${w.withdrawn ? ` (withdrew ${longDate(w.withdrawn)})` : ""}`).join("; ")}.`
                : "Cosponsors who withdrew are not listed."}{" "}
              A name links to a profile only for members of the current Congress.
              {unresolved > 0 ? ` ${unresolved} cosponsor${unresolved === 1 ? "" : "s"} could not be matched to a member record and ${unresolved === 1 ? "is" : "are"} left out.` : ""}
            </p>
          </MethodologyNote>
        </div>
      )}
    </div>
  );
}

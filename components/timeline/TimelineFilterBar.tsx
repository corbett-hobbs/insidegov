"use client";

import { useMemo } from "react";
import { FILTER_SELECT, FilterCaption, HelpTip } from "../charts/FilterBarParts";
import { PillGroup } from "../charts/PillGroup";
import { RangeReset } from "../charts/RangeReset";
import { RangeSelector } from "../charts/RangeSelector";
import { TermBand, type BandTerm } from "../charts/TermBand";
import { soleOf, type Picked } from "@/lib/multi-select";
import { initialsOf } from "@/lib/term-label";
import { lastName, termYears, type CourtMode, type Kind } from "@/lib/timeline-derive";
import type { TimelinePayload } from "@/lib/timeline-types";

const MODES: { value: CourtMode; label: string }[] = [
  { value: "lean", label: "By lean" },
  { value: "appt", label: "By appointing president" },
];

type KindPick = "all" | Kind;

/** The Events toggle's value for the page's picked set (an empty set, the moment after Clear elsewhere, reads as All). */
const kindPick = (k: Picked<Kind>): KindPick => soleOf(k) ?? "all";

/**
 * The pinned bar for /timeline: Events (an All / Laws / Cases toggle), Court (a dropdown: By lean or By appointing president, with a "?" note), and the
 * Years-shown slider with the presidential-term band under it (rule 5b). Desktop: one row, every control captioned
 * (rule 5d). Phones: the toggle and the Court dropdown share a row; Court keeps its caption there (a standing exception to
 * rule 5d: "By lean" and "By appointing president" mean nothing without the word Court), the toggle names itself, the slider has its own row.
 */
export function TimelineFilterBar({
  data,
  minYear,
  maxYear,
  range,
  onRange,
  kinds,
  onKinds,
  mode,
  onMode,
}: {
  data: TimelinePayload;
  minYear: number;
  maxYear: number;
  range: [number, number];
  onRange: (r: [number, number]) => void;
  kinds: Picked<Kind>;
  onKinds: (k: Picked<Kind>) => void;
  mode: CourtMode;
  onMode: (m: CourtMode) => void;
}) {
  const terms = useMemo<BandTerm[]>(
    () =>
      data.presidents.map((p) => {
        const [from, to] = termYears(p, minYear, maxYear);
        return { id: p.start, label: `${p.name} (${from}–${p.end ? to : "now"})`, last: lastName(p.name), initials: initialsOf(p.name), party: p.party, from, to };
      }),
    [data.presidents, minYear, maxYear],
  );
  const kindOptions = useMemo<{ value: KindPick; label: string }[]>(
    () => [{ value: "all", label: "All" }, { value: "law", label: "Laws" }, { value: "case", label: "Cases" }],
    [],
  );
  const full = range[0] === minYear && range[1] === maxYear;
  return (
    <div data-pinned-bar className="sticky top-0 z-40 border-b border-line-strong bg-surface/95 shadow-[0_2px_6px_rgba(26,34,51,0.08)] backdrop-blur sm:shadow-none">
      <div className="mx-auto w-full max-w-[1180px] px-4 pb-2 pt-2 sm:px-6 sm:py-2.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:flex-nowrap sm:gap-x-4 sm:gap-y-2">
          <div className="flex flex-none items-center gap-2 [&>[role=group]>button]:whitespace-nowrap">
            <FilterCaption id="tl-events">Events</FilterCaption>
            <PillGroup options={kindOptions} value={kindPick(kinds)} onChange={(v) => onKinds(v === "all" ? null : new Set<Kind>([v]))} labelledBy="tl-events" />
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
            <FilterCaption phone id="tl-court">Court</FilterCaption>
            <select aria-labelledby="tl-court" value={mode} onChange={(e) => onMode(e.target.value as CourtMode)} className={`${FILTER_SELECT} min-w-0 flex-1 sm:w-[14rem] sm:flex-none`}>
              {MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <HelpTip label="What does the Court setting change?" text="How the Court row is read: by lean (which way its median justice leaned each term) or by appointing president (which party's presidents appointed the sitting justices)." />
          </div>
          <RangeSelector
            min={minYear}
            max={maxYear}
            value={range}
            onChange={onRange}
            format={String}
            ariaLabel="Years shown"
            below={<TermBand terms={terms} min={minYear} max={maxYear} value={range} onChange={onRange} />}
            action={<RangeReset show={!full} onReset={() => onRange([minYear, maxYear])} className="mt-0.5 font-sans leading-none" />}
            className="w-full min-w-0 sm:ml-auto sm:w-auto sm:min-w-[14rem] sm:flex-1"
          />
        </div>
      </div>
    </div>
  );
}

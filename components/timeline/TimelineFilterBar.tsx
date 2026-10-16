"use client";

import { useMemo } from "react";
import { FilterCaption } from "../charts/FilterBarParts";
import { MultiSelectFilter, type MultiOption } from "../charts/MultiSelectFilter";
import { PillGroup } from "../charts/PillGroup";
import { RangeReset } from "../charts/RangeReset";
import { RangeSelector } from "../charts/RangeSelector";
import { TermBand, type BandTerm } from "../charts/TermBand";
import type { Picked } from "@/lib/multi-select";
import { initialsOf } from "@/lib/term-label";
import { inYears, lastName, termYears, type CourtMode, type Kind } from "@/lib/timeline-derive";
import type { TimelinePayload } from "@/lib/timeline-types";
import { KIND_LABEL } from "./shared";

const MODES = [
  { value: "lean", label: "Lean" },
  { value: "appt", label: "Appointed by" },
] as const;

/**
 * The pinned bar for /timeline: Events (laws, court cases; a checkbox dropdown, rule 5c), Court by (Lean or Appointed by),
 * and the Years-shown slider with the presidential-term band under it (rule 5b). Desktop: one row, every control captioned
 * (rule 5d). Phones: Events and Court by share a row with no captions (rule 5a), the slider its own.
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
  const options = useMemo<MultiOption<Kind>[]>(
    () => (["law", "case"] as const).map((k) => ({ id: k, label: KIND_LABEL[k], count: String(data.events.filter((e) => e.kind === k && inYears(e, range[0], range[1])).length) })),
    [data.events, range],
  );
  const full = range[0] === minYear && range[1] === maxYear;
  return (
    <div data-pinned-bar className="sticky top-0 z-40 border-b border-line-strong bg-surface/95 shadow-[0_2px_6px_rgba(26,34,51,0.08)] backdrop-blur sm:shadow-none">
      <div className="mx-auto w-full max-w-[1180px] px-4 pb-2 pt-2 sm:px-6 sm:py-2.5">
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 sm:flex sm:flex-nowrap sm:items-center sm:gap-x-4 sm:gap-y-2">
          <div className="flex min-w-0 items-center gap-2 sm:flex-none">
            <FilterCaption>Events</FilterCaption>
            <MultiSelectFilter label="Events" noun="events" allLabel="Laws and cases" options={options} value={kinds} onChange={onKinds} className="w-full sm:w-[9.5rem]" />
          </div>
          <div className="flex min-w-0 items-center gap-2 sm:flex-none [&>[role=group]]:max-sm:w-full [&>[role=group]>button]:whitespace-nowrap [&>[role=group]>button]:max-sm:flex-auto">
            <FilterCaption id="tl-court-by">Court by</FilterCaption>
            <PillGroup options={MODES} value={mode} onChange={onMode} labelledBy="tl-court-by" />
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
            className="col-span-2 min-w-0 sm:ml-auto sm:min-w-[14rem] sm:flex-1"
          />
        </div>
      </div>
    </div>
  );
}

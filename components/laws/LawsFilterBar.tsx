"use client";

import { useMemo } from "react";
import { MultiSelectFilter, type MultiOption } from "@/components/charts/MultiSelectFilter";
import { PartyFilter } from "@/components/charts/PartyFilter";
import { FilterCaption, HelpTip } from "@/components/charts/FilterBarParts";
import { RangeReset } from "@/components/charts/RangeReset";
import { RangeSelector } from "@/components/charts/RangeSelector";
import { TermBand } from "@/components/charts/TermBand";
import { SUPPORT_COLORS, SUPPORT_ORDER, SUPPORT_SHORT, groupOptions, groupWindowTotals, presidentBand, windowBands, yearSpan } from "@/lib/laws-derive";
import { fmtInt } from "@/lib/decisions-derive";
import { sameRange } from "@/lib/year-range";
import { groupFills } from "./shared";
import { useLawsActions, useLawsValues } from "./LawsState";

/** Under the Commemorations row: a quarter of all laws are days, buildings and medals, so it is the one row worth saying what it holds. */
const COMMEMORATIONS_HINT = "Days, weeks, buildings, medals and memorials";

const MAJOR_DEFINITION =
  "A major law is one that political scientist David Mayhew's lists of important enactments name, judged from the press at the time and later policy studies. His lists run through the 118th Congress.";

/**
 * The pinned filter bar for /congress/laws, directly under the site navigation: the Policy area and Vote checkbox dropdowns
 * (`MultiSelectFilter`: untick a topic to see the laws without it, e.g. commemorations, whose row says what it holds; the rows count the laws in the years
 * shown), the Major laws checkbox with its "?", then the Years-shown slider with the presidential-term band under its track
 * (the Decisions bar's shape). Policy area lists the topic groups in the order and colours of card 1's legend; Vote lists the
 * support bands and is the same filter card 2's legend and the list's pills set. Sponsor party (`PartyFilter`) narrows every chart and the list to the laws
 * a Democrat or a Republican sponsored. Phones: Policy area, Vote and Sponsor party share a row (labels read by screen readers
 * only), Major laws moves into the Policy area panel (below `xl` as well, where the bar has no room for it), then the slider.
 */
export function LawsFilterBar() {
  const { data, range, groups, major, bands, party, window: win } = useLawsValues();
  const { setRange, setGroups, setMajor, setBands, setParty } = useLawsActions();
  const terms = useMemo(() => presidentBand(data), [data]);
  const [lo, hi] = yearSpan(data);
  const full = sameRange(range, [lo, hi]);
  const fills = useMemo(() => groupFills(data), [data]);
  const totals = useMemo(() => groupWindowTotals(data, win, major), [data, win, major]);
  const areaOptions = useMemo<MultiOption<string>[]>(() => groupOptions(data).map((o) => ({ ...o, swatch: fills.get(o.id), count: fmtInt(totals.get(o.id) ?? 0), hint: o.id === "commemorations" ? COMMEMORATIONS_HINT : undefined })), [data, fills, totals]);
  // Counts follow the policy area, the years and major laws, not the vote itself, so each row says what ticking it would add.
  const bandTotals = useMemo(() => (win[0] > win[1] ? [0, 0, 0, 0, 0] : windowBands(data, win[0], win[1], groups, major)), [data, win, groups, major]);
  const voteOptions = useMemo<MultiOption<number>[]>(() => SUPPORT_ORDER.map((k) => ({ id: k, label: SUPPORT_SHORT[k]!, swatch: SUPPORT_COLORS[k]!, count: fmtInt(bandTotals[k]!) })), [bandTotals]);
  return (
    <div data-pinned-bar className="sticky top-0 z-40 border-b border-line-strong bg-surface/95 shadow-[0_2px_6px_rgba(26,34,51,0.08)] backdrop-blur sm:shadow-none">
      <div className="mx-auto w-full max-w-[1180px] px-4 pb-2 pt-2 sm:px-6 sm:py-2.5">
        <div className="flex flex-col gap-1.5 lg:flex-row lg:items-start lg:gap-x-5">
          <div className="flex flex-none flex-wrap items-center gap-x-1.5 gap-y-1.5 sm:gap-x-3 lg:flex-nowrap lg:pt-px">
            <div className="flex min-w-0 flex-[1.6] basis-0 items-center gap-2 sm:flex-none sm:basis-auto">
              <FilterCaption>Policy area</FilterCaption>
              <MultiSelectFilter label="Policy area" noun="policy areas" options={areaOptions} value={groups} onChange={setGroups}
                dot={major ? "major laws only" : undefined}
                footerClassName="xl:hidden"
                dotClassName="xl:hidden"
                footer={
                  <label className="flex cursor-pointer items-start gap-2 text-[0.8rem] text-ink">
                    <input type="checkbox" checked={major} onChange={(e) => setMajor(e.target.checked)} className="m-0 mt-0.5 h-4 w-4 flex-none cursor-pointer accent-[var(--accent)]" />
                    <span>
                      Major laws only
                      <span className="block text-[0.72rem] leading-snug text-ink-muted">{MAJOR_DEFINITION}</span>
                    </span>
                  </label>
                }
                className="flex-1 sm:w-[12.5rem] sm:flex-none"
              />
            </div>
            <div className="flex min-w-0 flex-1 basis-0 items-center gap-2 sm:flex-none sm:basis-auto">
              <FilterCaption>Vote</FilterCaption>
              <MultiSelectFilter label="Vote: the closest recorded final-passage vote" noun="votes" allLabel="Any vote" options={voteOptions} value={bands} onChange={setBands} className="flex-1 sm:w-[9.5rem] sm:flex-none" />
            </div>
            <PartyFilter
              label="Sponsor"
              ariaLabel="Sponsor party"
              value={party}
              onChange={setParty}
              options={[
                { id: "D", label: "Democrats" },
                { id: "R", label: "Republicans" },
              ]}
              className="flex-[1.25] basis-0 sm:flex-none sm:basis-auto"
              selectClassName="flex-1 sm:w-[8.5rem] sm:flex-none"
            />
            <div className="flex flex-none items-center gap-1 max-xl:hidden">
              <label className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap text-[0.8rem] text-ink">
                <input type="checkbox" checked={major} onChange={(e) => setMajor(e.target.checked)} className="h-4 w-4 cursor-pointer accent-[var(--accent)]" />
                Major laws
              </label>
              <HelpTip label="What is a major law?" text={MAJOR_DEFINITION} />
            </div>
          </div>
          <RangeSelector
            min={lo}
            max={hi}
            value={range}
            minSpan={1}
            onChange={(r) => setRange(r)}
            format={String}
            ariaLabel="Years shown"
            below={<TermBand terms={terms} min={lo} max={hi} value={range} onChange={(r) => setRange(r)} />}
            action={<RangeReset show={!full} onReset={() => setRange([lo, hi])} className="mt-0.5 font-sans leading-none" />}
            className="min-w-0 lg:flex-1"
          />
        </div>
      </div>
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { ChamberSwitch } from "@/components/ChamberSwitch";
import { PartyFilter } from "@/components/charts/PartyFilter";
import { RangeReset } from "@/components/charts/RangeReset";
import { RangeSelector } from "@/components/charts/RangeSelector";
import { TermBand } from "@/components/charts/TermBand";
import type { ChamberView } from "@/lib/chamber";
import { bandTerms, SLIDER_BOUNDS, type PartyPick } from "@/lib/demographics-chart";
import type { DemoCongress, DemoPresident } from "@/lib/demographics-types";
import { sameRange, type YearRange } from "@/lib/year-range";

/**
 * The pinned filter bar for /congress/demographics, directly under the site navigation: the Chamber switch and the Party
 * dropdown, then the Years-shown slider with the presidential-term band under its track (no President dropdown). On a phone
 * Chamber and Party share a row and the slider row follows. The slider is the window every chart draws; Party is the one
 * pick every chart, the strip and the lists follow, and the legends set it too.
 */
export function DemographicsFilterBar({
  view,
  onView,
  party,
  onParty,
  otherNow,
  rows,
  presidents,
  range,
  onRange,
}: {
  view: ChamberView;
  onView: (v: ChamberView) => void;
  party: PartyPick;
  onParty: (p: PartyPick) => void;
  /** The Congress shown has a member who is neither a Democrat nor a Republican; "Other" is listed only then. */
  otherNow: boolean;
  /** Every Congress (the term band shows all of them regardless of the window). */
  rows: readonly DemoCongress[];
  presidents: readonly DemoPresident[];
  range: YearRange;
  onRange: (r: YearRange) => void;
}) {
  const terms = useMemo(() => bandTerms(rows, presidents), [rows, presidents]);
  const [lo, hi] = SLIDER_BOUNDS;
  const full = sameRange(range, SLIDER_BOUNDS);
  return (
    <div data-pinned-bar className="sticky top-0 z-40 border-b border-line-strong bg-surface/95 shadow-[0_2px_6px_rgba(26,34,51,0.08)] backdrop-blur sm:shadow-none">
      <div className="mx-auto w-full max-w-[1180px] px-4 pb-2 pt-2 sm:px-6 sm:py-2.5">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-x-5">
          <div className="flex flex-none items-center gap-2 sm:pt-px">
            <ChamberSwitch value={view} onChange={onView} />
            <PartyFilter
              value={party}
              onChange={onParty}
              options={[
                { id: "D", label: "Democrats" },
                { id: "R", label: "Republicans" },
                ...(otherNow ? [{ id: "O" as const, label: "Other parties" }] : []),
              ]}
            />
          </div>
          <RangeSelector
            min={lo}
            max={hi}
            value={range}
            onChange={(r) => onRange(r)}
            format={String}
            ariaLabel="Years shown"
            below={<TermBand terms={terms} min={lo} max={hi} value={range} onChange={(r) => onRange(r)} />}
            action={<RangeReset show={!full} onReset={() => onRange([lo, hi])} className="mt-0.5 font-sans leading-none" />}
            className="min-w-0 sm:flex-1"
          />
        </div>
      </div>
    </div>
  );
}

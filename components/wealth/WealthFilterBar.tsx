"use client";

import { ChamberSwitch } from "@/components/ChamberSwitch";
import { FilterCaption } from "@/components/charts/FilterBarParts";
import { PartyFilter } from "@/components/charts/PartyFilter";
import { StateFilter } from "@/components/senate/StateFilter";
import { stateName } from "@/lib/states";
import { wealthPartyName, wealthPartyNoun, type WealthParty } from "@/lib/wealth-copy";
import type { ChamberView } from "@/lib/chamber";

/**
 * The pinned filter bar for /congress/wealth: chamber switch + state dropdown
 * (reusing the same controls as the homepage explorer's toolbar) + party
 * dropdown, plus a right-aligned summary count. Every chart/list on the page
 * reads the same `view`/`stateFilter`/`party` trio — there is no independent
 * per-chart filter state.
 */
export function WealthFilterBar({
  view,
  onViewChange,
  states,
  stateFilter,
  onStateFilterChange,
  party,
  onPartyChange,
  count,
}: {
  view: ChamberView;
  onViewChange: (v: ChamberView) => void;
  states: string[];
  stateFilter: string | null;
  onStateFilterChange: (s: string | null) => void;
  party: WealthParty | null;
  onPartyChange: (p: WealthParty | null) => void;
  count: number;
}) {
  const summary = `${count.toLocaleString("en-US")} ${wealthPartyNoun(view, party)} with net worth data${
    stateFilter ? ` in ${stateName(stateFilter)}` : ""
  }`;

  return (
    <div className="sticky top-0 z-40 border-b border-line-strong bg-surface/95 backdrop-blur">
      <div className="mx-auto w-full max-w-[1180px] px-4 py-2.5 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2 sm:gap-x-5">
          <ChamberSwitch value={view} onChange={onViewChange} />

          <div className="flex flex-none items-center gap-1.5 sm:gap-2">
            <FilterCaption>State</FilterCaption>
            <StateFilter
              states={states}
              value={stateFilter}
              onChange={onStateFilterChange}
              compact
            />
          </div>

          <PartyFilter
            value={party}
            onChange={onPartyChange}
            options={(["Democrat", "Republican"] as const).map((id) => ({ id, label: wealthPartyName(id) }))}
            selectClassName="max-w-[8.5rem]"
          />

          <p className="ml-auto min-w-0 text-right font-mono text-[0.72rem] leading-snug text-ink-muted">
            {summary}
          </p>
        </div>
      </div>
    </div>
  );
}

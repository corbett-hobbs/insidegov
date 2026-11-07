"use client";

import { ChamberSwitch } from "@/components/ChamberSwitch";
import { FilterCaption } from "@/components/charts/FilterBarParts";
import { PartyFilter } from "@/components/charts/PartyFilter";
import { StateFilter } from "@/components/senate/StateFilter";
import type { ChamberView } from "@/lib/chamber";
import type { DirectoryMember, DirectoryParty } from "@/lib/members-directory";
import { memberPath } from "@/lib/member-url";
import { partyLetter, seatLabel } from "@/lib/members-directory";
import { MemberFaceThumb } from "@/components/SearchResultRow";

const PARTIES: readonly { id: DirectoryParty; label: string }[] = [
  { id: "Democrat", label: "Democrats" },
  { id: "Republican", label: "Republicans" },
  { id: "Independent", label: "Independents" },
];

/**
 * The pinned filter bar for /congress/members (rule 5): name search, Chamber,
 * State, Party. One row from `sm`; on phones two rows of two (search beside
 * the chamber switch, State beside Party), captions screen-reader-only (5d).
 */
export function MembersFilterBar({
  query,
  onQueryChange,
  chamber,
  onChamberChange,
  states,
  state,
  onStateChange,
  party,
  onPartyChange,
  suggestions = null,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  chamber: ChamberView;
  onChamberChange: (c: ChamberView) => void;
  states: string[];
  state: string | null;
  onStateChange: (s: string | null) => void;
  party: DirectoryParty | null;
  onPartyChange: (p: DirectoryParty | null) => void;
  /** Phones only: members matching the typed name, listed under the bar. `null` hides the list. */
  suggestions?: DirectoryMember[] | null;
}) {
  return (
    <div data-pinned-bar className="sticky top-0 z-40 border-b border-line-strong bg-surface/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-2 px-4 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5 sm:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-5">
          <label className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
            <FilterCaption>Name</FilterCaption>
            <input
              type="search"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search by name"
              aria-label="Search members by name"
              className={`w-full min-w-0 rounded-md border bg-surface-raised px-2.5 py-[0.38rem] text-[0.8rem] text-ink placeholder:text-ink-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:w-44 ${query ? "border-accent" : "border-line-strong"}`}
            />
          </label>
          <ChamberSwitch value={chamber} onChange={onChamberChange} />
        </div>

        <div className="flex min-w-0 items-center gap-2 sm:gap-5">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
            <FilterCaption>State</FilterCaption>
            <StateFilter states={states} value={state} onChange={onStateChange} />
          </div>
          <PartyFilter
            value={party}
            onChange={onPartyChange}
            options={PARTIES}
            className="min-w-0 flex-1 sm:flex-none"
            selectClassName="w-full sm:w-auto"
          />
        </div>
      </div>

      {suggestions && (
        <ul
          aria-label="Matching members"
          className="absolute left-4 right-4 top-[calc(100%+4px)] z-50 m-0 max-h-[40svh] list-none overflow-y-auto rounded-lg border border-line-strong bg-surface p-0 shadow-lg sm:hidden"
        >
          {suggestions.length === 0 ? (
            <li className="px-4 py-3 text-[0.85rem] text-ink-muted">No members match.</li>
          ) : (
            suggestions.map((m) => (
              <li key={m.bioguideId} className="border-b border-line last:border-0">
                <a href={memberPath(m)} className="flex items-center gap-2.5 px-4 py-2 active:bg-surface-raised">
                  <MemberFaceThumb bioguideId={m.bioguideId} hasPhoto={m.hasPhoto} />
                  <span className="min-w-0 flex-1 truncate text-[0.85rem] text-ink">{m.name}</span>
                  <span className="flex-none text-[0.72rem] text-ink-muted">
                    {m.chamber === "senate" ? "Senator" : "Representative"} · {partyLetter(m.party)}-{seatLabel(m)}
                  </span>
                </a>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

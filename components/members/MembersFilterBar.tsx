"use client";

import { useState } from "react";
import Link from "next/link";
import { ChamberSwitch } from "@/components/ChamberSwitch";
import { MemberPhoto } from "@/components/MemberPhoto";
import { FilterCaption } from "@/components/charts/FilterBarParts";
import { PartyFilter } from "@/components/charts/PartyFilter";
import { StateFilter } from "@/components/senate/StateFilter";
import { chamberLabel, type ChamberView } from "@/lib/chamber";
import { memberPath } from "@/lib/member-url";
import { partyLetter, seatLabel, type DirectoryMember, type DirectoryParty } from "@/lib/members-directory";

const PARTIES: readonly { id: DirectoryParty; label: string }[] = [
  { id: "Democrat", label: "Democrats" },
  { id: "Republican", label: "Republicans" },
  { id: "Independent", label: "Independents" },
];

/** Phone name-search results: the best matches, and how many members match in all. */
export interface NameSuggestions {
  matches: DirectoryMember[];
  total: number;
}

/**
 * The pinned filter bar for /congress/members (rule 5): name search, Chamber,
 * State, Party. One row from `sm`; on phones two rows of two (search beside
 * the chamber switch, State beside Party), captions screen-reader-only (5d).
 *
 * On a phone the on-screen keyboard covers the list the name box filters, so
 * the page passes `suggestions` instead and they open as a panel straight under
 * the bar (an overlay: the bar never grows and the page never jumps). Each row
 * links to the member's page. From `sm` the panel never shows and the name box
 * filters the list as before.
 */
export function MembersFilterBar({
  query,
  onQueryChange,
  suggestions,
  chamber,
  onChamberChange,
  states,
  state,
  onStateChange,
  party,
  onPartyChange,
  otherFiltersOn,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  /** Phone only: matches for the typed name; `null` when the box is empty or the screen is wide. */
  suggestions: NameSuggestions | null;
  chamber: ChamberView;
  onChamberChange: (c: ChamberView) => void;
  states: string[];
  state: string | null;
  onStateChange: (s: string | null) => void;
  party: DirectoryParty | null;
  onPartyChange: (p: DirectoryParty | null) => void;
  /** Whether chamber, state or party is narrowing the suggestions (for the empty message). */
  otherFiltersOn: boolean;
}) {
  const [focused, setFocused] = useState(false);

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
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(e) => {
                if (e.key === "Escape") e.currentTarget.blur();
              }}
              placeholder="Search by name"
              aria-label="Search members by name"
              autoComplete="off"
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

      {focused && suggestions && (
        <div
          // Tapping a row must not blur the box first: that would close the panel before the tap lands.
          onMouseDown={(e) => e.preventDefault()}
          className="absolute inset-x-0 top-full max-h-[min(45svh,22rem)] overflow-y-auto overscroll-contain border-b border-line-strong bg-surface shadow-[0_10px_26px_rgba(10,12,16,0.16)] sm:hidden"
        >
          {suggestions.matches.length === 0 ? (
            <p className="px-4 py-3 text-[0.84rem] text-ink-muted" role="status">
              No members match &ldquo;{query.trim()}&rdquo;.
              {otherFiltersOn ? " Chamber, state or party is narrowing the search." : ""}
            </p>
          ) : (
            <>
              <ul role="listbox" aria-label="Matching members" className="m-0 list-none p-0">
                {suggestions.matches.map((m) => (
                  <li key={m.bioguideId} role="presentation" className="border-b border-line last:border-0">
                    <Link
                      href={memberPath(m)}
                      role="option"
                      aria-selected={false}
                      className="flex items-center gap-3 px-4 py-2 active:bg-surface-raised"
                    >
                      <MemberPhoto
                        bioguideId={m.bioguideId}
                        hasPhoto={m.hasPhoto}
                        size="small"
                        className="h-9 w-7 flex-none rounded-sm bg-surface-raised object-cover object-top"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-[0.9rem] font-medium leading-tight text-ink">{m.name}</span>
                        <span className="mt-0.5 block text-[0.72rem] leading-snug text-ink-faint">
                          {partyLetter(m.party)} · {chamberLabel(m.chamber)} · {seatLabel(m)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {suggestions.total > suggestions.matches.length && (
                <p className="m-0 px-4 py-2 text-[0.72rem] text-ink-faint" role="status">
                  Showing {suggestions.matches.length} of {suggestions.total}. Keep typing to narrow.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

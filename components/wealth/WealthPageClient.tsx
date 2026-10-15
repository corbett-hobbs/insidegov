"use client";

import { HowToRead } from "@/components/HowToRead";
import { useMemo, useState } from "react";
import { stateName } from "@/lib/states";
import type { ChamberView } from "@/lib/chamber";
import type { WealthMember } from "@/lib/wealth-data";
import type { WealthParty } from "@/lib/wealth-copy";
import { HowToReadNotes } from "@/components/wealth/HowToReadNotes";
import { WealthFilterBar } from "./WealthFilterBar";
import { NetWorthScatterCard } from "./NetWorthScatterCard";
import { WealthListsSection } from "./WealthListsSection";
import { PageHeader } from "@/components/PageHeader";

/**
 * Owns the one shared chamber/state/party filter for the whole page (plan §2,
 * decision 2) — page-level React state, not URL params: unlike the homepage
 * explorer, /congress/wealth's filter bar only has a chamber switch and state
 * and party dropdowns, no per-view page to link back to from elsewhere, so
 * there's no cross-page link that needs a shareable URL yet. Every section
 * below reads `view/stateFilter/party` from here; nothing keeps independent
 * filter state. The lists filter to the pick; the scatter dims what it leaves out.
 */
export function WealthPageClient({ members }: { members: WealthMember[] }) {
  const [view, setView] = useState<ChamberView>("both");
  const [stateFilter, setStateFilter] = useState<string | null>(null);
  const [party, setParty] = useState<WealthParty | null>(null);

  const chamberPool = useMemo(
    () =>
      view === "both" ? members : members.filter((m) => m.chamber === view),
    [members, view],
  );

  // Same list/order as the homepage: every state (incl. territorial
  // delegates, who ride along under their delegate "state" code) present
  // among current members of the selected chamber, sorted by display name.
  const states = useMemo(
    () =>
      [...new Set(chamberPool.map((m) => m.state))].sort((a, b) =>
        stateName(a).localeCompare(stateName(b)),
      ),
    [chamberPool],
  );

  // Changing chamber can strand a state that isn't in the new pool (e.g. a
  // territory only the House has) — drop the filter rather than show a
  // selection that no longer applies, same as the explorer.
  const effectiveStateFilter =
    stateFilter && states.includes(stateFilter) ? stateFilter : null;

  const pool = useMemo(
    () =>
      chamberPool.filter(
        (m) =>
          (!effectiveStateFilter || m.state === effectiveStateFilter) &&
          (!party || m.caucus === party),
      ),
    [chamberPool, effectiveStateFilter, party],
  );

  const withData = useMemo(
    () => pool.filter((m) => m.points.length > 0),
    [pool],
  );

  return (
    <>
      <WealthFilterBar
        view={view}
        onViewChange={setView}
        states={states}
        stateFilter={effectiveStateFilter}
        onStateFilterChange={setStateFilter}
        party={party}
        onPartyChange={setParty}
        count={withData.length}
      />

      <main className="mx-auto flex w-full max-w-[1120px] flex-col gap-8 px-4 pb-16 pt-7 sm:px-6">
        <PageHeader eyebrow="Congress · Wealth" title="How Much Is Congress Worth?">
          <p>
            Estimated net worth for every member of Congress, built from the
            financial disclosures they file each year. Members write the laws
            that move markets, and these estimates show whose wealth has grown
            fastest since they took office.
          </p>
          <HowToRead>
            <HowToReadNotes />
          </HowToRead>
        </PageHeader>

        <NetWorthScatterCard
          key={view}
          view={view}
          chamberMembers={chamberPool}
          stateFilter={effectiveStateFilter}
          party={party}
        />
        <WealthListsSection
          members={pool}
          view={view}
          stateFilter={effectiveStateFilter}
          party={party}
        />
      </main>
    </>
  );
}

"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { SourceLink } from "@/components/SourceLink";
import { stateName } from "@/lib/states";
import { useMediaQuery } from "@/lib/use-media-query";
import type { ChamberView } from "@/lib/chamber";
import {
  filterMembers,
  pickLeaders,
  sortMembers,
  suggestMembers,
  type DirectoryMember,
  type DirectoryParty,
  type DirectorySort,
} from "@/lib/members-directory";
import type { PageviewsWindow } from "@/lib/members-directory-data";
import { MembersFilterBar } from "./MembersFilterBar";
import { MembersList } from "./MembersList";
import { UpNext } from "@/components/UpNext";

/**
 * /congress/members: one page-level filter (name, chamber, state, party) and
 * one sort, read by the single list. Page state, not URL params, like
 * /congress/wealth. On phones the name box suggests members under the bar
 * rather than filtering the list (see `MembersFilterBar`).
 */
export function MembersPageClient({ members, pageviews }: { members: DirectoryMember[]; pageviews: PageviewsWindow | null }) {
  const [query, setQuery] = useState("");
  const [chamber, setChamber] = useState<ChamberView>("both");
  const [state, setState] = useState<string | null>(null);
  const [party, setParty] = useState<DirectoryParty | null>(null);
  const [sort, setSort] = useState<DirectorySort>(pageviews ? "interest" : "name");

  // Every state (and delegate territory) with a member in the chosen chamber, by name.
  const states = useMemo(
    () =>
      [...new Set(members.filter((m) => chamber === "both" || m.chamber === chamber).map((m) => m.state))].sort((a, b) =>
        stateName(a).localeCompare(stateName(b)),
      ),
    [members, chamber],
  );
  // A territory has no senators: switching to the Senate drops it rather than show an empty list.
  const effectiveState = state && states.includes(state) ? state : null;

  // On a phone the keyboard hides the list, so typing a name can't be seen filtering it. There
  // the name box feeds a suggestions panel under the pinned bar instead (each row opens the
  // member's page) and the list keeps every other filter but ignores the name. Same breakpoint
  // as Tailwind's `sm`, where the bar goes to one row.
  const phone = useMediaQuery("(max-width: 639px)");
  const listQuery = phone ? "" : query;

  const filtered = useMemo(
    () => filterMembers(members, { query: listQuery, chamber, party, state: effectiveState }),
    [members, listQuery, chamber, party, effectiveState],
  );
  const sorted = useMemo(() => sortMembers(filtered, sort), [filtered, sort]);
  const leaders = useMemo(() => (listQuery.trim() ? [] : pickLeaders(filtered)), [filtered, listQuery]);
  const suggestions = useMemo(
    () => (phone && query.trim() ? suggestMembers(members, { query, chamber, party, state: effectiveState }) : null),
    [phone, members, query, chamber, party, effectiveState],
  );

  return (
    <>
      <MembersFilterBar
        query={query}
        onQueryChange={setQuery}
        suggestions={suggestions}
        otherFiltersOn={chamber !== "both" || effectiveState !== null || party !== null}
        chamber={chamber}
        onChamberChange={setChamber}
        states={states}
        state={effectiveState}
        onStateChange={setState}
        party={party}
        onPartyChange={setParty}
      />

      <main className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 px-4 pb-16 pt-7 sm:px-6">
        <PageHeader eyebrow="Congress · Members" title="Who Is in Congress Today?">
          <p>
            Browse all current lawmakers. Filter by chamber, party, or state to explore individual voting records, committee assignments, sponsored bills, and financial disclosures.
          </p>
        </PageHeader>

        <MembersList members={sorted} leaders={leaders} sort={sort} onSortChange={setSort} pageviews={pageviews} />

        <UpNext />
        <p className="m-0 text-[0.8rem] leading-[1.6] text-ink-muted">
          Source: <SourceLink id="congress-legislators">congress-legislators</SourceLink> (members and terms),{" "}
          <SourceLink id="voteview">Voteview</SourceLink> (ideology),{" "}
          <SourceLink id="house-clerk-disclosures">House Clerk</SourceLink> and <SourceLink id="senate-efd">Senate eFD</SourceLink>{" "}
          (net worth), <SourceLink id="wikimedia-pageviews">Wikimedia</SourceLink> (Wikipedia views).
        </p>
      </main>
    </>
  );
}

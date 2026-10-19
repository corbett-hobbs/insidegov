"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { SourceLink } from "@/components/SourceLink";
import { stateName } from "@/lib/states";
import type { ChamberView } from "@/lib/chamber";
import {
  filterMembers,
  pickLeaders,
  sortMembers,
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
 * /congress/wealth.
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

  const filtered = useMemo(
    () => filterMembers(members, { query, chamber, party, state: effectiveState }),
    [members, query, chamber, party, effectiveState],
  );
  const sorted = useMemo(() => sortMembers(filtered, sort), [filtered, sort]);
  const leaders = useMemo(() => (query.trim() ? [] : pickLeaders(filtered)), [filtered, query]);

  const senators = members.filter((m) => m.chamber === "senate").length;

  return (
    <>
      <MembersFilterBar
        query={query}
        onQueryChange={setQuery}
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
            All {members.length} members in office today: {senators} senators and {members.length - senators} members of the
            House, including the delegates from Washington, D.C., and the territories. Search by name or narrow by chamber,
            state or party, then open anyone&rsquo;s page for their voting record, committees, laws and finances. The list
            starts with the members people look up most on Wikipedia.
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

"use client";

import Link from "next/link";
import { HowToRead } from "@/components/HowToRead";
import { PageHeader } from "@/components/PageHeader";
import { PageShortcuts } from "@/components/PageShortcuts";
import { ordinal } from "@/lib/demographics-chart";
import { openYear } from "@/lib/laws-derive";
import type { LawsPayload } from "@/lib/laws-types";
import { LawsCountCard } from "./LawsCountCard";
import { JumpToLaws } from "./JumpToLaws";
import { LawsFilterBar } from "./LawsFilterBar";
import { LawsGroupsCard } from "./LawsGroupsCard";
import { LAW_LIST_ID, LawsListCard } from "./LawsListCard";
import { LawsStateProvider, useLawsActions, useLawsValues } from "./LawsState";
import { LawsSupportCard } from "./LawsSupportCard";
import { SourceLink } from "@/components/SourceLink";
import { UpNext } from "@/components/UpNext";

function ControlToggle() {
  const { control } = useLawsValues();
  const { setControl } = useLawsActions();
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[0.8rem] text-ink-muted">
      <input type="checkbox" checked={control} onChange={(e) => setControl(e.target.checked)} className="h-4 w-4 cursor-pointer accent-[var(--accent)]" />
      Show which party held the House and Senate under each chart
    </label>
  );
}

/**
 * /congress/laws. One shared state (`LawsState`): the years window, the ticked policy areas, major laws only, the ticked support bands and
 * the hovered / pinned Congress. The window and the policy areas narrow both cards (rule 4); the bands ticked in the bar or picked on card 2 also
 * narrows card 1. Card 3 compares policy areas (rows over the window, a heatmap by decade) and sets the policy area; the list of every law follows the same filters.
 */
export function LawsPageClient({ data }: { data: LawsPayload }) {
  const first = openYear(data.congresses[0]!);
  return (
    <LawsStateProvider data={data}>
      <LawsFilterBar />
      <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-4 pb-16 pt-7 sm:px-6">
        <PageHeader eyebrow="Congress · Laws" title="What Laws Does Congress Pass?">
          <p>
            Every public law Congress has passed since {first}, by policy area and by how close the vote was. How much Congress passes, on what, and by what margin shows whether it is governing or gridlocked.
          </p>
          <HowToRead>
            <p>
              One bar is one two-year Congress, labelled by the year it opens; the president under it signed most of its laws. A law counts in the Congress that enacted it, signed or not (veto overrides included); private laws are left out. A law&rsquo;s vote band is the closest final-passage vote it faced in either chamber; laws passed by voice vote or consent in both chambers have no tally and form their own band. &ldquo;Major laws&rdquo; are David Mayhew&rsquo;s lists of important enactments, assessed through the {ordinal(data.majorThrough)} Congress. Select a Congress to pin it on both charts.
            </p>
          </HowToRead>
          <PageShortcuts>
            <JumpToLaws />
            <p>
              <Link href="/timeline" className="font-medium text-accent underline decoration-line-strong underline-offset-2 hover:decoration-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
                See who held power, 1933&ndash;now →
              </Link>
            </p>
          </PageShortcuts>
        </PageHeader>

        {/* Sits with the charts it changes, not among the intro links. */}
        <div className="-mb-3"><ControlToggle /></div>
        <LawsCountCard />
        <LawsSupportCard />
        <LawsGroupsCard />
        <div id={LAW_LIST_ID}>
          <LawsListCard />
        </div>

        <UpNext />
        <p className="m-0 text-[0.8rem] leading-[1.6] text-ink-muted">
          Source: <SourceLink id="congress-gov">Congress.gov</SourceLink> (Library of Congress) for laws, policy areas and sponsors; <SourceLink id="voteview">Voteview</SourceLink> (Lewis, Poole, Rosenthal, Boche, Rudkin and Sonnet) as the check on roll-call tallies; <SourceLink id="mayhew">David Mayhew, lists of important enactments</SourceLink>, for major laws; the <SourceLink id="senate-party-division">Senate Historical Office</SourceLink> and the <SourceLink id="house-party-division">Clerk of the House</SourceLink> for party control. Presidents: the White House Historical Association. Data through {data.dataThrough}.
        </p>
      </main>
    </LawsStateProvider>
  );
}

"use client";

import { DemographicsWindowProvider } from "./TermWindowContext";
import { useMemo, useState } from "react";
import { HowToRead } from "@/components/HowToRead";
import { PageHeader } from "@/components/PageHeader";
import type { ChamberView } from "@/lib/chamber";
import { SLIDER_BOUNDS, readoutRow, windowRows, type PartyPick } from "@/lib/demographics-chart";
import type { DemographicsPayload } from "@/lib/demographics-types";
import type { YearRange } from "@/lib/year-range";
import { AgeCard } from "./AgeCard";
import { DemographicsFilterBar } from "./DemographicsFilterBar";
import { StatStrip } from "./StatStrip";
import { useRoster } from "./useRoster";
import { TenureCard } from "./TenureCard";
import { WomenCard } from "./WomenCard";
import { SourceLink } from "@/components/SourceLink";
import { UpNext } from "@/components/UpNext";

/**
 * /congress/demographics. Page state: the chamber view, the years-shown window, and one pinned Congress that all three
 * charts share (a dashed playhead and the readout above each chart). The charts draw only the Congresses whose first
 * year is in the window.
 */
export function DemographicsPageClient({ data, rosterVersion }: { data: DemographicsPayload; rosterVersion: string }) {
  const [view, setView] = useState<ChamberView>("both");
  const [range, setRange] = useState<YearRange>(SLIDER_BOUNDS);
  const [pin, setPin] = useState<number | null>(null);
  const [pickedParty, setParty] = useState<PartyPick>(null);
  const all = data.views[view];
  const rows = useMemo(() => windowRows(all, range), [all, range]);
  // A pin that has left the window is simply not shown (and comes back if the window widens).
  const livePin = rows.some((r) => r.congress === pin) ? pin : null;
  // The stat strip and the member lists follow the pinned Congress; with none pinned they show the latest one in the years
  // shown (the latest of all only when no Congress is in them).
  const shown = readoutRow(rows, livePin) ?? all[all.length - 1];
  const roster = useRoster(rosterVersion);
  // One party pick for the whole page (the bar's dropdown and every legend set it). "Other" is offered only while the Congress
  // shown has such a member, like the Age chart's two lines; a pick of it that the Congress shown no longer supports is not
  // applied, and comes back when a Congress that has them is shown again, as a pin that has left the window does.
  const otherNow = shown.seatsBy.O > 0;
  const party = pickedParty === "O" && !otherNow ? null : pickedParty;

  return (
    <>
      <DemographicsWindowProvider value={{ min: SLIDER_BOUNDS[0], max: SLIDER_BOUNDS[1], value: range, onChange: setRange }}>
      <DemographicsFilterBar view={view} onView={setView} party={party} onParty={setParty} otherNow={otherNow} rows={data.views.both} presidents={data.presidents} range={range} onRange={setRange} />
      <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-4 pb-16 pt-7 sm:px-6">
        <PageHeader eyebrow="Congress · Demographics" title="Who Serves in Congress?">
          <p>
            The age, gender and tenure of every voting member of Congress since 1933. Who holds the seats shapes which questions Congress takes up, and these charts show how fast, or how slowly, that has changed.
          </p>
          <HowToRead>
            <p>
              Each bar or point is one Congress and counts everyone who held a seat at any time in its two years, so mid-term replacements are included. The strip under each chart shows the president in office for most of each Congress, tinted by party. Click a Congress to pin it across all three charts.
            </p>
          </HowToRead>
        </PageHeader>

        <StatStrip row={shown} party={party} />

        <AgeCard rows={rows} presidents={data.presidents} pin={livePin} onPin={setPin} view={view} roster={roster} party={party} onParty={setParty} />
        <WomenCard rows={rows} presidents={data.presidents} pin={livePin} onPin={setPin} view={view} roster={roster} party={party} onParty={setParty} />
        <TenureCard rows={rows} presidents={data.presidents} pin={livePin} onPin={setPin} view={view} roster={roster} party={party} />

        <UpNext />
        <p className="m-0 text-[0.8rem] leading-[1.6] text-ink-muted">
          Source: member biographies and terms from the <SourceLink id="congress-legislators">@unitedstates/congress-legislators</SourceLink> project; Congress membership lists from <SourceLink id="voteview">Voteview</SourceLink> (Lewis, Poole, Rosenthal, Boche, Rudkin &amp; Sonnet). Voting members only: delegates and resident commissioners are not counted.
        </p>
      </main>
      </DemographicsWindowProvider>
    </>
  );
}

"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { SectionPills, SectionStrip, SectionToc, useSectionScroll, type SectionNavItem } from "@/components/SectionNav";
import { type ImmigrationPageData } from "@/lib/immigration-derive";
import { coverageLabel } from "@/lib/removals-country-derive";
import type { EncountersPayload } from "@/lib/encounters-types";
import type { LprPayload } from "@/lib/lpr-types";
import type { RefugeePayload } from "@/lib/refugee-types";
import type { RemovalsCountryPayload } from "@/lib/removals-country-types";
import { EncountersCard } from "./EncountersCard";
import { CriminalHistoryCard } from "./CriminalHistoryCard";
import { ImmigrationFilterBar } from "./ImmigrationFilterBar";
import { LprSection } from "./LprSection";
import { RefugeeSection } from "./RefugeeSection";
import { RemovalsCard } from "./RemovalsCard";
import { RemovalsCountryCard } from "./RemovalsCountryCard";
import { SectionHeading } from "./SectionHeading";
import { SourceLink } from "@/components/SourceLink";

const asOfLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

/** The page's sections, in order: their numbers run through the pills, the headings and the source notes at the bottom. */
const SECTIONS: readonly SectionNavItem[] = [
  { id: "green-cards", label: "Green cards" },
  { id: "refugees", label: "Refugee admissions", short: "Refugees" },
  { id: "border", label: "Border encounters and ICE removals", short: "Border & removals" },
];

export function ImmigrationPageClient({ data, countries, refugees, lpr, encounters, worldMap }: { data: ImmigrationPageData; countries: RemovalsCountryPayload; refugees: RefugeePayload; lpr: LprPayload; encounters: EncountersPayload; worldMap: { width: number; height: number; features: { key: string; name: string; d: string }[] } }) {
  // Two pieces of page state: the fiscal-year window (the two-handle slider and the term band) narrows the timeline, and
  // the selected fiscal year (a click on a bar, or the year dropdown in the country card) picks the year the country list
  // shows and is marked on the timeline. The selected year is always inside the window.
  const covered = useMemo(() => new Set(countries.years.map((y) => y.fy)), [countries]);
  // The slider spans every year the page has data for: from the refugee series' first year (FY1980; green cards begin in FY1977 and
  // ICE in FY2003) to the newest year all three sections share. Each section clamps to its own years below.
  const bounds: [number, number] = [refugees.years[0].fy, Math.min(lpr.lastFy, data.lastFy)];
  const [range, setRangeRaw] = useState<[number, number]>(bounds);
  // The newest year in the window that has a country table, else the window's last year.
  const pickYear = (r: readonly [number, number]) => {
    for (let f = r[1]; f >= r[0]; f--) if (covered.has(f)) return f;
    return r[1];
  };
  const [fy, setFyRaw] = useState(() => pickYear(bounds));
  const setFy = (f: number) => setFyRaw(Math.min(range[1], Math.max(range[0], f)));
  const setRange = (r: [number, number]) => {
    setRangeRaw(r);
    setFyRaw(pickYear(r)); // the country card's year follows the window's last year
  };
  // The fiscal year either section-3 card is hovered or pinned on, lit on both so a year can be read straight down. Each card keeps
  // its own tooltip and numbers; a card reports its own year and is lit by the other's.
  const [syncFy, setSyncFy] = useState<number | null>(null);
  const iceByFy = useMemo(() => new Map(data.years.map((y) => [y.fy, y.value])), [data.years]);
  const { pillsRef, stuck, active } = useSectionScroll(SECTIONS);
  // ICE's figures begin in FY2003 and end at the page's last year, so the ICE cards get the part of the window they have; a window
  // that ends before FY2003 gets a short notice instead of empty charts.
  const iceFirst = Math.max(range[0], data.firstFy);
  const iceLast = Math.min(range[1], data.lastFy);
  const iceRange: [number, number] | null = iceFirst <= iceLast ? [iceFirst, iceLast] : null;
  // The removals card also carries the INS-era years (FY1980 on, DHS statistics), so it has every year of the window.
  const removalsRange: [number, number] = [Math.max(range[0], data.historyFirstFy), Math.min(range[1], data.lastFy)];
  // One tap puts all three sections on the years ICE has: the slider's left end moves to ICE's first year (and its right end up to the
  // page's last year when the window ended before ICE began). Shown only while the window starts earlier, so there is nothing to keep in sync.
  const snap = (
    <button
      type="button"
      onClick={() => setRange([data.firstFy, range[1] >= data.firstFy ? range[1] : bounds[1]])}
      className="cursor-pointer text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      Show all three on the same years (FY{data.firstFy} on)
    </button>
  );
  const fyIce = iceRange ? Math.min(iceRange[1], Math.max(iceRange[0], fy)) : fy;
  const lprFy = lpr.years.filter((y) => !y.preliminary).at(-1)?.fy;
  return (
    <>
      <ImmigrationFilterBar terms={lpr.terms} years={lpr.years} bounds={bounds} range={range} onRange={setRange}>
        {stuck && <SectionStrip items={SECTIONS} active={active} />}
      </ImmigrationFilterBar>
      <SectionToc items={SECTIONS} active={active} visible={stuck} />
      <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-4 pb-16 pt-7 sm:px-6">
        <PageHeader eyebrow="Presidency · Immigration" title="How Many People Come In and Out of the U.S.?">
          <p>
            Who gets a green card, which refugees are resettled here from abroad, and who ICE removes from the country, year by year. Together they show who the U.S. lets in, who it sends out, and how sharply that changes from one president to the next.
          </p>
          <SectionPills items={SECTIONS} pillsRef={pillsRef} />
        </PageHeader>

        <SectionHeading id="green-cards" number={1} title="How Many People Get Green Cards?" />

        <LprSection payload={lpr} worldMap={worldMap} range={range} />

        <SectionHeading id="refugees" number={2} title="How Many Refugees Does the U.S. Admit?" />

        <RefugeeSection payload={refugees} worldMap={worldMap} range={range} iceLastFy={data.lastFy} />

        <SectionHeading id="border" number={3} title="Who Is Stopped at the Border, and Who Is Removed?">
          <p>
            CBP (U.S. Customs and Border Protection) guards the border. Its Border Patrol agents catch people between ports of entry, and its officers at the ports turn away people who are not admissible; each stop is an “encounter”.
          </p>
          <p>
            An encounter is where a story starts, not where it ends. Afterwards a person may be released to pursue their case, sent back by CBP itself, or handed to ICE (Immigration and Customs Enforcement), which carries out removals and returns and also arrests people inside the country. The two cards are steps of one process: the first counts stops at the border, the second counts what ICE later removes or returns, in whatever year that happens. They belong together but measure different moments, so they sit side by side rather than being added up or matched stop to outcome.
          </p>
        </SectionHeading>

        <EncountersCard payload={encounters} range={range} iceLastFy={data.lastFy} removals={iceByFy} activeFy={syncFy} onActiveFy={setSyncFy} />

        <RemovalsCard data={data} range={removalsRange} fy={fyIce} onFy={setFy} activeFy={syncFy} onActiveFy={setSyncFy} />

        {iceRange ? (
          <>
            <CriminalHistoryCard data={data} range={iceRange} fy={fyIce} onFy={setFy} />

            <RemovalsCountryCard payload={countries} fy={fyIce} range={iceRange} onFy={setFy} worldMap={worldMap} />
          </>
        ) : (
          <p className="m-0 rounded-[10px] border border-line bg-surface px-5 py-4 text-[0.9rem] text-ink-muted">
            ICE’s own figures, which the criminal-history and country charts use, begin in FY{data.firstFy}. Move the left end of the years slider up to FY{data.firstFy} or later to see them. {snap}
          </p>
        )}

        <div className="flex flex-col gap-1.5 text-[0.8rem] leading-[1.6] text-ink-muted [&>p]:m-0">
          <p>
            <span className="mr-1.5 font-mono font-medium text-accent">1</span>
            Source: <SourceLink id="ohss-yearbook">DHS Office of Homeland Security Statistics, Yearbook of Immigration Statistics</SourceLink> through FY{lprFy}; <SourceLink id="ohss-legal-immigration">Legal Immigration and Adjustment of Status Report</SourceLink> (quarterly) for the newest year (preliminary). As of {asOfLabel(lpr.asOf)}. Years go to the administration in office on September 30.
          </p>
          <p>
            <span className="mr-1.5 font-mono font-medium text-accent">2</span>
            Source: <SourceLink id="refugee-determinations">Presidential Determinations on Refugee Admissions</SourceLink> (Federal Register) for ceilings; <SourceLink id="wraps-admissions">State Department Refugee Processing Center, Refugee Admissions Report</SourceLink> through September 30, 2026, for arrivals. As of {asOfLabel(refugees.asOf)}; court status is not tracked. Years go to the administration in office on September 30.
          </p>
          <p>
            <span className="mr-1.5 font-mono font-medium text-accent">3</span>
            Source: <SourceLink id="cbp-encounters">CBP Nationwide Encounters</SourceLink>, FY2020–FY{encounters.lastFy} (FY{encounters.lastFy} preliminary); <SourceLink id="cbp-encounters">CBP Border Patrol apprehension histories</SourceLink>, FY1980 on; <SourceLink id="ohss-cbp-encounters">DHS Office of Homeland Security Statistics</SourceLink>, port-of-entry figures FY{encounters.firstOfoFy}–FY2014 (rounded; port-of-entry figures begin in FY{encounters.firstOfoFy}); <SourceLink id="ohss-yearbook-table39">Yearbook of Immigration Statistics {data.history.edition}, Table 39</SourceLink>, removals before March 2003 (Immigration and Naturalization Service era), FY{data.historyFirstFy}–FY{data.firstFy - 1}, removals only, rounded to tens, as of {asOfLabel(data.history.asOf)}; <SourceLink id="ice-statistics">ICE annual enforcement reports</SourceLink>, removals FY{data.firstFy}–FY{data.lastFy}; <SourceLink id="dhs-ice-budget-fy2027">DHS FY2027 ICE budget overview</SourceLink>, FY{data.lastFy} arrests, detention and criminal history. Border encounters as of {asOfLabel(encounters.asOf)}. Countries are countries of citizenship ({coverageLabel(countries)}). Removals as of {asOfLabel(data.asOf)}. Years go to the administration in office for most of the year.
          </p>
          <p>Counts are never combined across cards or sections. Where a card’s source or definition changes, the chart marks it.</p>
        </div>
      </main>
    </>
  );
}

"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { type ImmigrationPageData } from "@/lib/immigration-derive";
import { coverageLabel } from "@/lib/removals-country-derive";
import type { RefugeePayload } from "@/lib/refugee-types";
import type { RemovalsCountryPayload } from "@/lib/removals-country-types";
import { CriminalHistoryCard } from "./CriminalHistoryCard";
import { ImmigrationFilterBar } from "./ImmigrationFilterBar";
import { RefugeeSection } from "./RefugeeSection";
import { RemovalsCard } from "./RemovalsCard";
import { RemovalsCountryCard } from "./RemovalsCountryCard";
import { SectionHeading } from "./SectionHeading";

const asOfLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

export function ImmigrationPageClient({ data, countries, refugees, worldMap }: { data: ImmigrationPageData; countries: RemovalsCountryPayload; refugees: RefugeePayload; worldMap: { width: number; height: number; features: { key: string; name: string; d: string }[] } }) {
  // Two pieces of page state: the fiscal-year window (the two-handle slider and the term band) narrows the timeline, and
  // the selected fiscal year (a click on a bar, or the year dropdown in the country card) picks the year the country list
  // shows and is marked on the timeline. The selected year is always inside the window.
  const covered = useMemo(() => new Set(countries.years.map((y) => y.fy)), [countries]);
  const bounds: [number, number] = [data.firstFy, data.lastFy];
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
  return (
    <>
      <ImmigrationFilterBar terms={data.terms} years={data.years} bounds={bounds} range={range} onRange={setRange} />
      <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-4 pb-16 pt-7 sm:px-6">
        <PageHeader eyebrow="Presidency · Immigration" title="How Many People Come In and Out of the U.S.?">
          <p>
            Every year, the U.S. sends some people out and lets others in. Here are two pieces of that picture: who ICE removes from the country, and which refugees are resettled here from abroad.
          </p>
          <nav aria-label="Sections" className="flex flex-wrap gap-2">
            {[
              ["#ice", "ICE removals"],
              ["#refugees", "Refugee admissions"],
            ].map(([href, label]) => (
              <a key={href} href={href} className="rounded-full border border-line-strong bg-surface px-3 py-0.5 text-[0.78rem] text-ink no-underline hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
                {label}
              </a>
            ))}
          </nav>
        </PageHeader>

        <SectionHeading id="ice" title="How Many People Does ICE Remove?">
          <p>
            ICE counts how many people it removes each fiscal year. Some were picked up at the border and handed over to ICE; the rest were arrested by ICE’s own officers.
          </p>
        </SectionHeading>

        <RemovalsCard data={data} range={range} fy={fy} onFy={setFy} />

        <CriminalHistoryCard data={data} range={range} fy={fy} onFy={setFy} />

        <RemovalsCountryCard payload={countries} fy={fy} range={range} onFy={setFy} worldMap={worldMap} />

        <p className="m-0 text-[0.8rem] leading-[1.6] text-ink-muted">
          Source: U.S. Immigration and Customs Enforcement removal statistics, FY{data.firstFy}–FY{data.lastFy} (FY
          {data.lastFy} from the DHS FY2027 ICE budget overview). Data as of {asOfLabel(data.asOf)}. Each fiscal year is
          assigned to the administration in office for most of it; inauguration-year splits are shown on the year’s card.
          Arrests, detention and criminal history come from ICE’s annual enforcement reports (FY2025 detention and criminal history from the budget overview). The country list uses the removals-by-country-of-citizenship tables in ICE’s annual reports ({coverageLabel(countries)}); each year’s
          countries add up to that year’s ICE total. Countries are countries of citizenship, not destinations. One agency, one definition: ICE
          only, never combined with Border Patrol or DHS-wide counts.
        </p>

        <SectionHeading id="refugees" title="How Many Refugees Does the U.S. Admit?" />

        <RefugeeSection payload={refugees} worldMap={worldMap} range={range} iceLastFy={data.lastFy} />
      </main>
    </>
  );
}

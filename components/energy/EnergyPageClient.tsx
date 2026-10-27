"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { EIA_ATTRIBUTION } from "@/lib/energy-entities";
import { termAtDay } from "@/lib/energy-derive";
import type { EnergyPayload } from "@/lib/energy-types";
import type { FaqFile } from "@/lib/news-types";
import { dateOfDay, dayOf, MONTH_NAMES } from "@/lib/indicator-time";
import { termLabel } from "@/lib/trade-chart";
import { ElectricityCard } from "./ElectricityCard";
import { EnergyFilterBar } from "./EnergyFilterBar";
import { activeDay, EnergyStateProvider, useEnergyActions, useEnergyValues } from "./EnergyState";
import { LngCard } from "./LngCard";
import { OilTradeCard } from "./OilTradeCard";
import { SupplyDemandCard } from "./SupplyDemandCard";
import { SprCard } from "./SprCard";
import { SourceLink } from "@/components/SourceLink";
import { UpNext } from "@/components/UpNext";
import { ChartJumpLink, NewsAndFaqBand, NewsQuestionsPills, Questions } from "@/components/news/NewsSections";
import { energyFaq } from "./energy-news";

/** `faqFile` is `faq_energy.json`; null (or empty) leaves out the FAQ section, its header link and the cards' jump links. */
export function EnergyPageClient({ payload, faqFile }: { payload: EnergyPayload; faqFile: FaqFile | null }) {
  return (
    <EnergyStateProvider>
      <EnergyPage payload={payload} faqFile={faqFile} />
    </EnergyStateProvider>
  );
}

const longDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

function EnergyPage({ payload, faqFile }: { payload: EnergyPayload; faqFile: FaqFile | null }) {
  const v = useEnergyValues();
  const { setRange, clearPin } = useEnergyActions();
  const firstYear = dateOfDay(0).year;
  const lastYear = dateOfDay(payload.span - 1).year;
  const range = useMemo<[number, number]>(() => v.range ?? [firstYear, lastYear], [v.range, firstYear, lastYear]);
  const view = useMemo<[number, number]>(() => [dayOf(range[0], 0, 1), Math.min(payload.span, dayOf(range[1] + 1, 0, 1))], [range, payload.span]);

  const faq = useMemo(() => energyFaq(faqFile), [faqFile]);
  // The card whose jump link was tapped (its DOM id); its questions are highlighted for a few seconds.
  const [focus, setFocus] = useState<string | null>(null);
  const jumpTo = (target: string) => {
    setFocus(target);
    window.setTimeout(() => setFocus((f) => (f === target ? null : f)), 4000);
  };
  const jump = (target: string) => <ChartJumpLink target={target} news={[]} groups={faq} onJump={jumpTo} />;

  const pinDay = activeDay({ hover: null, pin: v.pin });
  const announcement = (() => {
    if (pinDay === null) return "";
    const { year, month } = dateOfDay(pinDay);
    const t = termAtDay(payload.terms, pinDay);
    return `Pinned ${MONTH_NAMES[month]} ${year}${t ? `, ${termLabel(t)}` : ""}.`;
  })();

  return (
    <>
      <EnergyFilterBar terms={payload.terms} range={range} firstYear={firstYear} lastYear={lastYear} onRange={setRange} canClear={v.pin !== null} onClear={clearPin} />
      <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-4 pb-16 pt-7 sm:px-6">
        <div aria-live="polite" className="sr-only">
          {announcement}
        </div>
        <PageHeader eyebrow="Presidency · Energy" title="How Has U.S. Energy Changed?">
          <p>
            Track electricity sources, domestic oil production, LNG exports, and Strategic Petroleum Reserve levels since 1991. Because energy costs ripple through the economy, key regulatory and legislative turning points are marked along the way.
          </p>
          <NewsQuestionsPills news={[]} groups={faq} />
        </PageHeader>

        <ElectricityCard payload={payload} view={view} jump={jump("electricity")} />
        <SupplyDemandCard payload={payload} view={view} jump={jump("supply")} />
        <OilTradeCard payload={payload} view={view} jump={jump("oil")} />
        <LngCard payload={payload} view={view} jump={jump("lng")} />
        <SprCard payload={payload} view={view} jump={jump("spr")} />

        {faq.length > 0 && (
          <NewsAndFaqBand>
            <Questions groups={faq} focus={focus} />
          </NewsAndFaqBand>
        )}

        <UpNext />
        <p className="m-0 text-[0.8rem] leading-[1.6] text-ink-muted">
          {EIA_ATTRIBUTION}, <SourceLink id="eia-mer">Monthly Energy Review</SourceLink>, <SourceLink href="https://www.eia.gov/petroleum/supply/monthly/">Petroleum Supply Monthly</SourceLink>, <SourceLink id="eia-electricity">Electric Power Monthly</SourceLink> and <SourceLink href="https://www.eia.gov/naturalgas/monthly/">Natural Gas Monthly</SourceLink>, retrieved {longDate(payload.fetchedAt)}. Policy actions are hand-curated from Department of
          Energy, Federal Register and govinfo.gov pages. Presidential terms and recession dates match the Economy page.
        </p>
      </main>
    </>
  );
}

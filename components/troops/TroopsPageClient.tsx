"use client";

import { useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { BasesPayload } from "@/lib/bases-types";
import type { WorldMapFile } from "@/lib/foreign-aid-entities";
import type { TroopsPayload } from "@/lib/troops-types";
import { MapCard } from "./MapCard";
import { TroopsFirstPlaceCard } from "./TroopsFirstPlaceCard";
import { TroopsChartCard } from "./TroopsChartCard";
import { TroopsFilterBar } from "./TroopsFilterBar";
import { TroopsStateProvider } from "./TroopsState";
import { SourceLink } from "@/components/SourceLink";
import { UpNext } from "@/components/UpNext";
import { NewsFaqBand, NewsQuestionsPills, useChartJump } from "@/components/news/NewsSections";
import type { FaqFile } from "@/lib/news-types";
import { troopsFaq } from "./troops-news";

const dateLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

/** `faqFile` is `faq_troops-abroad.json`; null (or empty) leaves out the FAQ section, its header link and the cards' jump links. */
export function TroopsPageClient({ payload, map, bases, faqFile }: { payload: TroopsPayload; map: WorldMapFile; bases: BasesPayload; faqFile: FaqFile | null }) {
  const first = payload.years[0];
  const last = payload.years[payload.years.length - 1];
  const faq = useMemo(() => troopsFaq(faqFile), [faqFile]);
  const { focus, jump } = useChartJump([], faq);
  return (
    <TroopsStateProvider payload={payload}>
      <TroopsFilterBar />
      <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-4 pb-16 pt-7 sm:px-6">
        <PageHeader eyebrow="Presidency · Troops abroad" title="Where Are U.S. Troops Stationed Abroad?">
          <p>
            Explore active-duty military deployments country by country, from {first.fy} through {last.fy}, to see how U.S. overseas commitments have expanded or contracted from one administration to the next.
          </p>
          <NewsQuestionsPills news={[]} groups={faq} />
        </PageHeader>

        <TroopsChartCard jump={jump("how-many-troops-are-stationed-abroad")} />

        <MapCard map={map} bases={bases} jump={jump("where-they-are-and-who-hosts-the-most")} />

        <TroopsFirstPlaceCard jump={jump("who-s-hosted-the-most")} />

        <NewsFaqBand news={[]} groups={faq} focus={focus} />

        <UpNext />
        <p className="m-0 text-[0.8rem] leading-[1.6] text-ink-muted">
          Source: <SourceLink id="dmdc">U.S. Department of Defense, Defense Manpower Data Center (DMDC)</SourceLink>: location tables (September 30 tables from 2008, data through {dateLabel(payload.dataThrough)}) and 309A country tables (1996 and 1998–2005), public domain. 1953–2007
          otherwise from the <SourceLink id="troopdata">troopdata</SourceLink> compilation (Allen, Flynn and Martinez Machain 2022, <i>Conflict Management and Peace Science</i> 39(3); Kane 2005, Heritage Foundation), GPL-3.0. Space Force is counted with the Air Force (“Air &amp; Space Force”)
          so the branch is comparable across September 2023. Known installations (optional map layer): David Vine’s lists of U.S. bases abroad as compiled in the troopdata package (Flynn), GPL-3.0, one snapshot through {bases.through}. Each year is colored by the president in office on its snapshot date.
        </p>
      </main>
    </TroopsStateProvider>
  );
}

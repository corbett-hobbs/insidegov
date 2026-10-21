import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { hubDescription } from "@/lib/hub-seo";
import { TroopsPageClient } from "@/components/troops/TroopsPageClient";
import { getBasesPayload } from "@/lib/bases-data";
import { getTroopsPayload, getTroopsWorldMap } from "@/lib/troops-data";
import { TopicDatasetLd } from "@/components/TopicDatasetLd";

/** /presidency/troops-abroad — active-duty U.S. personnel stationed abroad, by region, country and branch. */
export function generateMetadata(): Metadata {
  return pageMetadata({
    title: "U.S. Troops Stationed Abroad by Country",
    // A headline finding from the page's data (lib/hub-seo.ts); the plain line stands in if the data cannot be read.
    description: hubDescription("/presidency/troops-abroad", "How many U.S. troops are stationed overseas, by host country, region and military branch since 2008, by president. Defense Manpower Data Center figures."),
    path: "/presidency/troops-abroad",
    topic: "presidency/troops-abroad",
  });
}

export default function TroopsAbroadPage() {
  return (
    <>
      <TopicDatasetLd path="/presidency/troops-abroad" />
      <TroopsPageClient payload={getTroopsPayload()} map={getTroopsWorldMap()} bases={getBasesPayload()} />
    </>
  );
}

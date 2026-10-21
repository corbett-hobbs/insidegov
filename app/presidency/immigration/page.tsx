import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { hubDescription } from "@/lib/hub-seo";
import { ImmigrationPageClient } from "@/components/immigration/ImmigrationPageClient";
import { getEncountersPayload } from "@/lib/encounters-data";
import { getImmigrationPageData } from "@/lib/immigration-data";
import { getWorldMap } from "@/lib/foreign-aid-data";
import { getLprPayload } from "@/lib/lpr-data";
import { getRefugeePayload } from "@/lib/refugee-data";
import { getRemovalsCountryPayload } from "@/lib/removals-country-data";
import { TopicDatasetLd } from "@/components/TopicDatasetLd";

/** /presidency/immigration — green cards and naturalizations, refugee admissions against the presidential ceiling, CBP border encounters and ICE removals, by fiscal year and administration. */
export function generateMetadata(): Metadata {
  return pageMetadata({
    title: "U.S. Immigration Statistics by President",
    // A headline finding from the page's data (lib/hub-seo.ts); the plain line stands in if the data cannot be read.
    description: hubDescription("/presidency/immigration", "Green cards, naturalizations, refugee admissions, border encounters and ICE deportations by fiscal year and president. From DHS, State, CBP and ICE data."),
    path: "/presidency/immigration",
    topic: "presidency/immigration",
  });
}

export default function ImmigrationPage() {
  return (
    <>
      <TopicDatasetLd path="/presidency/immigration" />
      <ImmigrationPageClient data={getImmigrationPageData()} countries={getRemovalsCountryPayload()} refugees={getRefugeePayload()} lpr={getLprPayload()} encounters={getEncountersPayload()} worldMap={(({ width, height, features }) => ({ width, height, features }))(getWorldMap())} />
    </>
  );
}

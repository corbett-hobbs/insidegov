import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { ImmigrationPageClient } from "@/components/immigration/ImmigrationPageClient";
import { getEncountersPayload } from "@/lib/encounters-data";
import { getImmigrationPageData } from "@/lib/immigration-data";
import { getWorldMap } from "@/lib/foreign-aid-data";
import { getLprPayload } from "@/lib/lpr-data";
import { getRefugeePayload } from "@/lib/refugee-data";
import { getRemovalsCountryPayload } from "@/lib/removals-country-data";
import { TopicDatasetLd } from "@/components/TopicDatasetLd";

/** /presidency/immigration — green cards and naturalizations, refugee admissions against the presidential ceiling, CBP border encounters and ICE removals, by fiscal year and administration. */
export const metadata: Metadata = pageMetadata({
  title: "U.S. Immigration Statistics by President",
  description: "Green cards, naturalizations, refugee admissions, border encounters and ICE deportations by fiscal year and president. From DHS, State, CBP and ICE data.",
  path: "/presidency/immigration",
  topic: "presidency/immigration",
});

export default function ImmigrationPage() {
  return (
    <>
      <TopicDatasetLd path="/presidency/immigration" />
      <ImmigrationPageClient data={getImmigrationPageData()} countries={getRemovalsCountryPayload()} refugees={getRefugeePayload()} lpr={getLprPayload()} encounters={getEncountersPayload()} worldMap={(({ width, height, features }) => ({ width, height, features }))(getWorldMap())} />
    </>
  );
}

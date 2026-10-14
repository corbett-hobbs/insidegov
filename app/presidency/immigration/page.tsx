import type { Metadata } from "next";
import { ImmigrationPageClient } from "@/components/immigration/ImmigrationPageClient";
import { getImmigrationPageData } from "@/lib/immigration-data";
import { getWorldMap } from "@/lib/foreign-aid-data";
import { getRefugeePayload } from "@/lib/refugee-data";
import { getRemovalsCountryPayload } from "@/lib/removals-country-data";
import { site, ogDefaults, twitterDefaults } from "@/lib/site";

/** /presidency/immigration — ICE removals by fiscal year, and refugee admissions against the presidential ceiling, by administration. */
export const metadata: Metadata = {
  title: "How many people come in and out of the U.S.?",
  description:
    "ICE removals by fiscal year since 2003, and refugee admissions against each year's presidential ceiling, by region and country of origin, set against the administration in office. From ICE's own statistics and State Department data.",
  alternates: { canonical: "/presidency/immigration" },
  openGraph: {
    ...ogDefaults,
    title: `How many people come in and out of the U.S.? · ${site.name}`,
    description:
      "Who ICE removes and which refugees are resettled in the U.S., by fiscal year and administration. From ICE's own statistics and State Department data.",
    url: "/presidency/immigration",
  },
  twitter: twitterDefaults,
};

export default function ImmigrationPage() {
  return <ImmigrationPageClient data={getImmigrationPageData()} countries={getRemovalsCountryPayload()} refugees={getRefugeePayload()} worldMap={(({ width, height, features }) => ({ width, height, features }))(getWorldMap())} />;
}

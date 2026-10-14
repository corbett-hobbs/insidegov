import type { Metadata } from "next";
import { ImmigrationPageClient } from "@/components/immigration/ImmigrationPageClient";
import { getImmigrationPageData } from "@/lib/immigration-data";
import { getWorldMap } from "@/lib/foreign-aid-data";
import { getLprPayload } from "@/lib/lpr-data";
import { getRefugeePayload } from "@/lib/refugee-data";
import { getRemovalsCountryPayload } from "@/lib/removals-country-data";
import { site, ogDefaults, twitterDefaults } from "@/lib/site";

/** /presidency/immigration — green cards and naturalizations, refugee admissions against the presidential ceiling, and ICE removals, by fiscal year and administration. */
export const metadata: Metadata = {
  title: "How many people come in and out of the U.S.?",
  description:
    "Green cards and naturalizations by class and country of birth, refugee admissions against each year's presidential ceiling, and ICE removals, by fiscal year and set against the administration in office. From DHS, State Department and ICE statistics.",
  alternates: { canonical: "/presidency/immigration" },
  openGraph: {
    ...ogDefaults,
    title: `How many people come in and out of the U.S.? · ${site.name}`,
    description:
      "Who gets a green card, which refugees are resettled and who ICE removes, by fiscal year and administration. From DHS, State Department and ICE statistics.",
    url: "/presidency/immigration",
  },
  twitter: twitterDefaults,
};

export default function ImmigrationPage() {
  return <ImmigrationPageClient data={getImmigrationPageData()} countries={getRemovalsCountryPayload()} refugees={getRefugeePayload()} lpr={getLprPayload()} worldMap={(({ width, height, features }) => ({ width, height, features }))(getWorldMap())} />;
}

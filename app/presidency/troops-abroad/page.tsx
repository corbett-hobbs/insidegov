import type { Metadata } from "next";
import { TroopsPageClient } from "@/components/troops/TroopsPageClient";
import { getBasesPayload } from "@/lib/bases-data";
import { getTroopsPayload, getTroopsWorldMap } from "@/lib/troops-data";
import { site, topicOgDefaults, topicTwitterDefaults } from "@/lib/site";

/** /presidency/troops-abroad — active-duty U.S. personnel stationed abroad, by region, country and branch. */
export const metadata: Metadata = {
  title: "Where are U.S. troops stationed abroad?",
  description:
    "Active-duty U.S. military personnel stationed abroad by region, host country and branch since 2008, with presidential terms marked. From the Defense Manpower Data Center.",
  alternates: { canonical: "/presidency/troops-abroad" },
  openGraph: {
    ...topicOgDefaults,
    title: `Where are U.S. troops stationed abroad? · ${site.name}`,
    description: "Active-duty U.S. personnel by host country, region and branch. From the Defense Manpower Data Center.",
    url: "/presidency/troops-abroad",
  },
  twitter: topicTwitterDefaults,
};

export default function TroopsAbroadPage() {
  return <TroopsPageClient payload={getTroopsPayload()} map={getTroopsWorldMap()} bases={getBasesPayload()} />;
}

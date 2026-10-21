import type { Metadata } from "next";
import { TroopsPageClient } from "@/components/troops/TroopsPageClient";
import { getBasesPayload } from "@/lib/bases-data";
import { getTroopsPayload, getTroopsWorldMap } from "@/lib/troops-data";
import { site, topicOg, topicTwitter } from "@/lib/site";
import { TopicDatasetLd } from "@/components/TopicDatasetLd";

/** /presidency/troops-abroad — active-duty U.S. personnel stationed abroad, by region, country and branch. */
export const metadata: Metadata = {
  title: "Where are U.S. troops stationed abroad?",
  description:
    "Active-duty U.S. military personnel stationed abroad by region, host country and branch since 2008, with presidential terms marked. From the Defense Manpower Data Center.",
  alternates: { canonical: "/presidency/troops-abroad" },
  openGraph: {
    ...topicOg("presidency/troops-abroad"),
    title: `Where are U.S. troops stationed abroad? · ${site.name}`,
    description: "Active-duty U.S. personnel by host country, region and branch. From the Defense Manpower Data Center.",
    url: "/presidency/troops-abroad",
  },
  twitter: topicTwitter("presidency/troops-abroad"),
};

export default function TroopsAbroadPage() {
  return (
    <>
      <TopicDatasetLd path="/presidency/troops-abroad" />
      <TroopsPageClient payload={getTroopsPayload()} map={getTroopsWorldMap()} bases={getBasesPayload()} />
    </>
  );
}

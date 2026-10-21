import type { Metadata } from "next";
import { ForeignAidPageClient } from "@/components/foreign-aid/ForeignAidPageClient";
import { getAidPayload, getWorldMap } from "@/lib/foreign-aid-data";
import { site, topicOgDefaults, topicTwitterDefaults } from "@/lib/site";
import { TopicDatasetLd } from "@/components/TopicDatasetLd";

/** /presidency/foreign-aid — U.S. foreign assistance disbursements by fiscal year, country and sector. */
export const metadata: Metadata = {
  title: "Where does U.S. foreign aid go?",
  description:
    "U.S. foreign assistance disbursements by fiscal year, sector and recipient country since FY2001, with presidential terms marked. From ForeignAssistance.gov.",
  alternates: { canonical: "/presidency/foreign-aid" },
  openGraph: {
    ...topicOgDefaults,
    title: `Where does U.S. foreign aid go? · ${site.name}`,
    description: "U.S. foreign assistance disbursements by fiscal year, sector and country. From ForeignAssistance.gov.",
    url: "/presidency/foreign-aid",
  },
  twitter: topicTwitterDefaults,
};

export default function ForeignAidPage() {
  return (
    <>
      <TopicDatasetLd path="/presidency/foreign-aid" />
      <ForeignAidPageClient payload={getAidPayload()} map={getWorldMap()} />
    </>
  );
}

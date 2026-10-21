import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { ForeignAidPageClient } from "@/components/foreign-aid/ForeignAidPageClient";
import { getAidPayload, getWorldMap } from "@/lib/foreign-aid-data";
import { TopicDatasetLd } from "@/components/TopicDatasetLd";

/** /presidency/foreign-aid — U.S. foreign assistance disbursements by fiscal year, country and sector. */
export const metadata: Metadata = pageMetadata({
  title: "U.S. Foreign Aid by Country and Year",
  description: "Where U.S. foreign aid goes: disbursements by recipient country, sector and fiscal year since 2001, by president. Data from ForeignAssistance.gov.",
  path: "/presidency/foreign-aid",
  topic: "presidency/foreign-aid",
});

export default function ForeignAidPage() {
  return (
    <>
      <TopicDatasetLd path="/presidency/foreign-aid" />
      <ForeignAidPageClient payload={getAidPayload()} map={getWorldMap()} />
    </>
  );
}

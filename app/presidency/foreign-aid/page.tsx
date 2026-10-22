import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { hubDescription } from "@/lib/hub-seo";
import { ForeignAidPageClient } from "@/components/foreign-aid/ForeignAidPageClient";
import { getAidPayload, getWorldMap } from "@/lib/foreign-aid-data";
import { TopicDatasetLd } from "@/components/TopicDatasetLd";

/** /presidency/foreign-aid — U.S. foreign assistance disbursements by fiscal year, country and sector. */
export function generateMetadata(): Metadata {
  return pageMetadata({
    title: "U.S. Foreign Aid by Country and Year",
    // A headline finding from the page's data (lib/hub-seo.ts); the plain line stands in if the data cannot be read.
    description: hubDescription("/presidency/foreign-aid", "Where U.S. foreign aid goes: disbursements to recipient countries and regional programs by fiscal year since 2001. Data from ForeignAssistance.gov."),
    path: "/presidency/foreign-aid",
    topic: "presidency/foreign-aid",
  });
}

export default function ForeignAidPage() {
  return (
    <>
      <TopicDatasetLd path="/presidency/foreign-aid" />
      <ForeignAidPageClient payload={getAidPayload()} map={getWorldMap()} />
    </>
  );
}

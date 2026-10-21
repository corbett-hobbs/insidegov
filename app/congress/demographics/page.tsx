import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { DemographicsPageClient } from "@/components/demographics/DemographicsPageClient";
import { getDemographicsPayload, getRosterVersion } from "@/lib/demographics-data";
import { TopicDatasetLd } from "@/components/TopicDatasetLd";

/** /congress/demographics — the Congress vertical's Demographics section. */
export const metadata: Metadata = pageMetadata({
  title: "Congress Demographics: Age, Gender and Tenure",
  description: "The average age of Congress, how many members are women and how long they have served, for every House and Senate since 1933.",
  path: "/congress/demographics",
  topic: "congress/demographics",
});

export default function DemographicsPage() {
  return (
    <>
      <TopicDatasetLd path="/congress/demographics" />
      <DemographicsPageClient data={getDemographicsPayload()} rosterVersion={getRosterVersion()} />
    </>
  );
}

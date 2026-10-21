import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { hubDescription } from "@/lib/hub-seo";
import { DemographicsPageClient } from "@/components/demographics/DemographicsPageClient";
import { getDemographicsPayload, getRosterVersion } from "@/lib/demographics-data";
import { TopicDatasetLd } from "@/components/TopicDatasetLd";

/** /congress/demographics — the Congress vertical's Demographics section. */
export function generateMetadata(): Metadata {
  return pageMetadata({
    title: "Congress Demographics: Age, Gender and Tenure",
    // A headline finding from the page's data (lib/hub-seo.ts); the plain line stands in if the data cannot be read.
    description: hubDescription("/congress/demographics", "The average age of Congress, how many members are women and how long they have served, for every House and Senate since 1933."),
    path: "/congress/demographics",
    topic: "congress/demographics",
  });
}

export default function DemographicsPage() {
  return (
    <>
      <TopicDatasetLd path="/congress/demographics" />
      <DemographicsPageClient data={getDemographicsPayload()} rosterVersion={getRosterVersion()} />
    </>
  );
}

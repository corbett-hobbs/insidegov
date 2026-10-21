import type { Metadata } from "next";
import { DemographicsPageClient } from "@/components/demographics/DemographicsPageClient";
import { getDemographicsPayload, getRosterVersion } from "@/lib/demographics-data";
import { site, topicOg, topicTwitter } from "@/lib/site";
import { TopicDatasetLd } from "@/components/TopicDatasetLd";

/** /congress/demographics — the Congress vertical's Demographics section. */
export const metadata: Metadata = {
  title: "Who serves in Congress?",
  description: "How old the members of Congress are, how many are women, and how long they have served, for every Congress since 1933.",
  alternates: { canonical: "/congress/demographics" },
  openGraph: {
    ...topicOg("congress/demographics"),
    title: `Who serves in Congress? · ${site.name}`,
    description: "Age, gender and time in office of the members of every Congress since 1933.",
    url: "/congress/demographics",
  },
  twitter: topicTwitter("congress/demographics"),
};

export default function DemographicsPage() {
  return (
    <>
      <TopicDatasetLd path="/congress/demographics" />
      <DemographicsPageClient data={getDemographicsPayload()} rosterVersion={getRosterVersion()} />
    </>
  );
}

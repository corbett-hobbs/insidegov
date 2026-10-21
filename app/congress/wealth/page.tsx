import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { hubDescription } from "@/lib/hub-seo";
import { getWealthData } from "@/lib/wealth-data";
import { WealthPageClient } from "@/components/wealth/WealthPageClient";
import { TopicDatasetLd } from "@/components/TopicDatasetLd";

/** /congress/wealth — the Congress vertical's Wealth section. */
export function generateMetadata(): Metadata {
  return pageMetadata({
    title: "Net Worth of Every Member of Congress",
    // A headline finding from the page's data (lib/hub-seo.ts); the plain line stands in if the data cannot be read.
    description: hubDescription("/congress/wealth", "Estimated net worth of every current senator and representative, and how it has changed, from their annual House and Senate financial disclosures."),
    path: "/congress/wealth",
    topic: "congress/wealth",
  });
}

export default function WealthPage() {
  const members = getWealthData();
  return (
    <>
      <TopicDatasetLd path="/congress/wealth" />
      <WealthPageClient members={members} />
    </>
  );
}

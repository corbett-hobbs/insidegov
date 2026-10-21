import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { getWealthData } from "@/lib/wealth-data";
import { WealthPageClient } from "@/components/wealth/WealthPageClient";
import { TopicDatasetLd } from "@/components/TopicDatasetLd";

/** /congress/wealth — the Congress vertical's Wealth section. */
export const metadata: Metadata = pageMetadata({
  title: "Net Worth of Every Member of Congress",
  description: "Estimated net worth of every current senator and representative, and how it has changed, from their annual House and Senate financial disclosures.",
  path: "/congress/wealth",
  topic: "congress/wealth",
});

export default function WealthPage() {
  const members = getWealthData();
  return (
    <>
      <TopicDatasetLd path="/congress/wealth" />
      <WealthPageClient members={members} />
    </>
  );
}

import type { Metadata } from "next";
import { getWealthData } from "@/lib/wealth-data";
import { WealthPageClient } from "@/components/wealth/WealthPageClient";
import { site, ogDefaults, twitterDefaults } from "@/lib/site";
import { TopicDatasetLd } from "@/components/TopicDatasetLd";

/** /congress/wealth — the Congress vertical's Wealth section. */
export const metadata: Metadata = {
  title: "How much is Congress worth?",
  description:
    "Estimated from annual House Clerk and Senate eFD financial disclosures — every current member of Congress's net worth over time.",
  alternates: { canonical: "/congress/wealth" },
  openGraph: {
    ...ogDefaults,
    title: `How much is Congress worth? · ${site.name}`,
    description:
      "Estimated from annual House Clerk and Senate eFD financial disclosures.",
    url: "/congress/wealth",
  },
  twitter: twitterDefaults,
};

export default function WealthPage() {
  const members = getWealthData();
  return (
    <>
      <TopicDatasetLd path="/congress/wealth" />
      <WealthPageClient members={members} />
    </>
  );
}

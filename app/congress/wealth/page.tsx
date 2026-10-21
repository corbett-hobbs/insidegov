import type { Metadata } from "next";
import { getWealthData } from "@/lib/wealth-data";
import { WealthPageClient } from "@/components/wealth/WealthPageClient";
import { site, topicOgDefaults, topicTwitterDefaults } from "@/lib/site";

/** /congress/wealth — the Congress vertical's Wealth section. */
export const metadata: Metadata = {
  title: "How much is Congress worth?",
  description:
    "Estimated from annual House Clerk and Senate eFD financial disclosures — every current member of Congress's net worth over time.",
  alternates: { canonical: "/congress/wealth" },
  openGraph: {
    ...topicOgDefaults,
    title: `How much is Congress worth? · ${site.name}`,
    description:
      "Estimated from annual House Clerk and Senate eFD financial disclosures.",
    url: "/congress/wealth",
  },
  twitter: topicTwitterDefaults,
};

export default function WealthPage() {
  const members = getWealthData();
  return <WealthPageClient members={members} />;
}

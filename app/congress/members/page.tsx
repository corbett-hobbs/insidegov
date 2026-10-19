import type { Metadata } from "next";
import { getMembersDirectory } from "@/lib/members-directory-data";
import { MembersPageClient } from "@/components/members/MembersPageClient";
import { site, ogDefaults, twitterDefaults } from "@/lib/site";

/** /congress/members — the Congress vertical's Members directory. */
export const metadata: Metadata = {
  title: "Who is in Congress today?",
  description:
    "Every senator and representative in office today: search by name, filter by chamber, state and party, and sort by ideology, seniority, net worth or how often they are looked up.",
  alternates: { canonical: "/congress/members" },
  openGraph: {
    ...ogDefaults,
    title: `Who is in Congress today? · ${site.name}`,
    description: "Every senator and representative in office today, with links to their pages.",
    url: "/congress/members",
  },
  twitter: twitterDefaults,
};

export default function MembersPage() {
  const { members, pageviews } = getMembersDirectory();
  return <MembersPageClient members={members} pageviews={pageviews} />;
}

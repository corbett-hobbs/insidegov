import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { getMembersDirectory } from "@/lib/members-directory-data";
import { MembersPageClient } from "@/components/members/MembersPageClient";

/** /congress/members — the Congress vertical's Members directory. */
export const metadata: Metadata = pageMetadata({
  title: "Current Members of Congress by State and Party",
  description: "Every current U.S. senator and representative: search by name or state, filter by party and chamber, and sort by ideology, seniority or net worth.",
  path: "/congress/members",
});

export default function MembersPage() {
  const { members, pageviews } = getMembersDirectory();
  return <MembersPageClient members={members} pageviews={pageviews} />;
}

import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { hubDescription } from "@/lib/hub-seo";
import { getMembersDirectory } from "@/lib/members-directory-data";
import { MembersPageClient } from "@/components/members/MembersPageClient";

/** /congress/members — the Congress vertical's Members directory. */
export function generateMetadata(): Metadata {
  return pageMetadata({
    title: "Current Members of Congress by State and Party",
    // A headline finding from the page's data (lib/hub-seo.ts); the plain line stands in if the data cannot be read.
    description: hubDescription("/congress/members", "Every current U.S. senator and representative: search by name or state, filter by party and chamber, and sort by ideology, seniority or net worth."),
    path: "/congress/members",
  });
}

export default function MembersPage() {
  const { members, pageviews } = getMembersDirectory();
  return <MembersPageClient members={members} pageviews={pageviews} />;
}

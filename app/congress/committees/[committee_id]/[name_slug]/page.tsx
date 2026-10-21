import type { Metadata } from "next";
import { committeeSeo } from "@/lib/entity-seo";
import { pageMetadata } from "@/lib/seo";
import { notFound, permanentRedirect } from "next/navigation";
import {
  getAllCommittees,
  getCommitteeCompassBackdrop,
  getCommitteeCompassPool,
  getCommitteeProfile,
} from "@/lib/committee-data";
import { getCommitteeWikipediaSummary } from "@/lib/committee-summary";
import { getCommitteeBillsSummary } from "@/lib/committee-bills-data";
import { committeePath, committeeSlug } from "@/lib/committee-url";
import { CommitteeProfileView } from "@/components/committee/CommitteeProfileView";

interface RouteParams {
  committee_id: string;
  name_slug: string;
}

/** One static page per committee, at the canonical slug. */
export function generateStaticParams(): RouteParams[] {
  return getAllCommittees().map((c) => ({
    committee_id: c.committeeId,
    name_slug: committeeSlug(c),
  }));
}

// Keep dynamicParams on so a stale name-slug 308-redirects to the canonical URL
// (same rule as the member routes). No loading.tsx — its Suspense boundary would
// downgrade the redirect to a client-side meta refresh.
export const dynamicParams = true;

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { committee_id } = await params;
  const committee = getCommitteeProfile(committee_id);
  if (!committee) return { title: "Committee not found" };
  const { title, description } = committeeSeo({ ...committee, chair: committee.chair?.name ?? null, rankingMember: committee.rankingMember?.name ?? null });
  return pageMetadata({ title, description, path: committeePath(committee), ownImage: true });
}

export default async function CommitteePage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { committee_id, name_slug } = await params;

  const committee = getCommitteeProfile(committee_id);
  if (!committee) notFound();

  const canonical = committeeSlug(committee);
  if (name_slug !== canonical) {
    permanentRedirect(committeePath(committee));
  }

  return (
    <CommitteeProfileView
      committee={committee}
      compassPool={getCommitteeCompassPool(committee)}
      compassBackdrop={getCommitteeCompassBackdrop(committee)}
      legislation={getCommitteeBillsSummary(committee.committeeId)}
      about={getCommitteeWikipediaSummary(committee.committeeId)}
    />
  );
}

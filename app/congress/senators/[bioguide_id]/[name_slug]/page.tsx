import type { Metadata } from "next";
import { memberSeo } from "@/lib/entity-seo";
import { pageMetadata } from "@/lib/seo";
import { notFound, permanentRedirect } from "next/navigation";
import {
  getChamberCurrent,
  getCurrentMembers,
  getMemberProfile,
} from "@/lib/congress-data";
import { getMemberCommitteeMemberships } from "@/lib/committee-data";
import { getMemberWealthProfile } from "@/lib/wealth-data";
import { getMemberWikipediaBio } from "@/lib/wikipedia-bio";
import { memberPath, memberSlug } from "@/lib/member-url";
import { partyAbbr } from "@/components/senate/format";
import { JsonLd } from "@/components/JsonLd";
import { personJsonLd } from "@/lib/structured-data";
import { MemberProfileView } from "@/components/profile/MemberProfileView";

interface RouteParams {
  bioguide_id: string;
  name_slug: string;
}

/** One static page per current senator, at the canonical slug. */
export function generateStaticParams(): RouteParams[] {
  return getCurrentMembers("senate").map((s) => ({
    bioguide_id: s.bioguideId,
    name_slug: memberSlug(s),
  }));
}

// A valid id with a stale slug isn't pre-built. Keep dynamicParams on so the
// request reaches the page, which 308-redirects it to the canonical URL (a
// real HTTP redirect — do not add a loading.tsx here, its Suspense boundary
// would turn the redirect into a client-side meta refresh).
export const dynamicParams = true;

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { bioguide_id } = await params;
  const profile = getMemberProfile("senate", bioguide_id);
  if (!profile) return { title: "Senator not found" };
  const { title, description } = memberSeo({ ...profile, chamber: "senate", partyAbbr: partyAbbr(profile.party), hasWealth: getMemberWealthProfile(bioguide_id) != null });
  return pageMetadata({ title, description, path: memberPath(profile), type: "profile", ownImage: true });
}

export default async function SenatorPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { bioguide_id, name_slug } = await params;

  const profile = getMemberProfile("senate", bioguide_id);
  if (!profile) notFound(); // unknown id, or not a senator in the latest Congress

  const canonical = memberSlug(profile);
  if (name_slug !== canonical) {
    permanentRedirect(memberPath(profile));
  }

  const current = getChamberCurrent("senate");
  return (
    <>
      <JsonLd data={personJsonLd({ path: memberPath(profile), name: profile.name, jobTitle: "U.S. Senator", description: memberSeo({ ...profile, chamber: "senate", partyAbbr: partyAbbr(profile.party), hasWealth: false }).jobDescription, affiliation: "U.S. Senate" })} />
    <MemberProfileView
      profile={profile}
      compassMembers={current.plottable}
      delegationMembers={current.all}
      trend={current.trend}
      committeeMemberships={getMemberCommitteeMemberships(bioguide_id)}
      wealthProfile={getMemberWealthProfile(bioguide_id)}
      bio={getMemberWikipediaBio(bioguide_id)}
    />
    </>
  );
}

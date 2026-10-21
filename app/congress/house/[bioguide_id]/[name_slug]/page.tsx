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

/** One static page per current representative, at the canonical slug. */
export function generateStaticParams(): RouteParams[] {
  return getCurrentMembers("house").map((m) => ({
    bioguide_id: m.bioguideId,
    name_slug: memberSlug(m),
  }));
}

// Keep dynamicParams on so a stale name-slug 308-redirects to the canonical
// URL. Do not add a loading.tsx here — its Suspense boundary would downgrade
// the redirect to a client-side meta refresh.
export const dynamicParams = true;

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { bioguide_id } = await params;
  const profile = getMemberProfile("house", bioguide_id);
  if (!profile) return { title: "Representative not found" };
  const { title, description } = memberSeo({ ...profile, chamber: "house", partyAbbr: partyAbbr(profile.party), hasWealth: getMemberWealthProfile(bioguide_id) != null });
  return pageMetadata({ title, description, path: memberPath(profile), type: "profile", ownImage: true });
}

export default async function RepresentativePage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { bioguide_id, name_slug } = await params;

  const profile = getMemberProfile("house", bioguide_id);
  if (!profile) notFound();

  const canonical = memberSlug(profile);
  if (name_slug !== canonical) {
    permanentRedirect(memberPath(profile));
  }

  const current = getChamberCurrent("house");
  return (
    <>
      <JsonLd data={personJsonLd({ path: memberPath(profile), name: profile.name, jobTitle: "U.S. Representative", description: memberSeo({ ...profile, chamber: "house", partyAbbr: partyAbbr(profile.party), hasWealth: false }).jobDescription, affiliation: "U.S. House of Representatives" })} />
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

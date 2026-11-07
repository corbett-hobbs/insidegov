import type {
  ChamberMember,
  MemberProfile,
  PartyMeanPoint,
} from "@/lib/congress-types";
import type { MemberCommitteeMembership } from "@/lib/committee-types";
import type { MemberWealthProfile } from "@/lib/wealth-data";
import { SiteFooter } from "@/components/senate/SiteFooter";
import { SetBackLink } from "@/components/BackLinkContext";
import type { WikipediaBio } from "@/lib/wikipedia-types";
import { ProfileHeader } from "./ProfileHeader";
import { MemberIdeologySection } from "./MemberIdeologySection";
import { CommitteeMembershipsCard } from "./CommitteeMembershipsCard";
import { MemberWealthSection } from "./MemberWealthSection";
import { getMemberViews } from "@/lib/members-directory-data";
import { MemberLawsCard } from "./MemberLawsCard";
import { MemberVotesCard } from "./MemberVotesCard";
import { ProfileSection } from "./ProfileSection";
import { SectionPills, type SectionNavItem } from "@/components/SectionNav";

interface MemberProfileViewProps {
  profile: MemberProfile;
  /** Plottable members of the latest Congress in this chamber (compass). */
  compassMembers: ChamberMember[];
  /** Every member of the latest Congress in this chamber (delegation). */
  delegationMembers: ChamberMember[];
  trend: PartyMeanPoint[];
  /** This member's current committee assignments — empty for the small
   *  share of current members with no current committee seat. */
  committeeMemberships: MemberCommitteeMembership[];
  /** `null` when the member has no financial_disclosures.json rows at all. */
  wealthProfile: MemberWealthProfile | null;
  /** `null` when the member has no Wikipedia record — the header omits the bio. */
  bio: WikipediaBio | null;
}

/**
 * A member's profile page: a vertical-neutral identity header followed by one
 * section per content vertical (see lib/verticals.ts). Today that's just
 * ideology; a future vertical (e.g. wealth) is added by dropping its own
 * `<Member…Section>` in below, as a sibling — the existing sections and this
 * shell don't change.
 */
export function MemberProfileView({
  profile,
  compassMembers,
  delegationMembers,
  trend,
  committeeMemberships,
  wealthProfile,
  bio,
}: MemberProfileViewProps) {
  // Mirrors the early return in MemberWealthSection, so its header never shows over nothing.
  const hasWealth = !!wealthProfile?.years.some((y) => y.kind === "usable" || y.kind === "needs_review");
  const sections: SectionNavItem[] = [
    { id: "member-ideology", label: "Ideology" },
    ...(committeeMemberships.length > 0 ? [{ id: "member-committees", label: "Committees" }] : []),
    { id: "member-laws", label: "Laws" },
    ...(hasWealth ? [{ id: "member-net-worth", label: "Net worth" }] : []),
  ];
  return (
    <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-7 px-6 pb-16 pt-11">
      <SetBackLink href="/congress/members" />

      <ProfileHeader profile={profile} bio={bio} />

      <SectionPills items={sections} numbered={false} className="sm:hidden" />

      <ProfileSection label="Ideology" id="member-ideology">
        <MemberIdeologySection
          profile={profile}
          compassMembers={compassMembers}
          delegationMembers={delegationMembers}
          trend={trend}
          views={getMemberViews()}
        />
      </ProfileSection>

      {committeeMemberships.length > 0 && (
        <ProfileSection label="Committees" id="member-committees">
          <CommitteeMembershipsCard
            profile={profile}
            memberships={committeeMemberships}
          />
        </ProfileSection>
      )}

      <ProfileSection label="Laws" id="member-laws">
        <MemberLawsCard bioguideId={profile.bioguideId} name={profile.name} />
        <MemberVotesCard bioguideId={profile.bioguideId} name={profile.name} />
      </ProfileSection>

      {hasWealth && wealthProfile && (
        <ProfileSection label="Net worth" id="member-net-worth">
          <MemberWealthSection profile={profile} wealthProfile={wealthProfile} />
        </ProfileSection>
      )}

      <SiteFooter />
    </main>
  );
}

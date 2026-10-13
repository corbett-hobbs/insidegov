import Link from "next/link";
import {
  partySplit,
  type CommitteeProfile,
  type RosterLead,
} from "@/lib/committee-types";
import type { CommitteeAbout } from "@/lib/wikipedia-types";
import { memberPath } from "@/lib/member-url";
import { CommitteeSeal } from "./CommitteeSeal";
import { partyAbbr } from "@/components/senate/format";
import { GROUP_VAR, ordinal } from "@/components/senate/format";

const EYEBROW = {
  house: "HOUSE COMMITTEE",
  senate: "SENATE COMMITTEE",
  joint: "JOINT COMMITTEE",
} as const;

const CONTROL_LABEL = {
  dem: "Democratic",
  rep: "Republican",
  other: "Split / other",
} as const;

function LeadLink({ lead, role }: { lead: RosterLead; role: string }) {
  return (
    <>
      {role}:{" "}
      <Link
        href={memberPath({
          bioguideId: lead.bioguideId,
          chamber: lead.chamber,
          name: lead.name,
        })}
        className="font-medium text-ink hover:underline"
      >
        {lead.name}
      </Link>{" "}
      ({partyAbbr(lead.party)})
    </>
  );
}

/**
 * A committee's identity block. The title line runs the page's full width with
 * the committee's seal to its left (House or Senate seal; the site's own drawn
 * seal for a joint committee). Under it, from `lg`, the details (control, Chair,
 * Ranking Member, member count) sit on the left in a fixed 380px column and, where
 * Wikipedia's description says what the committee does, an About block fills the
 * rest, same split as a member's `ProfileHeader`. Below `lg` the About block
 * stacks under the details behind a top rule. No description = no About block.
 */
export function CommitteeHeader({
  committee,
  about = null,
}: {
  committee: CommitteeProfile;
  /** Trimmed Wikipedia description; `null` renders the details alone. */
  about?: CommitteeAbout | null;
}) {
  const { name, chamber, controlGroup, chair, rankingMember, memberCount, latestCongress } =
    committee;

  return (
    <header className="max-w-[1180px]">
      <div className="mb-5 flex items-center gap-3 sm:gap-5">
        <CommitteeSeal chamber={chamber} size={88} className="size-[60px] sm:size-[88px]" />
        <div className="min-w-0">
          <p className="mb-1.5 font-mono text-[0.72rem] uppercase tracking-[0.12em] text-ink-faint">
            {EYEBROW[chamber]}
          </p>
          <h1 className="font-serif text-[clamp(2rem,4vw,2.8rem)] font-semibold leading-[1.05] tracking-[-0.01em]">
            {name}
          </h1>
        </div>
      </div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-0">
        <div className="min-w-0 lg:w-[380px] lg:flex-none">
          <p className="text-[1rem] text-ink-muted">
            <span
              className="mr-1.5 inline-block size-[0.55rem] rounded-full align-middle"
              style={{ background: GROUP_VAR[controlGroup] }}
            />
            {chamber === "joint"
              ? "No single majority"
              : `${CONTROL_LABEL[controlGroup]} control`}{" "}
            · {partySplit(committee)}
          </p>
          {chair && (
            <p className="mt-1.5 text-[0.9rem] text-ink-muted">
              <LeadLink lead={chair} role="Chair" />
            </p>
          )}
          {rankingMember && (
            <p className="mt-1.5 text-[0.9rem] text-ink-muted">
              <LeadLink lead={rankingMember} role="Ranking Member" />
            </p>
          )}
          {!chair && !rankingMember && (
            <p className="mt-1.5 text-[0.9rem] text-ink-muted">
              Leadership not recorded
            </p>
          )}
          <p className="mt-1.5 text-[0.9rem] text-ink-muted">
            {memberCount} members in the {ordinal(latestCongress)} Congress
          </p>
        </div>
        {about && (
          <section
            aria-label="About"
            className="border-t border-line pt-4 lg:min-w-0 lg:flex-1 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0"
          >
            <p className="mb-1.5 font-mono text-[0.72rem] uppercase tracking-[0.12em] text-ink-faint">
              About
            </p>
            <p className="mb-1.5 font-serif text-[1.0625rem] leading-[1.35] text-ink lg:text-base">
              {about.extract}
            </p>
            <p className="text-xs leading-[1.4] text-ink-muted">
              {about.url ? (
                <>
                  From{" "}
                  <a
                    href={about.url}
                    rel="noopener"
                    className="text-accent underline underline-offset-2"
                  >
                    Wikipedia
                  </a>{" "}
                  (text may be abridged), licensed under{" "}
                  <a
                    href="https://creativecommons.org/licenses/by-sa/4.0/"
                    rel="noopener"
                    className="text-accent underline underline-offset-2"
                  >
                    CC BY-SA 4.0
                  </a>
                  .
                </>
              ) : (
                "Summary written by InsideGov from the committee\u2019s jurisdiction."
              )}
            </p>
          </section>
        )}
      </div>
    </header>
  );
}

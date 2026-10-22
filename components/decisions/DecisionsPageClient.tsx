"use client";

import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { HowToRead } from "@/components/HowToRead";
import { PageShortcuts } from "@/components/PageShortcuts";
import { fmtInt } from "@/lib/decisions-derive";
import { ISSUE_AREA_DESCRIPTIONS } from "@/lib/decisions-issue-areas";
import type { DecisionsPayload } from "@/lib/decisions-types";
import { AreasCard } from "./AreasCard";
import { CaseListCard } from "./CaseListCard";
import { CasesCard } from "./CasesCard";
import { DecisionsFilterBar } from "./DecisionsFilterBar";
import { DecisionsStateProvider } from "./DecisionsState";
import { CASE_LIST_ID, JumpToCases } from "./JumpToCases";
import { SplitCard } from "./SplitCard";
import { SourceLink } from "@/components/SourceLink";
import { UpNext } from "@/components/UpNext";

/**
 * /supreme-court/decisions. One shared state (`DecisionsState`): the years window, the issue area and the hovered / pinned
 * term. The window and the area narrow cards 1 and 2 (rule 4); card 3 compares areas over the same window and sets the area.
 */
export function DecisionsPageClient({ data }: { data: DecisionsPayload }) {
  const first = data.terms[0];
  const last = data.terms[data.terms.length - 1];
  return (
    <DecisionsStateProvider data={data}>
      <DecisionsFilterBar />
      <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-4 pb-16 pt-7 sm:px-6">
        <PageHeader eyebrow="Supreme Court · Decisions" title="How Does the Supreme Court Decide?">
          <p>
            Explore every argued Supreme Court case since {first}, categorized by dissent volume. Tracking unanimity versus razor-thin 5&ndash;4 decisions illustrates the fragility of legal consensus.
          </p>
          <HowToRead>
            <p>
              Each case has one issue area, the Supreme Court Database&rsquo;s label for what it was mainly about. Pick one in the Issue area menu at the top (the &#9432; beside each area says the same thing), or select an area in the charts below.
            </p>
            <dl className="m-0 mt-2.5 grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {data.areas.map((a) => (
                <div key={a.id}>
                  <dt className="font-medium text-ink">{a.label}</dt>
                  <dd className="m-0 text-[0.86rem] leading-snug">{ISSUE_AREA_DESCRIPTIONS[a.id]}</dd>
                </div>
              ))}
            </dl>
          </HowToRead>
          <PageShortcuts>
            <JumpToCases />
            <p>
              <Link href="/timeline" className="font-medium text-accent underline decoration-line-strong underline-offset-2 hover:decoration-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
                See who held power, 1933&ndash;now →
              </Link>
            </p>
          </PageShortcuts>
        </PageHeader>

        <CasesCard />
        <SplitCard />
        <AreasCard />
        <div id={CASE_LIST_ID}>
          <CaseListCard />
        </div>

        <UpNext />
        <p className="m-0 text-[0.8rem] leading-[1.6] text-ink-muted">
          Source: <SourceLink id="scdb">{data.citation}</SourceLink>, case-centered by citation, argued cases only, terms {first}–{last}. A term runs October to June. {fmtInt(data.unclearVotes)} cases whose vote is marked unclear are left out. Licensed CC BY-NC 3.0 US. Landmark cases: Wikipedia, “<SourceLink id="wikipedia-landmark-decisions">{data.landmarkSource.page}</SourceLink>”, revision of {data.landmarkSource.revisionDate} (CC BY-SA 4.0), joined to the database by U.S. Reports citation, docket or case name and year; {fmtInt(data.landmarkSource.count)} of its cases are argued cases in these terms.
        </p>
      </main>
    </DecisionsStateProvider>
  );
}

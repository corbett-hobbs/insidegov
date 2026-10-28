"use client";

import { useMemo } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { PageShortcuts } from "@/components/PageShortcuts";
import { openYear } from "@/lib/laws-derive";
import type { LawsPayload } from "@/lib/laws-types";
import { LawsCountCard } from "./LawsCountCard";
import { JumpToLaws } from "./JumpToLaws";
import { LawsFilterBar } from "./LawsFilterBar";
import { LawsGroupsCard } from "./LawsGroupsCard";
import { LAW_LIST_ID, LawsListCard } from "./LawsListCard";
import { LawsStateProvider, useLawsActions, useLawsValues } from "./LawsState";
import { LawsSupportCard } from "./LawsSupportCard";
import { SourceLink } from "@/components/SourceLink";
import { UpNext } from "@/components/UpNext";
import { NewsFaqBand, NewsQuestionsPills, useChartJump } from "@/components/news/NewsSections";
import { updatedLabel } from "@/lib/news-derive";
import type { FaqFile, NewsFile } from "@/lib/news-types";
import { lawsFaq, lawsNews } from "./laws-news";

function ControlToggle() {
  const { control } = useLawsValues();
  const { setControl } = useLawsActions();
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[0.8rem] text-ink-muted">
      <input type="checkbox" checked={control} onChange={(e) => setControl(e.target.checked)} className="h-4 w-4 cursor-pointer accent-[var(--accent)]" />
      Show which party held the House and Senate under each chart
    </label>
  );
}

/**
 * /congress/laws. One shared state (`LawsState`): the years window, the ticked policy areas, major laws only, the ticked support bands and
 * the hovered / pinned Congress. The window and the policy areas narrow both cards (rule 4); the bands ticked in the bar or picked on card 2 also
 * narrows card 1. Card 3 compares policy areas (rows over the window, a heatmap by decade) and sets the policy area; the list of every law follows the same filters.
 * `faqFile` is `faq_laws.json` and `newsFile` `news_laws.json`; null (or empty) leaves out that section, its header link and the cards' jump links.
 */
export function LawsPageClient({ data, faqFile, newsFile }: { data: LawsPayload; faqFile: FaqFile | null; newsFile: NewsFile | null }) {
  const first = openYear(data.congresses[0]!);
  const faq = useMemo(() => lawsFaq(faqFile), [faqFile]);
  const news = useMemo(() => lawsNews(data, newsFile), [data, newsFile]);
  const { focus, jump } = useChartJump(news, faq);
  return (
    <LawsStateProvider data={data}>
      <LawsFilterBar />
      <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-4 pb-16 pt-7 sm:px-6">
        <PageHeader eyebrow="Congress · Laws" title="What Laws Does Congress Pass?">
          <p>
            Track federal legislation enacted since {first}, broken down by policy topic and final vote margins. Examining what passes&mdash;and how narrowly&mdash;provides a clear indicator of legislative productivity versus gridlock.
          </p>
          <PageShortcuts>
            <JumpToLaws />
            <p>
              <Link href="/timeline" className="font-medium text-accent underline decoration-line-strong underline-offset-2 hover:decoration-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
                See who held power, 1933&ndash;now →
              </Link>
            </p>
          </PageShortcuts>
          <NewsQuestionsPills news={news} groups={faq} />
        </PageHeader>

        {/* Sits with the charts it changes, not among the intro links. */}
        <div className="-mb-3"><ControlToggle /></div>
        <LawsCountCard jump={jump("how-many-laws-does-congress-pass")} />
        <LawsSupportCard jump={jump("how-broadly-are-laws-supported")} />
        <LawsGroupsCard jump={jump("which-kinds-of-laws-pass-and-how")} />
        <div id={LAW_LIST_ID}>
          <LawsListCard />
        </div>

        <NewsFaqBand news={news} updated={updatedLabel(newsFile?.asOf)} groups={faq} focus={focus} chartNote="bars show the laws per Congress on the law’s topic, the last ten Congresses, the newest still in progress" />

        <UpNext />
        <p className="m-0 text-[0.8rem] leading-[1.6] text-ink-muted">
          Source: <SourceLink id="congress-gov">Congress.gov</SourceLink> (Library of Congress) for laws, policy areas and sponsors; <SourceLink id="voteview">Voteview</SourceLink> (Lewis, Poole, Rosenthal, Boche, Rudkin and Sonnet) as the check on roll-call tallies; <SourceLink id="mayhew">David Mayhew, lists of important enactments</SourceLink>, for major laws; the <SourceLink id="senate-party-division">Senate Historical Office</SourceLink> and the <SourceLink id="house-party-division">Clerk of the House</SourceLink> for party control. Presidents: the White House Historical Association. Data through {data.dataThrough}.
        </p>
      </main>
    </LawsStateProvider>
  );
}

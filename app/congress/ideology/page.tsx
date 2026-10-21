import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { Suspense } from "react";
import {
  getBothTrend,
  getChamberCurrent,
  getMemberSearchIndex,
} from "@/lib/congress-data";
import {
  committeesLatestCongress,
  getCommittees,
  getCommitteeSearchIndex,
} from "@/lib/committee-data";
import { site } from "@/lib/site";
import { SenateExplorer } from "@/components/senate/SenateExplorer";
import { TopicDatasetLd } from "@/components/TopicDatasetLd";

export const metadata: Metadata = pageMetadata({
  title: "Ideology Scores for Every Member of Congress",
  description: site.congressIdeologyDescription,
  path: "/congress/ideology",
  topic: "congress/ideology",
});

export default function Home() {
  const senate = getChamberCurrent("senate");
  const house = getChamberCurrent("house");
  const bothTrend = getBothTrend();
  const search = getMemberSearchIndex();
  const committees = getCommittees("both");
  const committeeSearch = getCommitteeSearchIndex();

  return (
    <>
      <TopicDatasetLd path="/congress/ideology" />
    <Suspense fallback={<div className="min-h-screen" />}>
      <SenateExplorer
        senate={senate}
        house={house}
        bothTrend={bothTrend}
        search={search}
        committees={committees}
        committeeSearch={committeeSearch}
        committeeCongress={committeesLatestCongress()}
      />
    </Suspense>
    </>
  );
}

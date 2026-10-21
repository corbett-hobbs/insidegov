import type { Metadata } from "next";
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
import { site, topicOg, topicTwitter } from "@/lib/site";
import { SenateExplorer } from "@/components/senate/SenateExplorer";
import { TopicDatasetLd } from "@/components/TopicDatasetLd";

export const metadata: Metadata = {
  title: "How does Congress vote?",
  description: site.congressIdeologyDescription,
  alternates: { canonical: "/congress/ideology" },
  openGraph: {
    ...topicOg("congress/ideology"),
    title: `How does Congress vote? · ${site.name}`,
    description: site.congressIdeologyDescription,
    url: "/congress/ideology",
  },
  twitter: topicTwitter("congress/ideology"),
};

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

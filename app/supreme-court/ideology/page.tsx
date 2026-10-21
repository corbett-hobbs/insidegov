import type { Metadata } from "next";
import { getCourtPayload, getCourtPresidentBand } from "@/lib/justice-data";
import { site, topicOg, topicTwitter } from "@/lib/site";
import { CourtExplorer } from "@/components/court/CourtExplorer";
import { TopicDatasetLd } from "@/components/TopicDatasetLd";

// PLACEHOLDER COPY — title/description awaiting Corby's edit.
export const metadata: Metadata = {
  title: "How does the Supreme Court lean?",
  description:
    "Where each Supreme Court justice sits on the liberal–conservative scale, term by term, from Martin–Quinn scores.",
  alternates: { canonical: "/supreme-court/ideology" },
  openGraph: {
    ...topicOg("supreme-court/ideology"),
    title: `How does the Supreme Court lean? · ${site.name}`,
    description:
      "Where each Supreme Court justice sits on the liberal–conservative scale, term by term, from Martin–Quinn scores.",
    url: "/supreme-court/ideology",
  },
  twitter: topicTwitter("supreme-court/ideology"),
};

export default function SupremeCourtPage() {
  return (
    <>
      <TopicDatasetLd path="/supreme-court/ideology" />
      <CourtExplorer data={getCourtPayload()} presidents={getCourtPresidentBand()} />
    </>
  );
}

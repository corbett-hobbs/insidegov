import type { Metadata } from "next";
import { getCourtPayload, getCourtPresidentBand } from "@/lib/justice-data";
import { site, ogDefaults, twitterDefaults } from "@/lib/site";
import { CourtExplorer } from "@/components/court/CourtExplorer";
import { TopicDatasetLd } from "@/components/TopicDatasetLd";

// PLACEHOLDER COPY — title/description awaiting Corby's edit.
export const metadata: Metadata = {
  title: "How does the Supreme Court lean?",
  description:
    "Where each Supreme Court justice sits on the liberal–conservative scale, term by term, from Martin–Quinn scores.",
  alternates: { canonical: "/supreme-court/ideology" },
  openGraph: {
    ...ogDefaults,
    title: `How does the Supreme Court lean? · ${site.name}`,
    description:
      "Where each Supreme Court justice sits on the liberal–conservative scale, term by term, from Martin–Quinn scores.",
    url: "/supreme-court/ideology",
  },
  twitter: twitterDefaults,
};

export default function SupremeCourtPage() {
  return (
    <>
      <TopicDatasetLd path="/supreme-court/ideology" />
      <CourtExplorer data={getCourtPayload()} presidents={getCourtPresidentBand()} />
    </>
  );
}

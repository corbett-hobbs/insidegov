import type { Metadata } from "next";
import { getCourtPayload, getCourtPresidentBand } from "@/lib/justice-data";
import { site, topicOgDefaults, topicTwitterDefaults } from "@/lib/site";
import { CourtExplorer } from "@/components/court/CourtExplorer";

// PLACEHOLDER COPY — title/description awaiting Corby's edit.
export const metadata: Metadata = {
  title: "How does the Supreme Court lean?",
  description:
    "Where each Supreme Court justice sits on the liberal–conservative scale, term by term, from Martin–Quinn scores.",
  alternates: { canonical: "/supreme-court/ideology" },
  openGraph: {
    ...topicOgDefaults,
    title: `How does the Supreme Court lean? · ${site.name}`,
    description:
      "Where each Supreme Court justice sits on the liberal–conservative scale, term by term, from Martin–Quinn scores.",
    url: "/supreme-court/ideology",
  },
  twitter: topicTwitterDefaults,
};

export default function SupremeCourtPage() {
  return <CourtExplorer data={getCourtPayload()} presidents={getCourtPresidentBand()} />;
}

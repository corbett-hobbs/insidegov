import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { hubDescription } from "@/lib/hub-seo";
import { getCourtPayload, getCourtPresidentBand } from "@/lib/justice-data";
import { CourtExplorer } from "@/components/court/CourtExplorer";
import { TopicDatasetLd } from "@/components/TopicDatasetLd";

// PLACEHOLDER COPY — title/description awaiting Corby's edit.
export function generateMetadata(): Metadata {
  return pageMetadata({
    title: "Supreme Court Ideology: How Each Justice Leans",
    // A headline finding from the page's data (lib/hub-seo.ts); the plain line stands in if the data cannot be read.
    description: hubDescription("/supreme-court/ideology", "How liberal or conservative each Supreme Court justice votes, term by term since 1937, from Martin–Quinn scores, and where the Court's median justice sits."),
    path: "/supreme-court/ideology",
    topic: "supreme-court/ideology",
  });
}

export default function SupremeCourtPage() {
  return (
    <>
      <TopicDatasetLd path="/supreme-court/ideology" />
      <CourtExplorer data={getCourtPayload()} presidents={getCourtPresidentBand()} />
    </>
  );
}

import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { getCourtPayload, getCourtPresidentBand } from "@/lib/justice-data";
import { CourtExplorer } from "@/components/court/CourtExplorer";
import { TopicDatasetLd } from "@/components/TopicDatasetLd";

// PLACEHOLDER COPY — title/description awaiting Corby's edit.
export const metadata: Metadata = pageMetadata({
  title: "Supreme Court Ideology: How Each Justice Leans",
  description: "How liberal or conservative each Supreme Court justice votes, term by term since 1937, from Martin–Quinn scores, and where the Court's median justice sits.",
  path: "/supreme-court/ideology",
  topic: "supreme-court/ideology",
});

export default function SupremeCourtPage() {
  return (
    <>
      <TopicDatasetLd path="/supreme-court/ideology" />
      <CourtExplorer data={getCourtPayload()} presidents={getCourtPresidentBand()} />
    </>
  );
}

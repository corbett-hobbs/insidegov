import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { DecisionsPageClient } from "@/components/decisions/DecisionsPageClient";
import { getDecisionsPageData } from "@/lib/decisions-data";
import { TopicDatasetLd } from "@/components/TopicDatasetLd";

/** /supreme-court/decisions — the Supreme Court vertical's Decisions section. */
export const metadata: Metadata = pageMetadata({
  title: "Supreme Court Decisions by Term and Issue",
  description: "Every argued Supreme Court case since 1946: how many the Court decides each term, how often it splits and on which issues. Look up any decision.",
  path: "/supreme-court/decisions",
  topic: "supreme-court/decisions",
});

export default function DecisionsPage() {
  return (
    <>
      <TopicDatasetLd path="/supreme-court/decisions" />
      <DecisionsPageClient data={getDecisionsPageData()} />
    </>
  );
}

import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { hubDescription } from "@/lib/hub-seo";
import { DecisionsPageClient } from "@/components/decisions/DecisionsPageClient";
import { getDecisionsPageData } from "@/lib/decisions-data";
import { TopicDatasetLd } from "@/components/TopicDatasetLd";

/** /supreme-court/decisions — the Supreme Court vertical's Decisions section. */
export function generateMetadata(): Metadata {
  return pageMetadata({
    title: "Supreme Court Decisions by Term and Issue",
    // A headline finding from the page's data (lib/hub-seo.ts); the plain line stands in if the data cannot be read.
    description: hubDescription("/supreme-court/decisions", "Every argued Supreme Court case since 1946, by dissent count: how often the Court is unanimous or splits 5–4. Look up any decision."),
    path: "/supreme-court/decisions",
    topic: "supreme-court/decisions",
  });
}

export default function DecisionsPage() {
  return (
    <>
      <TopicDatasetLd path="/supreme-court/decisions" />
      <DecisionsPageClient data={getDecisionsPageData()} />
    </>
  );
}

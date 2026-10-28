import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { hubDescription } from "@/lib/hub-seo";
import { LawsPageClient } from "@/components/laws/LawsPageClient";
import { getLawsPageData } from "@/lib/laws-data";
import { getFaqFile, getNewsFile } from "@/lib/news-data";
import { TopicDatasetLd } from "@/components/TopicDatasetLd";

/** /congress/laws — the Congress vertical's Laws section. */
export function generateMetadata(): Metadata {
  return pageMetadata({
    title: "Laws Passed by Congress, by Year and Topic",
    // A headline finding from the page's data (lib/hub-seo.ts); the plain line stands in if the data cannot be read.
    description: hubDescription("/congress/laws", "Federal laws Congress has enacted since 1973, by policy topic and vote margin. Look up any law's sponsors, votes and legislative history."),
    path: "/congress/laws",
    topic: "congress/laws",
  });
}

export default function LawsPage() {
  return (
    <>
      <TopicDatasetLd path="/congress/laws" />
      <LawsPageClient data={getLawsPageData()} faqFile={getFaqFile("laws")} newsFile={getNewsFile("laws")} />
    </>
  );
}

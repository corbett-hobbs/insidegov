import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { LawsPageClient } from "@/components/laws/LawsPageClient";
import { getLawsPageData } from "@/lib/laws-data";
import { TopicDatasetLd } from "@/components/TopicDatasetLd";

/** /congress/laws — the Congress vertical's Laws section. */
export const metadata: Metadata = pageMetadata({
  title: "Laws Passed by Congress, by Year and Topic",
  description: "Every public law Congress has passed since 1973, by year, policy area and vote margin. Look up any law's sponsors, votes and legislative history.",
  path: "/congress/laws",
  topic: "congress/laws",
});

export default function LawsPage() {
  return (
    <>
      <TopicDatasetLd path="/congress/laws" />
      <LawsPageClient data={getLawsPageData()} />
    </>
  );
}

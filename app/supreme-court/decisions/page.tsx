import type { Metadata } from "next";
import { DecisionsPageClient } from "@/components/decisions/DecisionsPageClient";
import { getDecisionsPageData } from "@/lib/decisions-data";
import { site, topicOg, topicTwitter } from "@/lib/site";
import { TopicDatasetLd } from "@/components/TopicDatasetLd";

/** /supreme-court/decisions — the Supreme Court vertical's Decisions section. */
export const metadata: Metadata = {
  title: "How does the Supreme Court decide?",
  description: "How many argued cases the Supreme Court decides each term and how often it splits, by issue area, since 1946.",
  alternates: { canonical: "/supreme-court/decisions" },
  openGraph: {
    ...topicOg("supreme-court/decisions"),
    title: `How does the Supreme Court decide? · ${site.name}`,
    description: "Cases decided per term, and how many justices dissented, for every Supreme Court term since 1946.",
    url: "/supreme-court/decisions",
  },
  twitter: topicTwitter("supreme-court/decisions"),
};

export default function DecisionsPage() {
  return (
    <>
      <TopicDatasetLd path="/supreme-court/decisions" />
      <DecisionsPageClient data={getDecisionsPageData()} />
    </>
  );
}

import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { hubDescription } from "@/lib/hub-seo";
import { getExecutiveOrdersData } from "@/lib/executive-orders-data";
import { ExecutiveOrdersPageClient } from "@/components/executive-orders/ExecutiveOrdersPageClient";
import { getFaqFile } from "@/lib/news-data";
import { TopicDatasetLd } from "@/components/TopicDatasetLd";

/** /presidency/executive-orders — the Presidency vertical's Executive orders section. */
export function generateMetadata(): Metadata {
  return pageMetadata({
    title: "Executive Orders by President and Year",
    // A headline finding from the page's data (lib/hub-seo.ts); the plain line stands in if the data cannot be read.
    description: hubDescription("/presidency/executive-orders", "Every executive order signed since 1994, by president, year and topic, with links to the Federal Register."),
    path: "/presidency/executive-orders",
    topic: "presidency/executive-orders",
  });
}

export default function ExecutiveOrdersPage() {
  return (
    <>
      <TopicDatasetLd path="/presidency/executive-orders" />
      <ExecutiveOrdersPageClient data={getExecutiveOrdersData()} faqFile={getFaqFile("executive-orders")} />
    </>
  );
}

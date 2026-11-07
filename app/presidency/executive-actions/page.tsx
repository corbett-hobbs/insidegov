import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { hubDescription } from "@/lib/hub-seo";
import { getExecutiveOrdersData } from "@/lib/executive-orders-data";
import { ExecutiveOrdersPageClient } from "@/components/executive-orders/ExecutiveOrdersPageClient";
import { getClemencyData } from "@/lib/clemency-data";
import { getFaqFile } from "@/lib/news-data";
import { TopicDatasetLd } from "@/components/TopicDatasetLd";

/** /presidency/executive-actions — the Presidency vertical's Executive actions page: orders, then pardons. */
export function generateMetadata(): Metadata {
  return pageMetadata({
    title: "Executive Orders and Pardons by President",
    // A headline finding from the page's data (lib/hub-seo.ts); the plain line stands in if the data cannot be read.
    description: hubDescription("/presidency/executive-actions", "Every executive order since 1994 and every pardon and commutation since Clinton, by president and year."),
    path: "/presidency/executive-actions",
    topic: "presidency/executive-actions",
  });
}

export default function ExecutiveOrdersPage() {
  return (
    <>
      <TopicDatasetLd path="/presidency/executive-actions" />
      <ExecutiveOrdersPageClient data={getExecutiveOrdersData()} clemency={getClemencyData()} faqFile={getFaqFile("executive-orders")} />
    </>
  );
}

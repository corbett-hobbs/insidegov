import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { getExecutiveOrdersData } from "@/lib/executive-orders-data";
import { ExecutiveOrdersPageClient } from "@/components/executive-orders/ExecutiveOrdersPageClient";
import { TopicDatasetLd } from "@/components/TopicDatasetLd";

/** /presidency/executive-orders — the Presidency vertical's Executive orders section. */
export const metadata: Metadata = pageMetadata({
  title: "Executive Orders by President and Year",
  description: "How many executive orders each president has signed, every year since 1994, by topic. Data from the Federal Register.",
  path: "/presidency/executive-orders",
  topic: "presidency/executive-orders",
});

export default function ExecutiveOrdersPage() {
  return (
    <>
      <TopicDatasetLd path="/presidency/executive-orders" />
      <ExecutiveOrdersPageClient data={getExecutiveOrdersData()} />
    </>
  );
}

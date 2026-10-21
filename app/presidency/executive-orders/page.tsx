import type { Metadata } from "next";
import { getExecutiveOrdersData } from "@/lib/executive-orders-data";
import { ExecutiveOrdersPageClient } from "@/components/executive-orders/ExecutiveOrdersPageClient";
import { site, topicOg, topicTwitter } from "@/lib/site";
import { TopicDatasetLd } from "@/components/TopicDatasetLd";

/** /presidency/executive-orders — the Presidency vertical's Executive orders section. */
export const metadata: Metadata = {
  title: "How many executive orders does each president sign?",
  description:
    "Executive orders signed each year since 1994, stacked by primary topic, with presidential terms marked. From the Federal Register.",
  alternates: { canonical: "/presidency/executive-orders" },
  openGraph: {
    ...topicOg("presidency/executive-orders"),
    title: `How many executive orders does each president sign? · ${site.name}`,
    description: "Executive orders signed each year since 1994, by primary topic. From the Federal Register.",
    url: "/presidency/executive-orders",
  },
  twitter: topicTwitter("presidency/executive-orders"),
};

export default function ExecutiveOrdersPage() {
  return (
    <>
      <TopicDatasetLd path="/presidency/executive-orders" />
      <ExecutiveOrdersPageClient data={getExecutiveOrdersData()} />
    </>
  );
}

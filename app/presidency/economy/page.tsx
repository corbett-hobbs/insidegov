import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { hubDescription } from "@/lib/hub-seo";
import { getEconomyPayload, getIndicatorSeriesList } from "@/lib/indicator-data";
import { FRED_API_NOTICE } from "@/lib/indicator-entities";
import { EconomyPageClient } from "@/components/economy/EconomyPageClient";
import { TopicDatasetLd } from "@/components/TopicDatasetLd";

/** /presidency/economy — the Presidency vertical's Economy section. */
export function generateMetadata(): Metadata {
  return pageMetadata({
    title: "U.S. Economy by President: Jobs, Inflation, Gas",
    // A headline finding from the page's data (lib/hub-seo.ts); the plain line stands in if the data cannot be read.
    description: hubDescription("/presidency/economy", "Gas prices, mortgage rates, jobs, inflation, income and the federal deficit since 1991, by president, with recessions and party control of Congress marked."),
    path: "/presidency/economy",
    topic: "presidency/economy",
  });
}

export default function EconomyPage() {
  const mortgage = getIndicatorSeriesList().find((s) => s.series_id === "MORTGAGE30US");
  if (!mortgage) throw new Error("MORTGAGE30US missing from indicator_series.json");
  return (
    <>
      <TopicDatasetLd path="/presidency/economy" />
      <EconomyPageClient payload={getEconomyPayload()} fredNotice={FRED_API_NOTICE} mortgageAttribution={mortgage.attribution} />
    </>
  );
}

import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { getEconomyPayload, getIndicatorSeriesList } from "@/lib/indicator-data";
import { FRED_API_NOTICE } from "@/lib/indicator-entities";
import { EconomyPageClient } from "@/components/economy/EconomyPageClient";
import { TopicDatasetLd } from "@/components/TopicDatasetLd";

/** /presidency/economy — the Presidency vertical's Economy section. */
export const metadata: Metadata = pageMetadata({
  title: "U.S. Economy by President: Jobs, Inflation, Gas",
  description: "Gas prices, mortgage rates, jobs, inflation, income and the federal deficit since 1991, by president, with recessions and party control of Congress marked.",
  path: "/presidency/economy",
  topic: "presidency/economy",
});

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

import type { Metadata } from "next";
import { getEconomyPayload, getIndicatorSeriesList } from "@/lib/indicator-data";
import { FRED_API_NOTICE } from "@/lib/indicator-entities";
import { EconomyPageClient } from "@/components/economy/EconomyPageClient";
import { site, topicOg, topicTwitter } from "@/lib/site";
import { TopicDatasetLd } from "@/components/TopicDatasetLd";

/** /presidency/economy — the Presidency vertical's Economy section. */
export const metadata: Metadata = {
  title: "What was the economy like?",
  description:
    "Gas prices, mortgage rates, jobs, inflation, income and the federal budget since 1991, with presidential terms, recessions and congressional control marked.",
  alternates: { canonical: "/presidency/economy" },
  openGraph: {
    ...topicOg("presidency/economy"),
    title: `What was the economy like? · ${site.name}`,
    description: "Economic conditions since 1991 alongside who was president. From FRED.",
    url: "/presidency/economy",
  },
  twitter: topicTwitter("presidency/economy"),
};

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

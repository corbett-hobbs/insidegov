import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { hubDescription } from "@/lib/hub-seo";
import { TradePageClient } from "@/components/trade/TradePageClient";
import { getTradePageData } from "@/lib/trade-data";
import { TopicDatasetLd } from "@/components/TopicDatasetLd";

/**
 * /presidency/trade — the Presidency vertical's Trade section. The filter bar and
 * the trade-balance chart are in; the tariff, partner and scatter charts land in
 * later sessions (docs: trade UI execution plan).
 */
export function generateMetadata(): Metadata {
  return pageMetadata({
    title: "U.S. Trade and Tariffs by Country",
    // A headline finding from the page's data (lib/hub-seo.ts); the plain line stands in if the data cannot be read.
    description: hubDescription("/presidency/trade", "U.S. imports, exports and tariffs with every country since 1991, with major executive, legislative and court actions marked. Census and USITC data."),
    path: "/presidency/trade",
    topic: "presidency/trade",
  });
}

export default function TradePage() {
  return (
    <>
      <TopicDatasetLd path="/presidency/trade" />
      <TradePageClient data={getTradePageData()} />
    </>
  );
}

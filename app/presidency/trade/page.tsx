import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { TradePageClient } from "@/components/trade/TradePageClient";
import { getTradePageData } from "@/lib/trade-data";
import { TopicDatasetLd } from "@/components/TopicDatasetLd";

/**
 * /presidency/trade — the Presidency vertical's Trade section. The filter bar and
 * the trade-balance chart are in; the tariff, partner and scatter charts land in
 * later sessions (docs: trade UI execution plan).
 */
export const metadata: Metadata = pageMetadata({
  title: "U.S. Trade and Tariffs by Country",
  description: "U.S. imports, exports and trade balance with every country since 1991, and the tariffs collected on imports, by president. Census Bureau and USITC data.",
  path: "/presidency/trade",
  topic: "presidency/trade",
});

export default function TradePage() {
  return (
    <>
      <TopicDatasetLd path="/presidency/trade" />
      <TradePageClient data={getTradePageData()} />
    </>
  );
}

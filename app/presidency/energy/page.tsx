import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { EnergyPageClient } from "@/components/energy/EnergyPageClient";
import { getEnergyPayload } from "@/lib/energy-data";
import { TopicDatasetLd } from "@/components/TopicDatasetLd";

/** /presidency/energy — the Presidency vertical's Energy section: the Strategic Petroleum Reserve, the oil balance, electricity by source and LNG exports. */
export const metadata: Metadata = pageMetadata({
  title: "U.S. Energy by President: Oil, SPR and LNG",
  description: "U.S. oil production, imports and exports, the Strategic Petroleum Reserve, electricity by source and LNG exports since 1991, by president. From the EIA.",
  path: "/presidency/energy",
  topic: "presidency/energy",
});

export default function EnergyPage() {
  return (
    <>
      <TopicDatasetLd path="/presidency/energy" />
      <EnergyPageClient payload={getEnergyPayload()} />
    </>
  );
}

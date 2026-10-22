import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { hubDescription } from "@/lib/hub-seo";
import { EnergyPageClient } from "@/components/energy/EnergyPageClient";
import { getEnergyPayload } from "@/lib/energy-data";
import { TopicDatasetLd } from "@/components/TopicDatasetLd";

/** /presidency/energy — the Presidency vertical's Energy section: the Strategic Petroleum Reserve, the oil balance, electricity by source and LNG exports. */
export function generateMetadata(): Metadata {
  return pageMetadata({
    title: "U.S. Energy by President: Oil, SPR and LNG",
    // A headline finding from the page's data (lib/hub-seo.ts); the plain line stands in if the data cannot be read.
    description: hubDescription("/presidency/energy", "Electricity by source, U.S. oil production, LNG exports and Strategic Petroleum Reserve levels since 1991, with key policy turning points marked. From the EIA."),
    path: "/presidency/energy",
    topic: "presidency/energy",
  });
}

export default function EnergyPage() {
  return (
    <>
      <TopicDatasetLd path="/presidency/energy" />
      <EnergyPageClient payload={getEnergyPayload()} />
    </>
  );
}

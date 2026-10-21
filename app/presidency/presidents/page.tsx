import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { getPresidentDirectory } from "@/lib/president-data";
import { getTimelinePayload } from "@/lib/timeline-data";
import { PresidentsDirectory } from "@/components/presidents/PresidentsDirectory";

/** /presidency/presidents — every president with a page, newest first. */
export const metadata: Metadata = pageMetadata({
  title: "U.S. Presidents: Laws, Courts and Economy",
  description: "Every U.S. president since Franklin D. Roosevelt: party, years in office, major laws signed, Supreme Court appointments, control of Congress and the economy.",
  path: "/presidency/presidents",
});

export default function PresidentsPage() {
  return <PresidentsDirectory rows={getPresidentDirectory()} timeline={{ ...getTimelinePayload(), events: [] }} />;
}

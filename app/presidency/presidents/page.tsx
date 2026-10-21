import type { Metadata } from "next";
import { getPresidentDirectory } from "@/lib/president-data";
import { getTimelinePayload } from "@/lib/timeline-data";
import { site, ogDefaults, twitterDefaults } from "@/lib/site";
import { PresidentsDirectory } from "@/components/presidents/PresidentsDirectory";

/** /presidency/presidents — every president with a page, newest first. */
export const metadata: Metadata = {
  title: "Who has held the presidency?",
  description:
    "Every president since Franklin D. Roosevelt: party, dates in office, major laws signed, how long Congress was on their side, the justices they appointed and the economy through their term, each linking to a page that clips the site's data to that time in office.",
  alternates: { canonical: "/presidency/presidents" },
  openGraph: {
    ...ogDefaults,
    title: `Who has held the presidency? · ${site.name}`,
    description: "Every president since FDR, with major laws, party control of Congress, Supreme Court appointments and the economy in office.",
    url: "/presidency/presidents",
  },
  twitter: twitterDefaults,
};

export default function PresidentsPage() {
  return <PresidentsDirectory rows={getPresidentDirectory()} timeline={{ ...getTimelinePayload(), events: [] }} />;
}

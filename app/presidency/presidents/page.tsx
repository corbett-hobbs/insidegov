import type { Metadata } from "next";
import { getPresidentDirectory } from "@/lib/president-data";
import { site, ogDefaults, twitterDefaults } from "@/lib/site";
import { PresidentsDirectory } from "@/components/presidents/PresidentsDirectory";

/** /presidency/presidents — every president with a page, newest first. */
export const metadata: Metadata = {
  title: "Who has held the presidency?",
  description:
    "Every president since Harry S. Truman: party, dates in office, laws signed, executive orders and Supreme Court appointments, each linking to a page that clips the site's data to that time in office.",
  alternates: { canonical: "/presidency/presidents" },
  openGraph: {
    ...ogDefaults,
    title: `Who has held the presidency? · ${site.name}`,
    description: "Every president since Truman, with laws signed, executive orders and Supreme Court appointments.",
    url: "/presidency/presidents",
  },
  twitter: twitterDefaults,
};

export default function PresidentsPage() {
  return <PresidentsDirectory rows={getPresidentDirectory()} />;
}

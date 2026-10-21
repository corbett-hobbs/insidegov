import type { Metadata } from "next";
import { TimelinePageClient } from "@/components/timeline/TimelinePageClient";
import { getTimelinePayload } from "@/lib/timeline-data";
import { site, topicOgDefaults, topicTwitterDefaults } from "@/lib/site";

/** /timeline — who held the presidency, Senate, House and Supreme Court when each landmark law and case happened, 1933 to now. */
export const metadata: Metadata = {
  title: "Who held power when it happened?",
  description:
    "Every landmark law and Supreme Court case since 1933, set against who held the White House, the Senate, the House and the Court that day.",
  alternates: { canonical: "/timeline" },
  openGraph: {
    ...topicOgDefaults,
    title: `Who held power when it happened? · ${site.name}`,
    description: "Landmark laws and Supreme Court cases since 1933, set against who held the White House, Congress and the Court.",
    url: "/timeline",
  },
  twitter: topicTwitterDefaults,
};

export default function TimelinePage() {
  return <TimelinePageClient data={getTimelinePayload()} />;
}

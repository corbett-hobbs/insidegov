import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { hubDescription } from "@/lib/hub-seo";
import { TimelinePageClient } from "@/components/timeline/TimelinePageClient";
import { getTimelinePayload } from "@/lib/timeline-data";

/** /timeline — who held the presidency, Senate, House and Supreme Court when each landmark law and case happened, 1933 to now. */
export function generateMetadata(): Metadata {
  return pageMetadata({
    title: "Timeline of Landmark Laws and Supreme Court Cases",
    // A headline finding from the page's data (lib/hub-seo.ts); the plain line stands in if the data cannot be read.
    description: hubDescription("/timeline", "Every landmark law and Supreme Court case since 1933, mapped against who controlled the White House, Congress and the Court on that day."),
    path: "/timeline",
    topic: "timeline",
  });
}

export default function TimelinePage() {
  return <TimelinePageClient data={getTimelinePayload()} />;
}

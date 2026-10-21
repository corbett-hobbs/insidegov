import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { TimelinePageClient } from "@/components/timeline/TimelinePageClient";
import { getTimelinePayload } from "@/lib/timeline-data";

/** /timeline — who held the presidency, Senate, House and Supreme Court when each landmark law and case happened, 1933 to now. */
export const metadata: Metadata = pageMetadata({
  title: "Timeline of Landmark Laws and Supreme Court Cases",
  description: "Every landmark law and Supreme Court case since 1933, set against which party held the White House, the Senate, the House and the Court that day.",
  path: "/timeline",
  topic: "timeline",
});

export default function TimelinePage() {
  return <TimelinePageClient data={getTimelinePayload()} />;
}

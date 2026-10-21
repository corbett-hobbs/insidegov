import { TOPIC_OG_SIZE, topicAlt, topicImage } from "@/app/_og/topic-card";

// The page's headline figure and sparkline (lib/og-topics.ts); rendered at build time.
export const alt = topicAlt("congress/wealth");
export const size = TOPIC_OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return topicImage("congress/wealth");
}

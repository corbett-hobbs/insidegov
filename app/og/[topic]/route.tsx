import { topicImage } from "@/app/_og/topic-card";
import { TOPIC_PATHS, type TopicPath } from "@/lib/og-topics";
import { ogTopicSlug } from "@/lib/site";

/**
 * `/og/<section>-<page>` (e.g. `/og/presidency-trade`): every topic page's share
 * card, prerendered to a static PNG at build. Pages point at it through
 * `topicOg` / `topicTwitter` in `lib/site.ts`. One route rather than an
 * `opengraph-image.tsx` per page, which would be one serverless function each.
 */
export const dynamic = "force-static";
export const dynamicParams = false;

const BY_SLUG = new Map<string, TopicPath>(TOPIC_PATHS.map((p) => [ogTopicSlug(p), p]));

export function generateStaticParams() {
  return [...BY_SLUG.keys()].map((topic) => ({ topic }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ topic: string }> }) {
  const path = BY_SLUG.get((await params).topic);
  if (!path) return new Response("Not found", { status: 404 });
  return topicImage(path);
}

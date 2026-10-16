import "server-only";
import { buildTimelinePayload, loadTimelineInputs } from "./timeline-build";
import type { TimelinePayload } from "./timeline-types";

/**
 * Build-time reader for /timeline: validates every input with Zod (`loadTimelineInputs`) and joins the hand-picked events
 * to the pipeline (`buildTimelinePayload`). The payload is about 40 KB and goes to the page whole.
 */
let cache: TimelinePayload | null = null;

export function getTimelinePayload(): TimelinePayload {
  cache ??= buildTimelinePayload(loadTimelineInputs(), new Date().toISOString().slice(0, 10));
  return cache;
}

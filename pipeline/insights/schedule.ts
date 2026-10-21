import { addDays, daysBetween } from "./format";
import { FRESH_DAYS } from "./freshness";
import type { Frequency } from "./types";

/**
 * The posting cadence. Approved drafts wait in a queue (open issues labelled `social-approved`); a scheduled workflow
 * (social-post.yml) asks `pickNext` at each slot which one, if any, to post now. Pure, tested in schedule.test.ts.
 *
 * Rules, in order:
 *   1. The intro thread goes first, before anything else, on each platform.
 *   2. Stale drafts never post: past their freshness window (freshness.ts), or superseded by a newer approved draft
 *      for the same series. They are expired (labelled and closed) instead.
 *   3. At most one post per slot, MAX_PER_DAY a day, MAX_PER_WEEK in any 7 days, MIN_HOURS_BETWEEN apart. The
 *      afternoon slot only runs when the queue is backed up (BACKLOG_THRESHOLD or more waiting).
 *   4. A topic (dataset) posts at most MAX_PER_DATASET_WEEK times in 7 days, and one that posted in the last
 *      DATASET_COOLDOWN_HOURS waits unless nothing else is waiting at the morning slot, so a week mixes topics
 *      instead of three energy charts in a row.
 *   5. Among what is left: notability (the insight's score) × urgency (closer to going stale = sooner) × rotation
 *      (topics not posted for a while come first).
 */

export const SLOTS = [
  // 14:30 UTC = 10:30 ET in summer, 9:30 in winter: after the morning releases (EIA gas Monday, WPSR Wednesday).
  { name: "morning", cron: "30 14 * * 1-5", backlogOnly: false },
  { name: "afternoon", cron: "0 20 * * 1-5", backlogOnly: true },
] as const;
export type SlotName = (typeof SLOTS)[number]["name"];

export const MAX_PER_DAY = 2;
export const MAX_PER_WEEK = 8;
export const MIN_HOURS_BETWEEN = 4;
export const DATASET_COOLDOWN_HOURS = 36;
export const BACKLOG_THRESHOLD = 3;
/** No topic more than this many times in any 7 days, however much it has (energy has 13 series). */
export const MAX_PER_DATASET_WEEK = 2;

export type QueueItem = {
  /** Issue number (or any unique key). */
  key: string;
  id: string;
  kind: string;
  dataset: string;
  seriesId: string;
  period: string;
  score: number;
  frequency: Frequency;
  releasedOn: string;
  expiresOn: string;
};

export type Posted = { dataset: string; postedAt: string };

export type Decision = {
  post: QueueItem | null;
  /** Why nothing was picked, or why this one. */
  reason: string;
  expired: QueueItem[];
  superseded: QueueItem[];
};

const hoursBetween = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 3_600_000;

export function pickNext(queue: QueueItem[], history: Posted[], now: string, slot: SlotName): Decision {
  const today = now.slice(0, 10);
  const intro = queue.find((q) => q.kind === "intro");
  if (intro) return { post: intro, reason: "the intro thread goes first", expired: [], superseded: [] };

  const expired = queue.filter((q) => q.expiresOn < today);
  const live = queue.filter((q) => q.expiresOn >= today);
  const newest = new Map<string, string>();
  for (const q of live) if (q.period > (newest.get(q.seriesId) ?? "")) newest.set(q.seriesId, q.period);
  const superseded = live.filter((q) => q.period < newest.get(q.seriesId)!);
  const eligible = live.filter((q) => q.period === newest.get(q.seriesId) && q.releasedOn <= today);
  const none = (reason: string): Decision => ({ post: null, reason, expired, superseded });

  if (eligible.length === 0) return none("nothing fresh is approved");
  const sorted = [...history].sort((a, b) => b.postedAt.localeCompare(a.postedAt));
  if (sorted.filter((p) => p.postedAt.slice(0, 10) === today).length >= MAX_PER_DAY) return none(`already ${MAX_PER_DAY} posts today`);
  if (sorted.filter((p) => hoursBetween(p.postedAt, now) < 7 * 24).length >= MAX_PER_WEEK) return none(`already ${MAX_PER_WEEK} posts in 7 days`);
  if (sorted[0] && hoursBetween(sorted[0].postedAt, now) < MIN_HOURS_BETWEEN) return none(`last post under ${MIN_HOURS_BETWEEN} hours ago`);
  const backlogOnly = SLOTS.find((s) => s.name === slot)!.backlogOnly;
  if (backlogOnly && eligible.length < BACKLOG_THRESHOLD) return none(`the ${slot} slot runs only with ${BACKLOG_THRESHOLD}+ waiting (${eligible.length})`);

  const lastByDataset = new Map<string, string>();
  for (const p of sorted) if (!lastByDataset.has(p.dataset)) lastByDataset.set(p.dataset, p.postedAt);
  const weekCount = (dataset: string) => sorted.filter((p) => p.dataset === dataset && hoursBetween(p.postedAt, now) < 7 * 24).length;
  const capped = eligible.filter((q) => weekCount(q.dataset) < MAX_PER_DATASET_WEEK);
  if (capped.length === 0) return none(`every waiting topic already posted ${MAX_PER_DATASET_WEEK} times this week`);
  const cooled = capped.filter((q) => {
    const last = lastByDataset.get(q.dataset);
    return !last || hoursBetween(last, now) >= DATASET_COOLDOWN_HOURS;
  });
  const pool = cooled.length ? cooled : backlogOnly ? [] : capped;
  if (pool.length === 0) return none("every waiting topic posted recently");

  const priority = (q: QueueItem) => {
    const window = FRESH_DAYS[q.frequency];
    const urgency = Math.min(1, Math.max(0, 1 - daysBetween(today, q.expiresOn) / window));
    const last = lastByDataset.get(q.dataset);
    const rotation = 1 + Math.min(7, last ? hoursBetween(last, now) / 24 : 7) / 7;
    return q.score * (1 + urgency) * rotation;
  };
  const best = [...pool].sort((a, b) => priority(b) - priority(a) || a.expiresOn.localeCompare(b.expiresOn) || a.key.localeCompare(b.key))[0]!;
  return { post: best, reason: `highest priority of ${pool.length} waiting${cooled.length < eligible.length ? ` (${eligible.length - cooled.length} held for topic spacing)` : ""}`, expired, superseded };
}

const SLOT_TIMES: Record<SlotName, string> = { morning: "14:30", afternoon: "20:00" };

/**
 * Plays the schedule forward: every weekday slot from `start` for `days` days, with items joining the queue on their
 * release day. Returns what would post when, and what would expire unposted.
 */
export function simulate(items: QueueItem[], start: string, days: number): { posts: { at: string; slot: SlotName; item: QueueItem; reason: string }[]; expired: QueueItem[] } {
  let queue: QueueItem[] = [];
  const pending = [...items];
  const history: Posted[] = [];
  const posts: { at: string; slot: SlotName; item: QueueItem; reason: string }[] = [];
  const expired: QueueItem[] = [];
  for (let d = 0; d < days; d++) {
    const date = addDays(start, d);
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    for (let i = pending.length - 1; i >= 0; i--) if (pending[i]!.releasedOn <= date) queue.push(...pending.splice(i, 1));
    if (weekday === 0 || weekday === 6) continue;
    for (const slot of SLOTS) {
      const at = `${date}T${SLOT_TIMES[slot.name]}:00Z`;
      const dec = pickNext(queue, history, at, slot.name);
      const gone = new Set([...dec.expired, ...dec.superseded].map((q) => q.key));
      expired.push(...queue.filter((q) => gone.has(q.key)));
      queue = queue.filter((q) => !gone.has(q.key));
      if (!dec.post) continue;
      posts.push({ at, slot: slot.name, item: dec.post, reason: dec.reason });
      history.push({ dataset: dec.post.dataset, postedAt: at });
      queue = queue.filter((q) => q.key !== dec.post!.key);
    }
  }
  expired.push(...queue.filter((q) => q.expiresOn < addDays(start, days)));
  return { posts, expired };
}

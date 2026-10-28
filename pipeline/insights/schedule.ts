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
 *   3. At most one data post per slot a day (a slot is a window that several runs share), MAX_PER_DAY a day, MAX_PER_WEEK in any 7 days, MIN_HOURS_BETWEEN apart. The
 *      afternoon slot only runs when the queue is backed up (BACKLOG_THRESHOLD or more waiting), or on the day the
 *      intro posted, so the first chart follows it.
 *   4. A topic (dataset) posts at most MAX_PER_DATASET_WEEK times in 7 days, and one that posted in the last
 *      DATASET_COOLDOWN_HOURS waits unless nothing else is waiting at the morning slot, so a week mixes topics
 *      instead of three energy charts in a row.
 *   5. Among what is left: notability (the insight's score) × urgency (closer to going stale = sooner) × rotation
 *      (topics not posted for a while come first).
 *
 * News drafts (kind "news", pipeline/insights/news) do not wait for a slot: `pickNews` runs every few minutes and
 * whenever a news draft is approved. They have their own caps (NEWS_MAX_PER_DAY, NEWS_MIN_MINUTES_BETWEEN after any
 * post, MAX_TOTAL_PER_DAY with data posts) and expire within hours. They count against a day's data posts only through
 * the total, and push back a same-topic data post (rotation).
 *
 * News beats data when the two meet:
 *   - A data slot stands down while an approved, fresh news draft is waiting (and the news lane has room today): the
 *     news post goes out first and the data post follows in the same slot window, after NEWS_MIN_MINUTES_BETWEEN.
 *   - A data draft for a series a news post already charted (posted in the last NEWS_COVERS_DAYS days, on that data
 *     period or a later one) is expired as covered: the news post's chart shows the same newest figure. A newer period
 *     is new information and still posts.
 * Series that only post when the news is about them (weekly series, single electricity sources) have no data drafts at
 * all (types.ts Series.newsOnly).
 */

/**
 * Slots are in Pacific time, so they stay put across daylight saving. Each is a window, not a moment: GitHub starts
 * scheduled runs hours late or skips them under load, so the workflow fires every 15 minutes through the windows (and when
 * a draft is approved) and the first run that finds something to post uses the slot (at most one data post per slot a day).
 *   9:00 a.m. PT = noon ET: working hours on both coasts, after the morning releases (EIA gas, WPSR, Census).
 *   1:00 p.m. PT = 4:00 p.m. ET: the backlog slot, still inside East Coast working hours; open until 5 p.m. PT.
 */
export const TIME_ZONE = "America/Los_Angeles";
export const SLOTS = [
  { name: "morning", localHour: 9, untilHour: 13, backlogOnly: false },
  { name: "afternoon", localHour: 13, untilHour: 17, backlogOnly: true },
] as const;
export type SlotName = (typeof SLOTS)[number]["name"];

/** Wall-clock parts of an instant in a time zone. */
function localParts(iso: string, tz: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23" })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), minute: Number(parts.minute), weekday: parts.weekday as string };
}

/** The calendar date in the schedule's time zone (caps "per day" and freshness go by Pacific days). */
export function localDate(iso: string, tz = TIME_ZONE): string {
  return localParts(iso, tz).date;
}

/** The slot window an instant falls in (a weekday, from the slot's local hour until its `untilHour`), or null. */
export function slotAt(iso: string, tz = TIME_ZONE): SlotName | null {
  const p = localParts(iso, tz);
  if (p.weekday === "Sat" || p.weekday === "Sun") return null;
  return SLOTS.find((s) => p.hour >= s.localHour && p.hour < s.untilHour)?.name ?? null;
}

/** The UTC instant of `hour`:00 local time on `date` (daylight-saving aware). */
export function localTimeToUtc(date: string, hour: number, tz = TIME_ZONE): string {
  // Start from the hour as if UTC, then correct by the zone's offset at that moment (twice, in case it crosses a change).
  let t = Date.parse(`${date}T${String(hour).padStart(2, "0")}:00:00Z`);
  for (let i = 0; i < 2; i++) {
    const p = localParts(new Date(t).toISOString(), tz);
    const asUtc = Date.parse(`${p.date}T${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}:00Z`);
    t -= asUtc - Date.parse(`${date}T${String(hour).padStart(2, "0")}:00:00Z`);
  }
  return new Date(t).toISOString();
}

/** "Tue Oct 22, 9:00 a.m. PT / 12:00 p.m. ET". */
export function slotLabel(iso: string): string {
  const fmt = (tz: string, withDay: boolean) =>
    new Intl.DateTimeFormat("en-US", { timeZone: tz, ...(withDay ? { weekday: "short", month: "short", day: "numeric" } : {}), hour: "numeric", minute: "2-digit" }).format(new Date(iso));
  return `${fmt(TIME_ZONE, true)} PT / ${fmt("America/New_York", false)} ET`;
}

export const MAX_PER_DAY = 2;
export const MAX_PER_WEEK = 8;
export const MIN_HOURS_BETWEEN = 3;
export const DATASET_COOLDOWN_HOURS = 36;
export const BACKLOG_THRESHOLD = 3;
/** No topic more than this many times in any 7 days, however much it has (energy has 13 series). */
export const MAX_PER_DATASET_WEEK = 2;
/** News posts a (Pacific) day, on top of the data posts. */
export const NEWS_MAX_PER_DAY = 2;
/** A news post waits this long after any post, and a data slot this long after a news post. */
export const NEWS_MIN_MINUTES_BETWEEN = 45;
/** News and data posts together, per day. */
export const MAX_TOTAL_PER_DAY = 4;
/** A data draft is covered when a news post charted its series this recently, on its period or a later one. */
export const NEWS_COVERS_DAYS = 3;

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
  /** News drafts: the exact moment they go stale (ISO); `expiresOn` is its Pacific date. */
  expiresAt?: string;
};

/** `kind` tells news posts from data posts (absent on posts from before the news lane: data). */
export type Posted = { dataset: string; postedAt: string; kind?: string; seriesId?: string; period?: string };

export type Decision = {
  post: QueueItem | null;
  /** Why nothing was picked, or why this one. */
  reason: string;
  expired: QueueItem[];
  superseded: QueueItem[];
  /** The part of `superseded` that a news post covered (the rest were replaced by a newer draft of the series). */
  covered?: QueueItem[];
};

const hoursBetween = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 3_600_000;

export function pickNext(allQueue: QueueItem[], history: Posted[], now: string, slot: SlotName): Decision {
  const today = localDate(now);
  const intro = allQueue.find((q) => q.kind === "intro");
  if (intro) return { post: intro, reason: "the intro thread goes first", expired: [], superseded: [] };
  // News drafts have their own lane (pickNews).
  const queue = allQueue.filter((q) => q.kind !== "news");

  const expired = queue.filter((q) => q.expiresOn < today);
  const live = queue.filter((q) => q.expiresOn >= today);
  const newest = new Map<string, string>();
  for (const q of live) if (q.period > (newest.get(q.seriesId) ?? "")) newest.set(q.seriesId, q.period);
  const older = live.filter((q) => q.period < newest.get(q.seriesId)!);
  // A news post that charted this series on this period (or a later one) already showed what the data draft would.
  const covered = live.filter((q) => !older.includes(q) && history.some((p) => p.kind === "news" && p.seriesId === q.seriesId && p.period !== undefined && p.period >= q.period && hoursBetween(p.postedAt, now) < NEWS_COVERS_DAYS * 24));
  const superseded = [...older, ...covered];
  const eligible = live.filter((q) => !superseded.includes(q) && q.releasedOn <= today);
  const none = (reason: string): Decision => ({ post: null, reason, expired, superseded, covered });

  if (eligible.length === 0) return none("nothing fresh is approved");
  // News goes first: an approved, fresh news draft the news lane has room to post leaves this run to it.
  const waiting = allQueue.filter((q) => q.kind === "news" && !newsExpired(q, now));
  if (waiting.length && !newsLaneFull(history, now)) return none(`${waiting.length} approved news ${waiting.length === 1 ? "draft is" : "drafts are"} waiting; news posts first`);
  const sorted = [...history].sort((a, b) => b.postedAt.localeCompare(a.postedAt));
  const data = sorted.filter((p) => p.kind !== "news");
  if (data.some((p) => localDate(p.postedAt) === today && slotAt(p.postedAt) === slot)) return none(`the ${slot} slot already posted today`);
  if (data.filter((p) => localDate(p.postedAt) === today).length >= MAX_PER_DAY) return none(`already ${MAX_PER_DAY} posts today`);
  if (sorted.filter((p) => localDate(p.postedAt) === today).length >= MAX_TOTAL_PER_DAY) return none(`already ${MAX_TOTAL_PER_DAY} posts today with news`);
  if (data.filter((p) => hoursBetween(p.postedAt, now) < 7 * 24).length >= MAX_PER_WEEK) return none(`already ${MAX_PER_WEEK} posts in 7 days`);
  if (data[0] && hoursBetween(data[0].postedAt, now) < MIN_HOURS_BETWEEN) return none(`last post under ${MIN_HOURS_BETWEEN} hours ago`);
  if (sorted[0]?.kind === "news" && hoursBetween(sorted[0].postedAt, now) < NEWS_MIN_MINUTES_BETWEEN / 60) return none(`a news post went out under ${NEWS_MIN_MINUTES_BETWEEN} minutes ago`);
  const backlogOnly = SLOTS.find((s) => s.name === slot)!.backlogOnly;
  // The intro's day is the exception: a first chart follows it in the afternoon, so a new account is not an intro and silence.
  const introToday = sorted.some((p) => p.dataset === "intro" && localDate(p.postedAt) === today);
  if (backlogOnly && !introToday && eligible.length < BACKLOG_THRESHOLD) return none(`the ${slot} slot runs only with ${BACKLOG_THRESHOLD}+ waiting (${eligible.length})`);

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
  return { post: best, reason: `highest priority of ${pool.length} waiting${cooled.length < eligible.length ? ` (${eligible.length - cooled.length} held for topic spacing)` : ""}`, expired, superseded, covered };
}

/** Whether today's news posts (or all of today's posts) have reached their caps, so a waiting news draft cannot go out until tomorrow. */
function newsLaneFull(history: Posted[], now: string): boolean {
  const todays = history.filter((p) => localDate(p.postedAt) === localDate(now));
  return todays.filter((p) => p.kind === "news").length >= NEWS_MAX_PER_DAY || todays.length >= MAX_TOTAL_PER_DAY;
}

/** Whether a news item is past its moment (`expiresAt`, or the end of `expiresOn` for an item without one). */
function newsExpired(q: QueueItem, now: string): boolean {
  return q.expiresAt ? Date.parse(q.expiresAt) < Date.parse(now) : q.expiresOn < localDate(now);
}

/**
 * The news lane: run every few minutes and on approval. Posts the most notable approved news draft that is still
 * fresh, unless the intro has not gone out yet, NEWS_MAX_PER_DAY (or MAX_TOTAL_PER_DAY) is reached, or the last post
 * of any kind was under NEWS_MIN_MINUTES_BETWEEN ago (it then posts at the next run that is clear). No slots, no
 * weekday rule: a person approved it, and news does not keep office hours.
 */
export function pickNews(queue: QueueItem[], history: Posted[], now: string): Decision {
  const news = queue.filter((q) => q.kind === "news");
  const expired = news.filter((q) => newsExpired(q, now));
  const live = news.filter((q) => !newsExpired(q, now));
  const none = (reason: string): Decision => ({ post: null, reason, expired, superseded: [] });
  if (queue.some((q) => q.kind === "intro")) return none("the intro thread goes first (at the next data slot)");
  if (live.length === 0) return none("no fresh news draft is approved");
  const today = localDate(now);
  const sorted = [...history].sort((a, b) => b.postedAt.localeCompare(a.postedAt));
  const todays = sorted.filter((p) => localDate(p.postedAt) === today);
  if (todays.filter((p) => p.kind === "news").length >= NEWS_MAX_PER_DAY) return none(`already ${NEWS_MAX_PER_DAY} news posts today`);
  if (todays.length >= MAX_TOTAL_PER_DAY) return none(`already ${MAX_TOTAL_PER_DAY} posts today`);
  if (sorted[0] && hoursBetween(sorted[0].postedAt, now) < NEWS_MIN_MINUTES_BETWEEN / 60) return none(`last post under ${NEWS_MIN_MINUTES_BETWEEN} minutes ago; it waits for the next run`);
  const best = [...live].sort((a, b) => b.score - a.score || (a.expiresAt ?? "").localeCompare(b.expiresAt ?? "") || a.key.localeCompare(b.key))[0]!;
  return { post: best, reason: `news, ${live.length === 1 ? "the one fresh draft" : `most notable of ${live.length} fresh`}`, expired, superseded: [] };
}

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
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    for (let i = pending.length - 1; i >= 0; i--) if (pending[i]!.releasedOn <= date) queue.push(...pending.splice(i, 1));
    if (weekday === 0 || weekday === 6) continue;
    for (const slot of SLOTS) {
      const at = localTimeToUtc(date, slot.localHour);
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

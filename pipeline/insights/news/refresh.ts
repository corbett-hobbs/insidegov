import type { Headline } from "../types";
import type { PageTopic } from "./topics";

/**
 * Refresh the data when the agency publishes it, instead of waiting for the weekly schedule (pure, tested in
 * refresh.test.ts; watch.ts does the gh calls). A news post about a release (the jobs report, the trade deficit) is only
 * as good as the data behind its chart, and the data refresh runs weekly while the news breaks within minutes of the release.
 *
 * Two signals say a release is out, and the topic's data file was last changed BEFORE it:
 *   - an agency's own feed (the ones that put the "Data" line on a page card): a recent release item for the topic. The agency
 *     feeds do not carry every release (BEA's has not carried the trade report), so
 *   - the news itself: a story the watcher would chart (2+ outlets, checked) on a topic whose refresh is mapped below, whose
 *     first headline is newer than the data.
 * Then the data is behind:
 *   - the topic's freshness workflow is dispatched (it is idempotent: with nothing new it opens no PR, and with something
 *     new it merges its own PR after the full CI gate, so nothing needs approving), again each hour while the data is
 *     still behind (FRED lags BLS and BEA by hours), up to MAX_DISPATCHES per release;
 *   - a news story on that topic is held, not drafted, until the data catches up, so a post never shows the old figure beside a
 *     headline about the new one. An agency release holds it for good (the data is certainly old); a story alone holds it
 *     STORY_GRACE_HOURS, because a story is not always about a new release (a jobs story on a layoff), and the data may
 *     simply have nothing new. The story expires on its own 24 hours after it broke.
 */

/** A release item counts for this long after it is published. */
export const RELEASE_RECENT_HOURS = 36;
/** A workflow is dispatched at most this often (the watcher runs hourly). */
export const DISPATCH_MIN_MINUTES = 50;
/** Dispatches per release item: enough to cover a source that lags its agency by hours, not a day of no-op runs. */
export const MAX_DISPATCHES = 8;
/** A story with no agency release behind it waits this long for the data, then posts with what we have. */
export const STORY_GRACE_HOURS = 3;

export type RefreshRule = {
  /** The freshness workflow file in .github/workflows (it has `workflow_dispatch`). */
  workflow: string;
  /** The committed output file whose last change says whether the data is up to date. */
  file: string;
};

const INDICATORS: RefreshRule = { workflow: "indicators-freshness.yml", file: "pipeline/output/indicator_observations.json" };
const ENERGY: RefreshRule = { workflow: "energy-freshness.yml", file: "pipeline/output/energy_observations.json" };

/** Topics (news/topics.ts PAGE_TOPICS) whose agency release the data refresh picks up. */
export const REFRESH_FOR_TOPIC: Record<string, RefreshRule> = {
  jobs: INDICATORS,
  unemployment: INDICATORS,
  inflation: INDICATORS,
  wages: INDICATORS,
  gdp: INDICATORS,
  trade_deficit: { workflow: "trade-freshness.yml", file: "pipeline/output/trade_national.json" },
  border: { workflow: "encounters-freshness.yml", file: "pipeline/output/encounters_monthly.json" },
  oil_production: ENERGY,
  lng: ENERGY,
  electricity: ENERGY,
};

/** Topics with an agency feed that no refresh follows, each with why (refresh.test.ts checks every release topic is in one list). */
export const NO_REFRESH: Record<string, string> = {
  green_cards: "no social chart yet, and the green card data is refreshed yearly",
  tariff: "a Federal Register proclamation is not a data release; the collected rate moves months later",
  emissions_rules: "a Federal Register rule, not data",
};

/** What a dispatch was for: `release` is the item's URL, `since` the first dispatch for it, `at` the latest. */
export type DispatchRecord = { release: string; since: string; at: string; count: number };

/** What says the data is behind: an agency's release item, or the first headline of a news story. */
export type ReleaseItem = Pick<Headline, "title" | "source" | "url" | "published"> & { kind: "agency" | "story" };

export type RefreshPlan = {
  /** Topics whose data is behind a recent release, with the item: a news story on one waits. */
  behind: Map<string, { workflow: string; release: ReleaseItem }>;
  /** Workflows to dispatch now (once each, however many topics share one). */
  dispatch: { workflow: string; release: ReleaseItem }[];
};

/** A story the watcher would chart: its topic key (news/social.ts SocialStory.key) and its first headline. */
export type StoryItem = Pick<Headline, "title" | "source" | "url" | "published"> & { topicId: string };

const hours = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / 3_600_000;

/**
 * What the feeds say about the data. `updatedAt(file)` is when the file last changed on the default branch (null when
 * unknown: then nothing is held and nothing is dispatched, so an API hiccup can never block a post). `dispatched` is
 * what earlier runs did, by workflow.
 */
export function planRefreshes(opts: {
  topics: PageTopic[];
  releases: Headline[];
  stories?: StoryItem[];
  now: string;
  updatedAt: (file: string) => string | null;
  dispatched: Record<string, DispatchRecord>;
}): RefreshPlan {
  const behind: RefreshPlan["behind"] = new Map();
  const dispatch: RefreshPlan["dispatch"] = [];
  for (const topic of opts.topics) {
    const rule = REFRESH_FOR_TOPIC[topic.id];
    const r = topic.release;
    if (!rule || !r) continue;
    const recent = (h: { published: string }) => hours(h.published, opts.now) <= RELEASE_RECENT_HOURS && hours(h.published, opts.now) >= -1;
    const newest = <T extends { published: string }>(a: T[]) => a.sort((x, y) => y.published.localeCompare(x.published))[0];
    const agency = newest(opts.releases.filter((h) => h.outletId === r.source && r.match.test(h.title) && recent(h)));
    const story = newest((opts.stories ?? []).filter((s) => s.topicId === topic.id && recent(s)));
    const item: ReleaseItem | undefined = agency ? { ...agency, kind: "agency" } : story ? { title: story.title, source: story.source, url: story.url, published: story.published, kind: "story" } : undefined;
    if (!item) continue;
    const updated = opts.updatedAt(rule.file);
    if (updated === null || Date.parse(updated) >= Date.parse(item.published)) continue;
    const last = opts.dispatched[rule.workflow];
    const sameRelease = last?.release === item.url;
    // A story alone holds the post for a grace period from the first dispatch; an agency release, until the data moves.
    const waited = item.kind === "story" && sameRelease && hours(last!.since, opts.now) >= STORY_GRACE_HOURS;
    if (!waited) behind.set(topic.id, { workflow: rule.workflow, release: item });
    const tooSoon = last !== undefined && sameRelease && hours(last.at, opts.now) * 60 < DISPATCH_MIN_MINUTES;
    const spent = last !== undefined && sameRelease && last.count >= MAX_DISPATCHES;
    if (!tooSoon && !spent && !dispatch.some((d) => d.workflow === rule.workflow)) dispatch.push({ workflow: rule.workflow, release: item });
  }
  return { behind, dispatch };
}

/** The record after a dispatch: a new release starts the count over. */
export function recordDispatch(prev: DispatchRecord | undefined, release: Pick<ReleaseItem, "url">, now: string): DispatchRecord {
  const same = prev?.release === release.url;
  return { release: release.url, since: same ? prev.since : now, at: now, count: same ? prev.count + 1 : 1 };
}

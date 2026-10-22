import type { Headline } from "../types";
import type { NewsTopic } from "./topics";

/**
 * Headlines to stories, pure (tested in news.test.ts). A story is one topic (with its country, for tariffs) that is
 * in the news right now: matched titles from the last NEWS_LOOKBACK_HOURS, carried by at least NEWS_MIN_SOURCES
 * different publishers or by one official document. One outlet's scoop, an old story resurfacing in search, or a
 * single opinion piece is not enough.
 */

/** Only headlines published this recently count (the watcher runs every 15 minutes; this is the overlap). */
export const NEWS_LOOKBACK_HOURS = 6;
/** Different publishers a story needs, unless an official document carries it. */
export const NEWS_MIN_SOURCES = 2;
/** A news draft may post this long after the watcher first saw the story. */
export const NEWS_FRESH_HOURS = 24;
/** The same topic (and country) is drafted at most once in this many days, however long it stays in the news. */
export const NEWS_COOLDOWN_DAYS = 3;
/** At most this many news drafts per watcher run, one per topic. */
export const NEWS_MAX_PER_RUN = 2;

export type Partner = { code: string; name: string; pattern: RegExp };

export type Story = {
  topic: NewsTopic;
  /** "tariff.CAN", "tariff.all", "diesel". */
  key: string;
  country?: { code: string; name: string };
  /** Newest first. */
  headlines: Headline[];
  sources: string[];
  official: boolean;
  score: number;
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Trade partners and the words that name them in a headline (case-sensitive: proper nouns, so "china" the porcelain and "chad" stay out). */
export function partnersFor(countries: { code: string; name: string }[], aliases: Record<string, string[]>): Partner[] {
  return countries.map((c) => {
    const words = [c.name, ...(aliases[c.code] ?? [])].sort((a, b) => b.length - a.length);
    return { ...c, pattern: new RegExp(`(?<![A-Za-z])(?:${words.map(escape).join("|")})(?![A-Za-z])`) };
  });
}

/** The partners a title names, in the order of the list. */
export function countriesIn(title: string, partners: Partner[]): Partner[] {
  return partners.filter((p) => p.pattern.test(title));
}

/**
 * Stories in the headlines at `now`, most notable first: per topic (and country), the matching recent headlines, their
 * publishers, and a score (topic weight, more publishers, an official document). A tariff headline naming exactly one
 * big trade partner is that partner's story; naming none or several, it is the all-countries story, which ranks after
 * any partner's story (tariffs are nearly always in the news somewhere; a story about one partner is the specific one).
 */
export function findStories(headlines: Headline[], topics: NewsTopic[], partners: Partner[], now: string): Story[] {
  const t = Date.parse(now);
  const recent = headlines.filter((h) => {
    const age = (t - Date.parse(h.published)) / 3_600_000;
    return age <= NEWS_LOOKBACK_HOURS && age >= -1;
  });
  const byKey = new Map<string, Story>();
  for (const h of recent) {
    for (const topic of topics) {
      const re = h.feed === "whitehouse" ? (topic.officialMatch ?? topic.match) : topic.match;
      if (!re.test(h.title) || topic.exclude?.test(h.title)) continue;
      let key = topic.id;
      let country: Story["country"];
      if (topic.param === "country") {
        const named = countriesIn(h.title, partners);
        if (named.length === 1) country = { code: named[0]!.code, name: named[0]!.name };
        key = `${topic.id}.${country?.code ?? "all"}`;
      }
      const s = byKey.get(key) ?? byKey.set(key, { topic, key, country, headlines: [], sources: [], official: false, score: 0 }).get(key)!;
      s.headlines.push(h);
      if (!s.sources.includes(h.source)) s.sources.push(h.source);
      s.official ||= h.feed === "whitehouse";
    }
  }
  const stories = [...byKey.values()].filter((s) => s.official || s.sources.length >= NEWS_MIN_SOURCES);
  for (const s of stories) {
    s.headlines.sort((a, b) => b.published.localeCompare(a.published));
    s.score = s.topic.weight * (1 + Math.log2(s.sources.length)) * (s.official ? 1.5 : 1);
  }
  for (const s of stories) {
    if (!s.topic.param || s.country) continue;
    const best = Math.max(0, ...stories.filter((o) => o.topic === s.topic && o.country).map((o) => o.score));
    if (best) s.score = Math.min(s.score, best * 0.99);
  }
  return stories.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
}

/** The draft id of a news story drafted on `day` (YYYY-MM-DD): the dedupe key in issue titles. */
export function newsId(key: string, day: string): string {
  return `news:${key}:${day}`;
}

export function parseNewsId(id: string): { key: string; day: string } | null {
  const m = id.match(/^news:([^:]+):(\d{4}-\d{2}-\d{2})$/);
  return m ? { key: m[1]!, day: m[2]! } : null;
}

/** Whether `key` was already drafted within NEWS_COOLDOWN_DAYS before `today` (from earlier draft ids, open or closed). */
export function inCooldown(key: string, earlierIds: string[], today: string): boolean {
  const cutoff = new Date(Date.parse(`${today}T00:00:00Z`) - NEWS_COOLDOWN_DAYS * 86_400_000).toISOString().slice(0, 10);
  return earlierIds.some((id) => {
    const p = parseNewsId(id);
    return p !== null && p.key === key && p.day > cutoff;
  });
}

/** A story the relevance check turned down is not asked about again for this long, unless it becomes official. */
export const NEWS_RECHECK_HOURS = 6;

/** What the watcher remembers between runs (kept on the social-drafts branch): stories the check turned down. */
export type WatchState = { rejected: Record<string, { at: string; official: boolean; reason: string }> };

export function recentlyRejected(story: Pick<Story, "key" | "official">, state: WatchState, now: string): boolean {
  const r = state.rejected[story.key];
  if (!r || (story.official && !r.official)) return false;
  return (Date.parse(now) - Date.parse(r.at)) / 3_600_000 < NEWS_RECHECK_HOURS;
}

/** The state without entries old enough to be checked again anyway. */
export function pruneState(state: WatchState, now: string): WatchState {
  return { rejected: Object.fromEntries(Object.entries(state.rejected).filter(([, r]) => (Date.parse(now) - Date.parse(r.at)) / 3_600_000 < NEWS_RECHECK_HOURS)) };
}

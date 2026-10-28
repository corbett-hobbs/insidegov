import type { DispatchRecord } from "./refresh";

/**
 * Helpers the news watcher shares with the page cards, pure (tested in news.test.ts): trade partners named in a title,
 * the dedupe ids of drafted stories, the cooldown, and what the watcher remembers between runs. Stories themselves are
 * found by the page cards' logic (cards.ts) and turned into drafts by social.ts.
 */

/** A news draft may post this long after the watcher first saw the story. */
export const NEWS_FRESH_HOURS = 24;
/** The same topic (and country) is drafted at most once in this many days, however long it stays in the news. */
export const NEWS_COOLDOWN_DAYS = 3;
/** At most this many news drafts per watcher run, one per chart. */
export const NEWS_MAX_PER_RUN = 2;

export type Partner = { code: string; name: string; pattern: RegExp };

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

/** The Claude check's answer for one candidate story, kept so an unchanged story is not asked about every hour. */
export type StoredCheck = { at: string; keep: string[]; reason: string; chart: string };

/** What the watcher remembers between runs (kept on the social-drafts branch): the check's answers, by the story's set of URLs. */
export type WatchState = { checks: Record<string, StoredCheck>; /** The refresh workflows the watcher dispatched, by workflow file (refresh.ts). */ dispatched: Record<string, DispatchRecord> };

/** An answer is kept this long (the feeds carry a day or two, so a story is not asked about again after that). */
export const CHECK_KEEP_HOURS = 48;

/** The state without answers old enough to be dropped. */
export function pruneState(state: WatchState, now: string): WatchState {
  const fresh = (at: string) => (Date.parse(now) - Date.parse(at)) / 3_600_000 < CHECK_KEEP_HOURS;
  return {
    checks: Object.fromEntries(Object.entries(state.checks).filter(([, c]) => fresh(c.at))),
    dispatched: Object.fromEntries(Object.entries(state.dispatched).filter(([, d]) => fresh(d.at))),
  };
}

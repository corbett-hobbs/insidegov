import { existsSync, readFileSync } from "node:fs";
import type { Headline } from "../types";
import { OUTLETS, sideOf } from "./outlets";
import type { PageTopic } from "./topics";

/**
 * How much the news covered each law, kept so a monthly laws post can list the month's laws with the most-covered first.
 * The outlets' feeds carry only a day or two of headlines, so the score cannot be worked out when the post is drafted:
 * the news watcher (watch.ts) adds to it on every run, and the draft reads it back (readLawNews).
 *
 * A law's headline match is the one the Laws page's "In the news" row uses (subjects.ts lawTopics: the short title, or for
 * a law under 90 days old its long first word). No model is involved, so the score costs nothing to keep. Only roster
 * outlets count, and not those whose headlines need the Claude check to tell news from commentary (HuffPost). Nothing
 * here is shown or quoted: the score only orders rows whose words come from the site's own data.
 */

export type LawNews = {
  /** Keys (news/outlets.ts) of the roster outlets that headlined the law. */
  outlets: string[];
  /** First and last day a headline matched (YYYY-MM-DD). */
  first: string;
  last: string;
};

/** An entry is dropped this many days after its last headline: a month's post is drafted within weeks of its end. */
export const LAW_NEWS_KEEP_DAYS = 75;

const DAY = 86_400_000;
const LAW_PREFIX = "law.";
/** The roster outlets whose headlines can be counted as news without the Claude check, by key, with their side. */
const sideById = new Map(OUTLETS.filter((o) => !o.needsCheck && !o.reserve).map((o) => [o.id, sideOf(o.lean)]));

/** The state with today's headlines added: each roster outlet that headlined a law, kept once. */
export function recordLawNews(prev: Record<string, LawNews>, topics: readonly PageTopic[], headlines: readonly Headline[], now: string): Record<string, LawNews> {
  const day = now.slice(0, 10);
  const next = { ...prev };
  const usable = headlines.filter((h) => h.outletId && sideById.has(h.outletId));
  for (const t of topics) {
    if (!t.id.startsWith(LAW_PREFIX)) continue;
    const lawId = t.id.slice(LAW_PREFIX.length);
    const hits = usable.filter((h) => t.match.test(h.title)).map((h) => h.outletId!);
    if (!hits.length) continue;
    const old = next[lawId];
    next[lawId] = { outlets: [...new Set([...(old?.outlets ?? []), ...hits])].sort(), first: old?.first ?? day, last: day };
  }
  return next;
}

/** Entries whose last headline is within LAW_NEWS_KEEP_DAYS of `now`. */
export function pruneLawNews(laws: Record<string, LawNews> | undefined, now: string): Record<string, LawNews> {
  return Object.fromEntries(Object.entries(laws ?? {}).filter(([, n]) => Date.parse(now) - Date.parse(`${n.last}T12:00:00Z`) <= LAW_NEWS_KEEP_DAYS * DAY));
}

/**
 * How widely the news covered a law: the sides it ran on (left, center, right) count first, then the outlets. A law three
 * outlets on one side headlined ranks below one that outlets on two sides headlined. Zero when no roster outlet did.
 */
export function newsScore(n: LawNews | undefined): number {
  if (!n) return 0;
  const sides = new Set(n.outlets.map((id) => sideById.get(id)).filter(Boolean));
  return sides.size * 100 + n.outlets.length;
}

/** The scores by law id (`119-pub-133`) from the watcher's state file; empty when it is not there (a backfill, a local run). */
export function readLawNews(file = process.env.LAW_NEWS_STATE): Record<string, LawNews> {
  if (!file || !existsSync(file)) return {};
  try {
    return ((JSON.parse(readFileSync(file, "utf8") || "{}") as { laws?: Record<string, LawNews> }).laws) ?? {};
  } catch {
    return {};
  }
}

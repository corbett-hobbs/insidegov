import { readFileSync } from "node:fs";
import type { ListedOrder } from "./eo-list";
import { type LawNews, newsScore, readLawNews } from "./news/law-news";

/**
 * The public laws listed on a monthly laws post's slide and thread card ("Laws signed in October"), the same list as
 * the executive orders' (eo-list.ts) with a different order: the laws the news covered most come first (law-news.ts:
 * the sides and outlets whose headlines named the law), then the newest, so with no coverage on record it is newest
 * first. Each row is the committed file's own (the title the Laws page shows, signing date, the CRS policy area and the
 * first sentence of the Congressional Research Service summary); nothing here is computed but the order.
 */

const LAWS = "pipeline/output/laws.json";
const META = "pipeline/output/laws_meta.json";

type Row = { law_id: string; number: number; date: string; title: string; area_id: string; summary?: string };

let cache: ListedOrder[] | undefined;

/** `s` cut at a word, with an ellipsis, when longer than `max`. */
const trimTo = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max).replace(/\s+\S*$/, "").replace(/[\s,;:(]+$/, "")}…`);

/** Laws are many and mostly small, so a summary is kept to a line or so: more of the month's laws fit the slide. */
const SUMMARY_MAX = 120;

/** Every law in the file with its id (`119-pub-133`) in `id`, newest signing first (ties: the higher number first); the news score is added per post. */
export function readLaws(): ListedOrder[] {
  if (cache) return cache;
  const areas = new Map((JSON.parse(readFileSync(META, "utf8")) as { areas: { id: string; name: string }[] }).areas.map((a) => [a.id, a.name]));
  const rows = JSON.parse(readFileSync(LAWS, "utf8")) as Row[];
  cache = rows
    .map((r) => ({ id: r.law_id, number: r.number, title: trimTo(r.title.trim(), 150), date: r.date, topic: areas.get(r.area_id) ?? "", summary: r.summary?.trim() ? trimTo(r.summary.trim(), SUMMARY_MAX) : null }))
    .sort((a, b) => b.date.localeCompare(a.date) || b.number - a.number);
  return cache;
}

/** The laws signed in the month `date` falls in, the most-covered first, then newest; at most `limit`. Each carries its score. */
export function lawsInMonth(all: readonly ListedOrder[], news: Record<string, LawNews>, date: string, limit: number): ListedOrder[] {
  const month = date.slice(0, 7);
  return all
    .filter((l) => l.date.startsWith(month))
    .map((l) => ({ ...l, score: newsScore(news[l.id!]) }))
    .sort((a, b) => b.score - a.score || b.date.localeCompare(a.date) || b.number - a.number)
    .slice(0, limit);
}

/** The laws a monthly laws insight lists, ranked by the watcher's stored scores (none on file: newest first). */
export function monthLaws(period: string, limit = 200): ListedOrder[] {
  return lawsInMonth(readLaws(), readLawNews(), period, limit);
}

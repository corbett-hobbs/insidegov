import type { Headline } from "../types";
import type { NewsTopic } from "./topics";

/**
 * Where headlines come from. Two kinds of feed, both plain RSS, no keys:
 *
 *   - `whitehouse`: the White House's presidential actions feed (executive orders, proclamations such as tariff
 *     changes). Official and public domain, so one item is enough to act on.
 *   - `google`: a Google News search per topic query, restricted to the last day. Wire and newspaper coverage; a story
 *     needs at least two different publishers (match.ts). Google's feed terms limit it to personal, non-commercial use:
 *     set SOCIAL_NEWS_SOURCES=whitehouse to listen to the official feed only.
 *
 * GDELT's free API was tried first and dropped: it rate-limits shared addresses (GitHub's runners) for minutes at a time.
 */

export type FeedId = "whitehouse" | "google";
export const FEEDS: FeedId[] = ["whitehouse", "google"];

export const WHITE_HOUSE_ACTIONS = "https://www.whitehouse.gov/presidential-actions/feed/";

export function googleNewsUrl(query: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(`${query} when:1d`)}&hl=en-US&gl=US&ceid=US:en`;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
    .trim();
}

function tag(item: string, name: string): string | undefined {
  const m = item.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decodeEntities(m[1]!) : undefined;
}

/**
 * Items of an RSS document. Google News titles end in " - Publisher" (also in `<source>`), which is cut from the title.
 * Items without a parsable date are dropped (recency is the whole point).
 */
export function parseRss(xml: string, feed: FeedId, defaultSource: string): Headline[] {
  const out: Headline[] = [];
  for (const m of xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)) {
    const item = m[0];
    let title = tag(item, "title");
    const url = tag(item, "link");
    const date = Date.parse(tag(item, "pubDate") ?? "");
    if (!title || !url || Number.isNaN(date)) continue;
    const source = tag(item, "source") ?? defaultSource;
    if (title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3)).trim();
    out.push({ title, source, url, published: new Date(date).toISOString(), feed });
  }
  return out;
}

async function getText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "user-agent": "InsideGov news watcher (+https://insidegov.fyi)", accept: "application/rss+xml, application/xml" }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
}

/** Every headline the enabled feeds carry now. A feed that fails is reported and skipped; the rest still count. */
export async function fetchHeadlines(topics: NewsTopic[], feeds: FeedId[], log: (msg: string) => void = console.log): Promise<Headline[]> {
  const jobs: { feed: FeedId; url: string; source: string }[] = [];
  if (feeds.includes("whitehouse")) jobs.push({ feed: "whitehouse", url: WHITE_HOUSE_ACTIONS, source: "The White House" });
  if (feeds.includes("google")) for (const q of new Set(topics.flatMap((t) => t.queries))) jobs.push({ feed: "google", url: googleNewsUrl(q), source: "Google News" });
  const all: Headline[] = [];
  for (const job of jobs) {
    try {
      const items = parseRss(await getText(job.url), job.feed, job.source);
      all.push(...items);
    } catch (err) {
      log(`  feed failed: ${(err as Error).message}`);
    }
  }
  // The same article turns up under several queries.
  const seen = new Set<string>();
  return all.filter((h) => {
    const k = `${h.source}|${h.title}`;
    return seen.has(k) ? false : (seen.add(k), true);
  });
}

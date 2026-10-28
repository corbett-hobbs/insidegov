import type { Headline } from "../types";
import { DATA_SOURCES, type DataSource, OUTLETS, type Outlet, isOpinion } from "./outlets";

/**
 * Where headlines come from. Two kinds of feed, all plain RSS, no keys:
 *
 *   - `outlets`: the news outlets' own feeds (outlets.ts), news sections only, opinion filtered out. Each headline
 *     carries its outlet's id; a story needs at least two different outlets (match.ts).
 *   - `data`: the agencies' own release feeds (BLS, BEA, EIA, CBP, USCIS, the Federal Register), for the "Data" line on
 *     a page card (pages.ts).
 *
 * Every request names the watcher honestly (USER_AGENT). Google News searches were used before the outlets' own feeds
 * (dropped: its feed terms limit it to personal, non-commercial use); GDELT's free API before that (dropped: it
 * rate-limits GitHub's shared runners).
 */

export const USER_AGENT = "InsideGov news watcher (+https://insidegov.fyi)";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

function tag(item: string, name: string): string | undefined {
  const m = item.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decodeEntities(m[1]!) : undefined;
}

/**
 * Items of an RSS document. Titles ending in " - Publisher" (aggregators repeat it in `<source>`) lose that suffix, and
 * markup inside a title is dropped. Items without a parsable date, or a link that is not http(s), are dropped (recency
 * is the whole point, and the card links to the article).
 */
export function parseRss(xml: string, feed: string, defaultSource: string, outletId?: string): Headline[] {
  const out: Headline[] = [];
  // RSS items, or Atom entries (BLS), whose link is an attribute.
  for (const m of xml.matchAll(/<item\b[\s\S]*?<\/item>|<entry\b[\s\S]*?<\/entry>/gi)) {
    const item = m[0];
    let title = tag(item, "title")?.replace(/<[^>]+>/g, "").trim();
    const atomLink = item.match(/<link\b(?=[^>]*\brel="alternate")?[^>]*\bhref="([^"]+)"/i)?.[1];
    const url = tag(item, "link") || (atomLink && decodeEntities(atomLink)) || tag(item, "guid");
    const date = Date.parse(tag(item, "pubDate") ?? tag(item, "dc:date") ?? tag(item, "published") ?? tag(item, "updated") ?? "");
    if (!title || !url || !/^https?:\/\//.test(url) || Number.isNaN(date)) continue;
    // An outlet's headline is the outlet's (AP's Flipboard feed names its section, "Top Stories", in <source>).
    const source = (outletId ? undefined : tag(item, "source")) ?? defaultSource;
    if (title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3)).trim();
    out.push({ title, source, url, published: new Date(date).toISOString(), feed, ...(outletId ? { outletId } : {}) });
  }
  return out;
}

async function getText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "user-agent": USER_AGENT, accept: "application/rss+xml, application/xml, text/xml" }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
}

type Job = { url: string; feed: string; source: string; outletId?: string; keep?: (h: Headline) => boolean };

/** Runs the jobs a few at a time; a feed that fails is reported and skipped, the rest still count. Same URL once. */
async function run(jobs: Job[], log: (msg: string) => void): Promise<Headline[]> {
  const all: Headline[] = [];
  const queue = [...jobs];
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      try {
        const items = parseRss(await getText(job.url), job.feed, job.source, job.outletId);
        all.push(...(job.keep ? items.filter(job.keep) : items));
      } catch (err) {
        log(`  feed failed: ${(err as Error).message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  // One article sits in several of an outlet's feeds (NYT Politics and U.S.).
  const seen = new Set<string>();
  return all.filter((h) => (seen.has(h.url) ? false : (seen.add(h.url), true)));
}

export type FetchOptions = { outlets?: Outlet[]; includeReserves?: boolean; log?: (msg: string) => void };

/** The outlets' news headlines now, opinion already filtered out by URL and title (outlets.ts isOpinion). */
export function fetchOutletHeadlines({ outlets = OUTLETS, includeReserves = true, log = console.log }: FetchOptions = {}): Promise<Headline[]> {
  const jobs = outlets
    .filter((o) => includeReserves || !o.reserve)
    .flatMap((o) => o.feeds.map((url): Job => ({ url, feed: "outlets", source: o.name, outletId: o.id, keep: (h) => !isOpinion(h, o) })));
  return run(jobs, log);
}

/** The agencies' recent data releases, as headlines with the agency's id as `outletId`. */
export function fetchDataReleases(sources: DataSource[] = DATA_SOURCES, log: (msg: string) => void = console.log): Promise<Headline[]> {
  const jobs = sources.flatMap((d) => d.feeds.map((url): Job => ({ url, feed: "data", source: d.name, outletId: d.id, keep: d.match ? (h) => d.match!.test(h.title) : undefined })));
  return run(jobs, log);
}

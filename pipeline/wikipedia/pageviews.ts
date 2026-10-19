/**
 * Generic Wikimedia Pageviews client: how often an English Wikipedia article is
 * read, as a trailing-window daily median. Takes plain article titles, so the
 * member, justice and president fetchers can all share it.
 *
 * Uses the REST per-article daily endpoint with `agent=user` (people, not
 * crawlers or automated traffic) and `all-access` (desktop + mobile web + app).
 * Wikimedia counts a view under the title the reader asked for, so a visit
 * through a redirect ("AOC", an old title after a page move) is not counted on
 * the article: each article's redirects are looked up and their daily views
 * added in. The API leaves out days with no views, so the window is filled
 * with zeros before taking the median. A median, not a mean, so one day's spike (a news
 * story, a viral clip) doesn't decide the ranking.
 */
import { getJson, pool } from "./client";

const ACTION_API = "https://en.wikipedia.org/w/api.php";
const API = "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user";
export const PAGEVIEWS_SOURCE = "https://wikimedia.org/api/rest_v1/metrics/pageviews";

/** Days the median covers. */
export const WINDOW_DAYS = 90;
/** Wikimedia publishes a day's counts some hours after it ends; ending the window two days back keeps the last day complete. */
export const LAG_DAYS = 2;
/** The Pageviews API allows far more than the summary endpoint; most redirect requests are tiny 404s. */
const PAGEVIEW_CONCURRENCY = 10;

export interface PageviewWindow {
  /** ISO dates, inclusive. */
  start: string;
  end: string;
  days: number;
}

export interface PageviewStats {
  /** The article title asked for. */
  title: string;
  /** Median daily views over the window (days with no views count as 0). */
  median: number;
  /** Sum of daily views over the window. */
  total: number;
  /** How many redirect titles were counted in. */
  redirects: number;
}

const DAY_MS = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/** The `days`-long window ending `lag` days before `today` (an ISO date, UTC). */
export function pageviewWindow(today: string, days = WINDOW_DAYS, lag = LAG_DAYS): PageviewWindow {
  const endMs = Date.parse(`${today}T00:00:00Z`) - lag * DAY_MS;
  return { start: iso(endMs - (days - 1) * DAY_MS), end: iso(endMs), days };
}

/** `2026-10-17` → `20261017`, the API's date form. */
const compact = (d: string) => d.replaceAll("-", "");

export function pageviewsUrl(title: string, w: PageviewWindow): string {
  const article = encodeURIComponent(title.replace(/ /g, "_"));
  return `${API}/${article}/daily/${compact(w.start)}/${compact(w.end)}`;
}

/**
 * One count per day of the window, in order, from the API's `items`. Days the
 * API left out are 0; items outside the window are ignored.
 */
export function dailyViews(items: readonly { timestamp: string; views: number }[], w: PageviewWindow): number[] {
  const out = new Array<number>(w.days).fill(0);
  const startMs = Date.parse(`${w.start}T00:00:00Z`);
  for (const it of items) {
    const t = it.timestamp; // YYYYMMDDHH
    const ms = Date.parse(`${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}T00:00:00Z`);
    const i = Math.round((ms - startMs) / DAY_MS);
    if (i >= 0 && i < w.days) out[i] += it.views;
  }
  return out;
}

/** Median of a non-empty list (mean of the middle two for an even count), rounded to a whole view. */
export function median(values: readonly number[]): number {
  if (values.length === 0) throw new Error("median of an empty list");
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return Math.round(s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2);
}

export function summarize(title: string, daily: readonly number[], redirects = 0): PageviewStats {
  return { title, median: median(daily), total: daily.reduce((a, b) => a + b, 0), redirects };
}

/** Day-by-day sum of several equal-length series. */
export function sumDaily(series: readonly (readonly number[])[], days: number): number[] {
  const out = new Array<number>(days).fill(0);
  for (const s of series) for (let i = 0; i < days; i++) out[i] += s[i] ?? 0;
  return out;
}

interface RedirectsResponse {
  query?: {
    normalized?: { from: string; to: string }[];
    pages?: { title: string; redirects?: { title: string }[] }[];
  };
  continue?: Record<string, string>;
}

/**
 * The main-namespace redirects pointing at each title, from the MediaWiki
 * action API (50 titles a request, following `continue`). Keyed by the title
 * as given.
 */
export async function fetchRedirects(titles: readonly string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>(titles.map((t) => [t, []]));
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    let cont: Record<string, string> = {};
    for (;;) {
      const params = new URLSearchParams({
        action: "query",
        format: "json",
        formatversion: "2",
        prop: "redirects",
        rdnamespace: "0",
        rdlimit: "max",
        titles: batch.join("|"),
        ...cont,
      });
      const res = await getJson(`${ACTION_API}?${params}`);
      if (res.kind === "skip") throw new Error(`redirects lookup: ${res.reason}`);
      const body = res.body as RedirectsResponse;
      // The API answers with normalized titles; map them back to the ones asked for.
      const asked = new Map(batch.map((t) => [t, t]));
      for (const n of body.query?.normalized ?? []) if (asked.has(n.from)) asked.set(n.to, n.from);
      for (const page of body.query?.pages ?? []) {
        const key = asked.get(page.title) ?? page.title;
        const list = out.get(key);
        if (list) for (const r of page.redirects ?? []) list.push(r.title);
      }
      if (!body.continue) break;
      cont = body.continue;
    }
  }
  return out;
}

/**
 * Fetch the window's stats for every title, its redirects' views added in. A
 * title whose article has no views in the window (404, or no such article) is
 * returned in `missing`, not thrown; a request that still fails after the
 * client's retries is in `failures`, so callers can refuse to overwrite their
 * committed output on a flaky run.
 */
export async function fetchPageviews(
  titles: readonly string[],
  w: PageviewWindow,
  onProgress?: (done: number, total: number) => void,
): Promise<{ stats: Map<string, PageviewStats>; missing: string[]; failures: string[] }> {
  const unique = [...new Set(titles)];
  const redirects = await fetchRedirects(unique);

  // One request per (article, title) pair; a redirect 404 just means no views.
  const jobs = unique.flatMap((article) =>
    [article, ...redirects.get(article)!].map((title) => ({ article, title, isArticle: title === article })),
  );
  const series = new Map<string, number[][]>(unique.map((t) => [t, []]));
  const missing: string[] = [];
  const failures: string[] = [];
  let done = 0;
  await pool(jobs, PAGEVIEW_CONCURRENCY, async ({ article, title, isArticle }) => {
    try {
      const out = await getJson(pageviewsUrl(title, w));
      if (out.kind === "skip") {
        if (isArticle) missing.push(article);
        return;
      }
      const items = (out.body as { items?: unknown }).items;
      if (!Array.isArray(items)) throw new Error("response has no items array");
      series.get(article)!.push(dailyViews(items as { timestamp: string; views: number }[], w));
    } catch (err) {
      failures.push(`${title}${isArticle ? "" : ` (redirect to ${article})`}: ${err instanceof Error ? err.message : err}`);
    } finally {
      done += 1;
      onProgress?.(done, jobs.length);
    }
  });

  const stats = new Map<string, PageviewStats>();
  for (const article of unique) {
    if (missing.includes(article)) continue;
    stats.set(article, summarize(article, sumDaily(series.get(article)!, w.days), redirects.get(article)!.length));
  }
  return { stats, missing, failures };
}

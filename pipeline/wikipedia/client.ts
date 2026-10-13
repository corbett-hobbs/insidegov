/**
 * Shared Wikipedia REST `page/summary` client for the build-time bio fetchers
 * (`fetch/wikipedia.ts` members, `fetch/wikipedia-committees.ts` committees).
 */
/** Wikimedia asks for a descriptive UA with a way to reach the operator. */
export const USER_AGENT =
  "congress-ideology/0.1 (https://github.com/corbett-hobbs/congress-ideology)";
const API = "https://en.wikipedia.org/api/rest_v1/page/summary";
export const CONCURRENCY = 5;
const MAX_ATTEMPTS = 6;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type Outcome =
  | { kind: "ok"; body: unknown }
  | { kind: "skip"; reason: string };

/** GET one summary, retrying 429/5xx/network errors with backoff. */
export async function getSummary(title: string): Promise<Outcome> {
  return getJson(`${API}/${encodeURIComponent(title.replace(/ /g, "_"))}`);
}

/** GET a Wikipedia JSON endpoint, retrying 429/5xx/network errors with backoff. */
export async function getJson(url: string): Promise<Outcome> {
  let lastError = "";
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let wait = 1000 * 2 ** attempt;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      });
      if (res.ok) return { kind: "ok", body: await res.json() };
      if (res.status === 404) return { kind: "skip", reason: "404 not found" };
      lastError = `${res.status} ${res.statusText}`;
      if (res.status !== 429 && res.status < 500) {
        throw new Error(`GET ${url} -> ${lastError}`); // 4xx: not retryable
      }
      const retryAfter = Number(res.headers.get("retry-after"));
      if (Number.isFinite(retryAfter) && retryAfter > 0) {
        wait = Math.max(wait, retryAfter * 1000);
      }
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("GET ")) throw err;
      lastError = err instanceof Error ? err.message : String(err);
    }
    await sleep(wait);
  }
  throw new Error(`GET ${url} -> gave up after ${MAX_ATTEMPTS} attempts (${lastError})`);
}

export async function pool<T>(items: T[], n: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(n, queue.length) }, async () => {
      let item: T | undefined;
      while ((item = queue.shift()) !== undefined) await fn(item);
    }),
  );
}


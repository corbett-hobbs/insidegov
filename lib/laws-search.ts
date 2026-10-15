/**
 * Full-text search over the CRS summaries for the Laws page. The summaries are ~51 MB of text, far too much to ship, so the
 * browser gets a word index instead: every distinct word (stop words dropped) with the laws that use it. A search word matches
 * a law when it is the start of one of that law's words ("vetera" finds "veterans"). Pure and tested; the build-time reader is
 * `lib/laws-data.ts` and the page's fetch is `components/laws/useLawsSearchIndex.ts`.
 */

/** A law's key in the index: Congress and law number packed (no Congress has 10,000 laws). */
export const lawKey = (congress: number, number: number): number => congress * 10000 + number;

export interface LawsSearchIndex {
  /** Every indexed word, sorted. */
  words: string[];
  /** Per word (same order): the keys of the laws using it, ascending, each stored as the gap from the one before. */
  postings: number[][];
}

const STOP = new Set(
  "a an and any are as at be been but by can for from has have in into is it its may not of on or other such that the their this to under was which who will with within shall than these those they there were also each".split(" "),
);

/** Lower-case alphanumeric runs: "Pub. L. 111-148" is `pub`, `l`, `111`, `148`. */
export const tokenize = (text: string): string[] => text.toLowerCase().match(/[a-z0-9]+/g) ?? [];

/** Builds the index from `[law key, summary text]` pairs, in any order. */
export function buildSearchIndex(docs: Iterable<readonly [number, string]>): LawsSearchIndex {
  const seen = new Map<string, number[]>();
  for (const [key, text] of docs) {
    for (const w of new Set(tokenize(text))) {
      if (w.length < 2 || STOP.has(w)) continue;
      const list = seen.get(w);
      if (list) list.push(key);
      else seen.set(w, [key]);
    }
  }
  const words = [...seen.keys()].sort();
  const postings = words.map((w) => {
    const keys = seen.get(w)!.sort((a, b) => a - b);
    return keys.map((k, i) => (i === 0 ? k : k - keys[i - 1]!));
  });
  return { words, postings };
}

/** First index in `words` that is not below `prefix`. */
function lowerBound(words: readonly string[], prefix: string): number {
  let lo = 0;
  let hi = words.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (words[mid]! < prefix) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Returns a lookup from a search word to the set of law keys whose summary has a word starting with it. A search word that
 * splits into several words ("h.r.", "111-148") needs all of them. Results are remembered, so typing "vet" then "vete"
 * does the work once per word.
 */
export function makeSummarySearch(index: LawsSearchIndex): (term: string) => ReadonlySet<number> {
  const cache = new Map<string, Set<number>>();
  const prefixHits = (prefix: string): Set<number> => {
    const hit = new Set<number>();
    for (let i = lowerBound(index.words, prefix); i < index.words.length && index.words[i]!.startsWith(prefix); i++) {
      let key = 0;
      for (const gap of index.postings[i]!) hit.add((key += gap));
    }
    return hit;
  };
  return (term) => {
    const cached = cache.get(term);
    if (cached) return cached;
    const parts = tokenize(term).filter((t) => t.length >= 2 && !STOP.has(t));
    let out = new Set<number>();
    parts.forEach((p, i) => {
      const hit = prefixHits(p);
      out = i === 0 ? hit : new Set([...out].filter((k) => hit.has(k)));
    });
    cache.set(term, out);
    return out;
  };
}

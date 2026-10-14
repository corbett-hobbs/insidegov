/**
 * Site-wide jump-to-page search. Pure and isomorphic: the entry shape, a
 * normaliser and the ranker. The index itself is built at build time by
 * lib/site-search-index.ts and served as static JSON from /api/search-index.
 */
export type SearchKind = "page" | "member" | "justice" | "committee";

/** Result groups, in display order. */
export const KIND_ORDER: readonly SearchKind[] = ["page", "member", "justice", "committee"];
export const KIND_LABELS: Record<SearchKind, string> = {
  page: "Pages",
  member: "Members of Congress",
  justice: "Justices",
  committee: "Committees",
};

export interface SearchEntry {
  /** Display name. */
  n: string;
  /** Grey line under the name ("Senator · D-NY"). */
  s: string;
  /** Destination path. */
  u: string;
  k: SearchKind;
  /** Extra match terms: aliases, state names, short forms. */
  a?: string;
}

/** Lowercase, strip accents and punctuation, collapse spaces. */
export function normalize(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Score one entry against a normalised query: every query word must start a
 * word in the name (or alias); name-prefix beats later-word match beats alias.
 * Returns 0 for no match.
 */
export function scoreEntry(entry: SearchEntry, q: string): number {
  const words = q.split(" ").filter(Boolean);
  if (words.length === 0) return 0;
  const name = normalize(entry.n);
  const alias = entry.a ? normalize(entry.a) : "";
  const nameWords = name.split(" ");
  const aliasWords = alias ? alias.split(" ") : [];
  let score = 0;
  for (const w of words) {
    if (nameWords.some((nw) => nw === w)) score += 4;
    else if (nameWords.some((nw) => nw.startsWith(w))) score += 3;
    else if (aliasWords.some((aw) => aw === w)) score += 2;
    else if (aliasWords.some((aw) => aw.startsWith(w))) score += 1;
    else return 0;
  }
  if (name.startsWith(q)) score += 5;
  else if (name.includes(q)) score += 2;
  return score;
}

/** Best matches first, ties broken by index order; at most `limit` results. */
export function searchEntries(entries: readonly SearchEntry[], query: string, limit = 12): SearchEntry[] {
  const q = normalize(query);
  if (!q) return [];
  return entries
    .map((e, i) => ({ e, i, score: scoreEntry(e, q) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || KIND_ORDER.indexOf(a.e.k) - KIND_ORDER.indexOf(b.e.k) || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.e);
}

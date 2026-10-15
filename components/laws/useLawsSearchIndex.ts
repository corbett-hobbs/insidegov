"use client";

import { useEffect, useMemo, useState } from "react";
import { makeSummarySearch, type LawsSearchIndex } from "@/lib/laws-search";

let cached: Promise<LawsSearchIndex> | null = null;

async function load(version: string): Promise<LawsSearchIndex> {
  const r = await fetch(`/data/laws/search?v=${encodeURIComponent(version)}`);
  if (!r.ok) throw new Error(`laws search index ${r.status}`);
  return (await r.json()) as LawsSearchIndex;
}

/**
 * The summary word index, fetched once, the first time `wanted` turns true (someone typed in the search box), then shared.
 * Until it arrives, `summaryHas` is undefined and search covers the list's own fields; `failed` leaves it that way.
 */
export function useLawsSearchIndex(version: string, wanted: boolean) {
  const [index, setIndex] = useState<LawsSearchIndex | null>(null);
  useEffect(() => {
    if (!wanted) return;
    let live = true;
    cached ??= load(version);
    cached.catch(() => (cached = null));
    cached.then(
      (i) => live && setIndex(i),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [version, wanted]);
  const summaryHas = useMemo(() => (index ? makeSummarySearch(index) : undefined), [index]);
  return { summaryHas, loading: wanted && !index };
}

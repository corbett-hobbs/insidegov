"use client";

import { useEffect, useRef } from "react";
import { withParams } from "./url-state";

/**
 * Keeps a page's filter state in its query string so a filtered view can be linked
 * and survives a reload. The page keeps its state in React as before; this hook only
 * mirrors it:
 *
 * - `restore(query)` runs once, after hydration, with the URL's search params. Parse
 *   them with the helpers in `lib/url-state.ts` and call the page's own setters
 *   (one restore for every key, so a page can apply them in the order its state needs).
 * - From then on `params` (key → formatted value, `null` for the default) is written
 *   back with `history.replaceState` whenever it changes: no navigation, no new history
 *   entry, no scroll; other params and the `#hash` are kept. Next's router picks up
 *   the change (`useSearchParams` stays in sync).
 *
 * It reads `window.location` rather than `useSearchParams()`, so the page still
 * prerenders as static HTML (no Suspense boundary, no client-side bailout); a linked
 * view shows the default for a frame and then switches.
 */
export function useUrlState(
  params: Readonly<Record<string, string | null>>,
  restore: (query: URLSearchParams) => void,
): void {
  const restoreRef = useRef(restore);
  useEffect(() => {
    restoreRef.current = restore;
  });

  useEffect(() => {
    restoreRef.current(new URLSearchParams(window.location.search));
  }, []);

  // Skip the mount pass: it still holds the defaults, and the restored state writes itself back on the next render.
  const mounted = useRef(false);
  const key = JSON.stringify(params);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const next = withParams(window.location.search, JSON.parse(key) as Record<string, string | null>);
    if (next === window.location.search) return;
    window.history.replaceState(null, "", `${window.location.pathname}${next}${window.location.hash}`);
  }, [key]);
}

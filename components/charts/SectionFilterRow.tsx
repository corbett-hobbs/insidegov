"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";

/**
 * Publishes the pinned filter bar's live height as `--pinned-bar-h` on the document, so a section's filter row can pin directly
 * under it (the bar grows when the section strip appears). Attach the returned ref to the bar.
 */
export function usePinnedBarHeight() {
  const observer = useRef<ResizeObserver | null>(null);
  useEffect(
    () => () => {
      observer.current?.disconnect();
      document.documentElement.style.removeProperty("--pinned-bar-h");
    },
    [],
  );
  return useCallback((el: HTMLElement | null) => {
    observer.current?.disconnect();
    if (!el) return;
    const set = () => document.documentElement.style.setProperty("--pinned-bar-h", `${el.getBoundingClientRect().height}px`);
    set();
    observer.current = new ResizeObserver(set);
    observer.current.observe(el);
  }, []);
}

/**
 * Filters that apply to one section only. The row sits under the section's heading and stays pinned under the page's filter bar
 * while its parent (the section's wrapper) is on screen, so a filter is never shown beside charts it doesn't affect. It sits below
 * the bar's z-index so the bar's dropdowns cover it, and above the cards so its own dropdown panel covers them.
 */
export function SectionFilterRow({ children }: { children: ReactNode }) {
  return (
    <div className="sticky top-[var(--pinned-bar-h,64px)] z-30 -mx-4 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1.5 bg-bg px-4 py-1.5 sm:-mx-6 sm:px-6">
      {children}
    </div>
  );
}

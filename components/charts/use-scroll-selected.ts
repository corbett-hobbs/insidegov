"use client";

import { useEffect, useRef, type RefObject } from "react";

/** The selected rows' ids and positions as one string, so re-sorting a list that holds a selection scrolls to it again. */
export function selectedRowsKey(rows: readonly { id: string; selected?: boolean }[]): string {
  return rows.flatMap((r, i) => (r.selected ? [`${r.id}@${i}`] : [])).join("|");
}

/**
 * Centre the first `[data-selected-row]` inside `root` in whichever ancestor scrolls the list, whenever the set of
 * selected rows changes. Scrolls that container directly (never scrollIntoView), so the page itself doesn't jump,
 * and does nothing when no ancestor scrolls (a list that is simply as tall as its content).
 *
 * Every ranked-row chart (SwarmRows, StackedRows, ...) calls this with its own `selectedKey` — the selected ids
 * joined into one string — so a country/state picked in a filter bar is always brought into view.
 */
export function useScrollSelectedRow(root: RefObject<HTMLElement | null>, selectedKey: string) {
  const first = useRef(true);
  useEffect(() => {
    if (!selectedKey) return;
    const instant = first.current;
    first.current = false;
    let settling = false;
    const run = () => {
      const el = root.current?.querySelector<HTMLElement>("[data-selected-row]");
      if (!el) return;
      let sc: HTMLElement | null = el.parentElement;
      while (sc && !(/(auto|scroll)/.test(getComputedStyle(sc).overflowY) && sc.scrollHeight > sc.clientHeight)) {
        sc = sc.parentElement;
      }
      if (!sc) return;
      const a = el.getBoundingClientRect();
      const b = sc.getBoundingClientRect();
      const top = Math.max(0, sc.scrollTop + (a.top - b.top) + a.height / 2 - sc.clientHeight / 2);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      sc.scrollTo({ top, behavior: reduce || instant || settling ? "auto" : "smooth" });
    };
    // Let layout settle a frame or two, then centre. The chart is still measuring its width and the cards around it
    // are still sizing at first, so keep re-centring when the list's layout shifts during the next moment, then stop.
    let id2 = 0;
    const id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => {
        run();
        settling = true;
      });
    });
    const host = root.current;
    const ro = host ? new ResizeObserver(() => settling && run()) : null;
    if (host && ro) {
      ro.observe(host);
      if (host.parentElement) ro.observe(host.parentElement);
    }
    const stop = window.setTimeout(() => ro?.disconnect(), 1200);
    return () => {
      cancelAnimationFrame(id1);
      cancelAnimationFrame(id2);
      ro?.disconnect();
      clearTimeout(stop);
    };
  }, [root, selectedKey]);
}

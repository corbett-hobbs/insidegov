"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

/** The width (Tailwind `lg`) from which the two cards sit side by side. */
const SIDE_BY_SIDE = "(min-width: 1024px)";

/**
 * Two cards side by side, each holding one scrollable case list (`data-case-scroll`), brought to exactly the same height with no
 * blank space under either card's Data notes. Each list grows with its cases up to 32rem (its own CSS cap); beside another card,
 * both lists are then sized so the cards match the shorter one, and the longer list scrolls. The two intro lines can wrap
 * differently, so the card's own chrome is measured rather than assumed. Stacked (phones, tablets) or alone, the CSS cap alone applies.
 * Before this runs, and with no script, the cards simply stretch to the taller one.
 */
export function MatchedCards({ className, children }: { className: string; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const mq = window.matchMedia(SIDE_BY_SIDE);
    const apply = () => {
      const boxes = [...el.querySelectorAll<HTMLElement>("[data-case-scroll]")];
      for (const b of boxes) {
        b.style.height = "";
        b.style.maxHeight = "";
      }
      // Measure each card at its own height, not stretched to its neighbour's.
      el.style.alignItems = "start";
      if (!mq.matches || boxes.length < 2) {
        el.style.alignItems = "";
        return;
      }
      const cards = boxes.map((b) => [...el.children].find((c) => c.contains(b)) as HTMLElement);
      // The card's height minus its list's: the title, intro, Data notes and padding.
      const h = (e: HTMLElement) => e.getBoundingClientRect().height;
      const chrome = boxes.map((b, i) => h(cards[i]!) - h(b));
      // A list's natural height is its content, capped at its CSS max-height (read back as the height it has just now, in fractional pixels so the cards end on the same line).
      const target = Math.min(...boxes.map((b, i) => chrome[i]! + h(b)));
      boxes.forEach((b, i) => {
        b.style.maxHeight = "none";
        b.style.height = `${target - chrome[i]!}px`;
      });
    };
    apply();
    // A width can change with no window resize (a scrollbar appearing, a side panel moving, a late font), and then the intro lines
    // wrap differently and the sizes go stale. Watch the cards: re-measure when the width changes or the two heights come apart.
    let width = el.getBoundingClientRect().width;
    const watch = new ResizeObserver(() => {
      const w = el.getBoundingClientRect().width;
      const cards = [...el.children].map((c) => c.getBoundingClientRect().height);
      if (w !== width || (mq.matches && cards.length > 1 && Math.max(...cards) - Math.min(...cards) > 0.5)) {
        width = w;
        apply();
      }
    });
    watch.observe(el);
    for (const c of el.children) watch.observe(c);
    window.addEventListener("resize", apply);
    mq.addEventListener("change", apply);
    void document.fonts?.ready.then(apply);
    return () => {
      watch.disconnect();
      window.removeEventListener("resize", apply);
      mq.removeEventListener("change", apply);
    };
  }, []);

  return (
    <div ref={root} className={className}>
      {children}
    </div>
  );
}

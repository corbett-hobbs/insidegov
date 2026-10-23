"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

export interface SectionNavItem {
  /** The `id` of the section's `SectionHeading`, which is the jump target. */
  id: string;
  /** The short name used in the pills, the pinned strip and the contents list. */
  label: string;
  /** A shorter name for the pinned strip, where three or more pills must fit one phone-width row. */
  short?: string;
}

/** The pinned bars (filter bar, then the section strip) cover this much of the top of the viewport. */
const PINNED_CLEARANCE = 160;

/**
 * Tracks the page's scroll for the numbered section navigation: `stuck` once the in-page pills have scrolled up under the
 * pinned filter bar (that is when the strip / contents list appear), and `active`, the last section whose heading has
 * reached the top. Attach `pillsRef` to the in-page pills.
 */
export function useSectionScroll(items: readonly SectionNavItem[]) {
  const pillsRef = useRef<HTMLElement>(null);
  const [stuck, setStuck] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const pills = pillsRef.current;
      setStuck(pills ? pills.getBoundingClientRect().bottom < 60 : false);
      let cur: string | null = null;
      for (const it of items) {
        const el = document.getElementById(it.id);
        if (el && el.getBoundingClientRect().top <= PINNED_CLEARANCE) cur = it.id;
      }
      setActive(cur);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [items]);
  return { pillsRef, stuck, active };
}

const NUM = "font-mono text-[0.7rem] font-medium";

/** The numbered jump pills in the page header: one line on a phone (the short names, scrolling sideways if they still do not fit), wrapping from `sm`. */
export function SectionPills({ items, pillsRef, numbered = true, className = "" }: { items: readonly SectionNavItem[]; pillsRef?: RefObject<HTMLElement | null>; numbered?: boolean; className?: string }) {
  return (
    <nav ref={pillsRef} aria-label="Sections" className={`flex gap-1.5 overflow-x-auto sm:flex-wrap sm:gap-2 sm:overflow-visible ${className}`}>
      {items.map((it, i) => (
        <a
          key={it.id}
          href={`#${it.id}`}
          className="inline-flex flex-none items-center gap-1.5 whitespace-nowrap rounded-full border border-line-strong bg-surface px-2.5 py-0.5 text-[0.78rem] text-ink no-underline hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:px-3"
        >
          {numbered && <span className={`${NUM} text-accent`}>{i + 1}</span>}
          {it.short ? (
            <>
              <span className="sm:hidden">{it.short}</span>
              <span className="max-sm:hidden">{it.label}</span>
            </>
          ) : (
            it.label
          )}
        </a>
      ))}
    </nav>
  );
}

/**
 * The strip pinned under the filter bar once the header pills have scrolled away, below 1420px (wider screens get
 * `SectionToc` in the left gutter instead). One row that scrolls sideways if the labels do not fit; the active section is
 * filled and kept in view.
 */
export function SectionStrip({ items, active }: { items: readonly SectionNavItem[]; active: string | null }) {
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = rowRef.current;
    const chip = row?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!row || !chip) return;
    const left = chip.offsetLeft - 16;
    const right = chip.offsetLeft + chip.offsetWidth + 16;
    if (left < row.scrollLeft) row.scrollTo({ left, behavior: "smooth" });
    else if (right > row.scrollLeft + row.clientWidth) row.scrollTo({ left: right - row.clientWidth, behavior: "smooth" });
  }, [active]);
  return (
    <nav aria-label="Jump to section" className="min-[1420px]:hidden">
      <div ref={rowRef} className="neighbor-chip-row -mx-4 flex gap-1.5 overflow-x-auto border-t border-line px-4 pb-1.5 pt-1.5 sm:mx-0 sm:px-0">
        {items.map((it, i) => {
          const on = it.id === active;
          return (
            <a
              key={it.id}
              href={`#${it.id}`}
              aria-current={on ? "true" : undefined}
              className={`inline-flex flex-none items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[0.75rem] no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                on ? "border-accent bg-accent text-accent-ink" : "border-line-strong bg-surface text-ink hover:border-accent"
              }`}
            >
              <span className={`${NUM} ${on ? "text-accent-ink" : "text-accent"}`}>{i + 1}</span>
              {it.short ?? it.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * A floating contents list in the left gutter, on screens at least 1420px wide (where the 1180px column leaves room for it).
 * It appears once the header pills have scrolled away and follows the reader from section to section.
 */
export function SectionToc({ items, active, visible }: { items: readonly SectionNavItem[]; active: string | null; visible: boolean }) {
  if (!visible) return null;
  return (
    <nav aria-label="Contents" className="fixed left-[calc(50%-694px)] top-36 z-30 hidden w-28 min-[1420px]:block">
      <ol className="m-0 flex list-none flex-col gap-0.5 border-l border-line-strong p-0">
        {items.map((it, i) => {
          const on = it.id === active;
          return (
            <li key={it.id}>
              <a
                href={`#${it.id}`}
                aria-current={on ? "true" : undefined}
                className={`-ml-px flex gap-1.5 border-l-2 py-1 pl-2.5 pr-1 text-[0.75rem] leading-snug no-underline hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                  on ? "border-accent font-medium text-ink" : "border-transparent text-ink-muted"
                }`}
              >
                <span className={`${NUM} pt-px text-accent`}>{i + 1}</span>
                <span>{it.label}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

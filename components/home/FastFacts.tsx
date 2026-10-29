"use client";

import Link from "next/link";
import { OverflowButtons, useScrollHints } from "@/components/SiteNav";
import type { FastFact } from "@/lib/fast-facts";
import { formatUpdatedStamp } from "@/lib/news-derive";

/**
 * "Latest numbers": six headline figures, each from a different page, under the homepage intro. One tile is one link to
 * its chart. Desktop is a grid (three across, then six); a phone gets one swipe row with an arrow button over each edge. The 1px gaps over a `bg-line` container draw the dividers however the grid wraps.
 */
export function FastFacts({ facts, updated }: { facts: FastFact[]; updated: string | null }) {
  const { ref, hiddenRight, canBack, measure } = useScrollHints(facts);
  // One tile per press, so the tile that lands on the left is always whole (the shared 60%-of-width step stops mid-tile).
  const scrollBy = (dir: 1 | -1) => {
    const el = ref.current;
    const tile = el?.children[0] as HTMLElement | undefined;
    if (el && tile) el.scrollBy({ left: dir * (tile.offsetWidth + 1), behavior: "smooth" });
  };
  return (
    <section aria-labelledby="fast-facts-title" className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="fast-facts-title" className="m-0 font-mono text-[0.68rem] font-medium uppercase tracking-[0.14em] text-accent">
          Latest numbers
        </h2>
        {updated && <span className="font-mono text-[0.68rem] text-ink-faint">Updated {formatUpdatedStamp(updated)}</span>}
      </div>
      <div className="relative">
        <ul
          ref={ref as React.RefObject<HTMLUListElement>}
          onScroll={measure}
          className="m-0 flex list-none snap-x snap-mandatory gap-px overflow-x-auto rounded-[10px] border border-line bg-line p-0 [scrollbar-width:none] sm:grid sm:grid-cols-3 sm:overflow-hidden lg:grid-cols-6 [&::-webkit-scrollbar]:hidden"
        >
          {facts.map((f) => (
            <li key={f.label} className="flex shrink-0 basis-[62%] snap-start bg-surface sm:basis-auto">
              <Link
                href={f.href}
                className="flex w-full flex-col gap-1 px-4 pb-4 pt-3.5 transition-colors hover:bg-surface-raised focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
              >
                <span className="font-mono text-[0.62rem] font-medium uppercase tracking-[0.08em] text-ink-faint">{f.label}</span>
                <span className="font-serif text-[2rem] font-medium leading-[1.05] tracking-tight text-accent">{f.figure}</span>
                <span className="text-[0.78rem] leading-snug text-ink-muted">{f.caption}</span>
                <span className="text-[0.72rem] text-accent underline underline-offset-2">{f.linkText}</span>
                <span className="mt-auto pt-2 font-mono text-[0.62rem] text-ink-faint">{f.asOf}</span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="sm:hidden">
          <OverflowButtons
            canBack={canBack}
            hiddenRight={hiddenRight}
            scrollBy={scrollBy}
            noun="number"
            plainMore
            backFade=""
            moreFade=""
          />
        </div>
      </div>
    </section>
  );
}

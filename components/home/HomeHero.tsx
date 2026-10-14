import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/PageHeader";

/**
 * The homepage banner: a duotone photo of the Capitol under a navy-to-gold
 * wash, the page title and intro (through PageHeader, in a narrowed column, not
 * a max-width on the header), two calls to action, and the branch index strip
 * pinned to its bottom edge. Light-on-dark tokens are scoped in globals.css
 * (`.home-hero`), so PageHeader's own colours need no changes.
 */
export function HomeHero({
  kicker,
  title,
  intro,
  startHref,
  strip,
}: {
  kicker: string;
  title: ReactNode;
  intro: ReactNode;
  startHref: string;
  strip: ReactNode;
}) {
  return (
    <section aria-label="Introduction" className="home-hero relative isolate overflow-hidden">
      <div aria-hidden="true" className="home-hero-photo" />
      <div aria-hidden="true" className="home-hero-tint" />
      <div aria-hidden="true" className="home-hero-wash" />
      <div aria-hidden="true" className="home-hero-scrim" />
      <div className="relative z-10 mx-auto w-full max-w-[1180px] px-4 pb-14 pt-14 sm:px-6 sm:pb-20 sm:pt-20 lg:pb-24 lg:pt-24">
        <div className="home-st grid lg:grid-cols-[minmax(0,40rem)_1fr]" style={{ "--i": 0 } as React.CSSProperties}>
          <div>
            <PageHeader size="display" eyebrow={kicker} title={title}>
              {intro}
            </PageHeader>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href={startHref}
                className="inline-flex items-center gap-2 rounded bg-[#e8c877] px-5 py-3 text-[0.9rem] font-semibold text-[#2a2008] transition-colors hover:bg-[#f1d68e]"
              >
                Start with the presidency <span aria-hidden="true">→</span>
              </Link>
              <Link
                href="/methodology"
                className="inline-flex items-center rounded border border-white/55 px-5 py-3 text-[0.9rem] font-semibold text-white transition-colors hover:bg-white/10"
              >
                Read the methodology
              </Link>
            </div>
          </div>
        </div>
      </div>
      {strip}
    </section>
  );
}

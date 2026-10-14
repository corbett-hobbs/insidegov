import type { ReactNode } from "react";

/**
 * A sub-header inside the Immigration page: one question per section (ICE removals, refugee admissions), with an optional short
 * intro. `id` is the jump-link target; `scroll-mt` keeps the heading clear of the pinned filter bar when a jump lands on it.
 */
export function SectionHeading({ id, title, children }: { id: string; title: string; children?: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24 border-t border-line-strong pt-5">
      <h2 id={`${id}-h`} className="m-0 font-serif text-[clamp(1.35rem,2.6vw,1.6rem)] font-medium leading-[1.2] tracking-[-0.01em]">
        {title}
      </h2>
      {children && <div className="mt-2 text-[0.92rem] leading-[1.65] text-ink-muted [&>p]:m-0">{children}</div>}
    </section>
  );
}

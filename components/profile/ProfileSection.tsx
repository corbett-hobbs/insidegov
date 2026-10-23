import type { ReactNode } from "react";

/**
 * One labelled band of a member page (the president page's section eyebrow): a small mono label with a hairline running out to
 * the edge, then the section's cards stacked beneath it. `id` is the jump target of the pill row under the page header.
 */
export function ProfileSection({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="flex scroll-mt-6 flex-col gap-5">
      <h2 id={`${id}-h`} className="m-0 flex items-center gap-3 font-mono text-[0.68rem] font-medium uppercase tracking-[0.08em] text-ink-muted">
        {label}
        <span aria-hidden className="h-px flex-1 bg-line" />
      </h2>
      {children}
    </section>
  );
}

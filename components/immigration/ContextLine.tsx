"use client";

import { useId, useState, type ReactNode } from "react";
import { SourceLink } from "@/components/SourceLink";
import { IMMIGRATION_CONTEXT, IMMIGRATION_TAKEAWAYS, type ContextEntry } from "./takeaways";

type Card = keyof typeof IMMIGRATION_TAKEAWAYS;

/**
 * A card's takeaway with its context (ARCHITECTURE_MAP rule 7d, draft) folded away: a small "i" button at the end of the
 * takeaway opens the context line under it, with its sources; it starts closed so the chart keeps its room. `takeaway` goes in
 * the card's `takeaway` prop and `panel` is the card's first child. A card with no context gets the plain takeaway.
 */
export function useTakeaway(card: Card): { takeaway: ReactNode; panel: ReactNode } {
  const [open, setOpen] = useState(false);
  const id = useId();
  const c = (IMMIGRATION_CONTEXT as Partial<Record<Card, ContextEntry>>)[card];
  const text = IMMIGRATION_TAKEAWAYS[card].takeaway;
  if (!c) return { takeaway: text, panel: null };
  const takeaway = (
    <>
      {text}{" "}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className={`group relative -top-px inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-full border py-px pl-0.5 pr-2 align-middle text-[0.72rem] font-medium leading-[1.3] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${open ? "border-ink bg-ink text-surface" : "border-line-strong text-ink-muted hover:border-ink hover:text-ink"}`}
      >
        <span aria-hidden className={`inline-flex h-[0.95rem] w-[0.95rem] items-center justify-center rounded-full font-serif text-[0.66rem] font-semibold italic leading-none ${open ? "bg-surface text-ink" : "bg-line text-ink-muted group-hover:text-ink"}`}>i</span>
        Context
        <span aria-hidden className="text-[0.6rem]">{open ? "▴" : "▾"}</span>
      </button>
    </>
  );
  const panel = (
    <div id={id} hidden={!open} className="mb-2.5 rounded-md border-l-2 border-line-strong bg-surface-raised px-3 py-2 text-[0.8rem] leading-[1.5] text-ink-muted">
      <span className="font-medium text-ink">Context:</span> {c.text}{" "}
      <span className="whitespace-nowrap">
        (
        {c.sources.map((s, i) => (
          <span key={s.id}>
            {i > 0 && ", "}
            <SourceLink id={s.id}>{s.label}</SourceLink>
          </span>
        ))}
        )
      </span>
    </div>
  );
  return { takeaway, panel };
}

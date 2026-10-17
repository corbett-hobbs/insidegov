"use client";

import { useState } from "react";

/** Roughly what the law page's clipped summary shows (one phone screen), counted in characters so the cut lands between paragraphs. */
const OPEN_CHARS = 700;

/** How many paragraphs to show closed: whole paragraphs up to about `OPEN_CHARS`, at least one, and all of them if only one is left over. */
export function openParagraphs(lengths: readonly number[]): number {
  let n = 0;
  let total = 0;
  while (n < lengths.length && (n === 0 || total + lengths[n]! <= OPEN_CHARS)) total += lengths[n++]!;
  return n >= lengths.length - 1 ? lengths.length : n;
}

/**
 * The Wikipedia opening as paragraphs. A long one opens on whole paragraphs, never mid-sentence, with "See more" for the
 * rest; the whole text is in the page either way.
 */
export function LeadBody({ paragraphs }: { paragraphs: readonly string[] }) {
  const [all, setAll] = useState(false);
  const shown = openParagraphs(paragraphs.map((p) => p.length));
  const long = shown < paragraphs.length;
  return (
    <>
      <div id="lead-body" className="flex flex-col gap-3">
        {paragraphs.map((p, i) => (
          <p key={i} className="m-0" hidden={!all && i >= shown}>
            {p}
          </p>
        ))}
      </div>
      {long && (
        <button
          type="button"
          aria-expanded={all}
          aria-controls="lead-body"
          onClick={() => setAll((o) => !o)}
          className="cursor-pointer self-start text-[0.85rem] text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {all ? "See less" : `See more (${paragraphs.length - shown} more paragraph${paragraphs.length - shown === 1 ? "" : "s"})`}
        </button>
      )}
    </>
  );
}

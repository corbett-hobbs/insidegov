"use client";

import { useState } from "react";

const PREVIEW_CHARS = 3000;

/**
 * The CRS summary as paragraphs. An omnibus law's summary runs to hundreds of paragraphs, so a long one opens at about 3,000
 * characters (whole paragraphs) with "Show the full summary"; the whole text is in the page either way.
 */
export function SummaryBody({ paragraphs }: { paragraphs: readonly string[] }) {
  const [all, setAll] = useState(false);
  let used = 0;
  let keep = paragraphs.length;
  for (let i = 0; i < paragraphs.length; i++) {
    used += paragraphs[i]!.length;
    if (used >= PREVIEW_CHARS) {
      keep = i + 1;
      break;
    }
  }
  const long = keep < paragraphs.length;
  const shown = all || !long ? paragraphs : paragraphs.slice(0, keep);
  return (
    <>
      {shown.map((p, i) => (
        <p key={i} className="m-0">
          {p}
        </p>
      ))}
      {long && (
        <button
          type="button"
          aria-expanded={all}
          onClick={() => setAll((o) => !o)}
          className="cursor-pointer self-start text-[0.85rem] text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {all ? "Show less" : `Show the full summary (${paragraphs.length - keep} more paragraphs)`}
        </button>
      )}
    </>
  );
}

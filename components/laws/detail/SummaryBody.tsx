"use client";

import { useEffect, useRef, useState } from "react";

/** Collapsed height: about one phone screen of text, so a phone and a desktop open to the same amount. */
const COLLAPSED_PX = 384;

/**
 * The CRS summary as paragraphs. A summary taller than about a phone screen (24rem) opens clipped with a fade and a
 * "See more" link; the whole text is in the page either way. An omnibus law's summary runs to hundreds of paragraphs.
 */
export function SummaryBody({ paragraphs }: { paragraphs: readonly string[] }) {
  const [all, setAll] = useState(false);
  const [long, setLong] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setLong(el.scrollHeight > COLLAPSED_PX + 48);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [paragraphs]);
  const clipped = long && !all;
  return (
    <>
      <div
        ref={box}
        id="summary-body"
        style={clipped ? { maxHeight: COLLAPSED_PX } : undefined}
        className={`relative flex flex-col gap-3 ${clipped ? "overflow-hidden" : ""}`}
      >
        {paragraphs.map((p, i) => (
          <p key={i} className="m-0">
            {p}
          </p>
        ))}
        {clipped && <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-surface to-transparent" />}
      </div>
      {long && (
        <button
          type="button"
          aria-expanded={all}
          aria-controls="summary-body"
          onClick={() => setAll((o) => !o)}
          className="cursor-pointer self-start text-[0.85rem] text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {all ? "See less" : "See more"}
        </button>
      )}
    </>
  );
}

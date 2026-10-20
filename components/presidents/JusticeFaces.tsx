"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { dateLabel } from "@/lib/president-derive";
import type { DirectoryJustice } from "@/lib/president-types";

/**
 * The justices a president appointed, as a row of small portraits. A face is one named person, so (rule 10t) a tap or click
 * pins that justice's card under the row and only the card links to the profile; tapping again, elsewhere or Esc closes it.
 * Faces sit above the row's stretched link. A justice still on the Court has a dot on the portrait.
 */
export function JusticeFaces({ justices }: { justices: DirectoryJustice[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (open === null) return;
    const away = (e: Event) => {
      if (!box.current?.contains(e.target as Node)) setOpen(null);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  if (justices.length === 0) return <span className="font-mono text-[0.95rem] text-ink">—</span>;
  const j = justices.find((x) => x.id === open);
  return (
    <span ref={box} className={`relative flex min-w-0 flex-col gap-1 ${j ? "z-30" : "z-10"}`}>
      <span className="flex flex-wrap gap-1">
        {justices.map((x) => (
          <button
            key={x.id}
            type="button"
            aria-pressed={open === x.id}
            aria-label={`${x.name}${x.serving ? ", still serving" : ""}`}
            onClick={() => setOpen(open === x.id ? null : x.id)}
            className={`relative h-[30px] w-6 flex-none rounded-[3px] border p-0 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus ${open === x.id ? "border-ink" : "border-line-strong"}`}
          >
            {x.photo ? (
              // A pre-sized static asset from public/.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={x.photo} alt="" width={24} height={30} className="h-full w-full rounded-[2px] object-cover object-top" />
            ) : (
              <span aria-hidden className="block h-full w-full rounded-[2px] bg-surface-raised" />
            )}
            {x.serving && <span aria-hidden className="absolute -right-[3px] -top-[3px] size-[7px] rounded-full border border-surface bg-ink" />}
          </button>
        ))}
      </span>
      {j && (
        <span className="rounded-md border border-line-strong bg-surface px-3 py-2 text-[0.78rem] leading-snug shadow-[0_8px_24px_rgba(26,34,51,0.22)] md:absolute md:left-0 md:top-full md:z-20 md:mt-1 md:w-[17rem]">
          <span className="block font-medium text-ink">{j.name}</span>
          <span className="block text-ink-muted">
            Nominated {dateLabel(j.nominated)}
            {j.serving ? " · still serving" : ""}
          </span>
          {j.path && (
            <Link href={j.path} className="mt-0.5 inline-block font-medium text-ink underline decoration-line-strong underline-offset-2 hover:decoration-accent">
              Open profile →
            </Link>
          )}
        </span>
      )}
    </span>
  );
}

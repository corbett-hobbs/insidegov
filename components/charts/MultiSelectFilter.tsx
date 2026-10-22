"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { track } from "@/lib/analytics";
import { isPicked, pickLabel, pickedCount, setPicked, type Picked } from "@/lib/multi-select";

export interface MultiOption<T> {
  id: T;
  label: string;
  /** Shown at the right of the row (a count for the years on screen); omitted when the page has no cheap one. */
  count?: string;
  /** CSS colour of the option's own chart colour, when it has one. */
  swatch?: string;
  /** One muted line under the name, for an option worth explaining (Laws: what "Commemorations" holds). */
  hint?: string;
  /**
   * A sentence or two about the option (Decisions: what an issue area holds). Adds an ⓘ button at the right of the row that opens it
   * under the name (tap or click; it never ticks the box), and the same text as a hover tooltip on the name.
   */
  info?: string;
}

/**
 * The pinned filter bars' checkbox dropdown: one button the size of the select it replaces, and a panel of tick boxes under it
 * (All / Clear in its header, so "everything except X" is two clicks and "only X" is Clear then X). A selection is `null` (all
 * ticked: no filter) or the set of ticked ids (`lib/multi-select`). The panel overlays the page, so the bar stays one line; it
 * stays open while boxes are ticked and closes on Esc, a tap outside or the button. On a narrow screen it shifts to stay on screen.
 */
export function MultiSelectFilter<T extends string | number>({
  label,
  noun,
  options,
  value,
  onChange,
  className = "",
  allLabel,
  footer,
  footerClassName = "",
  dotClassName = "sm:hidden",
  dot,
}: {
  /** Names the group for screen readers ("Policy area"). */
  label: string;
  /** Plural, lower case, for "All topics" / "3 of 9 topics". */
  noun: string;
  options: readonly MultiOption<T>[];
  value: Picked<T>;
  onChange: (next: Picked<T>) => void;
  /** Width and flex classes for the control (the panel anchors to it), e.g. `flex-1 sm:w-[12.5rem] sm:flex-none`. */
  className?: string;
  allLabel?: string;
  /** Extra controls under the list (Laws: the Major laws checkbox, on phones, where the bar has no room for it). `footerClassName` can hide the section at some widths. */
  footer?: ReactNode;
  footerClassName?: string;
  /** Hides the `dot` at the widths where the footer control it stands for is out of the panel (default: shown on phones only). */
  dotClassName?: string;
  /** When set, the button wears an accent dot (below `sm`) and says this to screen readers: a filter that lives in the footer is on. */
  dot?: string;
}) {
  const [open, setOpen] = useState(false);
  const [explained, setExplained] = useState<ReadonlySet<T>>(new Set());
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const uid = useId();
  const ids = options.map((o) => o.id);
  const ticked = pickedCount(value, ids);
  const filtered = value !== null;

  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", down);
    return () => document.removeEventListener("pointerdown", down);
  }, [open]);

  // Keep the panel inside the screen: a control in the right half of a phone's row would otherwise run off the edge.
  useLayoutEffect(() => {
    const p = panel.current;
    if (!open || !p) return;
    p.style.transform = "";
    const r = p.getBoundingClientRect();
    const margin = 8;
    // The document's own width, not `innerWidth`: a mobile browser widens the layout viewport the moment something overflows it, which would hide the overflow from this check.
    const vw = Math.min(document.documentElement.clientWidth, window.innerWidth);
    const dx = r.right > vw - margin ? vw - margin - r.right : r.left < margin ? margin - r.left : 0;
    if (dx) p.style.transform = `translateX(${Math.round(dx)}px)`;
  }, [open]);

  const face = pickLabel(
    value,
    options.map((o) => ({ id: o.id, label: o.label })),
    noun,
    allLabel,
  );

  const change = (next: Picked<T>) => {
    track("filter_change", { control: label }, 1000);
    onChange(next);
  };

  return (
    <div
      ref={root}
      className={`relative min-w-0 ${className}`}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          setOpen(false);
          button.current?.focus();
        }
      }}
    >
      <button
        ref={button}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={uid}
        aria-label={`${label}: ${face}${dot ? `, ${dot}` : ""}`}
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full min-w-0 cursor-pointer items-center justify-between gap-1.5 rounded-md border bg-surface-raised px-[0.55rem] py-[0.42rem] text-left text-[0.8rem] text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${open || filtered || dot ? "border-accent" : "border-line-strong"}`}
      >
        <span className="min-w-0 truncate">{face}</span>
        {filtered && (
          <span className="flex-none rounded-full bg-accent px-1.5 font-mono text-[0.62rem] leading-[1.15rem] text-accent-ink max-sm:hidden">
            {ticked}/{options.length}
          </span>
        )}
        {dot && <span aria-hidden title={dot} className={`h-1.5 w-1.5 flex-none rounded-full bg-accent ${dotClassName}`} />}
        <svg aria-hidden viewBox="0 0 10 6" className="h-1.5 w-2.5 flex-none text-ink-faint">
          <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </button>
      {open && (
        <div ref={panel} id={uid} role="group" aria-label={label} className="absolute left-0 top-[calc(100%+4px)] z-50 w-max min-w-[14rem] max-w-[min(18rem,calc(100vw-1rem))] overflow-hidden rounded-lg border border-line-strong bg-surface shadow-lg">
          <div className="flex items-center justify-between gap-2 border-b border-line bg-surface-raised px-3 py-1.5">
            <span className="font-mono text-[0.66rem] text-ink-muted">
              {ticked} of {options.length} shown
            </span>
            <span className="text-[0.75rem]">
              <button type="button" onClick={() => change(null)} className="rounded px-1 text-accent underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-focus">
                All
              </button>
              <span aria-hidden className="text-ink-faint">
                {" · "}
              </span>
              <button type="button" onClick={() => change(new Set())} className="rounded px-1 text-accent underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-focus">
                Clear
              </button>
            </span>
          </div>
          <div className="touch-scroll max-h-[min(19rem,60vh)] overflow-y-auto overscroll-contain">
            {options.map((o) => {
              const on = isPicked(value, o.id);
              const shown = o.info !== undefined && explained.has(o.id);
              return (
                <div key={String(o.id)} className="hover:bg-surface-raised">
                <label className="flex min-h-[2.75rem] cursor-pointer items-center gap-2 px-3 py-1.5 text-[0.8rem] sm:min-h-[2.1rem]">
                  <input type="checkbox" checked={on} onChange={(e) => change(setPicked(value, o.id, e.target.checked, ids))} className="m-0 h-4 w-4 flex-none cursor-pointer accent-[var(--accent)]" />
                  {o.swatch && <span aria-hidden className={`h-2.5 w-2.5 flex-none rounded-[2px] ${on ? "" : "opacity-35"}`} style={{ background: o.swatch }} />}
                  <span className="min-w-0 flex-1" title={o.info}>
                    <span className={`block truncate ${on ? "text-ink" : "text-ink-muted"}`}>{o.label}</span>
                    {o.hint && <span className="block truncate text-[0.7rem] leading-tight text-ink-faint">{o.hint}</span>}
                  </span>
                  {o.count !== undefined && <span className="flex-none font-mono text-[0.72rem] tabular-nums text-ink-muted">{o.count}</span>}
                  {o.info !== undefined && (
                    <button
                      type="button"
                      aria-expanded={shown}
                      aria-label={`About ${o.label}`}
                      onClick={(e) => {
                        e.preventDefault();
                        setExplained((cur) => {
                          const next = new Set(cur);
                          if (!next.delete(o.id)) next.add(o.id);
                          return next;
                        });
                      }}
                      className="-mr-2 flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-ink-faint hover:text-ink focus-visible:outline-2 focus-visible:outline-focus sm:-mr-1 sm:h-7 sm:w-7"
                    >
                      <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.3">
                        <circle cx="8" cy="8" r="6.5" />
                        <path d="M8 7.2v4" strokeLinecap="round" />
                        <circle cx="8" cy="4.9" r="0.45" fill="currentColor" />
                      </svg>
                    </button>
                  )}
                </label>
                {shown && <p className="m-0 px-3 pb-2 text-[0.72rem] leading-snug text-ink-muted">{o.info}</p>}
                </div>
              );
            })}
          </div>
          {footer && <div className={`border-t border-line px-3 py-2 ${footerClassName}`}>{footer}</div>}
        </div>
      )}
    </div>
  );
}

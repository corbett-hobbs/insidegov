"use client";

import { useState } from "react";
import { ACTION_KIND_LABEL, longDate, type TimelineAction } from "@/lib/law-details-derive";

const BADGE = "inline-flex items-center rounded-full border border-line-strong px-2 py-px text-[0.68rem] font-medium text-ink-muted";
const SHOWN = 30;

/**
 * The law page's action list, newest first. A full record can run to hundreds of steps, so the first 30 show and the rest sit behind
 * "Show all"; the whole list is in the page either way, so nothing is fetched on click.
 */
export function TimelineList({ actions }: { actions: readonly TimelineAction[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? actions : actions.slice(0, SHOWN);
  return (
    <>
      <ol tabIndex={0} aria-label="Timeline, scrollable" className="touch-scroll m-0 max-h-[32rem] list-none overflow-y-auto overscroll-contain p-0">
        {shown.map((a, i) => {
          const first = i === 0 || shown[i - 1]!.date !== a.date;
          return (
            <li key={i} className={`grid grid-cols-1 gap-x-3 py-1.5 text-[0.82rem] leading-[1.45] sm:grid-cols-[6.5rem_9rem_minmax(0,1fr)] ${first ? "border-t border-line first:border-t-0" : ""}`}>
              <span className={`tabular-nums text-ink-muted max-sm:mb-0.5 max-sm:font-medium max-sm:text-ink ${first ? "" : "max-sm:hidden"}`}>{first ? longDate(a.date) : ""}</span>
              <span className="text-[0.72rem] uppercase tracking-[0.04em] text-ink-faint max-sm:hidden">{ACTION_KIND_LABEL[a.kind]}</span>
              <span className="min-w-0">
                <span className="sm:hidden text-[0.68rem] uppercase tracking-[0.04em] text-ink-faint">{`${ACTION_KIND_LABEL[a.kind]} · `}</span>
                {a.text}
                {a.rolls.map((r) => (
                  <span key={r} className={`${BADGE} ml-2 whitespace-nowrap`}>
                    {r}
                  </span>
                ))}
              </span>
            </li>
          );
        })}
      </ol>
      {actions.length > SHOWN && (
        <button type="button" aria-expanded={all} onClick={() => setAll((o) => !o)} className="mt-2 cursor-pointer text-[0.82rem] text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
          {all ? "Show fewer" : `Show all ${actions.length} actions`}
        </button>
      )}
    </>
  );
}

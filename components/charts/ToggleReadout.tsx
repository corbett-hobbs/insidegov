"use client";

import type { ReactNode } from "react";
import { PinReadout, type PinLine } from "./PinReadout";

/**
 * A card's measure toggle with the active month's reading beside it. Layout rule: the bold value sits to the right
 * of the toggle on one line (it only drops below the toggle when the card is too narrow for both, never above), and
 * the small value line `PinReadout` prints for cards without a toggle is not repeated. Only the pin hint and
 * "Clear" follow, on phones. Shows `line.headline`, falling back to the values joined by " / ".
 */
export function ToggleReadout({ toggle, line, pinned, onClear, hint }: { toggle: ReactNode; line: PinLine | null; pinned: boolean; onClear: () => void; hint?: string }) {
  return (
    <>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        {/* Tighter pills on phones so the value fits beside them (the date wraps under it instead of widening it). */}
        <div className="[&_button]:px-1.5 [&_button]:text-[0.74rem] sm:[&_button]:px-[0.85rem] sm:[&_button]:text-[0.8rem]">{toggle}</div>
        <div className="min-w-[7.5rem] flex-1 text-right" aria-live="off">
          <div className="whitespace-nowrap font-mono text-[1rem] font-medium leading-tight tabular-nums text-ink sm:text-[1.6rem]">{line ? (line.headline ?? line.values.join(" / ")) : "—"}</div>
          {line && (
            <div className="mt-0.5 text-[0.75rem] leading-snug text-ink-muted">
              {line.date}
              {line.term ? <span className="block">{line.term}</span> : null}
            </div>
          )}
        </div>
      </div>
      <PinReadout line={null} pinned={pinned} onClear={onClear} hint={hint} />
    </>
  );
}

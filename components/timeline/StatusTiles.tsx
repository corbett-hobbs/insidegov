"use client";

import { statusNames, type CourtMode, type PowerStatus, type TileCount } from "@/lib/timeline-derive";
import { FOCUS_RING, STATUS_COLOR } from "./shared";

/**
 * The status tiles (rule 10p): how many of the events shown happened under each balance of power, which are also the
 * filter for the chart's markers and the era list (a tile picks that status, a second click clears it). They recount for
 * the Events filter and the years shown, follow the Court measure, and keep a 0 tile rather than vanishing.
 */
export function StatusTiles({
  tiles,
  mode,
  kinds,
  pick,
  onPick,
}: {
  tiles: readonly TileCount[];
  mode: CourtMode;
  kinds: { law: boolean; case: boolean };
  pick: PowerStatus | null;
  onPick: (s: PowerStatus | null) => void;
}) {
  const names = statusNames(mode);
  return (
    <div className="mb-3">
      <div className="mb-1.5 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-ink-faint">When each event happened</div>
      <div role="group" aria-label="Filter events by who held power" className="grid grid-cols-3 gap-2">
        {tiles.map((t) => {
          const on = pick === t.status;
          const parts = [kinds.law ? `${t.laws} law${t.laws === 1 ? "" : "s"}` : "", kinds.case ? `${t.cases} case${t.cases === 1 ? "" : "s"}` : ""].filter(Boolean).join(", ");
          return (
            <button
              key={t.status}
              type="button"
              aria-pressed={on}
              title={names[t.status].name}
              onClick={() => onPick(on ? null : t.status)}
              className={`flex min-w-0 flex-col gap-0.5 rounded-lg border border-t-[3px] px-2.5 pb-2 pt-1.5 text-left hover:bg-surface-raised max-sm:px-2 ${FOCUS_RING} ${on ? "bg-surface-raised" : "border-line bg-surface"}`}
              style={{ borderTopColor: STATUS_COLOR[t.status], boxShadow: on ? `inset 0 0 0 1.5px ${STATUS_COLOR[t.status]}` : undefined }}
            >
              <span className="font-serif text-[1.5rem] font-medium leading-none tabular-nums max-sm:text-[1.2rem]">{t.n}</span>
              <span className="text-[0.8rem] font-medium leading-tight text-ink max-sm:text-[0.72rem]">{names[t.status].short}</span>
              <span className="text-[0.72rem] tabular-nums text-ink-muted max-sm:text-[0.66rem]">
                {parts} · {Math.round(t.share * 100)}%
              </span>
              <span aria-hidden className="mt-1 block h-1 overflow-hidden rounded-sm bg-line">
                <i className="block h-full" style={{ width: `${t.share * 100}%`, background: STATUS_COLOR[t.status] }} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

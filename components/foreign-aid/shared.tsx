"use client";

import { LEGEND_ITEM, LEGEND_ROW } from "@/components/charts/legend";
import { TABLE_TOGGLE } from "@/components/charts/table-toggle";
import type { ReactNode } from "react";
import { SLOT_COUNT, SLOT_NAME, SLOT_VAR, sectorPhrase, slotsOfSectors } from "@/lib/foreign-aid-derive";
import { pickedCount } from "@/lib/multi-select";
import { LegendToggle } from "@/components/charts/LegendToggle";
import { useAidState } from "./ForeignAidState";

export const slotColor = (slot: number) => `var(${SLOT_VAR[slot]})`;

/** Hatch for partial years: surface-colored diagonals over the bar. Give each chart its own `id`. */
export function HatchDefs({ id }: { id: string }) {
  return (
    <defs>
      <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="6" style={{ stroke: "var(--surface)", strokeWidth: 2.2 }} />
      </pattern>
    </defs>
  );
}

/** Words for the sectors currently ticked (or null for all). */
export function useSectorLabel(): string | null {
  const { secs, data } = useAidState();
  return secs === null ? null : sectorPhrase(data, secs);
}

/**
 * Bottom legend for any chart colored by sector: the six slots, or just the filtered sector's slot.
 * `extra` adds chart-specific entries (partial year, term band).
 */
export function SectorLegend({ partial = false, only = null, onPick, children }: { partial?: boolean; only?: number | null; onPick?: (slot: number) => void; children?: ReactNode }) {
  const { secs, sole, data } = useAidState();
  const label = useSectorLabel();
  // How many of the ticked sectors share the neutral "Other" slot (every sector past the fifth).
  const others = pickedCount(secs, Array.from({ length: data.ns - (SLOT_COUNT - 1) }, (_, i) => SLOT_COUNT - 1 + i));
  const slots = slotsOfSectors(data, secs);
  return (
    <div className={`mt-2.5 ${LEGEND_ROW}`}>
      {slots.map((k) => {
        const inner = (
          <>
            <i className="inline-block h-[10px] w-[10px] rounded-[2px]" style={{ background: slotColor(k) }} />
            {sole !== null ? label : k === SLOT_COUNT - 1 ? `Other (${others} sector${others === 1 ? "" : "s"})` : SLOT_NAME[k]}
          </>
        );
        return onPick && sole === null ? (
          <LegendToggle key={k} active={only === k} dimmed={only !== null && only !== k} onClick={() => onPick(k)}>{inner}</LegendToggle>
        ) : (
          <span key={k} className={LEGEND_ITEM} title={k === SLOT_COUNT - 1 && secs === null ? "Multi-sector; democracy, human rights, and governance; education and social services; environment" : undefined}>{inner}</span>
        );
      })}
      {partial && (
        <span className={LEGEND_ITEM}>
          <i
            className="inline-block h-[10px] w-[10px] rounded-[2px] border border-line-strong"
            style={{ background: "repeating-linear-gradient(45deg, var(--ink-muted) 0 2px, transparent 2px 5px)" }}
          />
          Partial year
        </span>
      )}
      {children}
    </div>
  );
}

/** The table-view fallback every chart gets: native <details> around a scrollable table. */
export function TableView({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <details className="mt-3 text-[0.8rem] text-ink-muted">
      <summary className={TABLE_TOGGLE}>View as table</summary>
      <div className="mt-2 max-h-60 overflow-auto rounded-md border border-line">
        <table className="w-full min-w-[30rem] border-collapse text-right">
          <caption className="sr-only">{caption}</caption>
          {children}
        </table>
      </div>
    </details>
  );
}

export const TH = "sticky top-0 border-b border-line-strong bg-surface-raised px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.05em] text-ink-faint first:text-left";
export const TD = "border-b border-line px-2.5 py-1 font-mono text-ink first:text-left";

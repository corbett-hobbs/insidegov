import type { ReadoutLine } from "@/lib/line-readout";

/** One printed line of a multi-line readout: the shared `ReadoutLine` plus its legend key and an optional muted note under the value. */
export interface ReadoutRow<K extends string = string> extends ReadoutLine<K> {
  color: string;
  dash?: boolean;
  /** Muted text under the value, e.g. the same figure in the other unit ("123% of GDP"). */
  sub?: string | null;
}

/** The line's legend key: the same solid or dashed stroke the chart draws. */
export function LineKey({ color, dash }: { color: string; dash?: boolean }) {
  return (
    <svg width="20" height="8" aria-hidden className="shrink-0">
      <line x1="0" x2="20" y1="4" y2="4" stroke={color} strokeWidth="2" strokeDasharray={dash ? "4 3" : undefined} />
    </svg>
  );
}

/**
 * A card header's values for a multi-line chart: each visible line a peer row (its key, its name, its value) at one
 * size and weight, never a primary number with the other line demoted under it. Pass `readoutRows(...)`, so an isolated
 * line is the only row.
 */
export function HeaderReadout({ rows, valueClass = "text-[1.25rem]" }: { rows: readonly ReadoutRow[]; valueClass?: string }) {
  return (
    <div className="flex flex-col items-end gap-1">
      {rows.map((r) => (
        <div key={r.key} className="flex flex-col items-end">
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <LineKey color={r.color} dash={r.dash} />
            <span className="text-[0.75rem] text-ink-muted">{r.label}</span>
            <span className={`font-mono font-medium leading-tight tabular-nums text-ink ${valueClass}`}>{r.value ?? "—"}</span>
          </div>
          {r.sub && <div className="font-mono text-[0.8rem] text-ink-muted">{r.sub}</div>}
        </div>
      ))}
    </div>
  );
}

/** The same rows inside a chart tooltip: key and name left, value right, one weight for every line. */
export function TipReadout({ rows }: { rows: readonly ReadoutRow[] }) {
  return (
    <>
      {rows.map((r) => (
        <div key={r.key} className="flex flex-col">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5"><LineKey color={r.color} dash={r.dash} />{r.label}</span>
            <span className="font-mono text-[0.95rem] font-medium tabular-nums">{r.value ?? "—"}</span>
          </div>
          {r.sub && <div className="text-right opacity-75">{r.sub}</div>}
        </div>
      ))}
    </>
  );
}

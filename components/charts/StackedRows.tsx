"use client";

/**
 * A ranked list whose every row carries a stacked bar on one shared scale: rank, label, segments,
 * a total and a delta. The sibling of `SwarmRows` for composition instead of position (SwarmRows
 * draws dots on a shared axis and has no segment concept). HTML, not SVG, so long labels wrap on
 * phones. No entity knowledge: the caller supplies rows, colors and the formatted strings.
 *
 * Layout adapts to the list's own width (container query): five columns when wide, and under 400px
 * the bar drops to a second line and labels may wrap instead of truncating.
 */
import { useRef, type ReactNode } from "react";
import { selectedRowsKey, useScrollSelectedRow } from "./use-scroll-selected";

export interface StackedRowData {
  id: string;
  rank?: number;
  label: string;
  segments: { value: number; color: string; title?: string }[];
  total: string;
  /** Right-hand text, e.g. "+$3.5B" or "−1,204" (a plus or minus, "0" for no change). Leave it empty in every row to drop the column. */
  delta?: string;
  selected?: boolean;
  /** Fade the row (another row is selected). */
  dimmed?: boolean;
  /**
   * A cap the bar is measured against, on the same scale as `segments` (the refugee regions list: arrivals against the region's cap).
   * Draws a pale bar to `max` (lighter beyond `min` when it is a range) and a black tick at `max`; `null` means this row has no cap.
   * Any row carrying the field (even null) gives the list the wider last column, for text like "Cap 30,000–50,000".
   */
  cap?: { min: number; max: number } | null;
  /** This row opens to show `detail` under it (the trade products list: the top countries behind a product). Present only while open. */
  expandable?: boolean;
  detail?: ReactNode;
}

export function StackedRows({
  rows,
  scaleMax,
  onRowClick,
  ariaLabel,
  emptyText,
  rowClass = "",
  wideLabels = false,
}: {
  rows: readonly StackedRowData[];
  /** The value a full-width bar stands for. */
  scaleMax: number;
  onRowClick: (id: string) => void;
  ariaLabel: string;
  emptyText: string;
  /** Extra classes for each row's button (a fixed height, so the rows can line up with a companion chart). */
  rowClass?: string;
  /** Long labels (product names): a label column up to 260px instead of 118px, so names truncate far less often. Ranked rows with a delta only. */
  wideLabels?: boolean;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  useScrollSelectedRow(listRef, selectedRowsKey(rows));
  // No row has a second value (a delta, a military dollar figure): drop its column so the bar runs the full width.
  const hasDelta = rows.some((r) => !!r.delta);
  // No row has a rank (policy areas, issue areas): drop its column so labels start at the left edge and get the space back.
  const hasRank = rows.some((r) => r.rank !== undefined);
  // Rows with a cap carry text like "Cap 30,000–50,000" in the last column, so it is wider and the bar drops to its own line sooner.
  const hasCap = rows.some((r) => r.cap !== undefined);
  const cols = hasCap
    ? "grid-cols-[24px_minmax(86px,190px)_minmax(60px,1fr)_56px_118px]"
    : hasRank
    ? hasDelta ? (wideLabels ? "grid-cols-[24px_minmax(110px,260px)_minmax(60px,1fr)_50px_44px]" : "grid-cols-[24px_minmax(86px,118px)_minmax(60px,1fr)_50px_58px]") : "grid-cols-[24px_minmax(86px,118px)_minmax(60px,1fr)_56px]"
    : hasDelta ? "grid-cols-[minmax(86px,170px)_minmax(60px,1fr)_50px_58px]" : "grid-cols-[minmax(86px,170px)_minmax(60px,1fr)_56px]";
  const narrow = hasCap
    ? "@max-[560px]:grid-cols-[24px_1fr_auto_auto] @max-[560px]:gap-y-1"
    : hasRank
    ? hasDelta ? "@max-[400px]:grid-cols-[24px_1fr_auto_auto]" : "@max-[400px]:grid-cols-[24px_1fr_auto]"
    : hasDelta ? "@max-[400px]:grid-cols-[1fr_auto_auto]" : "@max-[400px]:grid-cols-[1fr_auto]";
  const barSpan = hasCap ? "@max-[560px]:col-[2/-1]" : hasRank ? "@max-[400px]:col-[2/-1]" : "@max-[400px]:col-[1/-1]";
  if (rows.length === 0) return <div className="px-2 py-10 text-center text-[0.82rem] text-ink-muted">{emptyText}</div>;
  return (
    <ul ref={listRef} aria-label={ariaLabel} className="@container m-0 list-none p-0">
      {rows.map((r) => (
        <li key={r.id}>
          <button
            type="button"
            onClick={() => onRowClick(r.id)}
            aria-pressed={r.expandable ? undefined : !!r.selected}
            aria-expanded={r.expandable ? !!r.detail : undefined}
            data-selected-row={r.selected ? "" : undefined}
            className={`grid w-full cursor-pointer ${cols} items-center gap-x-2 rounded-md border-0 px-2 py-1.5 text-left text-ink hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus ${narrow} ${hasCap ? "" : "@max-[400px]:gap-y-1"} ${
              r.selected ? "bg-[color-mix(in_oklab,var(--accent)_13%,var(--surface))]" : "bg-transparent"
            } ${r.dimmed ? "opacity-50" : ""} ${rowClass}`}
          >
            {hasRank && <span className="text-right font-mono text-[0.7rem] tabular-nums text-ink-faint">{r.rank ?? ""}</span>}
            <span
              title={r.label}
              className={`truncate text-[0.82rem] ${hasCap ? "@max-[560px]:whitespace-normal @max-[560px]:text-[0.85rem] @max-[560px]:leading-tight" : "@max-[400px]:whitespace-normal @max-[400px]:text-[0.85rem] @max-[400px]:leading-tight"} ${r.selected ? "font-semibold" : ""}`}
            >
              {r.label}
            </span>
            {hasCap ? (
              <span className={`relative h-[11px] rounded-[2px] bg-[color-mix(in_oklab,var(--ink)_5%,transparent)] @max-[560px]:order-last ${barSpan}`}>
                {r.cap && (
                  <i
                    aria-hidden
                    className="absolute inset-y-0 left-0 block"
                    style={{ width: `${(r.cap.max / scaleMax) * 100}%`, background: `color-mix(in oklab, var(--accent) ${r.cap.min === r.cap.max ? 16 : 9}%, var(--surface))` }}
                  />
                )}
                {r.cap && r.cap.min !== r.cap.max && (
                  <i aria-hidden className="absolute inset-y-0 left-0 block" style={{ width: `${(r.cap.min / scaleMax) * 100}%`, background: "color-mix(in oklab, var(--accent) 18%, var(--surface))" }} />
                )}
                {r.segments.map((s, i) =>
                  s.value > 0 ? <i key={i} title={s.title} className="absolute inset-y-0 left-0 block" style={{ width: `${(s.value / scaleMax) * 100}%`, background: s.color }} /> : null,
                )}
                {r.cap && <i aria-hidden className="absolute -inset-y-[2px] block w-[2px] bg-ink" style={{ left: `calc(${(r.cap.max / scaleMax) * 100}% - 2px)` }} />}
              </span>
            ) : (
              <span className={`flex h-[11px] overflow-hidden rounded-[2px] bg-[color-mix(in_oklab,var(--ink)_5%,transparent)] @max-[400px]:order-last ${barSpan}`}>
                {r.segments.map((s, i) =>
                  s.value > 0 ? <i key={i} title={s.title} className="block h-full" style={{ width: `${(s.value / scaleMax) * 100}%`, background: s.color }} /> : null,
                )}
              </span>
            )}
            <span className="text-right font-mono text-[0.75rem] tabular-nums">{r.total}</span>
            {(hasDelta || hasCap) && <span className="whitespace-nowrap text-left font-mono text-[0.7rem] tabular-nums text-ink-muted">{r.delta ?? ""}</span>}
          </button>
          {r.detail}
        </li>
      ))}
    </ul>
  );
}

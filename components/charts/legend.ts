/**
 * Legend rows are tight on purpose: small type, small gaps, and items that never break internally, so a legend
 * fills as few lines as possible (one where it fits) instead of spreading over two or three. Use these two
 * classes for every chart legend; see ARCHITECTURE_MAP "Page-level layout rules".
 */
export const LEGEND_ROW = "flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.7rem] leading-tight text-ink-muted";
export const LEGEND_ITEM = "inline-flex items-center gap-1 whitespace-nowrap";

/**
 * Same legend, capped at two lines tall below `sm`: the items flow down two rows and the row scrolls sideways, so the chart is
 * not pushed down the page by a legend that wraps to four lines. From `sm` it is the ordinary wrapping `LEGEND_ROW`. The same
 * pattern as the executive-order topic chips (`.neighbor-chip-row` carries the thin scrollbar).
 */
export const LEGEND_ROW_CAPPED =
  "neighbor-chip-row grid auto-cols-max grid-flow-col grid-rows-2 items-center gap-x-2.5 gap-y-1 overflow-x-auto pb-1 text-[0.7rem] leading-tight text-ink-muted sm:flex sm:flex-wrap sm:overflow-visible sm:pb-0";

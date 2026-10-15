import type { ReactNode } from "react";

/**
 * The row under every chart that holds its "Data notes" and "View as table"
 * disclosures side by side on one line. Children are `<details>` elements
 * (`MethodologyNote`, a table fallback); each keeps its summary in the row, and
 * the one that is open takes the full width and wraps beneath the other. Their
 * own top margins are zeroed here so the row sets the spacing. See
 * ARCHITECTURE_MAP "Page-level layout rules", rule 7a.
 */
export const NOTES_ROW =
  "mt-2 flex flex-wrap items-start gap-x-4 gap-y-1 [&>details]:mt-0 [&>details[open]]:w-full";

export function ChartNotesRow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`${NOTES_ROW} ${className}`.trim()}>{children}</div>;
}

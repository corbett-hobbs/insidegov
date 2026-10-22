"use client";

import { useState, type ReactNode } from "react";
import { ChartCard } from "@/components/charts/ChartCard";
import { CaseRow } from "@/components/decisions/CaseListCard";
import type { RelatedDecision } from "@/lib/decision-page-types";

/**
 * A card of other decisions (same issue, same term) with a "Landmark cases" checkbox top right. The lede is `${count} other argued case(s)${rest}`
 * so the count follows the box; `children` is the card's Data notes.
 */
export function RelatedCasesCard({ title, rest, cases, children }: { title: string; rest: string; cases: RelatedDecision[]; children: ReactNode }) {
  const [landmarkOnly, setLandmarkOnly] = useState(false);
  const shown = landmarkOnly ? cases.filter((r) => r.c[8] !== "") : cases;
  const n = shown.length;
  return (
    <ChartCard
      title={title}
      action={
        <label className="flex cursor-pointer items-center gap-2 text-[0.8rem] text-ink-muted" title="Only the cases on Wikipedia’s list of landmark decisions">
          <input type="checkbox" checked={landmarkOnly} onChange={(e) => setLandmarkOnly(e.target.checked)} className="h-4 w-4 cursor-pointer accent-[var(--accent)]" />
          Landmark cases
        </label>
      }
      lede={`${n} other ${landmarkOnly ? "landmark " : ""}argued case${n === 1 ? "" : "s"}${rest}`}
    >
      <div data-case-scroll tabIndex={0} aria-label={`${title}, scrollable`} className="touch-scroll max-h-[32rem] overflow-y-auto overflow-x-hidden overscroll-contain rounded-md border border-line">
        {n === 0 ? (
          <p className="m-0 p-4 text-[0.85rem] text-ink-muted">No landmark decisions among these.</p>
        ) : (
          <ol className="m-0 list-none p-0">
            {shown.map((r) => (
              <CaseRow key={r.c[14]} c={r.c} area={r.area} areaId={r.areaId} stacked outcome />
            ))}
          </ol>
        )}
      </div>
      {children}
    </ChartCard>
  );
}

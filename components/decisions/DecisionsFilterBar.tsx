"use client";

import { useMemo } from "react";
import { FILTER_LABEL, HelpTip } from "@/components/charts/FilterBarParts";
import { MultiSelectFilter, type MultiOption } from "@/components/charts/MultiSelectFilter";
import { RangeReset } from "@/components/charts/RangeReset";
import { RangeSelector } from "@/components/charts/RangeSelector";
import { TermBand } from "@/components/charts/TermBand";
import { fmtInt, presidentBandTerms, sumBucket, windowSum } from "@/lib/decisions-derive";
import { sameRange } from "@/lib/year-range";
import { useDecisionsActions, useDecisionsValues } from "./DecisionsState";
import { areaFill } from "./shared";

const LANDMARK_DEFINITION =
  "A landmark case is a Supreme Court decision that set a major precedent or changed how the law works; this filter uses Wikipedia's list of landmark decisions in the United States.";

/**
 * The pinned filter bar for /supreme-court/decisions, directly under the site navigation: the Issue area checkbox dropdown
 * (`MultiSelectFilter`: every area listed, largest first, with its cases in the years shown, so one can be left out), then
 * the Years-shown slider with the presidential-term band under its track (tinted by each president's party; there is no
 * President dropdown). Phones: Issue area is alone on its row, so its label sits
 * beside it (rule 5a); the slider row follows. The ticked areas are what a click on a row in card 3 or a legend entry in card 1 sets (just that one).
 */
export function DecisionsFilterBar() {
  const { data, range, areas, landmark } = useDecisionsValues();
  const { setRange, setAreas, setLandmark } = useDecisionsActions();
  const terms = useMemo(() => presidentBandTerms(data), [data]);
  const lo = data.terms[0];
  const hi = data.terms[data.terms.length - 1];
  const full = sameRange(range, [lo, hi]);
  // Every issue area, most cases first (in the years shown, landmark filter included), so each row says what ticking it adds.
  const options = useMemo<MultiOption<number>[]>(
    () =>
      data.areas
        .map((a, id) => ({ id, label: a.label, n: sumBucket(windowSum(data, id, range)) }))
        .sort((a, b) => b.n - a.n || a.id - b.id)
        .map((o) => ({ id: o.id, label: o.label, count: fmtInt(o.n), swatch: areaFill(data, o.id) })),
    [data, range],
  );
  return (
    <div data-pinned-bar className="sticky top-0 z-40 border-b border-line-strong bg-surface/95 shadow-[0_2px_6px_rgba(26,34,51,0.08)] backdrop-blur sm:shadow-none">
      <div className="mx-auto w-full max-w-[1180px] px-4 pb-2 pt-2 sm:px-6 sm:py-2.5">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-x-5">
          <div className="flex flex-none items-center gap-3 sm:pt-px">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
            <span className={FILTER_LABEL}>Issue area</span>
            <MultiSelectFilter label="Issue area" noun="issue areas" options={options} value={areas} onChange={setAreas} className="flex-1 sm:w-[10.5rem] sm:flex-none" />
          </div>
          <div className="flex flex-none items-center gap-1">
            <label className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap text-[0.8rem] text-ink">
              <input type="checkbox" checked={landmark} onChange={(e) => setLandmark(e.target.checked)} className="h-4 w-4 cursor-pointer accent-[var(--accent)]" />
              Landmark cases
            </label>
            <HelpTip label="What is a landmark case?" text={LANDMARK_DEFINITION} />
          </div>
          </div>
          <RangeSelector
            min={lo}
            max={hi}
            value={range}
            onChange={(r) => setRange(r)}
            format={String}
            ariaLabel="Years shown"
            below={<TermBand terms={terms} min={lo} max={hi} value={range} onChange={(r) => setRange(r)} />}
            action={<RangeReset show={!full} onReset={() => setRange([lo, hi])} className="mt-0.5 font-sans leading-none" />}
            className="min-w-0 sm:flex-1"
          />
        </div>
      </div>
    </div>
  );
}

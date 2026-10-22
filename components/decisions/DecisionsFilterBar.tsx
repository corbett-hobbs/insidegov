"use client";

import { useMemo } from "react";
import { PartyFilter } from "@/components/charts/PartyFilter";
import { BAND_COLORS, BAND_KEYS, BAND_SHORT, type DecisionDirection } from "@/lib/decisions-types";
import { FilterCaption } from "@/components/charts/FilterBarParts";
import { MultiSelectFilter, type MultiOption } from "@/components/charts/MultiSelectFilter";
import { RangeReset } from "@/components/charts/RangeReset";
import { RangeSelector } from "@/components/charts/RangeSelector";
import { TermBand } from "@/components/charts/TermBand";
import { fmtInt, presidentBandTerms, sumBucket, windowSum } from "@/lib/decisions-derive";
import { sameRange } from "@/lib/year-range";
import { useDecisionsActions, useDecisionsValues } from "./DecisionsState";
import { ISSUE_AREA_DESCRIPTIONS } from "@/lib/decisions-issue-areas";
import { areaFill } from "./shared";

const LANDMARK_DEFINITION =
  "A landmark case is a Supreme Court decision that set a major precedent or changed how the law works; this filter uses Wikipedia's list of landmark decisions in the United States.";

/**
 * The pinned filter bar for /supreme-court/decisions, directly under the site navigation, in the Laws bar's shape: the Issue area
 * checkbox dropdown (`MultiSelectFilter`: every area listed, largest first, with its cases in the years shown), the Vote dropdown
 * (the dissent bands, 9–0 to 5–4; the same filter card 2's legend and the list's pills set), the Outcome select (Liberal / Conservative,
 * SCDB's coding; narrows the list), then the Years-shown slider with the presidential-term band
 * under its track. Landmark cases is a checkbox inside the Issue area panel at every width (an accent dot on the dropdown while it is on), as
 * Major laws is on Laws. From `lg` the dropdowns share the left of the row with minimum widths so no label truncates and the slider takes the
 * rest (about half the bar from `xl`). Phones: Issue area, Vote and Outcome share a row (labels read by screen readers only), then the slider.
 */
export function DecisionsFilterBar() {
  const { data, range, areas, landmark, band, direction } = useDecisionsValues();
  const { setRange, setAreas, setLandmark, setBand, setDirection } = useDecisionsActions();
  const terms = useMemo(() => presidentBandTerms(data), [data]);
  const lo = data.terms[0];
  const hi = data.terms[data.terms.length - 1];
  const full = sameRange(range, [lo, hi]);
  // Every issue area, most cases first (in the years shown, landmark filter included), so each row says what ticking it adds.
  const options = useMemo<MultiOption<number>[]>(
    () =>
      data.areas
        .map((a, id) => ({ id, key: a.id, label: a.label, n: sumBucket(windowSum(data, id, range)) }))
        .sort((a, b) => b.n - a.n || a.id - b.id)
        .map((o) => ({ id: o.id, label: o.label, count: fmtInt(o.n), swatch: areaFill(data, o.id), info: ISSUE_AREA_DESCRIPTIONS[o.key] })),
    [data, range],
  );
  // Counts follow the issue area, the years and the landmark filter, not the vote itself, so each row says what ticking it would add.
  const voteOptions = useMemo<MultiOption<number>[]>(() => {
    const w = windowSum(data, areas, range);
    return BAND_KEYS.map((k) => ({ id: k, label: BAND_SHORT[k], swatch: BAND_COLORS[k], count: fmtInt(w[k]) }));
  }, [data, areas, range]);
  return (
    <div data-pinned-bar className="sticky top-0 z-40 border-b border-line-strong bg-surface/95 shadow-[0_2px_6px_rgba(26,34,51,0.08)] backdrop-blur sm:shadow-none">
      <div className="mx-auto w-full max-w-[1180px] px-4 pb-2 pt-2 sm:px-6 sm:py-2.5">
        <div className="flex flex-col gap-1.5 lg:flex-row lg:items-center lg:gap-x-4">
          <div className="flex flex-none flex-wrap items-center gap-x-1.5 gap-y-1.5 sm:gap-x-2.5 lg:flex-[1.3_1_0%] lg:flex-nowrap xl:flex-[1_1_0%]">
            <div className="flex min-w-0 flex-[1.5] basis-0 items-center gap-2 sm:max-w-[16rem] sm:flex-[1.5]">
              <FilterCaption>Issue area</FilterCaption>
              <MultiSelectFilter
                label="Issue area"
                noun="issue areas"
                options={options}
                value={areas}
                onChange={setAreas}
                dot={landmark ? "landmark cases only" : undefined}
                dotClassName=""
                footer={
                  <label className="flex cursor-pointer items-start gap-2 text-[0.8rem] text-ink">
                    <input type="checkbox" checked={landmark} onChange={(e) => setLandmark(e.target.checked)} className="m-0 mt-0.5 h-4 w-4 flex-none cursor-pointer accent-[var(--accent)]" />
                    <span>
                      Landmark cases only
                      <span className="block text-[0.72rem] leading-snug text-ink-muted">{LANDMARK_DEFINITION}</span>
                    </span>
                  </label>
                }
                className="flex-1 sm:min-w-[8.5rem]"
              />
            </div>
            <div className="flex min-w-0 flex-[1.1] basis-0 items-center gap-2 sm:max-w-[11rem] sm:flex-[0.9]">
              <FilterCaption>Vote</FilterCaption>
              <MultiSelectFilter label="Vote: how many justices dissented" noun="votes" allLabel="Any vote" options={voteOptions} value={band} onChange={setBand} className="flex-1 sm:min-w-[6.25rem]" />
            </div>
            <PartyFilter
              label="Outcome"
              ariaLabel="Outcome: who prevailed, as the Supreme Court Database codes it"
              allLabel="Any outcome"
              value={direction === null ? null : (String(direction) as "1" | "2")}
              onChange={(v) => setDirection(v === null ? null : (Number(v) as DecisionDirection))}
              options={[
                { id: "2", label: "Liberal" },
                { id: "1", label: "Conservative" },
              ]}
              className="flex-[1.25] basis-0 sm:max-w-[13.5rem] sm:flex-[1.2]"
              selectClassName="min-w-0 flex-1 sm:min-w-[8.25rem]"
            />
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
            className="min-w-0 lg:flex-[1_1_0%] xl:flex-[1.2_1_0%]"
          />
        </div>
      </div>
    </div>
  );
}

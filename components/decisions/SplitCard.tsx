"use client";

import { useState, type ReactNode } from "react";
import { useDecisionsActions } from "./DecisionsState";
import { ChartCard } from "@/components/charts/ChartCard";
import { LegendToggle } from "@/components/charts/LegendToggle";
import { LEGEND_ITEM, LEGEND_ROW } from "@/components/charts/legend";
import { PillGroup } from "@/components/charts/PillGroup";
import { MethodologyNote } from "@/components/MethodologyNote";
import { ChartNotesRow } from "@/components/charts/ChartNotesRow";
import { areaFilterLabel, bandShare, binByDecade, fmtInt, fmtPct, isSmallSample, splitGrain, sumBucket, windowCells, windowSum } from "@/lib/decisions-derive";
import { BAND_COLORS, BAND_LONG, BAND_SHORT, type SplitMode } from "@/lib/decisions-types";
import { isPicked, soleOf, toggleOnly } from "@/lib/multi-select";
import { SplitDecadeBars } from "./SplitDecadeBars";
import { SplitChart } from "./SplitChart";
import { useDecisionsValues } from "./DecisionsState";
import { Swatch, TableView } from "./shared";
import { useTakeawayContext } from "@/components/charts/ContextLine";
import { DECISIONS_TAKEAWAYS, contextFor } from "./takeaways";

/**
 * Card 2: how divided the Court is. The stacked area of `SplitChart`, a Share of cases / Number of cases toggle, and a
 * legend whose entries isolate a band (rule 12c): the pick draws that band alone from zero on its own axis and switches to
 * the count view; going back to Share clears it. Few-cases note when the topic is thin; the chart is never hidden.
 */
export function SplitCard({ jump }: { jump?: ReactNode }) {
  const { data, range, areas } = useDecisionsValues();
  const [mode, setModeRaw] = useState<SplitMode>("share");
  const { band } = useDecisionsValues();
  const iso = soleOf(band);
  const { setBand } = useDecisionsActions();
  // The picked band is the page's dissent filter: it also narrows card 1 and the case list (see DecisionsState).
  const setMode = (m: SplitMode) => {
    setModeRaw(m);
    if (m === "share") setBand(null);
  };
  const pick = (k: number) => {
    setBand(toggleOnly(band, k));
    setModeRaw("count");
  };

  const w = windowSum(data, areas, range);
  const total = sumBucket(w);
  const lo = range[0];
  const hi = range[1];
  const who = areaFilterLabel(data, areas);
  // The Data notes' opening: the shares for the selection shown (the takeaway describes the full default view).
  const summary = total
    ? `${who}, ${lo === hi ? lo : `${lo}–${hi}`}: ${fmtPct(bandShare(w, 0))} of ${fmtInt(total)} cases were unanimous and ${fmtPct(bandShare(w, 4))} split 5–4.`
    : "No cases in this selection.";
  const { terms, cells } = windowCells(data, areas, range);
  // Per term while a term has enough cases to read a share from; per decade once the selection is thin.
  const grain = splitGrain(data, areas, range);
  const small = isSmallSample(data, areas, range);

  const { takeaway, panel } = useTakeawayContext(DECISIONS_TAKEAWAYS.split.takeaway, contextFor("split"));

  return (
    <ChartCard
      id="how-divided-is-the-court"
      title={DECISIONS_TAKEAWAYS.split.title}
      takeaway={takeaway}
      action={
        <PillGroup
          ariaLabel="Split measure"
          value={mode}
          onChange={setMode}
          options={[
            { value: "share", label: "Share of cases" },
            { value: "count", label: "Number of cases" },
          ]}
        />
            }
    >
      {panel}
      {grain === "decade" ? <SplitDecadeBars mode={mode} /> : <SplitChart mode={mode} onIso={pick} />}
      <div className={`mt-2 ${LEGEND_ROW}`}>
        {[0, 1, 2, 3, 4].map((k) => (
          <LegendToggle key={k} active={iso === k} dimmed={!isPicked(band, k)} onClick={() => pick(k)}>
            <span className={LEGEND_ITEM}>
              <Swatch color={BAND_COLORS[k]} />
              {BAND_LONG[k]}
            </span>
          </LegendToggle>
        ))}
      </div>
      {grain === "decade" ? (
        <p className="m-0 mt-2 text-[0.78rem] leading-[1.45] text-ink-muted">Grouped by decade: this selection has few cases per term, so a single term&rsquo;s shares would swing widely.</p>
      ) : small ? (
        <p className="m-0 mt-2 text-[0.78rem] leading-[1.45] text-ink-muted">Few cases per term in this selection, so single-year shares swing widely. Read the trend, not individual years.</p>
      ) : null}
      <ChartNotesRow>
        <MethodologyNote>
          <p>
            {summary} Each band counts dissenting justices, not the full tally, so a 5&ndash;3 decision (eight justices sitting) lands in the 6&ndash;3 band. A selection with a median under 15 cases a term is grouped by decade automatically; the first and last decades are partial (1946&ndash;49 and 2020&ndash;25).
          </p>
        </MethodologyNote>
        <TableView
          label={`Table of cases by number of dissenting justices, per ${grain}`}
          head={[grain === "decade" ? "Decade" : "Term", "Cases", ...BAND_SHORT]}
          rows={grain === "decade" ? binByDecade(terms, cells).map((b) => [`${b.decade}s`, b.total, ...b.bucket]).reverse() : terms.map((t, i) => [t, sumBucket(cells[i]), ...cells[i]]).reverse()}
        />
        {jump}
      </ChartNotesRow>
    </ChartCard>
  );
}

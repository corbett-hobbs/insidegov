"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChartCard } from "@/components/charts/ChartCard";
import { LEGEND_ITEM, LEGEND_ROW } from "@/components/charts/legend";
import { ReversibleSortToggle } from "@/components/charts/SortToggle";
import { StackedRows, type StackedRowData } from "@/components/charts/StackedRows";
import { MethodologyNote } from "@/components/MethodologyNote";
import { ChartNotesRow } from "@/components/charts/ChartNotesRow";
import { areaRows, bandShare, fmtInt, fmtPct, nextAreaSort, topicTitle } from "@/lib/decisions-derive";
import { BAND_COLORS, BAND_LONG, BAND_SHORT, type AreaSort, type AreaSortKey } from "@/lib/decisions-types";
import { isOnly, isPicked, toggleOnly } from "@/lib/multi-select";
import { useDecisionsActions, useDecisionsValues } from "./DecisionsState";
import { DecadeHeatmap } from "./DecadeHeatmap";
import { Swatch, TableView } from "./shared";
import { DECISIONS_TAKEAWAYS } from "./takeaways";
import { SourceLink } from "@/components/SourceLink";

/** One toggle for the whole card: what the heatmap shades and how both charts order their rows. */
const SORTS: { key: AreaSortKey; label: string; hint: string }[] = [
  { key: "n", label: "Cases", hint: "Case counts in the heatmap; most cases first" },
  { key: "f", label: "5–4", hint: "Share that split 5–4 in the heatmap; largest first" },
  { key: "u", label: "Unanimous", hint: "Share that were unanimous in the heatmap; largest first" },
];

/**
 * Card 3: one row per topic, a 100% bar of the five dissent bands over the years in the window, case count at right
 * (a comparison chart, so a selection dims the other rows instead of removing them, rule 4). "All topics" is pinned
 * first. Clicking a row ticks just that topic in the pinned bar; clicking it again, or All, clears the filter.
 */
export function AreasCard({ jump }: { jump?: ReactNode }) {
  const { data, range, areas } = useDecisionsValues();
  const { setAreas } = useDecisionsActions();
  const [sort, setSort] = useState<AreaSort>({ key: "n", reversed: false });
  const rows = useMemo(() => areaRows(data, range, sort), [data, range, sort]);
  const stacked = useMemo<StackedRowData[]>(
    () =>
      rows.map((r) => ({
        id: r.id,
        label: r.label,
        labelTitle: topicTitle(data, r.id),
        total: fmtInt(r.total),
        selected: r.index >= 0 && isOnly(areas, r.index),
        dimmed: areas !== null && r.index >= 0 && !isPicked(areas, r.index),
        segments: [0, 1, 2, 3, 4].map((k) => ({
          value: bandShare(r.bucket, k),
          color: BAND_COLORS[k],
          title: `${r.label}: ${BAND_LONG[k]}, ${fmtPct(bandShare(r.bucket, k))} (${fmtInt(r.bucket[k])} of ${fmtInt(r.total)})`,
        })),
      })),
    [data, rows, areas],
  );
  const click = (id: string) => {
    const row = rows.find((r) => r.id === id);
    setAreas(!row || row.index < 0 ? null : toggleOnly(areas, row.index));
  };
  const lo = range[0];
  const hi = range[1];

  return (
    <ChartCard
      id="which-kinds-of-cases-split-the-court"
      title={DECISIONS_TAKEAWAYS.areas.title}
      takeaway={DECISIONS_TAKEAWAYS.areas.takeaway}
      action={
        <ReversibleSortToggle
          ariaLabel="Sort topics"
          options={SORTS}
          active={sort.key}
          reversed={sort.reversed}
          onSelect={(k) => setSort((cur) => nextAreaSort(cur, k))}
        />
      }
    >
      <div className="grid gap-x-8 gap-y-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <DecadeHeatmap rows={rows} measure={sort.key} />
        <div className="min-w-0">
          <p className="mb-2 mt-0 text-[0.78rem] text-ink-muted">{`Years shown: ${lo === hi ? lo : `${lo}\u2013${hi}`}`}</p>
          <div className={`mb-2 ${LEGEND_ROW}`}>
            {[0, 1, 2, 3, 4].map((k) => (
              <span key={k} className={LEGEND_ITEM}>
                <Swatch color={BAND_COLORS[k]} />
                {BAND_LONG[k]}
              </span>
            ))}
          </div>
          {/* Phones scroll the rows inside a fixed-height box (rule 11a); from `lg` all of them show (15 rows is not a long list). */}
          <div className="relative max-h-[28rem] overflow-y-auto overscroll-contain touch-scroll lg:max-h-none lg:overflow-visible" tabIndex={0} aria-label="Topics, one row each">
            <StackedRows rows={stacked} scaleMax={1} onRowClick={click} ariaLabel="Topics by number of dissenting justices" emptyText="No cases in these years." />
          </div>
        </div>
      </div>
      <ChartNotesRow>
        <MethodologyNote>
          <p>
            Left: how many cases, how many split 5&ndash;4 or how many were unanimous in each decade, for each of our {data.areas.length} topics. Right: how many justices dissented, in the years shown. The topics are our grouping, not the database&rsquo;s: each case goes to one, by the <SourceLink id="scdb">Supreme Court Database</SourceLink>&rsquo;s issue code or the law the case turned on, else its issue area, with a short hand-picked list of LGBTQ cases. The {fmtInt(data.unclassified)} cases with no issue area count only in &ldquo;All topics&rdquo;. Shares for small topics swing on a few cases.
          </p>
        </MethodologyNote>
        <TableView
          label="Table of topics by number of dissenting justices"
          head={["Topic", "Cases", ...BAND_SHORT]}
          rows={rows.map((r) => [r.label, r.total, ...r.bucket])}
        />
        {jump}
      </ChartNotesRow>
    </ChartCard>
  );
}

"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChartCard } from "@/components/charts/ChartCard";
import { LegendToggle } from "@/components/charts/LegendToggle";
import { LEGEND_ITEM, LEGEND_ROW } from "@/components/charts/legend";
import { PillGroup } from "@/components/charts/PillGroup";
import { StackedBars, type StackColumn, type StackSeries } from "@/components/charts/StackedBars";
import { MethodologyNote } from "@/components/MethodologyNote";
import { ChartNotesRow } from "@/components/charts/ChartNotesRow";
import { areaFilterLabel, areaSeries, presidentSegments, fmtInt, sumPicked, bandsPhrase, windowIndexes } from "@/lib/decisions-derive";
import { type Bucket } from "@/lib/decisions-types";
import { isPicked, samePick } from "@/lib/multi-select";
import { useDecisionsActions, useDecisionsTermSelect, useDecisionsValues } from "./DecisionsState";
import { Swatch, TableView, TooltipCard, chiefLine, topicFill } from "./shared";
import { useTakeawayContext } from "@/components/charts/ContextLine";
import { DECISIONS_TAKEAWAYS, contextFor } from "./takeaways";

interface Col extends StackColumn {
  term: number;
  all: number;
}

type Mode = "count" | "share";

/**
 * Card 1: argued cases decided per term, stacked by topic (all twelve, largest at the bottom, each in its own colour), narrowed by the
 * years window, the topic and the dissent band picked on card 2 (rule 4). Legend entries filter: a click picks that
 * issue area for the whole page (the dropdown's value) and a second click clears it. Peak and low are re-picked from what
 * is drawn (rule 12), the presidential-term band runs under the axis (rule 10j), and the crosshair and pin are shared with card 2.
 */
export function CasesCard({ jump }: { jump?: ReactNode }) {
  const { data, range, areas, band, direction, hover, pin } = useDecisionsValues();
  const { moveHover, leaveHover, togglePin, clearPin, setAreas } = useDecisionsActions();
  const [mode, setMode] = useState<Mode>("count");
  const every = useMemo(() => areaSeries(data), [data]);
  // The series drawn: each ticked topic, plus the cases with no issue area while nothing is filtered, so a bar is the whole term.
  const ticked = useMemo(() => new Map(every.map((s) => [s.id, s.areas.filter((i) => isPicked(areas, i))])), [every, areas]);
  const series = useMemo<StackSeries[]>(
    () => every.filter((s) => (s.id === "other" ? areas === null : ticked.get(s.id)!.length > 0)).map((s) => ({ id: s.id, label: s.label, fill: topicFill(s.id) })),
    [every, ticked, areas],
  );

  const { terms, cols } = useMemo(() => {
    const [a, b] = windowIndexes(data, range);
    const val = (bk: Bucket) => sumPicked(bk, band);
    const rows: Col[] = [];
    for (let ti = a; ti <= b; ti++) {
      const values: Record<string, number> = {};
      for (const s of series) values[s.id] = s.id === "other" ? val(data.other[ti]) : ticked.get(s.id)!.reduce((n, i) => n + val(data.by[i][ti]), 0);
      const total = series.reduce((t, s) => t + values[s.id], 0);
      rows.push({ key: String(data.terms[ti]), label: String(data.terms[ti]), term: data.terms[ti], total, values, denom: val(data.all[ti]), all: val(data.all[ti]) });
    }
    return { terms: rows.map((r) => r.term), cols: rows };
  }, [data, range, band, series, ticked, areas]);

  const segs = useMemo(() => presidentSegments(data, terms), [data, terms]);
  const termSelect = useDecisionsTermSelect(terms);
  const first = cols[0];
  const last = cols[cols.length - 1];
  // The Data notes' opening: the selection's first and last term, which the takeaway (about the full default view) leaves out.
  const span =
    cols.length === 0
      ? ""
      : cols.length === 1
        ? `: ${fmtInt(first.total)} in the ${first.term} term`
        : `: ${fmtInt(first.total)} in ${first.term} and ${fmtInt(last.total)} in ${last.term} for the selection shown`;
  const filters = [areas !== null ? `Topic: ${areaFilterLabel(data, areas)}.` : "", band !== null ? `Only cases decided ${bandsPhrase(band)}.` : "", direction !== null ? `Only ${direction === 2 ? "liberal" : "conservative"} outcomes.` : ""].filter(Boolean).join(" ");
  const filtered = areas !== null;

  const { takeaway, panel } = useTakeawayContext(DECISIONS_TAKEAWAYS.cases.takeaway, contextFor("cases"));

  return (
    <ChartCard
      id="how-many-cases-does-the-court-decide"
      title={DECISIONS_TAKEAWAYS.cases.title}
      takeaway={takeaway}
      action={
        <PillGroup
          ariaLabel="Cases measure"
          value={mode}
          onChange={setMode}
          options={[
            { value: "count", label: "Number of cases" },
            { value: "share", label: "Share of term" },
          ]}
        />
      }
    >
      {panel}
      {series.length === 0 ? (
        <p className="m-0 rounded-md border border-dashed border-line-strong p-4 text-[0.82rem] text-ink-muted">No topic is ticked. Tick one in the filter bar, or choose All.</p>
      ) : (
      <StackedBars
        columns={cols}
        series={series}
        mode={mode}
        highlight={null}
        selectedKey={pin === null ? null : String(pin)}
        onSelect={(k) => (k === null ? clearPin() : togglePin(Number(k)))}
        selectedStyle="line"
        fitShare
        markShare={filtered}
        terms={segs}
        termSelect={termSelect}
        activeKey={hover === null ? null : String(hover)}
        onActive={(k) => (k === null ? leaveHover() : moveHover(Number(k)))}
        yearTicks
        marginTop={20}
        unit="cases decided"
        ariaLabel="Stacked bar chart of the number of argued cases the Supreme Court decided, one bar per term, by topic"
        renderTooltip={(c) => (
          <TooltipCard title={`${c.term} term`} sub={chiefLine(data, c.term)}>
            <div>
              {fmtInt(c.total)} cases{band !== null ? ` decided ${bandsPhrase(band)}` : " decided"}
              {filtered && c.all ? ` (${Math.round((c.total / c.all) * 100)}% of the term)` : ""}
            </div>
            {[...series].reverse().map((s) =>
              (c.values[s.id] ?? 0) > 0 ? (
                <div key={s.id}>
                  <Swatch color={s.fill} /> {s.label}: {fmtInt(c.values[s.id])}
                </div>
              ) : null,
            )}
          </TooltipCard>
        )}
      />
      )}
      <div className={`mt-2 ${LEGEND_ROW}`}>
        {every.map((s) =>
          s.id === "other" ? (
            areas === null && (
              <span key={s.id} className={LEGEND_ITEM}>
                <Swatch color={topicFill(s.id)} />
                {s.label}
              </span>
            )
          ) : (
            <LegendToggle key={s.id} active={samePick(areas, new Set(s.areas))} dimmed={areas !== null && !s.areas.some((ai) => isPicked(areas, ai))} onClick={() => setAreas(samePick(areas, new Set(s.areas)) ? null : new Set(s.areas))}>
              <span className={LEGEND_ITEM}>
                <Swatch color={topicFill(s.id)} />
                {s.label}
              </span>
            </LegendToggle>
          ),
        )}
      </div>
      {filters && <p className="m-0 mt-2 text-[0.78rem] leading-[1.45] text-ink-muted">{filters}</p>}
      <ChartNotesRow>
        <MethodologyNote>
          <p>
            Orally argued cases, counted in the term decided (October to June){span}. Summary reversals and the {fmtInt(data.unclearVotes)} cases with an unclear vote are left out. Each topic has its own colour, largest at the bottom; the {fmtInt(data.unclassified)} cases with no issue area coded are grey and drop out when a topic is picked.
          </p>
        </MethodologyNote>
        <TableView
          label="Table of cases decided per term, by topic"
          head={["Term", "Cases", ...series.map((s) => s.label)]}
          rows={[...cols].reverse().map((c) => [c.term, c.total, ...series.map((s) => c.values[s.id] ?? 0)])}
        />
        {jump}
      </ChartNotesRow>
    </ChartCard>
  );
}


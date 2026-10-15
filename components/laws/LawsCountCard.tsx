"use client";

import { useMemo, useState } from "react";
import { ChartCard } from "@/components/charts/ChartCard";
import { LegendToggle } from "@/components/charts/LegendToggle";
import { LEGEND_ITEM, LEGEND_ROW } from "@/components/charts/legend";
import { PillGroup } from "@/components/charts/PillGroup";
import { StackedBars, type StackColumn, type StackSeries } from "@/components/charts/StackedBars";
import { Swatch, TableView, TooltipCard } from "@/components/decisions/shared";
import { MethodologyNote } from "@/components/MethodologyNote";
import { ChartNotesRow } from "@/components/charts/ChartNotesRow";
import { ordinal } from "@/lib/demographics-chart";
import { fmtInt } from "@/lib/decisions-derive";
import { bandsPhrase, cellFor, filterLabel, openYear, seriesOf, signedMostSegments } from "@/lib/laws-derive";
import { isOnly, isPicked, toggleOnly } from "@/lib/multi-select";
import { EmptyWindow, congressSub, congressTitle, congressYears, controlRowsFor, groupFills } from "./shared";
import { useLawsActions, useLawsValues } from "./LawsState";

interface Col extends StackColumn {
  ci: number;
  congress: number;
  all: number;
}

type Mode = "count" | "share";

/**
 * Card 1: public laws enacted per Congress, stacked by topic group, narrowed by the years window, the policy area, "major
 * laws only" and the support bands (rule 4). A legend entry picks that policy area alone for the whole page (the
 * filter bar's ticks); a second click clears it. The in-progress Congress is hatched and left out of the peak and low labels,
 * the president under each bar signed most of that Congress's laws, and the House / Senate strips show on request.
 */
export function LawsCountCard() {
  const { data, groups, major, bands, control, window: win, hover, pin } = useLawsValues();
  const { moveHover, leaveHover, togglePin, clearPin, setGroups } = useLawsActions();
  const [mode, setMode] = useState<Mode>("count");
  const every = useMemo(() => seriesOf(data), [data]);
  const fillOf = useMemo(() => groupFills(data), [data]);

  // One series per ticked topic group.
  const series = useMemo<(StackSeries & { groups: string[] })[]>(
    () => every.filter((s) => isPicked(groups, s.id)).map((s) => ({ id: s.id, label: s.label, fill: fillOf.get(s.id)!, groups: s.groups })),
    [groups, every, fillOf],
  );

  const cols = useMemo<Col[]>(() => {
    const rows: Col[] = [];
    const pick = (n: number, by: readonly number[]) => (bands === null ? n : by.reduce((t, v, k) => t + (bands.has(k) ? v : 0), 0));
    for (let ci = win[0]; ci <= win[1]; ci++) {
      const values: Record<string, number> = {};
      for (const s of series) {
        const c = cellFor(data, ci, new Set(s.groups), major);
        values[s.id] = pick(c.n, c.bands);
      }
      const all = cellFor(data, ci, null, major);
      rows.push({
        key: String(data.congresses[ci]),
        label: String(openYear(data.congresses[ci]!)),
        ci,
        congress: data.congresses[ci]!,
        total: series.reduce((t, s) => t + values[s.id]!, 0),
        values,
        denom: pick(all.n, all.bands),
        all: pick(all.n, all.bands),
      });
    }
    return rows;
  }, [data, win, bands, major, series]);

  const segs = useMemo(() => signedMostSegments(data, cols.map((c) => c.ci)), [data, cols]);
  const partialKeys = useMemo(() => new Set(cols.filter((c) => data.partial[c.ci]).map((c) => c.key)), [cols, data]);
  const ctl = controlRowsFor(data, control, win[0], win[1]);

  const noun = `${major ? "major " : ""}laws`;
  const done = cols.filter((c) => !partialKeys.has(c.key));
  const first = cols[0];
  const last = done[done.length - 1] ?? cols[cols.length - 1];
  const windowTotal = cols.reduce((t, c) => t + c.total, 0);
  const lede = !first
    ? ""
    : groups === null && bands === null && !major
      ? cols.length === 1
        ? `${fmtInt(first.total)} laws enacted by the ${ordinal(first.congress)} Congress (${congressYears(data, first.ci)}).`
        : `${fmtInt(first.total)} laws enacted by the ${ordinal(first.congress)} Congress (${congressYears(data, first.ci)}), ${fmtInt(last.total)} by the ${ordinal(last.congress)} (${congressYears(data, last.ci)}).`
      : `${fmtInt(windowTotal)} ${noun} in these years${groups === null ? "" : `: ${filterLabel(data, groups).toLowerCase()}`}${bands === null ? "" : `, ${bandsPhrase(bands)}`}.${major ? ` Major laws are assessed through the ${ordinal(data.majorThrough)} Congress.` : ""}`;
  const filtered = groups !== null || bands !== null || major;
  const ncByCongress = data.counts.map((row) => row.reduce((t, n, ai) => t + (data.areas[ai]!.group === "not-classified" ? n : 0), 0));
  const notClassified = ncByCongress.reduce((a, b) => a + b, 0);
  const lastCongress = data.congresses[data.congresses.length - 1]!;

  return (
    <ChartCard
      title="How many laws does Congress pass?"
      lede={lede || "No laws in this selection."}
      action={
        <PillGroup
          ariaLabel="Laws measure"
          value={mode}
          onChange={setMode}
          options={[
            { value: "count", label: "Number of laws" },
            { value: "share", label: "Share of Congress" },
          ]}
        />
      }
    >
      {cols.length === 0 ? (
        <EmptyWindow majorThrough={data.majorThrough} />
      ) : series.length === 0 ? (
        <p className="m-0 rounded-md border border-dashed border-line-strong p-4 text-[0.82rem] text-ink-muted">No policy area is ticked. Tick one in the filter bar, or choose All.</p>
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
          controlRows={ctl}
          partialKeys={partialKeys}
          slotYears={2}
          activeKey={hover === null ? null : String(hover)}
          onActive={(k) => (k === null ? leaveHover() : moveHover(Number(k)))}
          yearTicks
          marginTop={20}
          unit="laws enacted"
          ariaLabel="Stacked bar chart of the public laws enacted, one bar per Congress, by policy area"
          renderTooltip={(c) => (
            <TooltipCard title={congressTitle(data, c.ci)} sub={congressSub(data, c.ci)}>
              <div>
                {fmtInt(c.total)} {noun}
                {bands !== null ? ` ${bandsPhrase(bands)}` : ""}
                {filtered && groups !== null && c.all ? ` (${Math.round((c.total / c.all) * 100)}% of the Congress)` : ""}
              </div>
              {[...series].reverse().map((s) =>
                (c.values[s.id] ?? 0) > 0 ? (
                  <div key={s.id}>
                    <Swatch color={s.fill} /> {s.label}: {fmtInt(c.values[s.id]!)}
                  </div>
                ) : null,
              )}
            </TooltipCard>
          )}
        />
      )}
      <div className={`mt-2 ${LEGEND_ROW}`}>
        {every.map((s) => (
          <LegendToggle key={s.id} active={isOnly(groups, s.id)} dimmed={groups !== null && !isPicked(groups, s.id)} onClick={() => setGroups(toggleOnly(groups, s.id))}>
            <span className={LEGEND_ITEM}>
              <Swatch color={fillOf.get(s.id)!} />
              {s.label}
            </span>
          </LegendToggle>
        ))}
      </div>
      <ChartNotesRow>
        <MethodologyNote>
          <p>
            A law&rsquo;s policy area is the single area Congress.gov assigns its bill, grouped here into {every.filter((s) => s.id !== "not-classified").length} colour-coded topics. &ldquo;Commemorations&rdquo; is our own grouping, applied the same way in every year: Congress.gov filed it there, or its title designates a day, week or year, names a building or landmark, awards a medal or coin, or approves a memorial. Laws from the 93rd&ndash;95th Congresses without a current area were placed by InsideGov from their titles{notClassified > 0 ? `; ${fmtInt(notClassified)} recent laws not yet classified show as “Not classified”` : ""}. The {ordinal(lastCongress)} Congress is in session, so its bar is partial (hatched) and excluded from the peak and low labels.
          </p>
        </MethodologyNote>
        <TableView
          label="Table of laws enacted per Congress, by topic group"
          head={["Congress", "Opened", "Laws", ...series.map((s) => s.label)]}
          rows={[...cols].reverse().map((c) => [ordinal(c.congress), openYear(c.congress), c.total, ...series.map((s) => c.values[s.id] ?? 0)])}
        />
      </ChartNotesRow>
    </ChartCard>
  );
}

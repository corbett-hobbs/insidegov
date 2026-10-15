"use client";

import { useMemo, useState } from "react";
import { ChartCard } from "@/components/charts/ChartCard";
import { LegendToggle } from "@/components/charts/LegendToggle";
import { LEGEND_ITEM, LEGEND_ROW } from "@/components/charts/legend";
import { PillGroup } from "@/components/charts/PillGroup";
import { CaucusLines, type CaucusLine } from "./CaucusLines";
import { StackedBars, type StackColumn, type StackSeries } from "@/components/charts/StackedBars";
import { fmtShare } from "@/lib/chart-bars";
import { MethodologyNote } from "@/components/MethodologyNote";
import { ChartNotesRow } from "@/components/charts/ChartNotesRow";
import { congressSpan, presidentById, readoutRow, termSegmentsFor, type WomenMeasure } from "@/lib/demographics-chart";
import type { DemoCongress, DemoPresident } from "@/lib/demographics-types";
import { CongressReadout, Swatch, TableView, TooltipCard } from "./shared";

interface Col extends StackColumn {
  row: DemoCongress;
}
type Caucus = "D" | "R" | "O";
const SERIES: (StackSeries & { k: Caucus; men?: boolean })[] = [
  { id: "D", k: "D", label: "Democratic women", fill: "var(--dem)" },
  { id: "R", k: "R", label: "Republican women", fill: "var(--rep)" },
  { id: "O", k: "O", label: "Other women", fill: "var(--oth)" },
  // Men fill the rest of the 100% bar, in a light tint of the caucus colour.
  {
    id: "MD",
    k: "D",
    men: true,
    label: "Democratic men",
    fill: "color-mix(in srgb, var(--dem) 28%, var(--surface))",
    labelFill: "var(--ink)",
  },
  {
    id: "MR",
    k: "R",
    men: true,
    label: "Republican men",
    fill: "color-mix(in srgb, var(--rep) 28%, var(--surface))",
    labelFill: "var(--ink)",
  },
  {
    id: "MO",
    k: "O",
    men: true,
    label: "Other men",
    fill: "color-mix(in srgb, var(--oth) 28%, var(--surface))",
    labelFill: "var(--ink)",
  },
];

const PARTY_LINES: CaucusLine[] = [
  { k: "D", label: "Democrats", color: "var(--dem)" },
  { k: "R", label: "Republicans", color: "var(--rep)" },
  { k: "ALL", label: "All members", color: "var(--ink-faint)", dash: "4 3" },
];
/** Women as a share of a caucus's own members (or of everyone, for "ALL"); null for an empty group. */
const partyShare = (r: DemoCongress, k: string) => {
  const women = k === "ALL" ? womenTotal(r) : r.women[k as Caucus];
  const seats = k === "ALL" ? r.seats : r.seatsBy[k as Caucus];
  return seats ? women / seats : null;
};

const womenTotal = (r: DemoCongress) => r.women.D + r.women.R + r.women.O;

export function WomenCard({ rows, presidents, pin, onPin }: { rows: readonly DemoCongress[]; presidents: readonly DemoPresident[]; pin: number | null; onPin: (c: number | null) => void }) {
  const [mode, setModeRaw] = useState<WomenMeasure>("count");
  const [hl, setHl] = useState<string | null>(null);
  // Picking a series draws it alone, from zero, as a count; going back to Share clears the pick (rule 12c).
  const setMode = (m: WomenMeasure) => {
    setModeRaw(m);
    if (m !== "count") setHl(null);
  };
  const pick = (id: string) => {
    setHl((cur) => (cur === id ? null : id));
    setModeRaw("count");
  };
  const by = presidentById(presidents);
  // "Other" is drawn (and listed) only when someone in the years shown is neither a Democrat nor a Republican.
  const series = useMemo(() => (rows.some((r) => r.seatsBy.O > 0) ? SERIES : SERIES.filter((s) => s.k !== "O")), [rows]);
  // Count: the women alone. Share: every member, women then men, so each bar adds to 100%.
  const countSeries = useMemo(() => series.filter((s) => !s.men), [series]);
  const shown = mode === "share" ? series : countSeries;
  const cols = useMemo<Col[]>(
    () =>
      rows.map((r) => {
        const values = {
          D: r.women.D,
          R: r.women.R,
          O: r.women.O,
          MD: r.seatsBy.D - r.women.D,
          MR: r.seatsBy.R - r.women.R,
          MO: r.seatsBy.O - r.women.O,
        };
        return {
          key: String(r.congress),
          label: String(r.year),
          total: mode === "share" ? r.seats : womenTotal(r),
          values,
          row: r,
        };
      }),
    [rows, mode],
  );
  const segs = useMemo(() => termSegmentsFor(rows, presidents), [rows, presidents]);
  const cur = readoutRow(rows, pin);
  const overall = cur ? fmtShare(womenTotal(cur) / (cur.seats || 1)) : "";
  // Per party: each party's own share beside its count, the overall share once on the date line. Otherwise the overall share closes the line.
  const line = cur && {
    values:
      mode === "party"
        ? [`Dem. ${cur.women.D} (${fmtShare(partyShare(cur, "D") ?? 0)})`, `Rep. ${cur.women.R} (${fmtShare(partyShare(cur, "R") ?? 0)})`, ...(cur.women.O ? [`Other ${cur.women.O}`] : [])]
        : [`Dem. ${cur.women.D}`, `Rep. ${cur.women.R}`, ...(cur.women.O ? [`Other ${cur.women.O}`] : [])],
    suffix: mode === "party" ? undefined : `(${overall} of members)`,
    date: mode === "party" ? `${overall} of all members · ${congressSpan(cur)}` : congressSpan(cur),
    term: by.get(cur.termId)?.president,
  };
  return (
    <ChartCard
      title="How many members are women?"
      lede="Women in each Congress by caucus: how many, their share of all members (the rest are men), or their share of each party’s own members."
      action={
        <PillGroup
          ariaLabel="Women measure"
          value={mode}
          onChange={setMode}
          options={[
            { value: "count", label: "Number" },
            { value: "share", label: "Share of all" },
            { value: "party", label: "Share of party" },
          ]}
        />
      }
    >
      <CongressReadout line={line} pinned={pin !== null && !!cur && cur.congress === pin} onClear={() => onPin(null)} />
      {mode === "party" ? (
        <CaucusLines
          rows={rows}
          presidents={presidents}
          pin={pin}
          onPin={onPin}
          lines={PARTY_LINES}
          value={partyShare}
          fmt={(v) => fmtShare(v ?? 0)}
          fmtAxis={(v) => `${Math.round(v * 100)}%`}
          domain={(_, hi) => [0, hi * 1.1]}
          detail={(r, k) => `· ${k === "ALL" ? womenTotal(r) : r.women[k as Caucus]} of ${k === "ALL" ? r.seats : r.seatsBy[k as Caucus]}`}
          ariaLabel="Line chart of women as a share of each caucus's members and of all members, one point per Congress"
        />
      ) : (
        <>
          <StackedBars
            columns={cols}
            series={shown}
            mode={mode}
            highlight={hl}
            selectedKey={pin === null ? null : String(pin)}
            onSelect={(k) => onPin(k === null ? null : Number(k))}
            selectedStyle="line"
            unit={mode === "share" ? "members" : "women"}
            terms={segs}
            ariaLabel="Stacked bar chart of women in Congress by caucus, one bar per Congress"
            renderTooltip={(c) => (
              <TooltipCard title={congressSpan(c.row)} sub={by.get(c.row.termId)?.president ? `${by.get(c.row.termId)?.president} was president for most of it` : undefined}>
                <div>
                  Women: {womenTotal(c.row)} of {c.row.seats} members ({fmtShare(womenTotal(c.row) / (c.row.seats || 1))})
                </div>
                {shown.map((s) => (
                  <div key={s.id}>
                    <Swatch color={s.fill} /> {s.label}: {c.values[s.id]}
                    {mode === "share" ? ` (${fmtShare(c.values[s.id] / (c.row.seats || 1))})` : ""}
                  </div>
                ))}
              </TooltipCard>
            )}
          />
          <div className={`mt-2 ${LEGEND_ROW}`}>
            {shown.map((s) =>
              s.men ? (
                <span key={s.id} className={LEGEND_ITEM}>
                  <Swatch color={s.fill} />
                  {s.label}
                </span>
              ) : (
                <LegendToggle key={s.id} active={hl === s.id} dimmed={hl !== null && hl !== s.id} onClick={() => pick(s.id)}>
                  <span className={LEGEND_ITEM}>
                    <Swatch color={s.fill} />
                    {s.label}
                  </span>
                </LegendToggle>
              ),
            )}
          </div>
        </>
      )}
      <ChartNotesRow>
        <MethodologyNote>
          <p>A Congress has more members than the chambers have seats because replacements are counted. The source records gender as male or female only.</p>
        </MethodologyNote>
        <TableView
          head={["Congress", "Years", "Members", "Women", "Share", "Dem. women", "Rep. women", "Other women"]}
          rows={[...rows].reverse().map((r) => [`${r.congress}th`, `${r.year}–${r.year + 1}`, r.seats, womenTotal(r), fmtShare(womenTotal(r) / (r.seats || 1)), r.women.D, r.women.R, r.women.O])}
        />
      </ChartNotesRow>
    </ChartCard>
  );
}

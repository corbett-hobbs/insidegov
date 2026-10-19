"use client";

import { useMemo } from "react";
import { ChartCard } from "@/components/charts/ChartCard";
import { LEGEND_ITEM, LEGEND_ROW } from "@/components/charts/legend";
import { StackedBars, type StackColumn, type StackSeries } from "@/components/charts/StackedBars";
import { fmtShare } from "@/lib/chart-bars";
import type { ChamberView } from "@/lib/chamber";
import { MethodologyNote } from "@/components/MethodologyNote";
import { ChartNotesRow } from "@/components/charts/ChartNotesRow";
import { PARTY_NAME, congressSpan, presidentById, readoutRow, sliceOf, termSegmentsFor, type PartyPick } from "@/lib/demographics-chart";
import { TENURE_LABELS, type DemoCongress, type DemoPresident } from "@/lib/demographics-types";
import { useCongressTermSelect } from "./TermWindowContext";
import { MemberList, type RosterState } from "./MemberList";
import { CongressReadout, Swatch, TableView, TooltipCard } from "./shared";
import { DEMO_TAKEAWAYS } from "./takeaways";

interface Col extends StackColumn {
  row: DemoCongress;
}
const SERIES: StackSeries[] = TENURE_LABELS.map((label, i) => ({ id: `t${i}`, label, fill: `var(--tenure-${i + 1})` }));
const valuesOf = (r: DemoCongress, party: PartyPick) => Object.fromEntries(sliceOf(r, party).tenure.map((n, i) => [`t${i}`, n]));

export function TenureCard({ rows, presidents, pin, onPin, view, roster, party }: { rows: readonly DemoCongress[]; presidents: readonly DemoPresident[]; pin: number | null; onPin: (c: number | null) => void; view: ChamberView; roster: RosterState; party: PartyPick }) {
  const by = presidentById(presidents);
  const cols = useMemo<Col[]>(() => rows.map((r) => ({ key: String(r.congress), label: String(r.year), total: sliceOf(r, party).seats, values: valuesOf(r, party), row: r })), [rows, party]);
  const termSelect = useCongressTermSelect(rows);
  const segs = useMemo(() => termSegmentsFor(rows, presidents), [rows, presidents]);
  const cur = readoutRow(rows, pin);
  const now = cur && sliceOf(cur, party);
  const line = cur && now && {
    values: TENURE_LABELS.map((l, i) => `${l} ${fmtShare(now.tenure[i] / (now.seats || 1))}`),
    suffix: party ? `(${PARTY_NAME[party]})` : undefined,
    date: congressSpan(cur),
    term: by.get(cur.termId)?.president,
  };
  return (
    <ChartCard title={DEMO_TAKEAWAYS.tenure.title} takeaway={DEMO_TAKEAWAYS.tenure.takeaway[view]}>
      <CongressReadout line={line} pinned={pin !== null && !!cur && cur.congress === pin} onClear={() => onPin(null)} />
      <StackedBars
        columns={cols}
        series={SERIES}
        mode="share"
        highlight={null}
        selectedKey={pin === null ? null : String(pin)}
        onSelect={(k) => onPin(k === null ? null : Number(k))}
        selectedStyle="line"
        fitShare
        unit="members"
        terms={segs}
        termSelect={termSelect}
        ariaLabel="Stacked bar chart of members by Congresses served, one bar per Congress"
        renderTooltip={(c) => (
          <TooltipCard title={congressSpan(c.row)} sub={by.get(c.row.termId)?.president}>
            {party && <div>{PARTY_NAME[party]}: {sliceOf(c.row, party).seats} members</div>}
            {TENURE_LABELS.map((l, i) => (
              <div key={l}>
                <Swatch color={SERIES[i].fill} /> {l}: {fmtShare(sliceOf(c.row, party).tenure[i] / (sliceOf(c.row, party).seats || 1))} ({sliceOf(c.row, party).tenure[i]})
              </div>
            ))}
          </TooltipCard>
        )}
      />
      <div className={`mt-2 ${LEGEND_ROW}`}>
        {SERIES.map((s) => (
          <span key={s.id} className={LEGEND_ITEM}>
            <Swatch color={s.fill} />
            {s.label}
          </span>
        ))}
      </div>
      <MemberList {...roster} row={cur} rows={rows} view={view} order="tenure" party={party} onPin={onPin} />
      <ChartNotesRow>
        <MethodologyNote>
          <p>
            Each bar groups a Congress&rsquo;s members by years served, counting that Congress: every Congress served in either chamber, gaps and service before 1933 included, at two years each (up to 2 years is a first Congress, 3&ndash;10 years is two to five). Every bar is 100%, of everyone or of the party picked above.
          </p>
        </MethodologyNote>
        <TableView
          head={["Congress", "Years", "Members", ...TENURE_LABELS.map((l) => `${l} (share)`)]}
          rows={[...rows].reverse().map((r) => [`${r.congress}th`, `${r.year}–${r.year + 1}`, sliceOf(r, party).seats, ...sliceOf(r, party).tenure.map((n) => fmtShare(n / (sliceOf(r, party).seats || 1)))])}
        />
      </ChartNotesRow>
    </ChartCard>
  );
}

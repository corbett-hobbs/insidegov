"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChartCard } from "@/components/charts/ChartCard";
import { MethodologyNote } from "@/components/MethodologyNote";
import { ChartNotesRow } from "@/components/charts/ChartNotesRow";
import { SLOT_NAME, changeVsPrior, formatAidMoney, spendingByYear } from "@/lib/foreign-aid-derive";
import { useAidState } from "./ForeignAidState";
import { SpendingChart } from "./SpendingChart";
import { CardReadout, SectorLegend, TD, TH, TableView, useSectorLabel } from "./shared";
import { useTakeawayContext } from "@/components/charts/ContextLine";
import { AID_TAKEAWAYS, contextFor } from "./takeaways";

/** "How much the U.S. spends": the stacked-bar time series and everything that explains it. */
export function SpendingCard({ jump }: { jump?: ReactNode }) {
  const { data, year, range, country, secs, sole, isPartial } = useAidState();
  const sectorLabel = useSectorLabel();
  const rows = useMemo(() => spendingByYear(data, range[0], range[1], country, secs), [data, range, country, secs]);
  const [only, setOnly] = useState<number | null>(null);
  const shown = useMemo(() => (only === null || sole !== null ? rows : rows.map((r) => { const slots = r.slots.map((v, k) => (k === only ? v : 0)); return { ...r, slots, drawn: Math.max(0, slots[only]) }; })), [rows, only, sole]);
  const cur = rows.find((r) => r.fy === year);
  const change = changeVsPrior(data, year, country, secs);
  const showing = [country >= 0 ? data.payload.countries[country].name : null, sectorLabel].filter(Boolean);
  const anyPartial = rows.some((r) => isPartial(r.fy));

  const readout = (
    <>
      FY{year} · <b className="font-semibold text-ink">{formatAidMoney(cur?.total ?? 0)}</b>
      {isPartial(year) && " · partial year"}
      {change !== null && ` · ${change > 0 ? "+" : change < 0 ? "−" : ""}${Math.abs(Math.round(change * 100))}% vs. FY${year - 1}`} · nominal dollars
    </>
  );

  const { takeaway, panel } = useTakeawayContext(AID_TAKEAWAYS.spending, contextFor("spending"));
  return (
    <ChartCard
      id="how-much-the-u-s-spends"
      title="How much the U.S. spends"
      takeaway={takeaway}
      action={showing.length > 0 ? <span className="rounded-md border border-line-strong bg-surface-raised px-2 py-0.5 text-[0.75rem] text-ink">Showing {showing.join(" · ")}</span> : undefined}
    >
      {panel}
      <CardReadout>{readout}</CardReadout>
      <SpendingChart rows={shown} />
      <SectorLegend partial={anyPartial} only={sole === null ? only : null} onPick={(k) => setOnly((c) => (c === k ? null : k))} />
      <ChartNotesRow>
        <MethodologyNote>
          <p>
            Disbursements each fiscal year in nominal dollars, to every country and to global and regional programs, stacked by sector. Band under the axis: administration in office for most of the year (<span style={{ color: "var(--rep)" }}>■</span> Republican <span style={{ color: "var(--dem)" }}>■</span> Democratic).
          </p>
        </MethodologyNote>
        <TableView caption="Disbursements by fiscal year and sector">
          <thead>
            <tr>
              <th className={TH}>Fiscal year</th>
              <th className={TH}>Total</th>
              {sole === null && SLOT_NAME.map((s) => <th key={s} className={TH}>{s}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.fy}>
                <td className={TD}>
                  FY{r.fy}
                  {isPartial(r.fy) ? " (partial)" : ""}
                </td>
                <td className={TD}>{formatAidMoney(r.total)}</td>
                {sole === null && r.slots.map((v, k) => <td key={k} className={TD}>{formatAidMoney(v)}</td>)}
              </tr>
            ))}
          </tbody>
        </TableView>
        {jump}
      </ChartNotesRow>
    </ChartCard>
  );
}

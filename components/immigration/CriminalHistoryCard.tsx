"use client";

import { useState } from "react";
import { ChartCard } from "@/components/charts/ChartCard";
import { LEGEND_ITEM, LEGEND_ROW } from "@/components/charts/legend";
import { PillGroup } from "@/components/charts/PillGroup";
import { MethodologyNote } from "@/components/MethodologyNote";
import { TABLE_TOGGLE } from "@/components/charts/table-toggle";
import type { Criminality } from "@/lib/enforcement-entities";
import { CRIM_ORDER, convictedOrPendingShare, type AgencyView, type Measure } from "@/lib/immigration-breakdown";
import type { ImmigrationPageData } from "@/lib/immigration-derive";
import { CRIM_COLOR, CRIM_LABEL, CriminalHistoryChart } from "./CriminalHistoryChart";

const n = (v: number) => v.toLocaleString("en-US");

const LEDE: Record<AgencyView, string> = {
  all: "Criminal history, as ICE had it on record, of the people ICE removed. Choose who arrested them to see only the people ICE’s own officers arrested, or only those Border Patrol arrested and handed to ICE (FY2017 on).",
  ice: "Removals of people ICE’s own officers first arrested, FY2017–FY2024, with the criminal history ICE had on record.",
  cbp: "Removals of people Border Patrol first arrested and handed to ICE, FY2017–FY2024, with the criminal history ICE had on record. A large share have no known record.",
};

/**
 * "Criminal history of those removed": ICE removals by criminal history on the removals chart's year slots. Two
 * pick-one controls in the site's pill chrome: who first arrested the person (all, ICE, Border Patrol) and counts or
 * shares. The three views share one fixed count scale, so heights compare as the view changes. FY2025 is a single
 * combined convicted-or-pending bar (dashed, preliminary).
 */
export function CriminalHistoryCard({
  data,
  range,
  fy,
  onFy,
}: {
  data: ImmigrationPageData;
  range: readonly [number, number];
  fy: number;
  onFy: (fy: number) => void;
}) {
  const [view, setView] = useState<AgencyView>("all");
  const [measure, setMeasure] = useState<Measure>("counts");
  const years = data.years.filter((y) => y.fy >= range[0] && y.fy <= range[1]);
  const pending = range[1] >= data.lastFy;
  const bars = data.criminality.views[view];
  const firstBarFy = bars[0].fy;
  const shownBars = bars.filter((b) => b.fy >= range[0] && b.fy <= range[1]);
  const present = CRIM_ORDER.filter((k) => shownBars.some((b) => b.parts.some((p) => p.key === k)));
  const share = measure === "share";

  return (
    <ChartCard
      title="Criminal history of those removed"
      lede={`${LEDE[view]} ${share ? "Each bar is a share of its own total, labelled with the share who had a conviction or pending charges." : "Heights share one scale across the three choices."}`}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <span id="crim-agency-label" className="text-[0.8rem] text-ink-muted">
              Arrested by
            </span>
            <PillGroup<AgencyView>
              labelledBy="crim-agency-label"
              value={view}
              onChange={setView}
              options={[
                { value: "all", label: "All" },
                { value: "ice", label: "ICE" },
                { value: "cbp", label: "Border Patrol" },
              ]}
            />
          </div>
          <PillGroup<Measure>
            ariaLabel="Counts or shares"
            value={measure}
            onChange={setMeasure}
            options={[
              { value: "counts", label: "Counts" },
              { value: "share", label: "Share" },
            ]}
          />
        </div>
      }
    >
      <div className={`${LEGEND_ROW} mb-2`}>
        {present.map((k: Criminality) => (
          <span key={k} className={LEGEND_ITEM}>
            <i aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: CRIM_COLOR[k] }} />
            {CRIM_LABEL[k]}
          </span>
        ))}
        {shownBars.some((b) => b.status === "preliminary") && (
          <span className={LEGEND_ITEM}>
            <i aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm border border-dashed border-ink" />
            Preliminary
          </span>
        )}
      </div>

      <CriminalHistoryChart
        years={years}
        terms={data.terms}
        bars={bars}
        view={view}
        measure={measure}
        yMax={data.criminality.yMax}
        pending={pending}
        pendingFy={data.lastFy + 1}
        firstBarFy={firstBarFy}
        selectedFy={fy}
        onSelectFy={onFy}
      />

      <MethodologyNote>
        <p>
          Criminal history is as recorded in ICE systems at the time of the enforcement action; convictions include immigration crimes. &ldquo;No known record&rdquo; is not a finding about the person: people who have just crossed the border usually have no U.S. record, and nearly all FY2023&ndash;FY2024 &ldquo;no known record&rdquo; removals were Border Patrol handoffs. ICE does not print the Border Patrol view; it is the year&rsquo;s total minus ICE&rsquo;s own arrests. ICE reports only convicted versus not convicted through FY2015 (share labels then show convicted only). FY2025 is preliminary, from a DHS budget document, with one combined figure. Years with no ICE figure are blank, not zero.
        </p>
      </MethodologyNote>

      <details className="mt-3 text-[0.8rem] text-ink-muted">
        <summary className={TABLE_TOGGLE}>View as table</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-left">
            <caption className="sr-only">{`ICE removals by criminal history: ${view === "all" ? "all removals" : view === "ice" ? "first arrested by ICE" : "first arrested by Border Patrol (derived)"}`}</caption>
            <thead>
              <tr className="border-b border-line-strong text-[0.7rem] uppercase tracking-[0.06em] text-ink-faint">
                <th className="py-1.5 pr-3 font-medium">Fiscal year</th>
                {present.map((k) => (
                  <th key={k} className="py-1.5 pr-3 text-right font-medium">
                    {CRIM_LABEL[k].replace(/ \(.*\)$/, "")}
                  </th>
                ))}
                <th className="py-1.5 pr-3 text-right font-medium">Total</th>
                <th className="py-1.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {shownBars.map((b) => (
                <tr key={b.fy} className="border-b border-line">
                  <th scope="row" className="py-1.5 pr-3 font-mono font-medium text-ink">{`FY${b.fy}`}</th>
                  {present.map((k) => {
                    const p = b.parts.find((x) => x.key === k);
                    return (
                      <td key={k} className="py-1.5 pr-3 text-right font-mono text-ink">
                        {p ? (share ? `${Math.round((p.value / b.denominator) * 100)}%` : n(p.value)) : "—"}
                      </td>
                    );
                  })}
                  <td className="py-1.5 pr-3 text-right font-mono text-ink">{share ? `${Math.round(convictedOrPendingShare(b) * 100)}% convicted or pending` : n(b.total)}</td>
                  <td className="py-1.5">{b.status === "final" ? "Final" : "Preliminary"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </ChartCard>
  );
}

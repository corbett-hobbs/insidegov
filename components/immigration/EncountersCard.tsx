"use client";

import { useMemo, useState } from "react";
import { ChartCard } from "@/components/charts/ChartCard";
import { ChartNotesRow } from "@/components/charts/ChartNotesRow";
import { LEGEND_ITEM, LEGEND_ROW_CAPPED } from "@/components/charts/legend";
import { LegendToggle, useIsolate } from "@/components/charts/LegendToggle";
import { PillGroup } from "@/components/charts/PillGroup";
import { TABLE_TOGGLE } from "@/components/charts/table-toggle";
import { MethodologyNote } from "@/components/MethodologyNote";
import { ENCOUNTER_SERIES, USBP_ONLY_COLOR, markerGroups, monthsLabel, windowYears, type EncounterSeriesKey } from "@/lib/encounters-chart";
import type { EncounterScopeKey, EncountersPayload } from "@/lib/encounters-types";
import { EncountersChart } from "./EncountersChart";

const n = (v: number) => v.toLocaleString("en-US");
const SCOPE_NAME: Record<EncounterScopeKey, string> = { nationwide: "All borders", southwest: "Southwest border" };

/**
 * "Border encounters by fiscal year" (CBP): the section's first card, directly above the ICE removals chart. Bars are stacked
 * Border Patrol apprehensions / port-of-entry inadmissibles / Title 42 expulsions; an All borders / Southwest border pill
 * switches the scope, and a legend entry draws one series from zero. Shows the page's year window, plus the in-progress newest
 * year when the window reaches ICE's newest year. CBP only: never added to, subtracted from or divided by an ICE figure.
 */
export function EncountersCard({
  payload,
  range,
  iceLastFy,
  removals,
  activeFy,
  onActiveFy,
}: {
  payload: EncountersPayload;
  range: readonly [number, number];
  iceLastFy: number;
  removals: ReadonlyMap<number, number>;
  activeFy: number | null;
  onActiveFy: (fy: number | null) => void;
}) {
  const [scope, setScope] = useState<EncounterScopeKey>("nationwide");
  const [only, toggleOnly] = useIsolate<EncounterSeriesKey>();
  const years = useMemo(() => windowYears(payload.years, range, iceLastFy), [payload.years, range, iceLastFy]);
  const termsById = new Map(payload.terms.map((t) => [t.termId, t]));
  const prelim = years.find((y) => y.preliminary);
  const hasBpOnly = years.some((y) => y.detail === "usbp_only");
  const anyMarker = markerGroups(payload.markers, years[0].fy, years.length, 40, 0).length > 0;
  const shownSeries = ENCOUNTER_SERIES.filter((s) => s.key === "usbp" || years.some((y) => y[scope][s.key] !== null));
  const lede = `CBP’s count of encounters at the border each year: people Border Patrol caught away from official crossings, people turned away at official crossings, and people expelled under the COVID-19 health order (Title 42). Each is an event, not a person. ${SCOPE_NAME[scope]}${prelim ? `; FY${prelim.fy} is preliminary: ${monthsLabel(prelim.months)}` : ""}.`;
  const toggle = (
    <PillGroup<EncounterScopeKey>
      ariaLabel="Border shown"
      value={scope}
      onChange={setScope}
      options={[
        { value: "nationwide", label: SCOPE_NAME.nationwide },
        { value: "southwest", label: SCOPE_NAME.southwest },
      ]}
    />
  );
  return (
    <ChartCard title="Border encounters by fiscal year" lede={lede} action={toggle}>
      <div className={`${LEGEND_ROW_CAPPED} mb-2`}>
        {shownSeries.map((s) => (
          <LegendToggle key={s.key} active={only === s.key} dimmed={only !== null && only !== s.key} onClick={() => toggleOnly(s.key)}>
            <i aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            {s.name}
          </LegendToggle>
        ))}
        {hasBpOnly && (
          <span className={LEGEND_ITEM}>
            <i aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: USBP_ONLY_COLOR }} />
            Border Patrol only (no figures for official crossings)
          </span>
        )}
        {prelim && (
          <span className={LEGEND_ITEM}>
            <i aria-hidden className="inline-block h-[10px] w-3 rounded-[1px] border border-line-strong" style={{ background: "repeating-linear-gradient(45deg, var(--ink-muted) 0 2px, transparent 2px 5px)" }} />
            Preliminary, may be revised
          </span>
        )}
        {anyMarker && (
          <span className={LEGEND_ITEM}>
            <i aria-hidden className="inline-block h-2.5 w-3.5 rounded-full bg-ink" />
            Change in what CBP counts, select for detail
          </span>
        )}
      </div>

      <EncountersChart
        years={years}
        terms={payload.terms}
        markers={payload.markers}
        notes={payload.notes}
        scope={scope}
        only={only}
        removals={removals}
        activeFy={activeFy}
        onActiveFy={onActiveFy}
      />

      <ChartNotesRow>
        <MethodologyNote>
          <p>
            CBP only. An encounter is an event, not a person: someone caught twice counts twice, and CBP publishes no yearly count of unique people. Bars add Border Patrol apprehensions between ports of entry (the official crossings), people who came to a port and were found inadmissible, meaning not allowed in, by CBP’s Office of Field Operations (from FY2004; FY2004–FY2014 are DHS statistics, rounded to tens), and Title 42 expulsions (March 2020 to May 2023). Most encounters end with CBP and never reach ICE, so this is not a count of removals or of people who entered. The 1980s and 1990s peaks counted mostly Mexican adults given voluntary return, a different mix from today&rsquo;s. Source: CBP and DHS Office of Homeland Security Statistics.
          </p>
        </MethodologyNote>
        <details className="mt-3 text-[0.8rem] text-ink-muted">
          <summary className={TABLE_TOGGLE}>View as table</summary>
          <div className="mt-2 max-h-[24rem] overflow-auto">
            <table className="w-full min-w-[46rem] border-collapse text-left">
              <caption className="sr-only">{`CBP border encounters by fiscal year, ${SCOPE_NAME[scope].toLowerCase()}, by Border Patrol apprehensions, port-of-entry inadmissibles and Title 42 expulsions. A dash means not published.`}</caption>
              <thead>
                <tr className="border-b border-line-strong text-[0.7rem] uppercase tracking-[0.06em] text-ink-faint">
                  <th className="py-1.5 pr-3 font-medium">Fiscal year</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Encounters</th>
                  {ENCOUNTER_SERIES.map((s) => (
                    <th key={s.key} className="py-1.5 pr-3 text-right font-medium">
                      {s.short}
                    </th>
                  ))}
                  <th className="py-1.5 pr-3 font-medium">Status</th>
                  <th className="py-1.5 font-medium">Administration</th>
                </tr>
              </thead>
              <tbody>
                {[...years].reverse().map((y) => {
                  const p = y[scope];
                  return (
                    <tr key={y.fy} className="border-b border-line align-top">
                      <th scope="row" className="py-1.5 pr-3 font-mono font-medium text-ink">{`FY${y.fy}`}</th>
                      <td className="py-1.5 pr-3 text-right font-mono text-ink">{n(p.total)}</td>
                      {ENCOUNTER_SERIES.map((s) => (
                        <td key={s.key} className="py-1.5 pr-3 text-right font-mono text-ink">{p[s.key] === null ? "—" : n(p[s.key]!)}</td>
                      ))}
                      <td className="py-1.5 pr-3">
                        {y.preliminary ? `Preliminary, ${monthsLabel(y.months)}` : "Final"}
                        {y.detail === "usbp_only" ? ", Border Patrol only" : y.ofoRounded ? ", ports rounded" : ""}
                      </td>
                      <td className="py-1.5">{y.blended ? y.days.map((d) => `${d.last} ${d.days} days`).join(" · ") : (termsById.get(y.termId)?.president ?? "")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      </ChartNotesRow>
    </ChartCard>
  );
}

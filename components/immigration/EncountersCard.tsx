"use client";

import { useMemo } from "react";
import { ChartCard } from "@/components/charts/ChartCard";
import { ChartNotesRow } from "@/components/charts/ChartNotesRow";
import { LEGEND_ITEM, LEGEND_ROW_CAPPED } from "@/components/charts/legend";
import { LegendToggle, useIsolate } from "@/components/charts/LegendToggle";
import { TABLE_TOGGLE } from "@/components/charts/table-toggle";
import { MethodologyNote } from "@/components/MethodologyNote";
import { ENCOUNTER_SERIES, USBP_ONLY_COLOR, markerGroups, monthsLabel, windowYears, type EncounterSeriesKey } from "@/lib/encounters-chart";
import type { EncounterScopeKey, EncountersPayload } from "@/lib/encounters-types";
import { EncountersChart } from "./EncountersChart";
import { SourceLink } from "@/components/SourceLink";
import { IMMIGRATION_TAKEAWAYS } from "./takeaways";

const n = (v: number) => v.toLocaleString("en-US");
// Every CBP encounter, nationwide. The southwest-only series is in the data but not offered: what counts as "the southwest border" is unclear to a reader.
const scope: EncounterScopeKey = "nationwide";

/**
 * "Border encounters by fiscal year" (CBP): the section's first card, directly above the ICE removals chart. Bars are stacked
 * Border Patrol apprehensions / port-of-entry inadmissibles / Title 42 expulsions; a legend entry draws one series
 * from zero (no scope toggle). Shows the page's year window, plus the in-progress newest
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
  const [only, toggleOnly] = useIsolate<EncounterSeriesKey>();
  const years = useMemo(() => windowYears(payload.years, range, iceLastFy), [payload.years, range, iceLastFy]);
  const termsById = new Map(payload.terms.map((t) => [t.termId, t]));
  const prelim = years.find((y) => y.preliminary);
  const hasBpOnly = years.some((y) => y.detail === "usbp_only");
  const anyMarker = markerGroups(payload.markers, years[0].fy, years.length, 40, 0).length > 0;
  const shownSeries = ENCOUNTER_SERIES.filter((s) => s.key === "usbp" || years.some((y) => y[scope][s.key] !== null));
  return (
    <ChartCard title="Border encounters by fiscal year" takeaway={IMMIGRATION_TAKEAWAYS.encounters.takeaway}>
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
            CBP&rsquo;s count of encounters each year, nationwide, including airports and seaports: people Border Patrol caught away from official crossings, people turned away at official crossings, and people expelled under the COVID-19 health order (Title 42). CBP only. Each count is an event, not a person: someone caught twice counts twice, and CBP publishes no yearly count of unique people. What happens to the person afterwards is not in this chart; most encounters end with CBP and never reach ICE, so this is not a count of removals or of people who entered.{prelim ? ` FY${prelim.fy} is preliminary: ${monthsLabel(prelim.months)}.` : ""}
          </p>
          <p>
            The two big bars measure different things. Border Patrol counts everyone it catches between ports of entry (the official crossings), which is where anyone crossing without permission has to cross. The port bar counts only people CBP officers at a crossing found inadmissible, meaning not allowed in; the many people admitted there are not counted, so a small port bar does not mean few people use ports. Port figures begin in FY2004 (FY2004–FY2014 from DHS, rounded to tens). Title 42 expulsions ran March 2020 to May 2023. The 1980s and 1990s peaks were mostly Mexican adults given voluntary return, a different mix from today&rsquo;s. Source: <SourceLink id="cbp-encounters">CBP</SourceLink> and <SourceLink id="ohss-cbp-encounters">DHS Office of Homeland Security Statistics</SourceLink>.
          </p>
        </MethodologyNote>
        <details className="mt-3 text-[0.8rem] text-ink-muted">
          <summary className={TABLE_TOGGLE}>View as table</summary>
          <div className="mt-2 max-h-[24rem] overflow-auto">
            <table className="w-full min-w-[46rem] border-collapse text-left">
              <caption className="sr-only">{`CBP border encounters by fiscal year, by Border Patrol apprehensions, port-of-entry inadmissibles and Title 42 expulsions. A dash means not published.`}</caption>
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

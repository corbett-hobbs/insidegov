"use client";

import { useMemo } from "react";
import { ChartCard } from "@/components/charts/ChartCard";
import { LEGEND_ITEM, LEGEND_ROW_CAPPED } from "@/components/charts/legend";
import { LegendToggle, useIsolate } from "@/components/charts/LegendToggle";
import { PillGroup } from "@/components/charts/PillGroup";
import { TABLE_TOGGLE } from "@/components/charts/table-toggle";
import { MethodologyNote } from "@/components/MethodologyNote";
import { ChartNotesRow } from "@/components/charts/ChartNotesRow";
import { LPR_GROUPS, LPR_REGION_STACK, lprMarkers, regionsByFy, type LprGroupKey, type LprMetric } from "@/lib/lpr-chart";
import { LPR_CLASS_NAME, LPR_CLASS_STACK, type LprPayload, type LprRegionKey, type LprYear } from "@/lib/lpr-types";
import { LprChart } from "./LprChart";
import { GROUP_COLOR, REGION_COLOR } from "./lpr-style";
import { n } from "./refugee-style";
import { SourceLink } from "@/components/SourceLink";
import { useTakeaway } from "./ContextLine";

/**
 * "Green cards and citizenships by fiscal year": the green-card bars stacked by class of admission, with a Green cards /
 * Naturalizations pill toggle (the same control the country card uses) that swaps the one chart. The two are different people in
 * the same year, so they are never drawn together or added. The legend entries are the class filter: click one to draw only that
 * class from zero. The shown years are the page's window; the selected year is shared with the country card below.
 */
export function LprGreenCardCard({
  payload,
  years,
  fy,
  onFy,
  metric,
  onMetric,
}: {
  payload: LprPayload;
  years: readonly LprYear[];
  fy: number;
  onFy: (fy: number) => void;
  metric: LprMetric;
  onMetric: (m: LprMetric) => void;
}) {
  const [only, toggleOnly] = useIsolate<LprGroupKey>();
  const [onlyRegion, toggleRegion] = useIsolate<LprRegionKey>();
  const nat = metric === "naturalizations";
  const prelim = years.some((y) => y.preliminary);
  const termsById = new Map(payload.terms.map((t) => [t.termId, t]));
  const regions = useMemo(() => regionsByFy(payload, "naturalizations"), [payload]);
  const presentRegions = LPR_REGION_STACK.filter((r) => years.some((y) => (regions.get(y.fy)?.[r.key] ?? 0) > 0));
  const markers = useMemo(() => lprMarkers(payload.notes, metric, years[0].fy, years[years.length - 1].fy, prelim), [payload.notes, metric, years, prelim]);
  const cur = years.find((y) => y.fy === fy) ?? years[years.length - 1];
  const share = cur.classes ? Math.round((cur.classes.immediate_relatives / cur.lpr) * 100) : null;
  const toggle = (
    <PillGroup<LprMetric>
      ariaLabel="Count shown"
      value={metric}
      onChange={onMetric}
      options={[
        { value: "lpr", label: "Green cards" },
        { value: "naturalizations", label: "Naturalizations" },
      ]}
    />
  );
  const context = useTakeaway(nat ? "naturalizations" : "greenCards");
  return (
    <ChartCard title="Green cards and citizenships by fiscal year" takeaway={context.takeaway} action={toggle}>
      {context.panel}
      <div className={`${LEGEND_ROW_CAPPED} mb-2`}>
        {nat
          ? presentRegions.map((r) => (
              <LegendToggle key={r.key} active={onlyRegion === r.key} dimmed={onlyRegion !== null && onlyRegion !== r.key} onClick={() => toggleRegion(r.key)}>
                <i aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: REGION_COLOR[r.key] }} />
                {r.short}
              </LegendToggle>
            ))
          : LPR_GROUPS.map((g) => (
              <LegendToggle key={g.key} active={only === g.key} dimmed={only !== null && only !== g.key} onClick={() => toggleOnly(g.key)}>
                <i aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: GROUP_COLOR[g.key] }} />
                {g.name}
              </LegendToggle>
            ))}
        {!nat && years.some((y) => !y.classes) && (
          <span className={LEGEND_ITEM}>
            <i aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--ink-faint)", opacity: 0.55 }} />
            Total only (not split by class before FY{payload.firstDetailFy})
          </span>
        )}
        {nat && years.some((y) => !regions.get(y.fy)) && (
          <span className={LEGEND_ITEM}>
            <i aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--ink-faint)", opacity: 0.55 }} />
            Total only (continent not published)
          </span>
        )}
        {prelim && (
          <span className={LEGEND_ITEM}>
            <i aria-hidden className="inline-block h-[10px] w-3 rounded-[1px] border border-line-strong" style={{ background: "repeating-linear-gradient(45deg, var(--ink-muted) 0 2px, transparent 2px 5px)" }} />
            Preliminary, may be revised
          </span>
        )}
        {markers.length > 0 && (
          <span className={LEGEND_ITEM}>
            <i aria-hidden className="inline-block h-2.5 w-3.5 rounded-full bg-ink" />
            Numbered note, select for detail
          </span>
        )}
      </div>

      <LprChart years={years} terms={payload.terms} markers={markers} metric={metric} only={nat ? null : only} onlyRegion={nat ? onlyRegion : null} regions={regions} selectedFy={fy} onSelectFy={onFy} />

      <ChartNotesRow>
        <MethodologyNote>
          {nat ? (
            <p>
              Naturalizations: people aged 18 and over who became U.S. citizens through an application (Form N-400) in the fiscal year (FY{cur.fy}: {cur.naturalizations === null ? "no figure" : n(cur.naturalizations)}{cur.preliminary ? ", preliminary" : ""}); children who become citizens through a parent are not counted. Bars are split by the continent OHSS prints above its country rows, by country of birth (the newest year, preliminary, by country of nationality): North America here includes Mexico, Central America and the Caribbean. Continents are OHSS&rsquo;s, not assigned here; &ldquo;Unknown&rdquo; is people whose birthplace was not reported. The count follows how many applications USCIS processed, not only how many people applied. A person usually naturalizes five or more years after getting a green card, so these are different people from the green cards in the same year; the two are never added. Source: <SourceLink id="ohss-yearbook">DHS Office of Homeland Security Statistics</SourceLink> (Yearbook through FY2024; <SourceLink id="ohss-legal-immigration">quarterly report</SourceLink> for FY2025, preliminary). Rounded to the nearest ten. USCIS suspended in-person services in 2020.
            </p>
          ) : (
            <>
              <p>
                Green cards: people who became lawful permanent residents in the fiscal year (FY{cur.fy}: {n(cur.lpr)}{cur.preliminary ? ", preliminary" : ""}{share !== null ? `, ${share}% of them as immediate relatives of U.S. citizens` : ""}), counted when DHS grants the status, either on arrival with an immigrant visa or by adjusting status inside the U.S. This is not the number of visas the State Department issues, and not entries. Bars are colored by the class, the category a person became a resident under; refugees and asylees appear when they adjust to permanent residence, usually a year or more after arriving, so this is not the refugee admissions count above. Source: <SourceLink id="ohss-yearbook">DHS Office of Homeland Security Statistics</SourceLink> (Yearbook through FY2024; <SourceLink id="ohss-legal-immigration">quarterly report</SourceLink> for FY2025, preliminary).
              </p>
              <p>
                OHSS prints six major classes and the “Other” that holds every other printed class (what it holds changes by edition). Refugees and asylees are drawn together; the table splits them. Class detail starts in FY1999. Cells from FY2015 on are rounded to the nearest ten. The split between new arrivals and adjustments of status is not drawn; FY2013–FY2019 were revised in the FY2020 Yearbook.
              </p>
            </>
          )}
        </MethodologyNote>
        <details className="mt-3 text-[0.8rem] text-ink-muted">
          <summary className={TABLE_TOGGLE}>View as table</summary>
          <div className="mt-2 max-h-[24rem] overflow-auto">
            <table className="w-full min-w-[72rem] border-collapse text-left">
              <caption className="sr-only">Green cards by fiscal year and class of admission, and naturalizations</caption>
              <thead>
                <tr className="border-b border-line-strong text-[0.7rem] uppercase tracking-[0.06em] text-ink-faint">
                  <th className="py-1.5 pr-3 font-medium">Fiscal year</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Green cards</th>
                  {LPR_CLASS_STACK.map((c) => (
                    <th key={c} className="py-1.5 pr-3 text-right font-medium">
                      {LPR_CLASS_NAME[c].short}
                    </th>
                  ))}
                  <th className="py-1.5 pr-3 text-right font-medium">Naturalizations</th>
                  {LPR_REGION_STACK.map((r) => (
                    <th key={r.key} className="py-1.5 pr-3 text-right font-medium">
                      {`Nat. · ${r.short}`}
                    </th>
                  ))}
                  <th className="py-1.5 pr-3 font-medium">Status</th>
                  <th className="py-1.5 font-medium">Administration</th>
                </tr>
              </thead>
              <tbody>
                {years.map((y) => (
                  <tr key={y.fy} className="border-b border-line align-top">
                    <th scope="row" className="py-1.5 pr-3 font-mono font-medium text-ink">{`FY${y.fy}`}</th>
                    <td className="py-1.5 pr-3 text-right font-mono text-ink">{n(y.lpr)}</td>
                    {LPR_CLASS_STACK.map((c) => (
                      <td key={c} className="py-1.5 pr-3 text-right font-mono text-ink">{y.classes ? n(y.classes[c]) : "—"}</td>
                    ))}
                    <td className="py-1.5 pr-3 text-right font-mono text-ink">{y.naturalizations === null ? "—" : n(y.naturalizations)}</td>
                    {LPR_REGION_STACK.map((r) => (
                      <td key={r.key} className="py-1.5 pr-3 text-right font-mono text-ink">{regions.get(y.fy)?.[r.key] === undefined ? "—" : n(regions.get(y.fy)![r.key]!)}</td>
                    ))}
                    <td className="py-1.5 pr-3">{y.preliminary ? "Preliminary" : "Final"}</td>
                    <td className="py-1.5">{y.blended ? y.days.map((d) => `${d.last} ${d.days} days`).join(" · ") : (termsById.get(y.termId)?.president ?? "")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </ChartNotesRow>
    </ChartCard>
  );
}

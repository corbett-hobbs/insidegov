"use client";

import { ChartCard } from "@/components/charts/ChartCard";
import { LEGEND_ITEM, LEGEND_ROW_CAPPED } from "@/components/charts/legend";
import { LegendToggle, useIsolate } from "@/components/charts/LegendToggle";
import { TABLE_TOGGLE } from "@/components/charts/table-toggle";
import { MethodologyNote } from "@/components/MethodologyNote";
import { GEO_NAME, type GeoGroup, type RefugeePayload, type RefugeeYear } from "@/lib/refugee-types";
import { RefugeeChart } from "./RefugeeChart";
import { CEILING_TINT, GEO_STACK, REGION_COLOR, n } from "./refugee-style";

/**
 * "Refugee ceiling and admissions by fiscal year": the ceiling chart (`RefugeeChart`) with its key, Data notes and table. The key
 * entries are the region filter: click one to draw only that region from zero (the ceiling hides, it is a total), again to clear.
 * The shown years are the page's window, plus the newest (preliminary) year when the window reaches the end.
 */
export function RefugeeCeilingCard({ payload, years, fy, onFy }: { payload: RefugeePayload; years: readonly RefugeeYear[]; fy: number; onFy: (fy: number) => void }) {
  const [only, toggleOnly] = useIsolate<GeoGroup>();
  const present = [...GEO_STACK].filter((g) => years.some((y) => y.regions[g] > 0));
  const termsById = new Map(payload.terms.map((t) => [t.termId, t]));
  const prelim = years.some((y) => y.preliminary);
  const hasPrivate = years.some((y) => y.privateSector > 0);
  return (
    <ChartCard
      title="Refugee ceiling and admissions by fiscal year"
      lede="Each year the President sets a ceiling on how many refugees can be resettled in the U.S. The bars show how many actually arrived, and where they came from."
    >
      <div className={`${LEGEND_ROW_CAPPED} mb-2`}>
        {present.map((g) => (
          <LegendToggle key={g} active={only === g} dimmed={only !== null && only !== g} onClick={() => toggleOnly(g)}>
            <i aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: REGION_COLOR[g] }} />
            {GEO_NAME[g].short}
          </LegendToggle>
        ))}
        {only === null && years.some((y) => y.privateSector > 0) && (
          <span className={LEGEND_ITEM}>
            <i aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--ink-faint)", opacity: 0.55 }} />
            Private-sector initiative
          </span>
        )}
        {only === null && (
          <span className={LEGEND_ITEM}>
            <i aria-hidden className="relative inline-block h-2.5 w-3 rounded-[1px]" style={{ background: CEILING_TINT, boxShadow: "inset 0 2.4px 0 var(--ink)" }} />
            Ceiling
          </span>
        )}
        {prelim && (
          <span className={LEGEND_ITEM}>
            <i aria-hidden className="inline-block h-[10px] w-3 rounded-[1px] border border-line-strong" style={{ background: "repeating-linear-gradient(45deg, var(--ink-muted) 0 2px, transparent 2px 5px)" }} />
            Preliminary, may be revised
          </span>
        )}
        <span className={LEGEND_ITEM}>
          <i aria-hidden className="inline-block h-2.5 w-3.5 rounded-full bg-ink" />
          Numbered rule, select for detail
        </span>
      </div>

      <RefugeeChart years={years} terms={payload.terms} markers={payload.markers} only={only} selectedFy={fy} onSelectFy={onFy} />

      <MethodologyNote>
        <p>
          Ceiling: the most refugees the President authorizes for the year, a maximum rather than a quota, so arrivals under it are not a shortfall. It is the figure in force at year end, so a mid-year revision (FY2021, FY2026) shows the revised number; the year&rsquo;s card gives the first. Admitted: refugees resettled from abroad, by fiscal year of arrival (State Department); asylum seekers, parolees and people with Temporary Protected Status are not included. Regions follow the applicant&rsquo;s nationality. FY2026 is the first year-end report and may be revised. A year belongs to the president in office on Sept 30, so FY2025&rsquo;s ceiling was set by the previous administration.
        </p>
      </MethodologyNote>

      <details className="mt-3 text-[0.8rem] text-ink-muted">
        <summary className={TABLE_TOGGLE}>View as table</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse text-left">
            <caption className="sr-only">Refugees admitted by fiscal year and region, with the ceiling in force</caption>
            <thead>
              <tr className="border-b border-line-strong text-[0.7rem] uppercase tracking-[0.06em] text-ink-faint">
                <th className="py-1.5 pr-3 font-medium">Fiscal year</th>
                <th className="py-1.5 pr-3 text-right font-medium">Admitted</th>
                <th className="py-1.5 pr-3 text-right font-medium">Ceiling</th>
                <th className="py-1.5 pr-3 text-right font-medium">Share</th>
                {GEO_STACK.map((g) => (
                  <th key={g} className="py-1.5 pr-3 text-right font-medium">
                    {GEO_NAME[g].short}
                  </th>
                ))}
                {hasPrivate && <th className="py-1.5 pr-3 text-right font-medium">Private sector</th>}
                <th className="py-1.5 pr-3 font-medium">Status</th>
                <th className="py-1.5 font-medium">Administration</th>
              </tr>
            </thead>
            <tbody>
              {years.map((y) => (
                <tr key={y.fy} className="border-b border-line align-top">
                  <th scope="row" className="py-1.5 pr-3 font-mono font-medium text-ink">{`FY${y.fy}`}</th>
                  <td className="py-1.5 pr-3 text-right font-mono text-ink">{n(y.admissions)}</td>
                  <td className="py-1.5 pr-3 text-right font-mono text-ink">{y.ceiling === null ? "—" : n(y.ceiling)}</td>
                  <td className="py-1.5 pr-3 text-right font-mono text-ink">{y.share === null ? "—" : `${(y.share * 100).toFixed(1)}%`}</td>
                  {GEO_STACK.map((g) => (
                    <td key={g} className="py-1.5 pr-3 text-right font-mono text-ink">{n(y.regions[g])}</td>
                  ))}
                  {hasPrivate && <td className="py-1.5 pr-3 text-right font-mono text-ink">{n(y.privateSector)}</td>}
                  <td className="py-1.5 pr-3">{y.preliminary ? "Preliminary" : "Final"}</td>
                  <td className="py-1.5">{y.blended ? y.days.map((d) => `${d.last} ${d.days} days`).join(" · ") : (termsById.get(y.termId)?.president ?? "")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </ChartCard>
  );
}

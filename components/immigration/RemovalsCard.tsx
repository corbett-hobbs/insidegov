"use client";

import { TABLE_TOGGLE } from "@/components/charts/table-toggle";
import { ChartCard } from "@/components/charts/ChartCard";
import { RETURNS_COUNTED_FROM, type ImmigrationPageData } from "@/lib/immigration-derive";
import { RemovalsChart } from "./RemovalsChart";
import { MethodologyNote } from "@/components/MethodologyNote";
import { ChartNotesRow } from "@/components/charts/ChartNotesRow";
import { LEGEND_ITEM, LEGEND_ROW_CAPPED } from "@/components/charts/legend";

export function RemovalsCard({ data, range, fy, onFy, activeFy, onActiveFy }: { data: ImmigrationPageData; range: readonly [number, number]; fy: number; onFy: (fy: number) => void; activeFy?: number | null; onActiveFy?: (fy: number | null) => void }) {
  const years = data.removalsYears.filter((y) => y.fy >= range[0] && y.fy <= range[1]);
  // The unlocked-year slot follows the newest year: shown whenever the window reaches it.
  const pending = range[1] >= data.lastFy;
  const termsById = new Map(data.removalsTerms.map((t) => [t.termId, t]));
  const iceYears = data.years.length;
  return (
    <ChartCard
      title="Removals and detention by fiscal year"
      lede="People removed from the country each fiscal year: ICE’s own headline figure from FY2003, split by which agency first apprehended the person, and the Immigration and Naturalization Service’s count before March 2003, as DHS republishes it. The line is the average number of people in ICE detention on a given day. FY2025 is preliminary: it comes from ICE’s FY2027 budget overview, not a locked statistics release."
    >
      <RemovalsLegend />
      <RemovalsChart
        years={years}
        terms={data.removalsTerms}
        markers={data.markers}
        yMax={data.yMax}
        pending={pending}
        pendingFy={data.lastFy + 1}
        selectedFy={fy}
        onSelectFy={onFy}
        activeFy={activeFy}
        onActiveFy={onActiveFy}
      />

      <ChartNotesRow>
        <MethodologyNote>
          <p>
            Before March 2003 the Immigration and Naturalization Service did the removing; ICE took over. FY{data.historyFirstFy}&ndash;FY{data.firstFy - 1} are DHS&rsquo;s republished INS-era counts (Yearbook Table 39, {data.history.edition} edition, rounded to tens, removals only): continuity of records, not necessarily the same counting rules. From FY{data.firstFy} the bars are ICE&rsquo;s own figures, which differ from DHS&rsquo;s for the same years. Colors show who first apprehended the person; the Border Patrol part is still ICE&rsquo;s count. ICE prints that split for FY2008&ndash;FY2024 and counts returns from FY2007. CBP&rsquo;s counts are in the card above. {data.finalCount} of {iceYears} ICE years are final.
          </p>
        </MethodologyNote>
        <details className="mt-3 text-[0.8rem] text-ink-muted">
          <summary className={TABLE_TOGGLE}>
            View as table
          </summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[46rem] border-collapse text-left">
              <caption className="sr-only">Removals by fiscal year (INS era from DHS statistics, then ICE), by arresting agency, with average daily detention population</caption>
              <thead>
                <tr className="border-b border-line-strong text-[0.7rem] uppercase tracking-[0.06em] text-ink-faint">
                  <th className="py-1.5 pr-3 font-medium">Fiscal year</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Removals</th>
                  <th className="py-1.5 pr-3 text-right font-medium">ICE-arrested</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Border Patrol-arrested</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Avg. detained per day</th>
                  <th className="py-1.5 pr-3 font-medium">Status</th>
                  <th className="py-1.5 pr-3 font-medium">Administration</th>
                  <th className="py-1.5 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {years.map((y) => (
                  <tr key={y.fy} className="border-b border-line align-top">
                    <th scope="row" className="py-1.5 pr-3 font-mono font-medium text-ink">
                      {`FY${y.fy}`}
                    </th>
                    <td className="py-1.5 pr-3 text-right font-mono text-ink">{y.value.toLocaleString("en-US")}</td>
                    <td className="py-1.5 pr-3 text-right font-mono text-ink">{y.agency ? y.agency.ice.toLocaleString("en-US") : "—"}</td>
                    <td className="py-1.5 pr-3 text-right font-mono text-ink">{y.agency ? y.agency.cbp.toLocaleString("en-US") : "—"}</td>
                    <td className="py-1.5 pr-3 text-right font-mono text-ink">{y.detention ? y.detention.value.toLocaleString("en-US") : "—"}</td>
                    <td className="py-1.5 pr-3">
                      {y.status === "final" ? "Final" : "Preliminary"}
                      {y.era === "ins" ? ", INS era (DHS statistics), removals only" : y.fy < RETURNS_COUNTED_FROM ? ", returns not counted" : ""}
                    </td>
                    <td className="py-1.5 pr-3">
                      {y.blended
                        ? y.days.map((d) => `${d.last} ${d.days} days`).join(" · ")
                        : (termsById.get(y.termId)?.president ?? "")}
                    </td>
                    <td className="py-1.5">
                      <a href={y.sourceUrl} target="_blank" rel="noreferrer" className="text-accent underline-offset-2 hover:underline">
                        {y.source}
                      </a>
                    </td>
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

/** Legend for the stacked bars and the detention line: who first apprehended the person, and what the grey and dashed marks mean. */
function RemovalsLegend() {
  const swatch = (color: string) => <i aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />;
  return (
    <div className={`${LEGEND_ROW_CAPPED} mb-2`}>
      <span className={LEGEND_ITEM}>{swatch("var(--agency-ice)")}Interior arrests (ICE)</span>
      <span className={LEGEND_ITEM}>{swatch("var(--agency-cbp)")}Border arrests (Border Patrol)</span>
      <span className={LEGEND_ITEM}>{swatch("var(--oth)")}No split by agency on file</span>
      <span className={LEGEND_ITEM}>
        <i
          aria-hidden
          className="inline-block h-2.5 w-2.5 rounded-sm border border-[var(--oth)]"
          style={{ background: "repeating-linear-gradient(45deg, var(--oth) 0 1.5px, color-mix(in srgb, var(--oth) 22%, var(--surface)) 1.5px 4px)" }}
        />
        Removals only: INS era (DHS statistics) to FY2002, ICE to FY2006
      </span>
      <span className={LEGEND_ITEM}>
        <i aria-hidden className="inline-block h-0 w-[18px] border-t-[2.4px] border-ink" />
        Average people detained per day (from FY2018)
      </span>
      <span className={LEGEND_ITEM}>
        <i aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm border border-dashed border-ink" />
        Preliminary
      </span>
      <span className={LEGEND_ITEM}>
        <i aria-hidden className="inline-block h-2.5 w-3.5 rounded-full bg-ink" />
        Change in who counts or what is counted, select for detail
      </span>
    </div>
  );
}

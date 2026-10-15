"use client";

import { TABLE_TOGGLE } from "@/components/charts/table-toggle";
import { ChartCard } from "@/components/charts/ChartCard";
import { RETURNS_COUNTED_FROM, type ImmigrationPageData } from "@/lib/immigration-derive";
import { RemovalsChart } from "./RemovalsChart";
import { MethodologyNote } from "@/components/MethodologyNote";
import { ChartNotesRow } from "@/components/charts/ChartNotesRow";
import { LEGEND_ITEM, LEGEND_ROW_CAPPED } from "@/components/charts/legend";
import { SourceLink } from "@/components/SourceLink";

export function RemovalsCard({ data, range, fy, onFy, activeFy, onActiveFy }: { data: ImmigrationPageData; range: readonly [number, number]; fy: number; onFy: (fy: number) => void; activeFy?: number | null; onActiveFy?: (fy: number | null) => void }) {
  const years = data.removalsYears.filter((y) => y.fy >= range[0] && y.fy <= range[1]);
  // The unlocked-year slot follows the newest year: shown whenever the window reaches it.
  const pending = range[1] >= data.lastFy;
  const termsById = new Map(data.removalsTerms.map((t) => [t.termId, t]));
  const iceYears = data.years.length;
  return (
    <ChartCard
      title="Removals, returns and detention by fiscal year"
      lede="People removed or returned from the country each fiscal year. A removal follows a formal removal order; a return is leaving without one, after an enforcement encounter. The bars are ICE’s count from FY2003, when it was created, and the Immigration and Naturalization Service’s (INS) before that. Before FY2007 only removals are counted. From FY2008, ICE splits its count by where the person was first stopped: inside the country or at the border. The line is the average number of people in ICE detention on a given day. FY2025 is preliminary: it comes from ICE’s FY2027 budget overview, not a locked statistics release."
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
            The Immigration and Naturalization Service did removals until ICE took over in March 2003. FY{data.historyFirstFy}&ndash;FY{data.firstFy - 1} are its counts as DHS republishes them (<SourceLink id="ohss-yearbook-table39">Yearbook Table 39</SourceLink>, {data.history.edition} edition, rounded to tens), which may not follow ICE&rsquo;s counting rules. From FY{data.firstFy} the bars are <SourceLink id="ice-statistics">ICE&rsquo;s own figures</SourceLink>, which differ from DHS&rsquo;s for the same years. Through FY2006 they count removals only; from FY2007 ICE also counts returns, people who leave without a removal order. For FY2008&ndash;FY2024 ICE splits its count by where the person was first stopped (its &ldquo;arresting agency&rdquo;). {data.finalCount} of {iceYears} ICE years are final.
          </p>
        </MethodologyNote>
        <details className="mt-3 text-[0.8rem] text-ink-muted">
          <summary className={TABLE_TOGGLE}>
            View as table
          </summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[46rem] border-collapse text-left">
              <caption className="sr-only">Removals (and, from FY2007, returns) by fiscal year (INS era from DHS statistics, then ICE), by where the person was first stopped, with average daily detention population</caption>
              <thead>
                <tr className="border-b border-line-strong text-[0.7rem] uppercase tracking-[0.06em] text-ink-faint">
                  <th className="py-1.5 pr-3 font-medium">Fiscal year</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Removals</th>
                  <th className="py-1.5 pr-3 text-right font-medium">After interior stop</th>
                  <th className="py-1.5 pr-3 text-right font-medium">After border stop</th>
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
      <span className={LEGEND_ITEM}>{swatch("var(--agency-ice)")}After interior stop</span>
      <span className={LEGEND_ITEM}>{swatch("var(--agency-cbp)")}After border stop</span>
      <span className={LEGEND_ITEM}>
        <i
          aria-hidden
          className="inline-block h-2.5 w-2.5 rounded-sm border border-[var(--oth)]"
          style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--oth) 32%, var(--surface)) 50%, var(--oth) 50%)" }}
        />
        No split on file
      </span>
      <span className={LEGEND_ITEM}>
        <i aria-hidden className="inline-block h-0 w-[18px] border-t-[2.4px] border-ink" />
        Average people detained per day (from FY2018)
      </span>
      <span className={LEGEND_ITEM}>
        <i aria-hidden className="inline-block h-[10px] w-3 rounded-[1px] border border-line-strong" style={{ background: "repeating-linear-gradient(45deg, var(--ink-muted) 0 2px, transparent 2px 5px)" }} />
        Preliminary, may be revised
      </span>
      <span className={LEGEND_ITEM}>
        <i aria-hidden className="inline-block h-2.5 w-3.5 rounded-full bg-ink" />
        Change in who counts or what is counted, select for detail
      </span>
    </div>
  );
}

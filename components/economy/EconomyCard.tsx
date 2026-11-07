import { ChartNotesRow } from "@/components/charts/ChartNotesRow";
import { MethodologyNote } from "@/components/MethodologyNote";
import { TABLE_TOGGLE } from "@/components/charts/table-toggle";
import { useIsolate } from "@/components/charts/LegendToggle";
import { useTakeawayContext } from "@/components/charts/ContextLine";
import { memo, type ReactNode } from "react";
import { fiscalBars, quarterlyPoints, yearRows } from "@/lib/economy-series";
import type { EconomyData } from "@/lib/indicator-payload";
import type { Reading } from "@/lib/indicator-lookup";
import { HeaderReadout } from "@/components/charts/LineReadout";
import { EconomyChart, altText, chartPoints, hasSecondLine, lineRows, type AltView, type LineId } from "./EconomyChart";
import { contextFor, type ChartSpec } from "./specs";

/** The other unit's value under the headline ("5.8% of GDP"), with its own period when that data ends earlier or later. */
function altLine(alt: AltView | undefined, altReading: Reading | undefined, reading: Reading, value: number | null | undefined = altReading?.value): string | null {
  if (!alt || !altReading || value === null || value === undefined) return null;
  const text = altText(alt, value);
  if (altReading.snap === reading.snap) return text;
  const period = altReading.caption.match(/Q\d \d{4}|fiscal \d{4}/)?.[0];
  return period ? `${text} in ${period}` : text;
}

/**
 * The card's header reading: one big number, with the second line's value small under it while both lines show. Once a
 * legend entry is isolated, gas and debt print only that line, labelled with its key, so no hidden line's value remains.
 */
function Readout({ spec, reading, hero, alt, altReading, only }: { spec: ChartSpec; reading: Reading; hero: boolean; alt?: AltView; altReading?: Reading; only: LineId | null }) {
  const caption = reading.caption;
  if (hasSecondLine(spec) && only !== null) {
    const rows = lineRows(spec, reading, only, [altLine(alt, altReading, reading), altLine(alt, altReading, reading, altReading?.value2)]);
    return (
      <div className="min-w-[110px] shrink-0 text-right">
        <HeaderReadout rows={rows} />
        <div className="mt-0.5 text-[0.75rem] text-ink-muted">{caption}</div>
      </div>
    );
  }
  const other = altLine(alt, altReading, reading);
  return (
    <div className={`shrink-0 text-right ${hero ? "min-w-[120px]" : "min-w-[110px]"}`}>
      <div className={`font-mono font-medium leading-tight text-ink ${hero ? "text-[1.6rem]" : "text-[1.25rem]"}`}>
        {reading.value === null ? "—" : spec.head(reading.value)}
      </div>
      {hasSecondLine(spec) && reading.value2 !== null && (
        <div className="mt-0.5 font-mono text-[0.8rem] text-ink-muted">{`${spec.label2} ${spec.head(reading.value2)}`}</div>
      )}
      {other && <div className="mt-0.5 font-mono text-[0.8rem] text-ink-muted">{other}</div>}
      <div className="mt-0.5 text-[0.75rem] text-ink-muted">{spec.key === "debt" ? `total debt, ${caption}` : caption}</div>
    </div>
  );
}

/** `<details>` table fallback: one row per year (last reading, low, high), or the values themselves for annual series. */
const DataTable = memo(function DataTable({ data, spec }: { data: EconomyData; spec: ChartSpec }) {
  const pts =
    spec.kind === "fiscal"
      ? fiscalBars(data.def).map((b) => ({ day: b.mid, value: b.value }))
      : spec.kind === "debt"
        ? quarterlyPoints(data.tot)
        : chartPoints(data, spec.key);
  const annual = spec.kind === "fiscal" || spec.kind === "income";
  const rows = yearRows(pts);
  const fmt = (v: number) => spec.head(v);
  return (
    <details>
      <summary className={TABLE_TOGGLE}>View as table</summary>
      <div className="mt-2 max-h-72 overflow-auto">
        <table className="w-full border-collapse text-left text-[0.75rem] tabular-nums">
          <caption className="sr-only">{`${spec.title}, ${spec.unit}${spec.kind === "debt" ? ", total public debt" : ""}`}</caption>
          <thead className="sticky top-0 bg-surface-raised">
            <tr className="font-mono text-[0.65rem] uppercase tracking-[0.05em] text-ink-muted">
              <th scope="col" className="px-2 py-1.5">{spec.kind === "fiscal" ? "Fiscal year" : "Year"}</th>
              <th scope="col" className="px-2 py-1.5">{annual ? "Value" : "Last reading"}</th>
              {!annual && <th scope="col" className="px-2 py-1.5">Low</th>}
              {!annual && <th scope="col" className="px-2 py-1.5">High</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.year} className="border-t border-line">
                <th scope="row" className="px-2 py-1 font-normal">{r.year}</th>
                <td className="px-2 py-1">{fmt(r.last)}</td>
                {!annual && <td className="px-2 py-1">{fmt(r.low)}</td>}
                {!annual && <td className="px-2 py-1">{fmt(r.high)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
});

/**
 * One chart card. Below `md` it is a plain column. From `md` a non-hero card is a
 * subgrid over five row tracks (header + reading, takeaway, plot, legend, notes
 * row) that the pair shares, so two cards side by side get identical track heights:
 * plots, axes and term bands start and end at the same pixel whatever the
 * takeaway or legend lengths. The takeaway is ink, not muted: it is the card's
 * one-line reading; what the chart measures lives in Data notes. A context line (rule 7d)
 * opens inside the takeaway's track, so an open panel grows that row for both cards of a pair. The notes row sits at the bottom of its track.
 */
export function EconomyCard({
  data,
  spec,
  reading,
  hero = false,
  showCong,
  view,
  takeaway,
  notes,
  legend,
  alt,
  altReading,
  jump,
}: {
  /** The "2 questions · 1 in the news ↓" link at the end of the notes row. */
  jump?: ReactNode;
  data: EconomyData;
  spec: ChartSpec;
  reading: Reading;
  hero?: boolean;
  showCong: boolean;
  view: readonly [number, number];
  /** One or two sentences on what the chart shows (`spec.takeaway`). */
  takeaway: string;
  /** The card's "Data notes" (60-100 words). */
  notes?: ReactNode;
  /** A legend node, or a function of the line-isolate controls for cards with a second line. */
  legend?: ReactNode | ((c: { only: LineId | null; isolate: (k: LineId) => void }) => ReactNode);
  /** The chart in its other unit (deficit and debt: dollars vs share of GDP), shown beside the main reading and in the tooltip. */
  alt?: AltView;
  altReading?: Reading;
}) {
  const [only, isolate] = useIsolate<LineId>();
  const Heading = hero ? "h2" : "h3";
  const ctx = useTakeawayContext(takeaway, contextFor(spec.key));
  return (
    <section
      id={`chart-${spec.key}`}
      className={`min-w-0 scroll-mt-32 rounded-[10px] border border-line bg-surface ${
        hero ? "p-5 sm:p-6" : "flex flex-col p-[1.1rem_1.1rem_0.9rem] md:row-span-5 md:grid md:grid-rows-subgrid md:gap-y-0"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Heading className={`m-0 font-serif font-medium leading-tight ${hero ? "text-[1.6rem]" : "text-[1.3rem]"}`}>{spec.title}</Heading>
        </div>
        <Readout spec={spec} reading={reading} hero={hero} alt={alt} altReading={altReading} only={only} />
      </div>
      <div>
        <p className={`m-0 text-ink ${hero ? "mt-2 text-[0.95rem] leading-[1.55]" : "mt-1.5 text-[0.875rem] leading-[1.5]"}`}>{ctx.takeaway}</p>
        {ctx.panel && <div className="mt-2 [&>div]:mb-0">{ctx.panel}</div>}
      </div>
      <div className={hero ? "mt-3.5" : "mt-3"}>
        <EconomyChart data={data} spec={spec} hero={hero} showCong={showCong} view={view} reading={reading} only={only} alt={alt} />
      </div>
      <div>{typeof legend === "function" ? legend({ only, isolate }) : legend}</div>
      <ChartNotesRow className="mt-auto pt-3 md:w-full md:self-end">
        {notes && <MethodologyNote>{notes}</MethodologyNote>}
        <DataTable data={data} spec={spec} />
        {jump}
      </ChartNotesRow>
    </section>
  );
}

import { MethodologyNote } from "@/components/MethodologyNote";
import { TABLE_TOGGLE } from "@/components/charts/table-toggle";
import { useIsolate } from "@/components/charts/LegendToggle";
import { memo, type ReactNode } from "react";
import { fiscalBars, quarterlyPoints, yearRows } from "@/lib/economy-series";
import type { EconomyData } from "@/lib/indicator-payload";
import type { Reading } from "@/lib/indicator-lookup";
import { EconomyChart, chartPoints, type LineId } from "./EconomyChart";
import { type ChartSpec } from "./specs";

function Readout({ spec, reading, hero }: { spec: ChartSpec; reading: Reading; hero: boolean }) {
  return (
    <div className={`shrink-0 text-right ${hero ? "min-w-[120px]" : "min-w-[110px]"}`}>
      <div className={`font-mono font-medium leading-tight text-ink ${hero ? "text-[1.6rem]" : "text-[1.25rem]"}`}>
        {reading.value === null ? "—" : spec.head(reading.value)}
      </div>
      {spec.key === "gas" && reading.value2 !== null && (
        <div className="mt-0.5 font-mono text-[0.8rem] text-ink-muted">{`${spec.label2} ${spec.head(reading.value2)}`}</div>
      )}
      <div className="mt-0.5 text-[0.75rem] text-ink-muted">{reading.caption}</div>
    </div>
  );
}

/** `<details>` table fallback: one row per year (last reading, low, high), or the values themselves for annual series. */
const DataTable = memo(function DataTable({ data, spec }: { data: EconomyData; spec: ChartSpec }) {
  const pts =
    spec.kind === "fiscal"
      ? fiscalBars(data.def).map((b) => ({ day: b.mid, value: b.value }))
      : spec.kind === "debt"
        ? quarterlyPoints(data.held)
        : chartPoints(data, spec.key);
  const annual = spec.kind === "fiscal" || spec.kind === "income";
  const rows = yearRows(pts);
  const fmt = (v: number) => spec.head(v);
  return (
    <details className="open:w-full">
      <summary className={TABLE_TOGGLE}>View as table</summary>
      <div className="mt-2 max-h-72 overflow-auto">
        <table className="w-full border-collapse text-left text-[0.75rem] tabular-nums">
          <caption className="sr-only">{`${spec.title}, ${spec.unit}${spec.kind === "debt" ? ", held by the public" : ""}`}</caption>
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
 * subgrid over five row tracks (header + reading, description, plot, legend, notes
 * row) that the pair shares, so two cards side by side get identical track heights:
 * plots, axes and term bands start and end at the same pixel whatever the
 * description or legend lengths. The notes row sits at the bottom of its track.
 */
export function EconomyCard({
  data,
  spec,
  reading,
  hero = false,
  showCong,
  view,
  desc,
  notes,
  legend,
}: {
  data: EconomyData;
  spec: ChartSpec;
  reading: Reading;
  hero?: boolean;
  showCong: boolean;
  view: readonly [number, number];
  desc: string;
  /** The card's "Data notes" (60-100 words). */
  notes?: ReactNode;
  /** A legend node, or a function of the line-isolate controls for cards with a second line. */
  legend?: ReactNode | ((c: { only: LineId | null; isolate: (k: LineId) => void }) => ReactNode);
}) {
  const [only, isolate] = useIsolate<LineId>();
  const Heading = hero ? "h2" : "h3";
  return (
    <section
      className={`min-w-0 rounded-[10px] border border-line bg-surface ${
        hero ? "p-5 sm:p-6" : "flex flex-col p-[1.1rem_1.1rem_0.9rem] md:row-span-5 md:grid md:grid-rows-subgrid md:gap-y-0"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Heading className={`m-0 font-serif font-medium leading-tight ${hero ? "text-[1.6rem]" : "text-[1.3rem]"}`}>{spec.title}</Heading>
        </div>
        <Readout spec={spec} reading={reading} hero={hero} />
      </div>
      <p className={`m-0 text-ink-muted ${hero ? "mt-2 text-[0.875rem] leading-[1.5]" : "mt-1 text-[0.8rem] leading-[1.45]"}`}>{desc}</p>
      <div className={hero ? "mt-3.5" : "mt-3"}>
        <EconomyChart data={data} spec={spec} hero={hero} showCong={showCong} view={view} reading={reading} only={only} />
      </div>
      <div>{typeof legend === "function" ? legend({ only, isolate }) : legend}</div>
      <div className="mt-auto flex flex-wrap items-start gap-x-4 gap-y-1 pt-3 md:self-end md:w-full">
        {notes && <MethodologyNote className="mt-0 open:w-full">{notes}</MethodologyNote>}
        <DataTable data={data} spec={spec} />
      </div>
    </section>
  );
}

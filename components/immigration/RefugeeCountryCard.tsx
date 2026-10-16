"use client";

import { useMemo, useState } from "react";
import { ChartCard } from "@/components/charts/ChartCard";
import { PillGroup } from "@/components/charts/PillGroup";
import { StackedRows, type StackedRowData } from "@/components/charts/StackedRows";
import { TABLE_TOGGLE } from "@/components/charts/table-toggle";
import { YearPicker } from "@/components/charts/YearPicker";
import { MethodologyNote } from "@/components/MethodologyNote";
import { ChartNotesRow } from "@/components/charts/ChartNotesRow";
import { formatChange, rankCountries } from "@/lib/refugee-derive";
import { GEO_NAME, type GeoGroup, type RefugeePayload } from "@/lib/refugee-types";
import { RefugeeMap, undrawnRefugees, type MapMode } from "./RefugeeMap";
import type { MapFeature } from "./RemovalsMap";
import { capText, n } from "./refugee-style";
import { SourceLink } from "@/components/SourceLink";
import { useTakeaway } from "./ContextLine";

type WorldMap = { width: number; height: number; features: MapFeature[] };

/**
 * "Where refugees came from": refugees admitted for one fiscal year by country of chargeability, laid out like the ICE "Who gets
 * removed" card (a choropleth, and a ranked list of single-colour bars with the change from the year before; `StackedRows`). The
 * header toggle swaps countries for the five regions: each region's list row carries its arrivals against its cap (a pale bar to the
 * cap with a black tick), and the map takes the regions' colours. The year comes from the section's selected year (a click on the
 * ceiling chart's bars, or the year menu here). Clicking a country (or, in Regions, a region) highlights it and dims the rest.
 */
export function RefugeeCountryCard({
  payload,
  worldMap,
  fy,
  yearRange,
  onFy,
  country,
  onCountry,
}: {
  payload: RefugeePayload;
  worldMap: WorldMap;
  fy: number;
  /** The years the year menu offers (the page's window, plus the newest year when the window reaches it). */
  yearRange: readonly [number, number];
  onFy: (fy: number) => void;
  country: string | null;
  onCountry: (key: string | null) => void;
}) {
  const [mode, setMode] = useState<MapMode>("countries");
  const [region, setRegion] = useState<GeoGroup | null>(null);
  const ranked = useMemo(() => rankCountries(payload, fy), [payload, fy]);
  const regionYear = payload.regionYears.find((r) => r.fy === fy);
  const year = payload.years.find((y) => y.fy === fy);
  const prev = `FY${String(fy - 1).slice(2)}`;

  const picker = <YearPicker value={fy} range={yearRange} onChange={onFy} format={(v) => `FY${v}`} ariaLabel="Fiscal year shown" />;
  const modeToggle = (
    <PillGroup<MapMode>
      ariaLabel="Countries or regions"
      value={mode}
      onChange={(m) => {
        setMode(m);
        onCountry(null);
        setRegion(null);
      }}
      options={[
        { value: "countries", label: "Countries" },
        { value: "regions", label: "Regions" },
      ]}
    />
  );

  const top3 = ranked.slice(0, 3);
  const total = year?.admissions ?? 0;
  const topShare = total > 0 ? top3.reduce((a, r) => a + r.value, 0) / total : 0;
  const listNames = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : (names[0] ?? ""));
  const regionRows = (regionYear?.rows ?? []).filter((r) => r.admissions !== null);
  // The selected year in a sentence, at the head of the Data notes.
  const yearLine =
    mode === "countries"
      ? `FY${fy}: ${n(total)} refugees from ${ranked.length} ${ranked.length === 1 ? "country" : "countries"}${top3.length ? `, led by ${listNames(top3.map((r) => r.name))}, which ${top3.length > 1 ? "together " : ""}made up ${(topShare * 100).toFixed(topShare > 0.995 ? 2 : 0)}%.` : "."}`
      : `FY${fy}: ${n(total)} refugees from ${regionRows.length} regions, led by ${listNames(regionRows.slice(0, 3).map((r) => GEO_NAME[r.group as GeoGroup].name))}.`;

  // List rows and the selection chip for the current mode.
  let rows: StackedRowData[];
  let scaleMax: number;
  let chip: string | null = null;
  if (mode === "countries") {
    scaleMax = Math.max(1, ...ranked.map((r) => r.value));
    rows = ranked.map((r) => ({
      id: r.key,
      rank: r.rank,
      label: r.name,
      segments: [{ value: r.value, color: "var(--accent)", title: `${r.name}: ${n(r.value)}` }],
      total: n(r.value),
      delta: formatChange(r.change),
      selected: r.key === country,
      dimmed: country !== null && r.key !== country,
    }));
    if (country !== null) {
      const sel = ranked.find((r) => r.key === country);
      const nm = payload.countries.find((c) => c.key === country)?.name ?? country;
      chip = sel ? `${nm} · No. ${sel.rank} · ${n(sel.value)}` : `${nm} · no refugees in FY${fy}`;
    }
  } else {
    const all = regionYear?.rows ?? [];
    scaleMax = Math.max(1, ...all.map((r) => Math.max(r.admissions ?? 0, r.cap?.[1] ?? 0))) * 1.06;
    let rank = 0;
    rows = all.map((r) => ({
      id: r.group,
      rank: r.admissions === null ? undefined : ++rank,
      label: GEO_NAME[r.group].name,
      segments: r.admissions === null ? [] : [{ value: r.admissions, color: "var(--accent)", title: `${GEO_NAME[r.group].name}: ${n(r.admissions)}` }],
      total: r.admissions === null ? "–" : n(r.admissions),
      delta: r.cap ? `Cap ${capText(r.cap)}` : "–",
      cap: r.cap ? { min: r.cap[0], max: r.cap[1] } : null,
      selected: r.group === region,
      dimmed: region !== null && r.group !== region,
    }));
    const sel = all.find((r) => r.group === region);
    if (sel && region) {
      const rk = regionRows.findIndex((r) => r.group === region) + 1;
      chip = `${GEO_NAME[region].name} · ${sel.admissions === null ? "cap only" : `No. ${rk} · ${n(sel.admissions)}`}${sel.cap ? ` of ${capText(sel.cap)}` : ""}`;
    }
  }

  const mapRows = ranked.map((r) => ({ key: r.key, name: r.name, value: r.value, group: r.group }));
  const off = undrawnRefugees(worldMap.features, mapRows);

  const context = useTakeaway("refugeeCountries");
  return (
    <ChartCard
      title="Where refugees came from"
      takeaway={context.takeaway}
      action={
        <div className="flex flex-wrap items-center gap-2">
          {chip && <span className="rounded-md border border-line-strong bg-surface-raised px-2 py-0.5 text-[0.75rem] text-ink">{chip}</span>}
          <div className="flex flex-nowrap items-center gap-2">
            {picker}
            {modeToggle}
          </div>
        </div>
      }
    >
      {context.panel}
      <div className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-[1.5fr_1fr] md:items-stretch">
        <RefugeeMap
          features={worldMap.features}
          rows={mapRows}
          mode={mode}
          country={country}
          region={region}
          onPickCountry={onCountry}
          onPickRegion={setRegion}
          fy={fy}
        />
        <div className="flex min-w-0 flex-col">
          {mode === "regions" && regionYear?.noCaps && (
            <p className="m-0 mb-2 rounded-md border border-line bg-surface-raised px-3 py-2 text-[0.78rem] leading-[1.5] text-ink-muted">
              {regionYear.noCaps === "group"
                ? `No regional caps in FY${fy}: the determination allocated admissions “primarily” to a group, Afrikaners from South Africa, instead of dividing them by region.`
                : `No regional caps in FY${fy}: the determination divided the ceiling by kind of refugee instead of by region.`}
            </p>
          )}
          <div className="border-t border-line pt-1">
            <div
              className="max-h-[24rem] overflow-y-auto overscroll-contain pr-0.5 touch-scroll md:max-h-[27rem]"
              tabIndex={0}
              aria-label={`Refugees admitted by ${mode === "regions" ? "region" : "country"}, FY${fy}, ${rows.length} ${mode === "regions" ? "regions" : "countries"}, scrollable`}
            >
              <StackedRows
                rows={rows}
                scaleMax={scaleMax}
                onRowClick={(id) => (mode === "regions" ? setRegion((r) => (r === id ? null : (id as GeoGroup))) : onCountry(country === id ? null : id))}
                ariaLabel={mode === "regions" ? `Refugees admitted by region, FY${fy}, ranked, with each region’s cap` : `Refugees admitted by country of chargeability, FY${fy}, ranked`}
                emptyText="No refugees recorded."
              />
            </div>
          </div>
        </div>
      </div>

      <ChartNotesRow>
        <MethodologyNote>
          {mode === "countries" ? (
            <p>
              Refugees admitted by country of chargeability, from FY2001 (<SourceLink id="wraps-admissions">State Department</SourceLink>; earlier years have regions only). {yearLine} Chargeability is normally the applicant&rsquo;s nationality, which can differ from the country they fled: Burmese refugees processed in Thailand count under Burma. Colour bins are fixed so years compare.
              {off.names.length > 0 && <> Not on the map (former or unmapped territories): {listNames(off.names)}; they are in the list and table.</>} FY2026 is preliminary.
            </p>
          ) : (
            <p>
              Refugees admitted by region, by the nationality of the principal applicant (<SourceLink id="wraps-admissions">State Department</SourceLink>). {yearLine} The cap is the State Department&rsquo;s year-end regional ceiling (FY2001 on), else the last <SourceLink id="refugee-determinations">determination</SourceLink>&rsquo;s allocation; those numbers are starting points that get reassigned during the year, and FY2024&ndash;25 caps are ranges, shaded to the maximum. Some years have no regional caps: FY2020&ndash;21 were divided by kind of refugee and FY2026 &ldquo;primarily&rdquo; by group. An unallocated reserve is a cap with no arrivals. FY2026 is preliminary.
            </p>
          )}
        </MethodologyNote>
        <details className="mt-3 text-[0.8rem] text-ink-muted">
          <summary className={TABLE_TOGGLE}>View as table</summary>
          <div className="mt-2 max-h-[24rem] overflow-auto">
            <table className="w-full min-w-[26rem] border-collapse text-left">
              <caption className="sr-only">{mode === "regions" ? `Refugees admitted by region, FY${fy}` : `Refugees admitted by country of chargeability, FY${fy}`}</caption>
              <thead>
                <tr className="border-b border-line-strong text-[0.7rem] uppercase tracking-[0.06em] text-ink-faint">
                  <th className="py-1.5 pr-3 font-medium">Rank</th>
                  <th className="py-1.5 pr-3 font-medium">{mode === "regions" ? "Region" : "Country of chargeability"}</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Admitted</th>
                  {mode === "regions" && <th className="py-1.5 pr-3 text-right font-medium">Cap</th>}
                  <th className="py-1.5 text-right font-medium">{`Change vs. ${prev}`}</th>
                </tr>
              </thead>
              <tbody>
                {mode === "countries"
                  ? ranked.map((r) => (
                      <tr key={r.key} className="border-b border-line">
                        <td className="py-1.5 pr-3 font-mono">{r.rank}</td>
                        <th scope="row" className="py-1.5 pr-3 font-normal text-ink">{r.name}</th>
                        <td className="py-1.5 pr-3 text-right font-mono text-ink">{n(r.value)}</td>
                        <td className="py-1.5 text-right font-mono">{formatChange(r.change)}</td>
                      </tr>
                    ))
                  : (regionYear?.rows ?? []).map((r, i) => (
                      <tr key={r.group} className="border-b border-line">
                        <td className="py-1.5 pr-3 font-mono">{r.admissions === null ? "" : i + 1}</td>
                        <th scope="row" className="py-1.5 pr-3 font-normal text-ink">{GEO_NAME[r.group].name}</th>
                        <td className="py-1.5 pr-3 text-right font-mono text-ink">{r.admissions === null ? "–" : n(r.admissions)}</td>
                        <td className="py-1.5 pr-3 text-right font-mono">{r.cap ? capText(r.cap) : "–"}</td>
                        <td className="py-1.5 text-right font-mono">{r.admissions === null || r.prev === null ? "" : formatChange(r.admissions - r.prev)}</td>
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

"use client";

import { useMemo } from "react";
import { ChartCard } from "@/components/charts/ChartCard";
import { PillGroup } from "@/components/charts/PillGroup";
import { StackedRows, type StackedRowData } from "@/components/charts/StackedRows";
import { TABLE_TOGGLE } from "@/components/charts/table-toggle";
import { YearPicker } from "@/components/charts/YearPicker";
import { MethodologyNote } from "@/components/MethodologyNote";
import { LPR_BINS, type LprMetric } from "@/lib/lpr-chart";
import { rankLprCountries } from "@/lib/lpr-derive";
import type { LprPayload } from "@/lib/lpr-types";
import { formatChange } from "@/lib/refugee-derive";
import { RefugeeMap, undrawnRefugees, type MapWords } from "./RefugeeMap";
import type { MapFeature } from "./RemovalsMap";
import { n } from "./refugee-style";

type WorldMap = { width: number; height: number; features: MapFeature[] };

const WORDS: Record<LprMetric, MapWords> = {
  lpr: { value: "Green cards", none: "No green cards recorded", subject: "new permanent residents", basis: "country" },
  naturalizations: { value: "Naturalized", none: "No naturalizations recorded", subject: "naturalizations", basis: "country" },
};

const listNames = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : (names[0] ?? ""));

/**
 * "Where new permanent residents come from": green cards (or naturalizations, on the header toggle) for one fiscal year by country,
 * laid out like the refugee and ICE country cards: a choropleth on fixed bins with the top three named, and a ranked list of
 * single-colour bars with the change from the year before. Years come by country of birth; the newest (quarterly-only) year is by
 * nationality, so it gets no change column rather than a comparison across two bases. The year is the section's selected year.
 */
export function LprCountryCard({
  payload,
  worldMap,
  fy,
  yearRange,
  onFy,
  metric,
  onMetric,
  country,
  onCountry,
}: {
  payload: LprPayload;
  worldMap: WorldMap;
  fy: number;
  yearRange: readonly [number, number];
  onFy: (fy: number) => void;
  metric: LprMetric;
  onMetric: (m: LprMetric) => void;
  country: string | null;
  onCountry: (key: string | null) => void;
}) {
  const nat = metric === "naturalizations";
  const ranked = useMemo(() => rankLprCountries(payload, metric, fy), [payload, metric, fy]);
  const cy = payload.countryYears.find((c) => c.metric === metric && c.fy === fy);
  const year = payload.years.find((y) => y.fy === fy);
  const total = (nat ? year?.naturalizations : year?.lpr) ?? 0;
  const byNationality = cy?.basis === "nationality";
  const prelim = year?.preliminary ?? false;
  const prev = `FY${String(fy - 1).slice(2)}`;
  const top3 = ranked.slice(0, 3);
  const topShare = total > 0 ? top3.reduce((a, r) => a + r.value, 0) / total : 0;
  const hasChange = ranked.some((r) => r.change !== null);

  const lede = `FY${fy}: ${n(total)} ${nat ? "people became U.S. citizens" : "people became permanent residents"}${prelim ? " (preliminary)" : ""}, by country of ${byNationality ? "nationality" : "birth"}${top3.length ? `; ${listNames(top3.map((r) => r.name))} led, with ${Math.round(topShare * 100)}% together.` : "."}`;
  const rows: StackedRowData[] = ranked.map((r) => ({
    id: r.key,
    rank: r.rank,
    label: r.name,
    segments: [{ value: r.value, color: "var(--accent)", title: `${r.name}: ${n(r.value)}` }],
    total: n(r.value),
    delta: formatChange(r.change),
    selected: r.key === country,
    dimmed: country !== null && r.key !== country,
  }));
  const scaleMax = Math.max(1, ...ranked.map((r) => r.value));
  const sel = country !== null ? ranked.find((r) => r.key === country) : undefined;
  const chip = country !== null ? (sel ? `${sel.name} · No. ${sel.rank} · ${n(sel.value)}` : `${payload.countries.find((c) => c.key === country)?.name ?? country} · none in FY${fy}`) : null;

  const mapRows = ranked.map((r) => ({ key: r.key, name: r.name, value: r.value }));
  const off = undrawnRefugees(worldMap.features, mapRows);
  const measure = nat ? "Naturalizations" : "Green cards";

  return (
    <ChartCard
      title="Where new permanent residents come from"
      lede={lede}
      action={
        <div className="flex flex-wrap items-center gap-2">
          {chip && <span className="rounded-md border border-line-strong bg-surface-raised px-2 py-0.5 text-[0.75rem] text-ink">{chip}</span>}
          {/* Phones: the play button, year menu and Green cards / Naturalizations toggle share one line (tighter button padding). */}
          <div className="flex flex-wrap items-center gap-1.5 max-sm:[&_[role=group]_button]:px-1.5 sm:gap-2">
            <YearPicker value={fy} range={yearRange} onChange={onFy} format={(v) => `FY${v}`} ariaLabel="Fiscal year shown" />
            <PillGroup<LprMetric>
              ariaLabel="Count shown"
              value={metric}
              onChange={(m) => {
                onMetric(m);
                onCountry(null);
              }}
              options={[
                { value: "lpr", label: "Green cards" },
                { value: "naturalizations", label: "Naturalizations" },
              ]}
            />
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-[1.5fr_1fr] md:items-stretch">
        <RefugeeMap
          features={worldMap.features}
          rows={mapRows}
          mode="countries"
          country={country}
          region={null}
          onPickCountry={onCountry}
          onPickRegion={() => {}}
          fy={fy}
          bins={LPR_BINS[metric]}
          words={WORDS[metric]}
        />
        <div className="flex min-w-0 flex-col">
          {byNationality && (
            <p className="m-0 mb-2 rounded-md border border-line bg-surface-raised px-3 py-2 text-[0.78rem] leading-[1.5] text-ink-muted">
              FY{fy} is counted by country of <b className="font-semibold text-ink">nationality</b> and earlier years by country of birth, so no change from the year before is shown.
            </p>
          )}
          {/* On wide screens the list is as tall as the map beside it (the map sets the row; the list scrolls inside it), so neither leaves white space. */}
          <div className="border-t border-line pt-1 md:relative md:flex-1">
            <div
              className="max-h-[24rem] overflow-y-auto overscroll-contain pr-0.5 touch-scroll md:absolute md:inset-x-0 md:bottom-0 md:top-1 md:max-h-none"
              tabIndex={0}
              aria-label={`${measure} by country, FY${fy}, ${rows.length} countries, scrollable`}
            >
              <StackedRows
                rows={rows}
                scaleMax={scaleMax}
                onRowClick={(id) => onCountry(country === id ? null : id)}
                ariaLabel={`${measure} by country of ${byNationality ? "nationality" : "birth"}, FY${fy}, ranked`}
                emptyText="No figures recorded."
              />
            </div>
          </div>
        </div>
      </div>

      <MethodologyNote>
        <p>
          {nat ? "People aged 18 and over who became U.S. citizens" : "People who became permanent residents"} in the fiscal year, by country of {byNationality ? "nationality (the newest year, preliminary, is the only one the quarterly report gives by nationality)" : "birth (Yearbook)"}. The two bases answer different questions, so a country is never compared across them. Not visas issued or entries, and not the refugee or ICE counts. Colour bins are fixed so years compare.
          {off.names.length > 0 && <> Not on the map (former or unmapped places): {listNames(off.names)}; they are in the list and table.</>} The &ldquo;all other countries&rdquo;, unknown and withheld-count buckets are not countries and are not listed, so the list can fall a little short of the year&rsquo;s total. Cells from FY2015 on are rounded to the nearest ten.
        </p>
      </MethodologyNote>

      <details className="mt-3 text-[0.8rem] text-ink-muted">
        <summary className={TABLE_TOGGLE}>View as table</summary>
        <div className="mt-2 max-h-[24rem] overflow-auto">
          <table className="w-full min-w-[26rem] border-collapse text-left">
            <caption className="sr-only">{`${measure} by country of ${byNationality ? "nationality" : "birth"}, FY${fy}`}</caption>
            <thead>
              <tr className="border-b border-line-strong text-[0.7rem] uppercase tracking-[0.06em] text-ink-faint">
                <th className="py-1.5 pr-3 font-medium">Rank</th>
                <th className="py-1.5 pr-3 font-medium">Country</th>
                <th className="py-1.5 pr-3 text-right font-medium">{measure}</th>
                {hasChange && <th className="py-1.5 text-right font-medium">{`Change vs. ${prev}`}</th>}
              </tr>
            </thead>
            <tbody>
              {ranked.map((r) => (
                <tr key={r.key} className="border-b border-line">
                  <td className="py-1.5 pr-3 font-mono">{r.rank}</td>
                  <th scope="row" className="py-1.5 pr-3 font-normal text-ink">{r.name}</th>
                  <td className="py-1.5 pr-3 text-right font-mono text-ink">{n(r.value)}</td>
                  {hasChange && <td className="py-1.5 text-right font-mono">{formatChange(r.change)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </ChartCard>
  );
}

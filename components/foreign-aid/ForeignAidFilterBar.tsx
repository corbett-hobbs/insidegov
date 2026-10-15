"use client";

import { CountryCombobox } from "@/components/trade/CountryCombobox";
import { MultiSelectFilter, type MultiOption } from "@/components/charts/MultiSelectFilter";
import { formatAidMoney, sectorName, slotOfSector, yearTotal } from "@/lib/foreign-aid-derive";
import type { TradeCountryRef } from "@/lib/trade-types";
import { RangeReset } from "@/components/charts/RangeReset";
import { RangeSelector } from "@/components/charts/RangeSelector";
import { TermBand, type BandTerm } from "@/components/charts/TermBand";
import { useMemo } from "react";
import { useAidState } from "./ForeignAidState";
import { slotColor } from "./shared";

const LABEL = "font-mono text-[0.62rem] uppercase tracking-[0.08em] text-ink-faint";

/**
 * The pinned filter bar for /presidency/foreign-aid, directly under the site navigation: Country (reuses the trade
 * page's combobox), Sector, and the two-handle fiscal-year slider with the presidential-term band under its track (tap
 * a term to add or drop it; there is no President dropdown). The slider sets the window; the one selected year is set by
 * a click on the spending chart or the year menu in the map card. Sector is a checkbox dropdown (`MultiSelectFilter`; each row says the dollars disbursed in the years shown). Every control writes the shared `AidState`. Phones:
 * Country and Sector share a row, the slider its own.
 */
export function ForeignAidFilterBar() {
  const { data, range, setRange, country, setCountry, secs, setSecs } = useAidState();
  const { terms, countries, sectors, years } = data.payload;
  const refs = useMemo<TradeCountryRef[]>(() => countries.map((c) => ({ code: c.name, name: c.name, firstYear: null, lastYear: null })), [countries]);
  const first = years[0];
  const last = years[years.length - 1];
  const bandTerms = useMemo<BandTerm[]>(
    () => terms.map((t) => ({ id: t.termId, label: t.label, last: t.last, initials: t.president.split(" ").map((w) => w[0]).join(""), party: t.party, from: t.fromFy, to: t.toFy })),
    [terms],
  );
  const full = range[0] === first && range[1] === last;
  // Dollars per sector over the years shown (every country plus regional and global programs), so a row says what ticking it adds.
  const sectorOptions = useMemo<MultiOption<number>[]>(
    () =>
      sectors.map((_, si) => {
        let sum = 0;
        for (let fy = range[0]; fy <= range[1]; fy++) sum += yearTotal(data, fy, -1, new Set([si]));
        return { id: si, label: sectorName(data, si), count: formatAidMoney(sum), swatch: slotColor(slotOfSector(si)) };
      }),
    [data, sectors, range],
  );
  const indexOf = useMemo(() => new Map(countries.map((c, i) => [c.name, i])), [countries]);
  return (
    <div className="sticky top-0 z-40 border-b border-line-strong bg-surface/95 shadow-[0_2px_6px_rgba(26,34,51,0.08)] backdrop-blur sm:shadow-none">
      <div className="mx-auto w-full max-w-[1180px] px-4 pb-2 pt-2 sm:px-6 sm:py-2.5">
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 sm:flex sm:flex-nowrap sm:items-center sm:gap-x-4 sm:gap-y-2">
          <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
            <span className={LABEL}>Country</span>
            <CountryCombobox
              countries={refs}
              value={country >= 0 ? countries[country].name : null}
              onChange={(name) => setCountry(name === null ? -1 : (indexOf.get(name) ?? -1))}
              className="w-full sm:w-[9rem]"
            />
          </div>
          <div className="flex min-w-0 flex-col gap-0.5 sm:flex-none sm:flex-row sm:items-center sm:gap-2">
            <span className={LABEL}>Sector</span>
            <MultiSelectFilter label="Sector" noun="sectors" options={sectorOptions} value={secs} onChange={setSecs} className="w-full sm:w-[10rem]" />
          </div>
          <RangeSelector
            min={first}
            max={last}
            value={range}
            onChange={(r) => setRange(r)}
            format={(v) => `FY${String(v).slice(2)}`}
            ariaLabel="Fiscal years shown"
            below={<TermBand terms={bandTerms} min={first} max={last} value={range} onChange={(r) => setRange(r)} />}
            action={<RangeReset show={!full} onReset={() => setRange([first, last])} className="mt-0.5 font-sans leading-none" />}
            className="col-span-2 min-w-0 sm:ml-auto sm:min-w-[14rem] sm:flex-1"
          />
        </div>
      </div>
    </div>
  );
}

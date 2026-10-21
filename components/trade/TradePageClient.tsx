"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { dateOfDay, dayOf, MONTH_NAMES } from "@/lib/indicator-time";
import { termAtDay, termLabel } from "@/lib/trade-chart";
import type { TradePageData } from "@/lib/trade-data";
import type { TradeCountryPayload, TradeYearPayload } from "@/lib/trade-types";
import { ALL_PRODUCTS, type ProductPartnersPayload, type ProductsFlow, type TradeProductsPayload } from "@/lib/trade-products";
import { PRODUCT_USE_START_YEAR } from "@/lib/trade-product-use-entities";
import type { ProductUsePayload, SankeyPick } from "@/lib/trade-sankey";
import type { EndusePartnersPayload, TradeEndusePayload } from "@/lib/trade-enduse";
import { topByTotal } from "@/lib/trade-map";
import { TradeBalanceCard } from "./TradeBalanceCard";
import { TradeFilterBar } from "./TradeFilterBar";
import { TradePartnersCard } from "./TradePartnersCard";
import { TradeProductsCard } from "./TradeProductsCard";
import { TradeSankeyCard } from "./TradeSankeyCard";
import { TradeScatterCard } from "./TradeScatterCard";
import { TradeTariffCard } from "./TradeTariffCard";
import { TradeStateProvider, useTradeActions, useTradeValues } from "./TradeState";
import { SourceLink } from "@/components/SourceLink";
import { UpNext } from "@/components/UpNext";

export function TradePageClient({ data }: { data: TradePageData }) {
  return (
    <TradeStateProvider lastYear={data.lastYear}>
      <TradePage data={data} />
    </TradeStateProvider>
  );
}

function TradePage({ data }: { data: TradePageData }) {
  const v = useTradeValues();
  const { setRange, clearPin, setCountry, setShowCong, setYear } = useTradeActions();
  const { era, national, countries, firstYear, lastYear, initialYear, scatter, tariffFlags, tariffLastReviewed, worldMap, products, enduse } = data;
  const [loaded, setLoaded] = useState<Record<string, TradeCountryPayload>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const inflight = useRef<AbortController | null>(null);
  const [years, setYears] = useState<Record<number, TradeYearPayload>>({ [initialYear.year]: initialYear });
  const [yearFailed, setYearFailed] = useState<number | null>(null);

  // A country's file is fetched once, when first selected (precedent: /data/[chamber]).
  useEffect(() => {
    const code = v.country;
    if (!code || loaded[code]) return;
    const ctl = new AbortController();
    inflight.current?.abort();
    inflight.current = ctl;
    fetch(`/data/trade/countries/${encodeURIComponent(code)}`, { signal: ctl.signal })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<TradeCountryPayload>;
      })
      .then((p) => {
        setFailed(null);
        setLoaded((m) => ({ ...m, [p.code]: p }));
      })
      .catch((e) => {
        if (e?.name !== "AbortError") setFailed(code);
      });
    return () => ctl.abort();
  }, [v.country, loaded]);

  // A year's partner rows are fetched once, when the year dropdown first picks it.
  useEffect(() => {
    const y = v.year;
    if (years[y]) return;
    const ctl = new AbortController();
    fetch(`/data/trade/years/${y}`, { signal: ctl.signal })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<TradeYearPayload>;
      })
      .then((p) => {
        setYearFailed(null);
        setYears((m) => ({ ...m, [p.year]: p }));
      })
      .catch((e) => {
        if (e?.name !== "AbortError") setYearFailed(y);
      });
    return () => ctl.abort();
  }, [v.year, years]);
  // Goods by product: one file per partner (all years), plus one for all countries, fetched when first needed.
  const productCodes = useMemo(() => new Set(products.codes), [products.codes]);
  const productsKey = v.country ? (productCodes.has(v.country) ? v.country : null) : ALL_PRODUCTS;
  const productFile = useStaticFile<TradeProductsPayload>("/data/trade/products", productsKey);

  // The top countries behind each product: one small file per year, fetched for the year on screen once a line has been opened.
  const [partnersWanted, setPartnersWanted] = useState(false);
  const partnersFile = useStaticFile<ProductPartnersPayload>("/data/trade/product-partners", partnersWanted ? String(v.year) : null);

  // The card's "By use" view: the same two kinds of file by end-use category, fetched only once someone switches to it.
  const [enduseWanted, setEnduseWanted] = useState(false);
  const enduseCodes = useMemo(() => new Set(enduse.codes), [enduse.codes]);
  const enduseKey = v.country ? (enduseCodes.has(v.country) ? v.country : null) : ALL_PRODUCTS;
  const enduseFile = useStaticFile<TradeEndusePayload>("/data/trade/enduse", enduseWanted ? enduseKey : null);
  const [endusePartnersWanted, setEndusePartnersWanted] = useState(false);
  const endusePartnersFile = useStaticFile<EndusePartnersPayload>("/data/trade/enduse-partners", endusePartnersWanted ? String(v.year) : null);

  // "From product to use": shown once a line is tapped in the products card (all countries only), fetching the year's file then.
  const [follow, setFollow] = useState<{ flow: ProductsFlow; pick: SankeyPick } | null>(null);
  const sankeyShown = follow !== null && v.country === null && v.year >= PRODUCT_USE_START_YEAR;
  const productUseFile = useStaticFile<ProductUsePayload>("/data/trade/product-use", sankeyShown ? String(v.year) : null);
  // A new line followed after a failed load retries it.
  const retryProductUse = useRef<() => void>(() => {});
  useEffect(() => {
    retryProductUse.current = productUseFile.state === "error" ? productUseFile.retry : () => {};
  });
  const onFollow = useCallback((f: { flow: ProductsFlow; pick: SankeyPick }) => {
    setFollow((o) => (o && o.flow === f.flow && o.pick.kind === f.pick.kind && o.pick.code === f.pick.code ? o : f));
    retryProductUse.current();
  }, []);
  const [lastYearStr, lastMonthStr] = national.lastPeriod.split("-");
  const yearPartial = v.year === Number(lastYearStr) && Number(lastMonthStr) < 12;

  // While the next year loads, the previous one stays on screen (dimmed) instead of blanking the chart.
  const [lastShown, setLastShown] = useState<TradeYearPayload>(initialYear);
  const yearPayload = years[v.year] ?? null;
  if (yearPayload && yearPayload !== lastShown) setLastShown(yearPayload);

  // The scatter labels the biggest partners by total trade in the latest year; it takes the first few that survive its continent filter, so the whole ranking goes down.
  const topCodes = useMemo(() => topByTotal(initialYear.partners, initialYear.partners.length), [initialYear]);

  // Dot size on the scatter: latest-year total trade (exports + imports), $M, by partner code.
  const totals = useMemo(() => Object.fromEntries(initialYear.partners.map((p) => [p[0], p[2] + p[3]])), [initialYear]);

  const countryRef = v.country ? countries.find((c) => c.code === v.country) ?? null : null;
  const payload = v.country ? loaded[v.country] : undefined;
  const loadState: "idle" | "loading" | "error" | "ok" = !v.country ? "idle" : payload ? "ok" : failed === v.country ? "error" : "loading";
  const series = useMemo(
    () => (payload ? { exports: payload.exports, imports: payload.imports } : !v.country ? { exports: national.sa.exports, imports: national.sa.imports } : null),
    [payload, national, v.country],
  );

  const range = useMemo<[number, number]>(() => v.range ?? [firstYear, lastYear], [v.range, firstYear, lastYear]);
  const view = useMemo<[number, number]>(() => [dayOf(range[0], 0, 1), Math.min(era.span, dayOf(range[1] + 1, 0, 1))], [range, era.span]);

  const describe = (d: number) => {
    const { year, month } = dateOfDay(d);
    const t = termAtDay(era.terms, d);
    return `${MONTH_NAMES[month]} ${year}${t ? `, ${termLabel(t)}` : ""}`;
  };
  // Announced only when a date is pinned, never on every mouse move.
  const announcement = v.pin === null ? "" : `Pinned ${describe(v.pin)}.`;

  return (
    <>
      <TradeFilterBar
        terms={era.terms}
        countries={countries}
        country={v.country}
        onCountry={setCountry}
        range={range}
        firstYear={firstYear}
        lastYear={lastYear}
        onRange={setRange}
        canClear={v.pin !== null}
        onClear={clearPin}
      />
      <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-4 pb-16 pt-7 sm:px-6">
        <div aria-live="polite" className="sr-only">
          {announcement}
        </div>
        <PageHeader eyebrow="Presidency · Trade" title="How Does the U.S. Trade With the World?">
          <p>
            Who the U.S. buys from and sells to, and what it charges in tariffs on what comes in. Tariffs change what
            Americans pay and who they trade with, and the marked dates show when the courts, Congress and the White
            House pulled the levers.
          </p>
        </PageHeader>

        <label className="-mb-2 flex w-fit cursor-pointer items-center gap-2 text-[0.8rem] text-ink">
          <input
            type="checkbox"
            checked={v.showCong}
            onChange={(e) => setShowCong(e.target.checked)}
            className="m-0 accent-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          />
          Show Congress control under the charts
        </label>

        <TradeBalanceCard
          series={series}
          countryName={countryRef?.name ?? null}
          adjusted={!v.country}
          era={era}
          view={view}
          loading={loadState === "loading"}
          error={loadState === "error"}
        />

        <TradeTariffCard
          national={{ duties: national.duties, imports: national.dutyImports }}
          country={payload ? { duties: payload.duties, imports: payload.dutyImports } : null}
          countryName={countryRef?.name ?? null}
          era={era}
          view={view}
          flags={tariffFlags}
          lastReviewed={tariffLastReviewed}
          loading={loadState === "loading"}
          error={loadState === "error"}
        />

        {/* One card: the list and the map share the year and the Total trade / Balance choice. */}
          <TradePartnersCard
            map={worldMap}
            payload={yearPayload ?? lastShown}
            year={v.year}
            onYear={setYear}
            firstYear={firstYear}
            lastYear={lastYear}
            lastPeriod={national.lastPeriod}
            country={v.country}
            onPickCountry={setCountry}
            loading={!yearPayload && yearFailed !== v.year}
            error={!yearPayload && yearFailed === v.year}
          />

        {/* Full width, under the partners card whose year it shares: which goods, for the Country filter's partner (or all countries). */}
        <TradeProductsCard
          payload={productFile.data}
          year={v.year}
          onYear={setYear}
          firstYear={products.firstYear}
          lastYear={lastYear}
          through={MONTH_NAMES[Number(national.lastPeriod.slice(5)) - 1]}
          country={v.country}
          countryName={countryRef?.name ?? null}
          hasData={productsKey !== null}
          lag={products.lag}
          loading={productFile.state === "loading"}
          error={productFile.state === "error"}
          partners={partnersFile.data}
          partnersState={partnersFile.state}
          onWantPartners={() => {
            setPartnersWanted(true);
            partnersFile.retry(); // a tap after a failure retries
          }}
          byUse={{
            payload: enduseFile.data,
            hasData: enduseKey !== null,
            loading: enduseFile.state === "loading" || (enduseKey !== null && enduseFile.state === "idle"),
            error: enduseFile.state === "error",
            onWant: () => {
              setEnduseWanted(true);
              enduseFile.retry();
            },
            partners: endusePartnersFile.data,
            partnersState: endusePartnersFile.state,
            onWantPartners: () => {
              setEndusePartnersWanted(true);
              endusePartnersFile.retry();
            },
          }}
          onFollow={onFollow}
        />

        {/* Directly under the products card, once a line there is tapped: that line followed from chapter to product to use. */}
        {sankeyShown && follow && (
          <TradeSankeyCard
            payload={productUseFile.data}
            state={productUseFile.state === "error" ? "error" : productUseFile.data ? "ok" : "loading"}
            year={v.year}
            partial={yearPartial}
            flow={follow.flow}
            pick={follow.pick}
          />
        )}

        {/* Full width: the scatter needs the room for its labels. */}
        <TradeScatterCard rows={scatter.rows} windows={scatter.windows} country={v.country} onPickCountry={setCountry} topCodes={topCodes} totals={totals} />

        <UpNext />
        <p className="m-0 text-[0.8rem] leading-[1.6] text-ink-muted">
          Source: <SourceLink id="census-trade">U.S. Census Bureau</SourceLink> (trade values and calculated duties, 2010 on); <SourceLink id="usitc-dataweb">U.S. International Trade Commission
          DataWeb</SourceLink> (calculated duties, 1993 to 2009). Goods only, Census basis; services are not included. Calculated
          duties are computed from import entries, not Treasury receipts. Presidential terms and recession dates match the
          Economy page.
        </p>
      </main>
    </>
  );
}

/**
 * One prerendered JSON file under `base`, fetched the first time `key` asks for it and kept for the visit (the
 * products and end-use files by partner, their top-countries files by year). `key` null means not wanted yet. A
 * failed key is not refetched until `retry` (a tap after the failure) or another key succeeds.
 */
function useStaticFile<T>(base: string, key: string | null): { data: T | null; state: "idle" | "loading" | "error" | "ok"; retry: () => void } {
  const [files, setFiles] = useState<Record<string, T>>({});
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    if (key === null || files[key] || failed === key) return;
    const ctl = new AbortController();
    fetch(`${base}/${encodeURIComponent(key)}`, { signal: ctl.signal })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<T>;
      })
      .then((p) => {
        setFailed(null);
        setFiles((m) => ({ ...m, [key]: p }));
      })
      .catch((e) => {
        if (e?.name !== "AbortError") setFailed(key);
      });
    return () => ctl.abort();
  }, [base, key, files, failed]);
  const data = key === null ? null : files[key] ?? null;
  return { data, state: key === null ? "idle" : data ? "ok" : failed === key ? "error" : "loading", retry: () => setFailed(null) };
}

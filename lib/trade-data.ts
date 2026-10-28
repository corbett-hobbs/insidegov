import "server-only";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  countryRow,
  dutiesByCountryRow,
  dutiesNationalRow,
  tradeByCountryRow,
  tradeNationalRow,
  type CountryRow,
  type DutiesByCountryRow,
  type TradeByCountryRow,
} from "./trade-entities";
import { buildCountryPayload, buildNationalPayload, buildYearPayload } from "./trade-payload";
import { monthCount, monthIndex } from "./trade-derive";
import { displayCountryName } from "./trade-names";
import { getEraLayers } from "./indicator-data";
import { getWorldMap } from "./foreign-aid-data";
import { ratePercentSeries, spanEnd, storyCountryCode } from "./trade-chart";
import type { NewsFile } from "./news-types";
import { monthIndexOfDay } from "./indicator-time";
import { buildHubTariff, type HubTariff } from "./trade-hub";
import type { EconomyPayload } from "./indicator-payload";
import { tariffActionsFile } from "./tariff-actions-entities";
import { buildScatterRows, scatterWindows, type ScatterRow, type ScatterWindows } from "./trade-scatter";
import { getProductsCodes, getProductsPayload } from "./trade-products-data";
import { getEnduseCodes } from "./trade-enduse-data";
import { lagOf, type ProductsLag } from "./trade-products";
import { PRODUCTS_START_YEAR } from "./trade-products-entities";
import type { TariffFlag, TradeCountryPayload, TradeCountryRef, TradeNationalPayload, TradeYearPayload } from "./trade-types";

/**
 * Build-time trade dataset: reads the pipeline's trade files and hands the page
 * compact payloads. Mirrors `lib/indicator-data.ts`; the pivoting lives in the
 * pure `lib/trade-payload.ts`. Nothing is fetched at runtime in the app: the page
 * ships the national series, and `/data/trade/...` serves one country (all years)
 * or one year (all partners) as static JSON on demand.
 */

const OUT = join(process.cwd(), "pipeline", "output");

const readJson = (file: string): unknown[] => JSON.parse(readFileSync(join(OUT, file), "utf8"));

let cache: {
  countries: CountryRow[];
  trade: Map<number, TradeByCountryRow[]>;
  duties: Map<number, DutiesByCountryRow[]>;
  national: TradeNationalPayload;
  length: number;
} | null = null;

function load() {
  if (cache) return cache;
  // Newest last_year first, so a code shared by a recode resolves to its current name.
  const countries = readJson("countries.json")
    .map((r) => countryRow.parse(r))
    .sort((a, b) => (b.last_year ?? 0) - (a.last_year ?? 0));
  const shards = <T>(dir: string, parse: (r: unknown) => T) => {
    const m = new Map<number, T[]>();
    for (const f of readdirSync(join(OUT, dir)).filter((x) => /^\d{4}\.json$/.test(x))) m.set(Number(f.slice(0, 4)), readJson(`${dir}/${f}`).map(parse));
    return m;
  };
  const trade = shards("trade_by_country", (r) => tradeByCountryRow.parse(r));
  const duties = shards("duties_by_country", (r) => dutiesByCountryRow.parse(r));
  const national = buildNationalPayload(
    readJson("trade_national.json").map((r) => tradeNationalRow.parse(r)),
    readJson("duties_national.json").map((r) => dutiesNationalRow.parse(r)),
  );
  cache = { countries, trade, duties, national, length: monthCount(national.lastPeriod) };
  return cache;
}

/** What ships inline with the page. */
export function getTradeNational(): TradeNationalPayload {
  return load().national;
}

/** Non-aggregate country codes with a goods series (the country dropdown and `/data/trade/countries/[code]`). */
export function getTradeCountryRefs(): TradeCountryRef[] {
  const seen = new Set<string>();
  const out: TradeCountryRef[] = [];
  for (const c of load().countries) {
    if (c.is_aggregate || seen.has(c.country_code)) continue;
    seen.add(c.country_code);
    out.push({ code: c.country_code, name: displayCountryName(c.country_code, c.name), firstYear: c.first_year, lastYear: c.last_year });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function getTradeYears(): number[] {
  return [...load().trade.keys()].sort((a, b) => a - b);
}

export function getTradeCountry(code: string): TradeCountryPayload | null {
  const d = load();
  const ref = getTradeCountryRefs().find((c) => c.code === code);
  if (!ref) return null;
  const trade = [...d.trade.values()].flat().filter((r) => r.country_code === code);
  const duties = [...d.duties.values()].flat().filter((r) => r.country_code === code);
  return buildCountryPayload({ country_code: code, name: ref.name }, trade, duties, d.length);
}

/**
 * The duty rate (percent) of each partner a "Tariffs involving <country>" story names, for the story's sparkline: the last 36
 * months up to the country's latest month with a rate, `from` the month index (Jan 1991 = 0) of the first. Read here, on the
 * server, so the page ships a few dozen numbers per partner instead of fetching the country's file.
 */
export type StoryCountryRates = Record<string, { name: string; from: number; rates: (number | null)[] }>;

export function getStoryCountryRates(file: NewsFile | null): StoryCountryRates {
  const out: StoryCountryRates = {};
  for (const story of file?.stories ?? []) {
    const code = story.chartId === "tariffs" ? storyCountryCode(story.id) : null;
    if (!code || out[code]) continue;
    const country = getTradeCountry(code);
    if (!country) continue;
    const rates = ratePercentSeries(country.duties, country.dutyImports);
    let last = rates.length - 1;
    while (last >= 0 && rates[last] === null) last--;
    if (last < 0) continue;
    const from = Math.max(0, last - 35);
    out[code] = { name: country.name, from, rates: rates.slice(from, last + 1).map((v) => (v === null ? null : Math.round(v * 100) / 100)) };
  }
  return out;
}

export function getTradeYear(year: number): TradeYearPayload | null {
  const d = load();
  const trade = d.trade.get(year);
  if (!trade) return null;
  return buildYearPayload(year, d.countries, trade, d.duties.get(year) ?? []);
}

export interface TradePageData {
  national: TradeNationalPayload;
  countries: TradeCountryRef[];
  /** Presidential terms, recessions and chamber control on the shared day axis (same layers as the Economy page). */
  era: Pick<EconomyPayload, "rec" | "terms" | "control"> & { span: number };
  firstYear: number;
  lastYear: number;
  /** The curated tariff timeline (flags on Chart 2) and the date it was last reviewed. */
  tariffFlags: TariffFlag[];
  tariffLastReviewed: string;
  /** Chart 5: per-country change in duty rate and imports between the baseline and latest windows. */
  scatter: { windows: ScatterWindows; rows: ScatterRow[] };
  /** The latest year's partner rows, so the partners chart paints without a fetch. */
  initialYear: TradeYearPayload;
  /** Outlines for the trade map, keyed by trade `country_code` (the same world map the foreign-aid page draws). */
  worldMap: { width: number; height: number; features: { key: string; name: string; d: string }[] };
  /** The goods-by-product card: partners with a product file (fetched from `/data/trade/products/[code]`) and the first year. */
  products: { codes: string[]; firstYear: number; lag: (ProductsLag & { name: string })[] };
  /** The card's "By use" view: partners with an end-use file (fetched from `/data/trade/enduse/[code]`). Starts the same year as products. */
  enduse: { codes: string[] };
}

/** Everything the trade page ships inline: the national series, the country list and the era layers. */
export function getTradePageData(): TradePageData {
  const national = getTradeNational();
  const last = monthIndex(national.lastPeriod);
  const span = spanEnd(last);
  const lastYear = Number(national.lastPeriod.slice(0, 4));
  const initialYear = getTradeYear(lastYear);
  if (!initialYear) throw new Error(`no trade shard for ${lastYear}`);
  return {
    national,
    countries: getTradeCountryRefs(),
    era: { span, ...getEraLayers(span) },
    scatter: getScatter(),
    ...getTariffFlags(),
    firstYear: 1991,
    lastYear,
    initialYear,
    worldMap: (({ width, height, features }) => ({ width, height, features }))(getWorldMap()),
    products: { codes: getProductsCodes(), firstYear: PRODUCTS_START_YEAR, lag: getProductsLag(lastYear) },
    enduse: { codes: getEnduseCodes() },
  };
}

/** Partners whose product data for the year in progress trails the goods file by more than rounding (Data notes name them). */
function getProductsLag(year: number): (ProductsLag & { name: string })[] {
  const names = new Map(getTradeCountryRefs().map((c) => [c.code, c.name]));
  const goods = new Map((load().trade.get(year) ?? []).map((r) => [r.country_code, r]));
  const sum = (xs: (number | null)[]) => xs.reduce<number>((a, x) => a + (x ?? 0), 0);
  return getProductsCodes().flatMap((code) => {
    const g = goods.get(code);
    const rows = g ? getProductsPayload(code)?.rows.filter((r) => r.year === year) ?? [] : [];
    return rows.flatMap((r) => {
      const l = lagOf(code, r, sum(g![r.flow]));
      return l ? [{ ...l, name: names.get(code) ?? code }] : [];
    });
  });
}

/** Every country with a duties series, as monthly arrays on the shared axis (the scatter). */
function dutyInputs(): { code: string; name: string; duties: (number | null)[]; imports: (number | null)[] }[] {
  const d = load();
  const names = new Map(getTradeCountryRefs().map((c) => [c.code, c.name]));
  const byCode = new Map<string, DutiesByCountryRow[]>();
  for (const rows of d.duties.values()) for (const r of rows) (byCode.get(r.country_code) ?? byCode.set(r.country_code, []).get(r.country_code)!).push(r);
  return [...byCode].flatMap(([code, rows]) => {
    const name = names.get(code);
    if (!name) return []; // aggregates carry no duties rows; an unknown code is skipped, not guessed
    const p = buildCountryPayload({ country_code: code, name }, [], rows, d.length);
    return [{ code, name, duties: p.duties, imports: p.dutyImports }];
  });
}

const lastDutiesPeriod = () => {
  const last = readJson("duties_national.json").map((r) => dutiesNationalRow.parse(r)).map((r) => r.period).sort().pop();
  if (!last) throw new Error("duties_national.json is empty");
  return last;
};

/** Chart 5 rows: every country that has a duties series, over the windows set in `lib/trade-scatter.ts`. */
export function getScatter(): { windows: ScatterWindows; rows: ScatterRow[] } {
  const windows = scatterWindows(lastDutiesPeriod());
  return { windows, rows: buildScatterRows(dutyInputs(), windows) };
}

/** The curated tariff actions (hand-maintained, see docs/TARIFF_ACTIONS_CURATION.md), trimmed for the chart. */
export function getTariffFlags(): { tariffFlags: TariffFlag[]; tariffLastReviewed: string } {
  const file = tariffActionsFile.parse(JSON.parse(readFileSync(join(OUT, "tariff_actions.json"), "utf8")));
  return {
    tariffLastReviewed: file.last_reviewed,
    tariffFlags: file.actions.map((a) => ({
      id: a.action_id,
      date: a.date,
      label: a.label_short,
      description: a.description,
      authority: a.authority,
      kind: a.kind,
      priority: a.flag_priority,
      cutover: a.is_cutover,
      status: a.legal_status,
      statusNote: a.status_note ?? null,
      rateNote: a.rate_note ?? null,
    })),
  };
}

/** The homepage Presidency card: the national duty rate with the presidential terms under it (`lib/trade-hub.ts`). */
export function getHubTariff(): HubTariff {
  const national = getTradeNational();
  const { terms } = getEraLayers(spanEnd(monthIndex(national.lastPeriod)));
  return buildHubTariff(
    national.duties,
    national.dutyImports,
    terms.map((t) => ({
      label: t.label,
      party: t.party,
      startYear: t.startYear,
      endYear: t.endYear,
      m0: monthIndexOfDay(t.s),
      m1: monthIndexOfDay(t.e - 1),
    })),
  );
}

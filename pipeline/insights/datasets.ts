import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import type { Administration, CellRef, DatasetId, EventSet, Point, Series, UnitFormat } from "./types";

/**
 * Loads committed pipeline outputs into insight series. Every point keeps the cells it was built from, so verify.ts can
 * trace each caption number back to a row. `ref` reads the file as it was at a git revision instead of the working tree
 * (the freshness workflows use `HEAD`, the data before the refresh, to tell which periods are new).
 */

type Row = Record<string, unknown>;

export function readOutput<T = Row[]>(file: string, ref?: string): T {
  const text = ref
    ? execFileSync("git", ["show", `${ref}:${file}`], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 })
    : readFileSync(file, "utf8");
  return JSON.parse(text) as T;
}

const OUT = "pipeline/output";
const ENERGY_OBS = `${OUT}/energy_observations.json`;
const INDICATOR_OBS = `${OUT}/indicator_observations.json`;
const ENCOUNTERS = `${OUT}/encounters_monthly.json`;
const ENCOUNTERS_FY = `${OUT}/encounters_series.json`;
const ENFORCEMENT = `${OUT}/enforcement_series.json`;
const TRADE = `${OUT}/trade_national.json`;
const EOS = `${OUT}/executive_orders.json`;
const LAWS = `${OUT}/laws.json`;
const ADMINS = `${OUT}/administrations.json`;

export const DATASET_FILES: Record<DatasetId, string[]> = {
  energy: [ENERGY_OBS],
  gas: [INDICATOR_OBS],
  encounters: [ENCOUNTERS, ENCOUNTERS_FY],
  ice: [ENFORCEMENT],
  trade: [TRADE],
  executive_orders: [EOS],
  laws: [LAWS],
};

export const DATASETS = Object.keys(DATASET_FILES) as DatasetId[];

const MBD: UnitFormat = { scale: 0.001, decimals: 2, suffix: "M barrels/day" };
const BKWH: UnitFormat = { scale: 0.001, decimals: 1, suffix: "B kWh" };
const COUNT: UnitFormat = { scale: 1, decimals: 0, suffix: "" };
const USD_BN: UnitFormat = { scale: 0.001, decimals: 1, prefix: "$", suffix: "B" };

type SeriesConfig = Omit<Series, "points" | "dataset" | "url" | "source" | "frequency" | "kind" | "moveMode"> &
  Partial<Pick<Series, "frequency" | "kind" | "moveMode">>;

const EIA = "U.S. Energy Information Administration";
const ENERGY: (SeriesConfig & { series_id: string })[] = [
  { series_id: "PAPRPUS", anchor: "#supply", id: "energy.crude_production", name: "U.S. crude oil production", axisLabel: "million barrels a day", unit: MBD, seasonal: false, weight: 1.3 , releaseLagDays: 60, headline: true },
  { series_id: "PAEXPUS", anchor: "#oil", id: "energy.petroleum_exports", name: "U.S. petroleum exports (crude oil plus products)", axisLabel: "million barrels a day", unit: MBD, seasonal: false, weight: 0.9 , releaseLagDays: 60 },
  { series_id: "PAIMPUS", anchor: "#oil", id: "energy.petroleum_imports", name: "U.S. petroleum imports (crude oil plus products)", axisLabel: "million barrels a day", unit: MBD, seasonal: false, weight: 0.9 , releaseLagDays: 60 },
  { series_id: "COEXPUS", anchor: "#oil", id: "energy.crude_exports", name: "U.S. crude oil exports", axisLabel: "million barrels a day", unit: MBD, seasonal: false, weight: 0.9 , releaseLagDays: 60 },
  {
    series_id: "WCSSTUS1", anchor: "#spr",
    id: "energy.spr",
    name: "crude oil in the Strategic Petroleum Reserve",
    axisLabel: "million barrels",
    unit: { scale: 0.001, decimals: 1, suffix: "M barrels" },
    seasonal: false,
    frequency: "weekly",
    weight: 1.2,
    // Weekly Petroleum Status Report: the week ending Friday is out the next Wednesday.
    releaseLagDays: 5,
  },
  // Monthly totals vary with the number of days in a month, so these compare like months.
  { series_id: "NGPRPUS", id: "energy.gas_production", name: "U.S. dry natural gas production", axisLabel: "billion cubic feet", unit: { scale: 1, decimals: 0, suffix: "B cu ft" }, seasonal: true, weight: 0.9 , releaseLagDays: 60 },
  { series_id: "N9133US2", anchor: "#lng", id: "energy.lng_exports", name: "U.S. liquefied natural gas exports", axisLabel: "billion cubic feet", unit: { scale: 0.001, decimals: 1, suffix: "B cu ft" }, seasonal: true, weight: 1.1 , releaseLagDays: 60 },
  { series_id: "ELETPUS", anchor: "#electricity", id: "energy.power_total", name: "U.S. electricity generation", axisLabel: "billion kilowatthours", unit: BKWH, seasonal: true, weight: 1.0 , releaseLagDays: 55, headline: true },
  { series_id: "CLETPUS", anchor: "#electricity", id: "energy.power_coal", name: "U.S. electricity generation from coal", axisLabel: "billion kilowatthours", unit: BKWH, seasonal: true, weight: 1.0 , releaseLagDays: 55 },
  { series_id: "NGETPUS", anchor: "#electricity", id: "energy.power_gas", name: "U.S. electricity generation from natural gas", axisLabel: "billion kilowatthours", unit: BKWH, seasonal: true, weight: 0.9 , releaseLagDays: 55 },
  { series_id: "NUETPUS", anchor: "#electricity", id: "energy.power_nuclear", name: "U.S. electricity generation from nuclear plants", axisLabel: "billion kilowatthours", unit: BKWH, seasonal: true, weight: 0.8 , releaseLagDays: 55 },
  { series_id: "WYETPUS", anchor: "#electricity", id: "energy.power_wind", name: "U.S. electricity generation from wind", axisLabel: "billion kilowatthours", unit: BKWH, seasonal: true, weight: 0.9 , releaseLagDays: 55 },
  { series_id: "SOETPUS", anchor: "#electricity", id: "energy.power_solar", name: "U.S. utility-scale solar generation", axisLabel: "billion kilowatthours", unit: BKWH, seasonal: true, weight: 0.9 , releaseLagDays: 55 },
];

/** Insight series id to EIA series id ("energy.spr" -> "WCSSTUS1"), the key energy_actions.json flags its actions with. */
export const EIA_SERIES: Record<string, string> = Object.fromEntries(ENERGY.map((c) => [c.id, c.series_id]));

const GAS: (SeriesConfig & { series_id: string })[] = [
  {
    series_id: "GASREGW", anchor: "#gas-price",
    id: "gas.regular",
    name: "the U.S. average price of regular gasoline",
    axisLabel: "dollars a gallon",
    unit: { scale: 1, decimals: 2, prefix: "$", suffix: "/gal" },
    seasonal: false,
    frequency: "weekly",
    context: ["Weekly retail price averaged over all U.S. stations, in nominal dollars (not adjusted for inflation)."],
    weight: 1.5,
    headline: true,
    // EIA surveys stations on Monday and publishes that afternoon or Tuesday.
    releaseLagDays: 1,
  },
  {
    series_id: "GASDESW", anchor: "#gas-price",
    id: "gas.diesel",
    name: "the U.S. average price of diesel",
    axisLabel: "dollars a gallon",
    unit: { scale: 1, decimals: 2, prefix: "$", suffix: "/gal" },
    seasonal: false,
    frequency: "weekly",
    weight: 1.1,
    releaseLagDays: 1,
  },
];

const monthDate = (month: string) => `${month}-01`;

function observationSeries(rows: Row[], file: string, cfg: SeriesConfig & { series_id: string }, base: Pick<Series, "dataset" | "url" | "source">): Series {
  const { series_id, ...rest } = cfg;
  const points: Point[] = rows
    .filter((r) => r.series_id === series_id && typeof r.value === "number")
    .map((r) => ({ date: String(r.date), value: r.value as number, cells: [{ file, key: { series_id, date: String(r.date) }, field: "value" }] }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return { frequency: "monthly", kind: "level", moveMode: "pct", ...rest, ...base, points };
}

export function loadEnergy(ref?: string): Series[] {
  const rows = readOutput(ENERGY_OBS, ref);
  return ENERGY.map((c) => observationSeries(rows, ENERGY_OBS, c, { dataset: "energy", url: "/presidency/energy", source: EIA }));
}

export function loadGas(ref?: string): Series[] {
  const rows = readOutput(INDICATOR_OBS, ref);
  return GAS.map((c) => observationSeries(rows, INDICATOR_OBS, c, { dataset: "gas", url: "/presidency/economy", source: `${EIA}, via FRED` }));
}

/** CBP encounters: Border Patrol apprehensions plus port-of-entry inadmissibles, Title 8 and Title 42 added together. */
export function loadEncounters(ref?: string): Series[] {
  const rows = readOutput(ENCOUNTERS, ref);
  const monthly = (["southwest", "nationwide"] as const).map((scope): Series => {
    const byMonth = new Map<string, Point>();
    for (const r of rows) {
      if (r.scope !== scope || typeof r.value !== "number") continue;
      const date = monthDate(String(r.month));
      const p = byMonth.get(date) ?? byMonth.set(date, { date, value: 0, cells: [] }).get(date)!;
      p.value += r.value;
      p.cells.push({ file: ENCOUNTERS, key: { month: String(r.month), scope, component: String(r.component), authority: String(r.authority) }, field: "value" });
    }
    return {
      id: `encounters.${scope}`,
      dataset: "encounters" as const,
      name: scope === "southwest" ? "CBP encounters at the southwest border" : "CBP encounters nationwide",
      axisLabel: "encounters per month",
      totalAxisLabel: "encounters",
      unit: COUNT,
      frequency: "monthly" as const,
      seasonal: false,
      kind: "flow" as const,
      moveMode: "pct" as const,
      context: [
        "Encounters count events, not people: one person stopped twice is two encounters.",
        "Border Patrol apprehensions and port-of-entry inadmissibles, Title 8 and Title 42, added together.",
      ],
      points: [...byMonth.values()].sort((a, b) => a.date.localeCompare(b.date)),
      url: "/presidency/immigration",
      anchor: "#border-encounters-by-fiscal-year",
      source: "U.S. Customs and Border Protection",
      weight: scope === "southwest" ? 1.5 : 1.1,
      headline: scope === "southwest",
      // CBP posts a month's figures in the middle of the next month.
      releaseLagDays: 18,
    };
  });
  return [...monthly, loadEncountersFiscal(ref)];
}

/**
 * Southwest border encounters by fiscal year, from FY2004 (the first year with port-of-entry figures beside Border Patrol's)
 * and only complete years. Lands when CBP publishes September.
 */
function loadEncountersFiscal(ref?: string): Series {
  const rows = readOutput(ENCOUNTERS_FY, ref).filter((r) => r.scope === "southwest" && r.period_type === "fiscal_year" && (r.period as number) >= 2004 && typeof r.value === "number");
  const byYear = new Map<number, Point & { complete: boolean }>();
  for (const r of rows) {
    const fy = r.period as number;
    const p = byYear.get(fy) ?? byYear.set(fy, { date: `${fy}-09-30`, value: 0, cells: [], complete: true }).get(fy)!;
    p.value += r.value as number;
    p.complete &&= r.months === 12;
    p.cells.push({ file: ENCOUNTERS_FY, key: { period: fy, period_type: "fiscal_year", scope: "southwest", component: String(r.component), authority: String(r.authority) }, field: "value" });
  }
  return {
    id: "encounters.southwest_fy",
    dataset: "encounters",
    name: "CBP encounters at the southwest border",
    axisLabel: "encounters per fiscal year",
    unit: COUNT,
    frequency: "fiscal_year",
    seasonal: false,
    kind: "flow",
    moveMode: "pct",
    context: [
      "Encounters count events, not people: one person stopped twice is two encounters.",
      "Fiscal years run October to September. Border Patrol apprehensions plus port-of-entry inadmissibles (Title 8 and Title 42).",
    ],
    points: [...byYear.values()].filter((p) => p.complete).map((p) => ({ date: p.date, value: p.value, cells: p.cells })).sort((a, b) => a.date.localeCompare(b.date)),
    url: "/presidency/immigration",
    anchor: "#border-encounters-by-fiscal-year",
    source: "U.S. Customs and Border Protection",
    weight: 1.5,
    releaseLagDays: 18,
  };
}

/** ICE fiscal-year totals (removals, average daily detention population). */
export function loadIce(ref?: string): Series[] {
  const rows = readOutput(ENFORCEMENT, ref);
  const metrics = [
    { metric: "removals", id: "ice.removals", name: "ICE removals", axisLabel: "removals per fiscal year", weight: 1.4 },
    { metric: "detention_adp", id: "ice.detention", name: "the average daily population in ICE detention", axisLabel: "people, daily average", weight: 1.2 },
  ];
  return metrics.map((m) => ({
    id: m.id,
    dataset: "ice" as const,
    name: m.name,
    axisLabel: m.axisLabel,
    unit: COUNT,
    frequency: "fiscal_year" as const,
    seasonal: false,
    kind: "flow" as const,
    moveMode: "pct" as const,
    points: rows
      .filter((r) => r.metric === m.metric && r.scope === "ice" && r.arresting_agency === null && r.criminality === null && r.period_type === "fiscal_year")
      .map((r) => ({
        date: `${r.period}-09-30`,
        value: r.value as number,
        cells: [{ file: ENFORCEMENT, key: { period: r.period as number, period_type: "fiscal_year", metric: m.metric, scope: "ice", arresting_agency: null, criminality: null }, field: "value" }],
      }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    context: ["ICE fiscal years run October to September; the newest year's figure is preliminary until ICE's annual report."],
    url: "/presidency/immigration",
    anchor: "#removals-returns-and-detention-by-fiscal-year",
    source: "U.S. Immigration and Customs Enforcement",
    weight: m.weight,
    // ICE's annual report comes out months after the fiscal year ends.
    releaseLagDays: 90,
  }));
}

/** Census monthly goods trade, seasonally adjusted (the headline basis), in millions of dollars. */
export function loadTrade(ref?: string): Series[] {
  const rows = readOutput(TRADE, ref).filter((r) => r.frequency === "monthly" && r.basis === "census" && r.scope === "goods" && r.adjustment === "sa");
  const defs = [
    { field: "balance", id: "trade.deficit", name: "the U.S. goods trade deficit", negate: true, weight: 1.4, words: { high: "largest", low: "smallest", up: "widened", down: "narrowed" } },
    { field: "exports", id: "trade.exports", name: "U.S. goods exports", negate: false, weight: 1.0, words: undefined },
    { field: "imports", id: "trade.imports", name: "U.S. goods imports", negate: false, weight: 1.1, words: undefined },
  ];
  return defs.map((d) => ({
    id: d.id,
    dataset: "trade" as const,
    name: d.name,
    axisLabel: "billions of dollars a month, seasonally adjusted",
    unit: USD_BN,
    frequency: "monthly" as const,
    seasonal: false,
    kind: "flow" as const,
    moveMode: "pct" as const,
    words: d.words,
    points: rows
      .map((r) => {
        const cell: CellRef = { file: TRADE, key: { period: String(r.period), frequency: "monthly", basis: "census", scope: "goods", adjustment: "sa" }, field: d.field, ...(d.negate ? { negate: true } : {}) };
        return { date: monthDate(String(r.period)), value: (d.negate ? -1 : 1) * (r[d.field] as number), cells: [cell] };
      })
      .sort((a, b) => a.date.localeCompare(b.date)),
    totalUnit: { scale: 0.000001, decimals: 2, prefix: "$", suffix: "T" },
    totalAxisLabel: "trillions of dollars, not adjusted for inflation",
    context: ["Dollar figures are nominal: not adjusted for inflation.", "Monthly figures are seasonally adjusted (the Census headline basis)."],
    url: "/presidency/trade",
    anchor: "#trade-balance",
    source: "U.S. Census Bureau",
    weight: d.weight,
    headline: d.id === "trade.deficit",
    // The Census/BEA trade release comes about five weeks after the month ends.
    releaseLagDays: 36,
  }));
}

export function loadExecutiveOrders(ref?: string): EventSet {
  const rows = readOutput(EOS, ref);
  return {
    id: "executive_orders",
    dataset: "executive_orders",
    name: "executive orders",
    verb: "signed",
    // The Federal Register's executive-order data starts in 1994, a year into Clinton's first term.
    coverageStart: "1994-01-01",
    events: rows
      .map((r) => ({ date: String(r.signing_date), cell: { file: EOS, key: { eo_number: r.eo_number as number }, field: "__row" } }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    url: "/presidency/executive-orders",
    source: "Federal Register",
    weight: 1.3,
  };
}

export function loadLaws(ref?: string): EventSet {
  const rows = readOutput(LAWS, ref);
  return {
    id: "laws",
    dataset: "laws",
    name: "public laws",
    verb: "enacted",
    coverageStart: "1973-01-03",
    events: rows
      .map((r) => ({ date: String(r.date), cell: { file: LAWS, key: { law_id: String(r.law_id) }, field: "__row" } }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    url: "/congress/laws",
    source: "Congress.gov",
    weight: 1.2,
  };
}

export function loadAdministrations(ref?: string): Administration[] {
  return readOutput<Administration[]>(ADMINS, ref).map((a) => ({ term_id: a.term_id, president: a.president, start: a.start, end: a.end }));
}

export type Loaded = { series: Series[]; events: EventSet[] };

export function loadDataset(id: DatasetId, ref?: string): Loaded {
  switch (id) {
    case "energy":
      return { series: loadEnergy(ref), events: [] };
    case "gas":
      return { series: loadGas(ref), events: [] };
    case "encounters":
      return { series: loadEncounters(ref), events: [] };
    case "ice":
      return { series: loadIce(ref), events: [] };
    case "trade":
      return { series: loadTrade(ref), events: [] };
    case "executive_orders":
      return { series: [], events: [loadExecutiveOrders(ref)] };
    case "laws":
      return { series: [], events: [loadLaws(ref)] };
  }
}

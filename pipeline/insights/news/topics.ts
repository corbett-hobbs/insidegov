/**
 * The news topics the watcher listens for, and the chart each one gets. A topic is only here if the site already has
 * the data to answer it: a headline about diesel gets the weekly diesel price, a headline about tariffs and Canada
 * gets the tariff rate collected on imports from Canada against all countries. Anything else in the news is ignored.
 *
 * `lead` is the caption's fixed first sentence. It names the topic and never describes the news (no "announced",
 * no rates or terms, no people), so the post is context for the story, not a take on it.
 */

export type ChartBuild =
  /** A series from datasets.ts by id: its latest value against its peak in the window (else the change on a year). */
  | { kind: "series"; seriesId: string; years: number; peak: boolean }
  /** The collected tariff rate: a country against all countries, or all countries alone (news/charts.ts). */
  | { kind: "tariff" };

export type NewsTopic = {
  id: string;
  /** What the chart shows, in words, for the relevance check. */
  chart: string;
  /** A headline counts only if its title matches. */
  match: RegExp;
  /** A matching title is still dropped if it matches this (utility "tariffs" are electricity and water rates). */
  exclude?: RegExp;
  /** Titles of official documents (White House presidential actions) that count, when they differ from `match`. */
  officialMatch?: RegExp;
  /** The topic takes a country (tariffs): the one trade partner a headline names, else all countries. */
  param?: "country";
  lead: (country?: string) => string;
  build: ChartBuild;
  /** Ranking weight when several topics are in the news at once. */
  weight: number;
};

export const NEWS_TOPICS: NewsTopic[] = [
  {
    id: "tariff",
    chart: "the average U.S. tariff rate actually collected (duties divided by import value), monthly, for one trade partner against all countries, or for all countries",
    match: /\btariffs?\b|\bduties on imports\b/i,
    exclude: /\b(electric(ity)?|power|water|sewer|utility|utilities|energy|feed-in|load|transmission|rate case|tariff case|regulators?|commission)\b/i,
    officialMatch: /\btariffs?\b|\bduties\b|\badjusting imports\b|\breciprocal trade\b/i,
    param: "country",
    lead: (country) => (country ? `Tariffs involving ${country} are in the news.` : "Tariffs are in the news."),
    build: { kind: "tariff" },
    weight: 1.5,
  },
  {
    id: "diesel",
    chart: "the weekly U.S. average retail price of diesel over the last ten years",
    match: /\bdiesel\b/i,
    lead: () => "Diesel is in the news.",
    build: { kind: "series", seriesId: "gas.diesel", years: 10, peak: true },
    weight: 1.2,
  },
  {
    id: "gasoline",
    chart: "the weekly U.S. average retail price of regular gasoline over the last ten years",
    match: /\b(gas|gasoline) prices?\b|\bprices? (of|for) (gas|gasoline)\b|\bprices? at the pump\b/i,
    lead: () => "Gas prices are in the news.",
    build: { kind: "series", seriesId: "gas.regular", years: 10, peak: true },
    weight: 1.3,
  },
  {
    id: "spr",
    chart: "the weekly amount of crude oil in the Strategic Petroleum Reserve",
    match: /\bstrategic petroleum reserve\b|\bSPR\b/i,
    officialMatch: /\bstrategic petroleum reserve\b/i,
    lead: () => "The Strategic Petroleum Reserve is in the news.",
    build: { kind: "series", seriesId: "energy.spr", years: 15, peak: true },
    weight: 1.1,
  },
  {
    id: "oil_production",
    chart: "monthly U.S. crude oil production",
    match: /\b(U\.?S\.?|American|domestic) (crude )?oil (production|output)\b|\b(U\.?S\.?|American) (crude|shale) (production|output)\b/i,
    lead: () => "U.S. oil production is in the news.",
    build: { kind: "series", seriesId: "energy.crude_production", years: 10, peak: true },
    weight: 1.0,
  },
  {
    id: "lng",
    chart: "monthly U.S. liquefied natural gas exports, the same month in each year",
    match: /\bLNG\b|\bliquefied natural gas\b/i,
    lead: () => "U.S. natural gas exports are in the news.",
    build: { kind: "series", seriesId: "energy.lng_exports", years: 12, peak: true },
    weight: 0.9,
  },
  {
    id: "trade_deficit",
    chart: "the monthly U.S. goods trade deficit, seasonally adjusted",
    match: /\btrade (deficit|gap|balance)\b/i,
    lead: () => "The trade deficit is in the news.",
    build: { kind: "series", seriesId: "trade.deficit", years: 10, peak: true },
    weight: 1.1,
  },
  {
    id: "border",
    chart: "monthly CBP encounters at the southwest border",
    match: /\bborder (crossings|encounters|apprehensions|arrests)\b|\b(illegal|unlawful) crossings\b|\bcrossings at the (southern|southwest|U\.?S\.?-Mexico) border\b/i,
    lead: () => "The southwest border is in the news.",
    build: { kind: "series", seriesId: "encounters.southwest", years: 10, peak: true },
    weight: 1.3,
  },
  {
    id: "removals",
    chart: "ICE removals by fiscal year",
    match: /\bdeportations?\b|\bdeported\b|\bICE removals\b/i,
    lead: () => "Immigration enforcement is in the news.",
    build: { kind: "series", seriesId: "ice.removals", years: 16, peak: true },
    weight: 1.2,
  },
];

/**
 * Demonyms and short names headlines use for the trade partners big enough to be tariff news, keyed by ISO alpha-3.
 * The country's own name (countries.json, display name) always counts too.
 */
export const COUNTRY_ALIASES: Record<string, string[]> = {
  CAN: ["Canadian", "Ottawa"],
  MEX: ["Mexican"],
  CHN: ["Chinese", "Beijing"],
  JPN: ["Japanese", "Tokyo"],
  KOR: ["Korea", "Korean", "Seoul"],
  TWN: ["Taiwanese"],
  VNM: ["Vietnamese"],
  IND: ["Indian", "New Delhi"],
  DEU: ["German", "Berlin"],
  FRA: ["French"],
  ITA: ["Italian"],
  GBR: ["UK", "U.K.", "Britain", "British"],
  CHE: ["Swiss"],
  IRL: ["Irish"],
  BRA: ["Brazilian"],
  RUS: ["Russian", "Moscow"],
  AUS: ["Australian"],
  ISR: ["Israeli"],
  THA: ["Thai"],
  MYS: ["Malaysian"],
  IDN: ["Indonesian"],
  PHL: ["Philippine", "Filipino"],
  ZAF: ["South African"],
  TUR: ["Turkish", "Türkiye", "Turkiye"],
  SAU: ["Saudi"],
  ARG: ["Argentine", "Argentinian"],
  COL: ["Colombian"],
  NLD: ["Dutch"],
  ESP: ["Spanish"],
  SWE: ["Swedish"],
  CHL: ["Chilean"],
  KHM: ["Cambodian"],
};

/** Trade partners named in tariff news must import at least this much a year (smaller ones are rarely tariff news, and their names collide with other words: Georgia, Jordan, Chad). */
export const MIN_PARTNER_IMPORTS = 2e9;

/** The pages with an "In the news" section: their output file is pipeline/output/news_<page>.json. */
export const NEWS_PAGES = ["economy", "immigration", "trade", "energy"] as const;
export type NewsPage = (typeof NEWS_PAGES)[number];

/**
 * The page-level "In the news" catalog (news/pages.ts): which headlines a page's charts give context for. Each topic is
 * one chart on one page, by the card's DOM id (`chartId`: Economy's `chart-<key>`, Immigration's `chart-encounters`,
 * Trade's and Energy's section ids). A headline goes to the FIRST topic in this list it matches, so a story is about one
 * chart: put the narrower topic first (diesel before gasoline, the trade deficit before tariffs).
 *
 * `label` is the card's topic line, in our words, never a take ("Diesel prices", "Tariffs involving Canada").
 * `release` names the agency feed (outlets.ts DATA_SOURCES) whose own release sits on the card as "Data", and the titles
 * that count; `releaseLagDays` is how long after the news that release can appear (the Federal Register prints a
 * proclamation days after it is signed).
 */
export type PageTopic = {
  id: string;
  page: NewsPage;
  chartId: string;
  label: (country?: string) => string;
  /** What the chart shows, in words, for the relevance check. */
  chart: string;
  match: RegExp;
  exclude?: RegExp;
  param?: "country";
  /** One development per window (a weekly price, a monthly report), so headlines need no shared detail to be one story. */
  periodic?: boolean;
  release?: { source: string; match: RegExp; lagDays?: number };
};

const social = (id: string) => NEWS_TOPICS.find((t) => t.id === id)!;
const fixed = (s: string) => () => s;

export const PAGE_TOPICS: PageTopic[] = [
  // Economy
  { id: "diesel", periodic: true, page: "economy", chartId: "chart-diesel", label: fixed("Diesel prices"), chart: social("diesel").chart, match: social("diesel").match },
  { id: "gasoline", periodic: true, page: "economy", chartId: "chart-gas", label: fixed("Gas prices"), chart: social("gasoline").chart, match: social("gasoline").match },
  {
    id: "mortgage", periodic: true, page: "economy", chartId: "chart-mort", label: fixed("Mortgage rates"),
    chart: "the weekly average 30-year fixed mortgage rate (Freddie Mac survey)",
    match: /\bmortgage rates?\b/i,
  },
  {
    id: "jobs", periodic: true, page: "economy", chartId: "chart-jobs", label: fixed("Jobs report"),
    chart: "monthly change in U.S. nonfarm payroll employment (BLS)",
    match: /\bjobs report\b|\b(non-?farm )?payrolls?\b|\bjob (growth|gains|losses)\b|\bemployers (added|cut|shed)\b|\b(added|adds|cut|shed|lost) [\d,.]+(k| thousand)? jobs\b/i,
    exclude: /\bpayroll tax\b|\bpayday\b/i,
    release: { source: "bls", match: /\bpayroll employment\b|\bunemployment rate\b/i },
  },
  {
    id: "unemployment", periodic: true, page: "economy", chartId: "chart-un", label: fixed("Unemployment"),
    chart: "the monthly U.S. unemployment rate (BLS)",
    match: /\bunemployment( rate)?\b|\bjobless (rate|claims)\b/i,
    exclude: /\bunemployment (benefits|insurance|checks?)\b/i,
    release: { source: "bls", match: /\bunemployment rate\b/i },
  },
  {
    id: "inflation", periodic: true, page: "economy", chartId: "chart-infl", label: fixed("Inflation"),
    chart: "the monthly U.S. consumer price index, change from a year earlier (BLS)",
    match: /\binflation\b|\bconsumer prices?\b|\bconsumer price index\b|\bCPI\b|\bcost of living\b/i,
    exclude: /\binflation reduction act\b/i,
    release: { source: "bls", match: /\bCPI\b|\bconsumer price/i },
  },
  {
    id: "wages", periodic: true, page: "economy", chartId: "chart-wage", label: fixed("Wages"),
    chart: "average hourly earnings adjusted for inflation (BLS)",
    match: /\b(real |average )?(hourly )?(wages|earnings) (grew|growth|rose|rise|fell|fall|outpace|lag)|\bwage growth\b|\bpaychecks?\b/i,
    exclude: /\bminimum wage\b|\bearnings (season|call|report)\b|\bquarterly earnings\b/i,
    release: { source: "bls", match: /\bhourly earnings\b/i },
  },
  {
    id: "gdp", periodic: true, page: "economy", chartId: "chart-gdp", label: fixed("Economic growth"),
    chart: "quarterly U.S. real GDP growth (BEA)",
    match: /\bGDP\b|\bgross domestic product\b|\beconomy (grew|shrank|contracted|expanded)\b|\beconomic growth (slowed|accelerated)\b/i,
    exclude: /\b(China|Chinese|Japan|Germany|German|UK|Britain|Canada|Canadian|Europe|eurozone|India|Russia)\b/,
    release: { source: "bea", match: /\bgross domestic product\b|\bGDP\b/i },
  },
  {
    id: "deficit", page: "economy", chartId: "chart-def", label: fixed("Federal deficit"),
    chart: "the federal budget deficit by fiscal year (Treasury)",
    match: /\b(federal|budget|U\.?S\.?) deficits?\b|\bdeficit (hits|tops|widens|narrows|soars|shrinks)\b/i,
    exclude: /\btrade deficit\b/i,
  },
  {
    id: "debt", page: "economy", chartId: "chart-debt", label: fixed("National debt"),
    chart: "federal debt held by the public (Treasury)",
    match: /\bnational debt\b|\bfederal debt\b|\bdebt (ceiling|limit)\b|\bU\.?S\.? debt\b|\$[\d.]+ trillion (in )?debt\b/i,
  },
  {
    id: "income", periodic: true, page: "economy", chartId: "chart-inc", label: fixed("Household income"),
    chart: "real median household income by year (Census)",
    match: /\b(median )?household income\b/i,
  },

  // Immigration
  {
    id: "border", page: "immigration", chartId: "chart-encounters", label: fixed("Border crossings"),
    chart: social("border").chart,
    match: new RegExp(`${social("border").match.source}|\\bmigrant (crossings|encounters)\\b|\\bborder (numbers|apprehensions)\\b`, "i"),
    release: { source: "cbp", match: /./ },
  },
  {
    id: "removals", page: "immigration", chartId: "chart-removals", label: fixed("Deportations"),
    chart: social("removals").chart,
    match: social("removals").match,
  },
  {
    id: "green_cards", page: "immigration", chartId: "chart-green-cards", label: fixed("Green cards"),
    chart: "new lawful permanent residents (green cards) by fiscal year",
    match: /\bgreen cards?\b|\blawful permanent residen(t|ts|cy)\b|\bpermanent residency\b/i,
    release: { source: "uscis", match: /\bgreen card\b|\bpermanent resident/i },
  },
  {
    id: "refugees", page: "immigration", chartId: "chart-refugees", label: fixed("Refugee admissions"),
    chart: "refugees admitted to the United States by fiscal year, and the annual ceiling",
    match: /\brefugee (admissions|cap|ceiling|program|resettlement)\b|\brefugees? (admitted|admissions|resettled)\b|\badmit(s|ting)?\b.{0,30}\brefugees\b/i,
  },

  // Trade
  {
    id: "trade_deficit", periodic: true, page: "trade", chartId: "trade-balance", label: fixed("Trade deficit"),
    chart: social("trade_deficit").chart,
    match: social("trade_deficit").match,
    release: { source: "bea", match: /\binternational trade in goods and services\b/i },
  },
  {
    id: "tariff", page: "trade", chartId: "tariffs", param: "country",
    label: (country) => (country ? `Tariffs involving ${country}` : "Tariffs"),
    chart: social("tariff").chart,
    match: social("tariff").match,
    exclude: social("tariff").exclude,
    release: { source: "federalregister", match: social("tariff").officialMatch!, lagDays: 7 },
  },

  // Energy
  { id: "spr", page: "energy", chartId: "spr", label: fixed("Strategic Petroleum Reserve"), chart: social("spr").chart, match: social("spr").match },
  { id: "oil_production", periodic: true, page: "energy", chartId: "supply", label: fixed("U.S. oil production"), chart: social("oil_production").chart, match: social("oil_production").match, release: { source: "eia", match: /\bcrude oil production\b|\boil production\b/i } },
  { id: "lng", page: "energy", chartId: "lng", label: fixed("Natural gas exports"), chart: social("lng").chart, match: social("lng").match, release: { source: "eia", match: /\bLNG\b|\bliquefied natural gas\b/i } },
  {
    id: "electricity", page: "energy", chartId: "electricity", label: fixed("Electricity"),
    chart: "monthly U.S. electricity generation by source (coal, natural gas, nuclear, wind, solar)",
    match: /\belectricity (prices|demand|generation|bills|rates|use)\b|\bpower (grid|demand|bills|prices)\b|\b(electric|power) grid\b|\bdata centers?\b.{0,40}\b(power|electricity|energy)\b/i,
    release: { source: "eia", match: /\belectricity\b|\bpower (sector|generation)\b/i },
  },
];

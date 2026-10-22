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
  /** Google News searches, one request each per run. */
  queries: string[];
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
    queries: ["tariffs", "tariff rate"],
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
    queries: ["diesel"],
    match: /\bdiesel\b/i,
    lead: () => "Diesel is in the news.",
    build: { kind: "series", seriesId: "gas.diesel", years: 10, peak: true },
    weight: 1.2,
  },
  {
    id: "gasoline",
    chart: "the weekly U.S. average retail price of regular gasoline over the last ten years",
    queries: ["gas prices"],
    match: /\b(gas|gasoline) prices?\b|\bprices? (of|for) (gas|gasoline)\b|\bprices? at the pump\b/i,
    lead: () => "Gas prices are in the news.",
    build: { kind: "series", seriesId: "gas.regular", years: 10, peak: true },
    weight: 1.3,
  },
  {
    id: "spr",
    chart: "the weekly amount of crude oil in the Strategic Petroleum Reserve",
    queries: ["Strategic Petroleum Reserve"],
    match: /\bstrategic petroleum reserve\b|\bSPR\b/i,
    officialMatch: /\bstrategic petroleum reserve\b/i,
    lead: () => "The Strategic Petroleum Reserve is in the news.",
    build: { kind: "series", seriesId: "energy.spr", years: 15, peak: true },
    weight: 1.1,
  },
  {
    id: "oil_production",
    chart: "monthly U.S. crude oil production",
    queries: ["U.S. oil production"],
    match: /\b(U\.?S\.?|American|domestic) (crude )?oil (production|output)\b|\b(U\.?S\.?|American) (crude|shale) (production|output)\b/i,
    lead: () => "U.S. oil production is in the news.",
    build: { kind: "series", seriesId: "energy.crude_production", years: 10, peak: true },
    weight: 1.0,
  },
  {
    id: "lng",
    chart: "monthly U.S. liquefied natural gas exports, the same month in each year",
    queries: ["LNG exports"],
    match: /\bLNG\b|\bliquefied natural gas\b/i,
    lead: () => "U.S. natural gas exports are in the news.",
    build: { kind: "series", seriesId: "energy.lng_exports", years: 12, peak: true },
    weight: 0.9,
  },
  {
    id: "trade_deficit",
    chart: "the monthly U.S. goods trade deficit, seasonally adjusted",
    queries: ["trade deficit"],
    match: /\btrade (deficit|gap|balance)\b/i,
    lead: () => "The trade deficit is in the news.",
    build: { kind: "series", seriesId: "trade.deficit", years: 10, peak: true },
    weight: 1.1,
  },
  {
    id: "border",
    chart: "monthly CBP encounters at the southwest border",
    queries: ["border crossings", "border apprehensions"],
    match: /\bborder (crossings|encounters|apprehensions|arrests)\b|\b(illegal|unlawful) crossings\b|\bcrossings at the (southern|southwest|U\.?S\.?-Mexico) border\b/i,
    lead: () => "The southwest border is in the news.",
    build: { kind: "series", seriesId: "encounters.southwest", years: 10, peak: true },
    weight: 1.3,
  },
  {
    id: "removals",
    chart: "ICE removals by fiscal year",
    queries: ["deportations"],
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

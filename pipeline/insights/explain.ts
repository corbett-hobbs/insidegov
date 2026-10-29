import type { Insight } from "./types";

/**
 * The "How to read this" slide of an Instagram carousel (carousel.tsx): what a series measures, in plain words, for a
 * reader who has never seen the site. Unlike `Insight.context` (notes for the caption writer, some of them instructions),
 * every sentence here is printed as is, so: definitions only, no numbers (none of them would be checked), no causes,
 * nothing that goes stale. A series with no entry gets no slide.
 *
 * Keyed by series id, or by the part before the first "." (news tariff charts are `tariff.CAN`, `tariff.all`).
 */

const MONTHLY_EIA = "EIA's monthly figures come out about two months after the month they cover.";
const LIKE_MONTHS = "It rises and falls with the seasons, so each month is compared with the same month in earlier years.";
const PETROLEUM = "Petroleum is crude oil plus refined products such as gasoline, diesel and jet fuel, in barrels a day averaged over the month.";
const POWER = "Electricity generated at U.S. power plants in a month, in billion kilowatthours.";
const ENCOUNTER = "An encounter is a Border Patrol apprehension, or a person turned away at an official port of entry.";
const EVENTS = "Encounters count events, not people: someone stopped twice counts twice.";
const TARIFF_LAG = "That is why it sits below announced tariff rates, and why it moves months after a rate changes.";
const ICE_PRELIM = "Fiscal years run from October to September. The newest year is preliminary until ICE's annual report.";
const NOMINAL_TRADE = "Dollars are not adjusted for inflation; monthly figures are seasonally adjusted.";

export const EXPLAINERS: Record<string, string[]> = {
  "energy.spr": [
    "The Strategic Petroleum Reserve is the federal government's emergency stockpile of crude oil, held in underground salt caverns in Texas and Louisiana.",
    "The Energy Department sells or lends oil from it, or buys oil to refill it. EIA reports the level every week.",
  ],
  "energy.crude_production": ["Crude oil pumped from U.S. wells, onshore and offshore, in barrels a day averaged over the month.", MONTHLY_EIA],
  "energy.petroleum_exports": [PETROLEUM, MONTHLY_EIA],
  "energy.petroleum_imports": [PETROLEUM, MONTHLY_EIA],
  "energy.crude_exports": ["Crude oil shipped from the United States to other countries, in barrels a day averaged over the month.", MONTHLY_EIA],
  "energy.gas_production": ["Dry natural gas: gas ready for pipelines and customers, after liquids are taken out.", MONTHLY_EIA, LIKE_MONTHS],
  "energy.lng_exports": ["Liquefied natural gas is natural gas cooled into a liquid so it can be shipped by tanker.", MONTHLY_EIA, LIKE_MONTHS],
  "energy.power_total": [POWER, MONTHLY_EIA, LIKE_MONTHS],
  "energy.power_coal": [POWER, MONTHLY_EIA, LIKE_MONTHS],
  "energy.power_gas": [POWER, MONTHLY_EIA, LIKE_MONTHS],
  "energy.power_nuclear": [POWER, MONTHLY_EIA, LIKE_MONTHS],
  "energy.power_wind": [POWER, MONTHLY_EIA, LIKE_MONTHS],
  "energy.power_solar": [POWER, "Utility-scale plants only: rooftop solar is not included.", MONTHLY_EIA, LIKE_MONTHS],
  "economy.mortgage_rate": ["The average interest rate on a home loan with a fixed rate and a thirty-year term, from Freddie Mac's weekly survey of lenders.", "The rate a buyer is offered depends on their credit and down payment; this is the national average."],
  "economy.fed_funds": ["The effective federal funds rate: the average interest rate banks charged each other for overnight loans that week, from the Federal Reserve Board.", "The Federal Reserve announces a target range and steers this rate into it; it is not the rate on a home or car loan."],
  "economy.treasury_10y": ["The market yield on ten-year U.S. Treasury notes, averaged over the week, from the Federal Reserve Board.", "Investors set it by buying and selling, not the Federal Reserve; mortgage rates tend to follow it."],
  "economy.unemployment": ["The share of people in the labor force who have no job and are looking for one, from the Bureau of Labor Statistics' monthly household survey.", "It is seasonally adjusted."],
  "economy.inflation": ["The change in the prices consumers pay, measured by the Consumer Price Index for all urban consumers, compared with the same month a year earlier.", "It covers a broad basket of goods and services, seasonally adjusted."],
  "economy.jobs_added": ["The change from the previous month in the number of jobs on employers' payrolls, from the Bureau of Labor Statistics' monthly survey of employers.", "It excludes farm jobs and is seasonally adjusted; a negative number means jobs were lost."],
  "economy.real_earnings": ["Average hourly pay of production and nonsupervisory workers, adjusted for inflation and stated in the dollars of the latest month, so each month shows what the pay buys today."],
  "economy.gdp_growth": ["Real gross domestic product is the value of goods and services the U.S. produces, adjusted for inflation. The chart shows how much it grew compared with the same quarter a year earlier."],
  "economy.household_income": ["The income of the household in the middle of the distribution, adjusted for inflation, from the Census Bureau's annual survey."],
  "economy.deficit": ["The gap between what the federal government spends and what it takes in during a fiscal year, which runs from October through September.", "A surplus, when revenue exceeds spending, shows as a negative number."],
  "economy.debt": ["All the money the federal government owes, including what it owes to its own trust funds such as Social Security, at the end of each quarter.", "Dollars are not adjusted for inflation."],
  "gas.regular": ["The average price of a gallon of regular gasoline across U.S. stations, from EIA's weekly Monday survey.", "Prices are as paid at the time, not adjusted for inflation."],
  "gas.diesel": ["The average price of a gallon of diesel across U.S. stations, from EIA's weekly Monday survey.", "Prices are as paid at the time, not adjusted for inflation."],
  "encounters.southwest": [ENCOUNTER, EVENTS, "This chart counts the southwest border only."],
  "encounters.nationwide": [ENCOUNTER, EVENTS, "This chart counts every U.S. border and port of entry."],
  "encounters.southwest_fy": [ENCOUNTER, EVENTS, "Fiscal years run from October to September."],
  "ice.removals": [
    "A removal is a deportation carried out under a formal order by Immigration and Customs Enforcement.",
    ICE_PRELIM,
  ],
  "ice.detention": ["The average number of people held in ICE detention on a given day, over the fiscal year.", "Fiscal years run from October to September."],
  "trade.deficit": ["The goods trade deficit is the value of goods the United States imports minus the value it exports. Services are not included.", NOMINAL_TRADE],
  "trade.exports": ["The value of goods the United States sells to other countries. Services are not included.", NOMINAL_TRADE],
  "trade.imports": ["The value of goods the United States buys from other countries. Services are not included.", NOMINAL_TRADE],
  tariff: [
    "The tariff rate collected is the duty actually paid on imports, divided by the value of all imports, including goods that pay no duty.",
    TARIFF_LAG,
  ],
  executive_orders: ["Executive orders are signed directives from the president to the federal government, numbered and published in the Federal Register."],
  laws: ["Laws are bills that passed both houses of Congress and were signed by the president, or enacted over a veto."],
};

/** Charts with two lines (news/charts.ts compare), explained together as one passage rather than one series after the other. */
const PAIRS: Record<string, string[]> = {
  "economy.fed_funds|economy.inflation": [
    "The federal funds rate is the interest rate banks charge each other for overnight loans, shown as a weekly average from the Federal Reserve Board. The Federal Reserve announces a target range and steers the rate into it, so it is not the rate on a home or car loan.",
    "Inflation is how much consumer prices have changed over the past year, measured by the Consumer Price Index for all urban consumers and reported monthly. Both lines are in percent, so they share one scale.",
  ],
  "gas.regular|gas.diesel": [
    "Regular gasoline and diesel prices are the U.S. average retail price per gallon at the pump, from a weekly survey by the Energy Information Administration. Neither is adjusted for inflation.",
    "Both lines are in dollars a gallon, so they share one scale. Diesel is the fuel for trucks, trains and farm equipment; gasoline is mostly for cars.",
  ],
  "gas.diesel|gas.regular": [
    "Regular gasoline and diesel prices are the U.S. average retail price per gallon at the pump, from a weekly survey by the Energy Information Administration. Neither is adjusted for inflation.",
    "Both lines are in dollars a gallon, so they share one scale. Diesel is the fuel for trucks, trains and farm equipment; gasoline is mostly for cars.",
  ],
  "trade.deficit|trade.imports": [
    "Imports are the value of goods the United States buys from other countries, and exports the value of goods it sells to them. The trade deficit is imports minus exports, so it is the gap between the two lines.",
    "Both are monthly, seasonally adjusted and in dollars, not adjusted for inflation. Services are not included.",
  ],
  "economy.mortgage_rate|economy.treasury_10y": [
    "The mortgage rate is the average rate on a 30-year fixed-rate home loan, from Freddie Mac's weekly survey of lenders. The ten-year Treasury yield is the market rate on ten-year U.S. government debt, set by investors and averaged over the week.",
    "Both lines are in percent, so they share one scale. The chart shows how far apart the two have been, not why.",
  ],
  "economy.treasury_10y|economy.fed_funds": [
    "The ten-year Treasury yield is the market rate on ten-year U.S. government debt, set by investors and averaged over the week. The federal funds rate is the rate banks charge each other for overnight loans, which the Federal Reserve steers into a target range.",
    "Both lines are in percent, so they share one scale: one is set by the market over ten years, the other by the Fed overnight.",
  ],
  "economy.unemployment|economy.inflation": [
    "Unemployment is the share of the labor force without a job and looking for one, from the Bureau of Labor Statistics' household survey. Inflation is how much consumer prices have changed over the past year, measured by the Consumer Price Index.",
    "Both are monthly rates in percent, so they share one scale. Together they are the two figures behind the misery index.",
  ],
};

/** Lines that tell the reader the figures arrive late or may be revised: worth a slide or reply even beside a reason. */
const LAGS = new Set([MONTHLY_EIA, TARIFF_LAG, ICE_PRELIM]);

/** Whether the explainer states a release lag or revision, which a reader needs next to any reason the post gives. */
export function hasLag(insight: Pick<Insight, "seriesId" | "kind">): boolean {
  return explainer(insight).some((l) => LAGS.has(l));
}

/** The same pairs in one thread post (at most about 250 characters, with its heading). */
const PAIRS_SHORT: Record<string, string> = {
  "economy.fed_funds|economy.inflation": "The federal funds rate is what banks charge each other for overnight loans, steered by the Fed into a target range. Inflation is the yearly change in consumer prices (CPI). Both are in percent, on one scale.",
  "gas.regular|gas.diesel": "Both are the U.S. average retail price per gallon at the pump, from a weekly Energy Information Administration survey, not adjusted for inflation. They share one scale in dollars a gallon.",
  "gas.diesel|gas.regular": "Both are the U.S. average retail price per gallon at the pump, from a weekly Energy Information Administration survey, not adjusted for inflation. They share one scale in dollars a gallon.",
  "trade.deficit|trade.imports": "Imports are goods the U.S. buys from other countries, exports are goods it sells to them, in dollars and seasonally adjusted. The trade deficit is imports minus exports: the gap between the lines. Services are not included.",
  "economy.mortgage_rate|economy.treasury_10y": "The mortgage rate is the average on a 30-year fixed home loan (Freddie Mac). The Treasury yield is the market rate on ten-year government debt. Both are weekly averages in percent, on one scale.",
  "economy.treasury_10y|economy.fed_funds": "The ten-year Treasury yield is set by investors; the federal funds rate is what banks charge each other overnight, steered by the Fed. Both are weekly averages in percent, on one scale.",
  "economy.unemployment|economy.inflation": "Unemployment is the share of the labor force without a job and looking for one. Inflation is the yearly change in consumer prices (CPI). Both are monthly, in percent, on one scale.",
};

/** A two-line chart's explainer as one thread post, when it has a short form. */
export function explainerShort(insight: Pick<Insight, "seriesId" | "alsoSeriesId">): string | undefined {
  return insight.alsoSeriesId ? PAIRS_SHORT[`${insight.seriesId}|${insight.alsoSeriesId}`] : undefined;
}

const TERMS = "Each term is measured from its inauguration, so every president is compared at the same point.";

export function explainer(insight: Pick<Insight, "seriesId" | "kind"> & { alsoSeriesId?: string }): string[] {
  const of = (id: string) => EXPLAINERS[id] ?? EXPLAINERS[id.split(".")[0]!] ?? [];
  // A chart with a second line explains both: the first series in full, the second's definition.
  const pair = insight.alsoSeriesId ? PAIRS[`${insight.seriesId}|${insight.alsoSeriesId}`] : undefined;
  if (pair) return pair;
  const lines = insight.alsoSeriesId ? [...of(insight.seriesId), ...of(insight.alsoSeriesId).slice(0, 1)] : of(insight.seriesId);
  if (!lines.length) return [];
  return insight.kind === "term_comparison" ? [...lines, TERMS] : lines;
}

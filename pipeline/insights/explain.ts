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
  "energy.gas_production": ["Dry natural gas: gas ready for pipelines and customers, after liquids are taken out.", LIKE_MONTHS],
  "energy.lng_exports": ["Liquefied natural gas is natural gas cooled into a liquid so it can be shipped by tanker.", LIKE_MONTHS],
  "energy.power_total": [POWER, LIKE_MONTHS],
  "energy.power_coal": [POWER, LIKE_MONTHS],
  "energy.power_gas": [POWER, LIKE_MONTHS],
  "energy.power_nuclear": [POWER, LIKE_MONTHS],
  "energy.power_wind": [POWER, LIKE_MONTHS],
  "energy.power_solar": [POWER, "Utility-scale plants only: rooftop solar is not included.", LIKE_MONTHS],
  "gas.regular": ["The average price of a gallon of regular gasoline across U.S. stations, from EIA's weekly Monday survey.", "Prices are as paid at the time, not adjusted for inflation."],
  "gas.diesel": ["The average price of a gallon of diesel across U.S. stations, from EIA's weekly Monday survey.", "Prices are as paid at the time, not adjusted for inflation."],
  "encounters.southwest": [ENCOUNTER, EVENTS, "This chart counts the southwest border only."],
  "encounters.nationwide": [ENCOUNTER, EVENTS, "This chart counts every U.S. border and port of entry."],
  "encounters.southwest_fy": [ENCOUNTER, EVENTS, "Fiscal years run from October to September."],
  "ice.removals": [
    "A removal is a deportation carried out under a formal order by Immigration and Customs Enforcement.",
    "Fiscal years run from October to September. The newest year is preliminary until ICE's annual report.",
  ],
  "ice.detention": ["The average number of people held in ICE detention on a given day, over the fiscal year.", "Fiscal years run from October to September."],
  "trade.deficit": ["The goods trade deficit is the value of goods the United States imports minus the value it exports. Services are not included.", NOMINAL_TRADE],
  "trade.exports": ["The value of goods the United States sells to other countries. Services are not included.", NOMINAL_TRADE],
  "trade.imports": ["The value of goods the United States buys from other countries. Services are not included.", NOMINAL_TRADE],
  tariff: [
    "The tariff rate collected is the duty actually paid on imports, divided by the value of all imports, including goods that pay no duty.",
    "That is why it sits below announced tariff rates, and why it moves months after a rate changes.",
  ],
  executive_orders: ["Executive orders are signed directives from the president to the federal government, numbered and published in the Federal Register."],
  laws: ["Laws are bills that passed both houses of Congress and were signed by the president, or enacted over a veto."],
};

const TERMS = "Each term is measured from its inauguration, so every president is compared at the same point.";

export function explainer(insight: Pick<Insight, "seriesId" | "kind">): string[] {
  const lines = EXPLAINERS[insight.seriesId] ?? EXPLAINERS[insight.seriesId.split(".")[0]!] ?? [];
  if (!lines.length) return [];
  return insight.kind === "term_comparison" ? [...lines, TERMS] : lines;
}

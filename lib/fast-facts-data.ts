import "server-only";
import { getEncountersPayload } from "./encounters-data";
import { getEnergyPayload } from "./energy-data";
import { getExecutiveOrdersData } from "./executive-orders-data";
import {
  encountersFact,
  executiveOrdersFact,
  gasFact,
  lawsFact,
  sprFact,
  tariffFact,
  type FastFact,
} from "./fast-facts";
import { getIndicatorObservations } from "./indicator-data";
import { dateOfDay } from "./indicator-time";
import { getLawsPageData } from "./laws-data";
import { getNewsFile } from "./news-data";
import { getHubTariff } from "./trade-data";

/**
 * The six figures of the homepage "Latest numbers" strip, one per page. Every figure comes from the same reader its page
 * uses, so the strip cannot drift from the chart it links to; the wording and rounding are the pure `lib/fast-facts.ts`.
 * `updated` is the weekly news refresh date the pages already print in their news band.
 * Order is the strip's order: the economy first (what people feel), then the policy pages, then the border.
 */
export function getFastFacts(): { updated: string | null; facts: FastFact[] } {
  const tariff = getHubTariff();

  const spr = getEnergyPayload().spr.map(([day, value]) => {
    const { year, month, day: d } = dateOfDay(day);
    return { date: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`, value };
  });

  const laws = getLawsPageData();
  const lawsThisCongress = laws.counts[laws.counts.length - 1].reduce((a, b) => a + b, 0);

  const eo = getExecutiveOrdersData();
  const thisYear = eo.years[eo.years.length - 1];
  const lastYear = eo.years[eo.years.length - 2];

  const enc = getEncountersPayload().years.map((y) => ({ fy: y.fy, months: y.months, preliminary: y.preliminary, total: y.nationwide.total }));

  const facts = [
    gasFact(getIndicatorObservations("GASREGW")),
    tariffFact(tariff.rates, tariff.latest.label),
    sprFact(spr),
    lawsFact(lawsThisCongress, laws.dataThrough),
    executiveOrdersFact(thisYear.total, thisYear.year, lastYear.total, eo.throughDate),
    encountersFact(enc),
  ];
  return { updated: getNewsFile("economy")?.asOf ?? null, facts };
}

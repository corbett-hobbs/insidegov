import { EIA_SERIES, readOutput } from "./datasets";
import type { Insight } from "./types";

/**
 * The "Key moments" slide of an Instagram carousel (carousel.tsx): dated government actions behind a chart, taken from
 * the same curated, sourced timelines the site draws as chart flags (energy_actions.json, tariff_actions.json). Only
 * actions from the chart's first date to the day the draft was made (an action after the newest data point still
 * belongs: it is why the topic is current); those naming the chart's country first, then the most important (flag_priority), then the newest, at most `max`, shown
 * oldest first. Listed by date only: the slide never says an action caused a change in the line.
 *
 * Energy actions name the EIA series they bear on; tariff actions name the countries they apply to ("all" or ISO codes),
 * and a news tariff chart's series id carries its country (`tariff.CAN`, `tariff.all`). Other series have no timeline yet.
 */

export type Moment = { date: string; label: string };

/** `specific`: the action names this chart's country, where others apply to all countries; it comes first on a country's chart. */
type Action = { date: string; label_short: string; flag_priority: number; specific?: boolean };
type EnergyAction = Action & { series: string[] };
type TariffAction = Action & { countries: "all" | string[] };

export const MAX_MOMENTS = 4;

function candidates(seriesId: string): Action[] {
  const eia = EIA_SERIES[seriesId];
  if (eia) return readOutput<{ actions: EnergyAction[] }>("pipeline/output/energy_actions.json").actions.filter((a) => a.series.includes(eia));
  if (seriesId.startsWith("tariff.")) {
    const code = seriesId.slice("tariff.".length);
    return readOutput<{ actions: TariffAction[] }>("pipeline/output/tariff_actions.json")
      .actions.filter((a) => a.countries === "all" || (code !== "all" && a.countries.includes(code)))
      .map((a) => ({ ...a, specific: a.countries !== "all" }));
  }
  return [];
}

/** Picks from actions already narrowed to the series (pure, tested). */
export function pickMoments(actions: Action[], from: string, to: string, max = MAX_MOMENTS): Moment[] {
  return actions
    .filter((a) => a.date >= from && a.date <= to)
    .sort((a, b) => Number(Boolean(b.specific)) - Number(Boolean(a.specific)) || a.flag_priority - b.flag_priority || b.date.localeCompare(a.date))
    .slice(0, max)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((a) => ({ date: a.date, label: a.label_short }));
}

export function keyMoments(insight: Pick<Insight, "seriesId" | "chart" | "release" | "news">): Moment[] {
  if (insight.chart.type !== "line" || insight.chart.points.length < 2) return [];
  const to = [insight.chart.points.at(-1)!.date, insight.release?.releasedOn ?? "", insight.news?.seenAt.slice(0, 10) ?? ""].sort().at(-1)!;
  return pickMoments(candidates(insight.seriesId), insight.chart.points[0]!.date, to);
}

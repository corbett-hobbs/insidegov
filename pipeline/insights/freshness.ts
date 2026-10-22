import { addDays, addMonths, daysBetween, fmtDate } from "./format";
import type { Fact, Frequency, Insight, Release } from "./types";

/**
 * Posts follow releases: a draft is about data that just came out, carries the day it came out, and goes stale.
 *
 *   - A draft whose newest period ended more than LAG_QUALIFIER_DAYS before the release (EIA electricity: June data
 *     out in late August) must SAY it is newly released, on the chart and in the caption, or a chart ending in June
 *     posted in October reads as old news. Data within two months of its release needs no qualifier.
 *   - A draft expires FRESH_DAYS after the release (by then the next week's or month's data is out or due), and a
 *     newer draft for the same series supersedes an older one (schedule.ts).
 */

export const LAG_QUALIFIER_DAYS = 60;

/** Days after release a draft may still post. */
export const FRESH_DAYS: Record<Frequency, number> = { weekly: 6, monthly: 21, fiscal_year: 45 };

/** The last day the period covers: a month's last day, a week's own date, a fiscal year's September 30. */
export function periodEnd(frequency: Frequency, period: string): string {
  return frequency === "monthly" ? addDays(addMonths(`${period.slice(0, 7)}-01`, 1), -1) : period;
}

export function estimateRelease(frequency: Frequency, period: string, lagDays: number): string {
  return addDays(periodEnd(frequency, period), lagDays);
}

export function releaseFor(frequency: Frequency, period: string, releasedOn: string, estimated: boolean): Release {
  const end = periodEnd(frequency, period);
  return { periodEnd: end, releasedOn, estimated, lagged: daysBetween(end, releasedOn) > LAG_QUALIFIER_DAYS, expiresOn: addDays(releasedOn, FRESH_DAYS[frequency]) };
}

export function isFresh(release: Release, today: string): boolean {
  return today >= release.releasedOn && today <= release.expiresOn;
}

/** "Released October 2026 · data for June 2026" (the chart note on lagged drafts). */
export function releaseNote(insight: Insight): string | null {
  const r = insight.release;
  if (!r?.lagged) return null;
  const covers = insight.frequency === "fiscal_year" ? fmtDate(insight.period, "fiscal_year") : fmtDate(insight.period, insight.frequency === "weekly" ? "day" : "month");
  return `New data, released ${fmtDate(r.releasedOn, "month")} · covers ${covers}`;
}

/**
 * The insight stamped with its release. A lagged one gets a `released` fact (so the caption may name the month) and
 * a template that leads with it; the caption check then requires the word "released".
 */
export function stampRelease(insight: Insight, releasedOn: string, estimated: boolean): Insight {
  const release = releaseFor(insight.frequency, insight.period, releasedOn, estimated);
  if (!release.lagged) return { ...insight, release };
  const released: Fact = {
    id: "released",
    text: fmtDate(releasedOn, "month"),
    value: releasedOn.slice(0, 7) + "-01",
    format: { kind: "date", style: "month" },
    derivation: { op: "date", date: releasedOn.slice(0, 7) + "-01", style: "month" },
  };
  return {
    ...insight,
    release,
    facts: [...insight.facts, released],
    template: `Newly released data (${released.text}). ${insight.template}`,
    context: [
      ...insight.context,
      `This data was released in ${released.text} but covers a period that ended ${fmtDate(release.periodEnd, "day")}. The caption must say it is newly released data (use the word "released").`,
    ],
  };
}

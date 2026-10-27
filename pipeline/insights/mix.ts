import { addMonths, fmtUnitAbs } from "./format";
import type { Fact, Insight, Point, Series } from "./types";

/**
 * Where a change in U.S. electricity generation came from: each source's change against the same month a year earlier
 * and over the 12 months to date, as facts that verify.ts traces to the data like any other (so captions may use them
 * too). Drawn on the carousel's breakdown slide (carousel.tsx). Only for the total generation series.
 */

const TOTAL = "energy.power_total";
const SOURCES: [id: string, name: string][] = [
  ["energy.power_gas", "Natural gas"],
  ["energy.power_solar", "Solar"],
  ["energy.power_wind", "Wind"],
  ["energy.power_nuclear", "Nuclear"],
  ["energy.power_coal", "Coal"],
];

function changeOver(id: string, from: Point[], to: Point[], series: Series): Fact {
  const sum = (ps: Point[]) => ps.reduce((s, p) => s + p.value, 0);
  const value = sum(to) - sum(from);
  return {
    id,
    text: fmtUnitAbs(value, series.unit),
    value,
    format: { kind: "unit_abs", unit: series.unit },
    derivation: { op: "change", from: from.flatMap((p) => p.cells), to: to.flatMap((p) => p.cells) },
  };
}

/** The 12 monthly points ending at `end`, or null if any is missing. */
function year(series: Series, end: string): Point[] | null {
  const byDate = new Map(series.points.map((p) => [p.date, p]));
  const pts = Array.from({ length: 12 }, (_, i) => byDate.get(addMonths(end, i - 11)));
  return pts.every(Boolean) ? (pts as Point[]) : null;
}

/** Facts for one series' two changes, or null when the data does not reach back far enough. */
function changes(series: Series, key: string, period: string): [Fact, Fact] | null {
  const cur = year(series, period);
  const prev = year(series, addMonths(period, -12));
  if (!cur || !prev) return null;
  return [changeOver(`mix_${key}_yoy`, [prev.at(-1)!], [cur.at(-1)!], series), changeOver(`mix_${key}_year`, prev, cur, series)];
}

export function withPowerMix(insight: Insight, all: Series[]): Insight {
  if (insight.seriesId !== TOTAL || insight.frequency !== "monthly") return insight;
  const total = all.find((s) => s.id === TOTAL);
  const totalFacts = total && changes(total, "total", insight.period);
  if (!totalFacts) return insight;
  const facts: Fact[] = [...totalFacts];
  const rows: NonNullable<Insight["mix"]>["rows"] = [];
  for (const [id, name] of SOURCES) {
    const s = all.find((x) => x.id === id);
    const f = s && changes(s, id.split("_")[1]!, insight.period);
    if (!f) continue;
    facts.push(...f);
    rows.push({ name, yoy: f[0].id, year: f[1].id });
  }
  if (!rows.length) return insight;
  return { ...insight, facts: [...insight.facts, ...facts], mix: { period: insight.period, rows, total: { yoy: totalFacts[0].id, year: totalFacts[1].id } } };
}

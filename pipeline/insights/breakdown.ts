import { readOutput } from "./datasets";
import { addMonths, fmtDate, fmtUnitAbs, monthName } from "./format";
import type { Breakdown, CellRef, Fact, Insight, Point, Series, UnitFormat } from "./types";

/**
 * What drove a change: each part's share of it, as facts that verify.ts traces to the data like any other (so captions
 * may use them too), drawn on the carousel's breakdown slide (carousel.tsx).
 *
 *   electricity generation  each source (gas, solar, wind, nuclear, coal): the month against a year earlier, and the
 *                           12 months to date against the 12 before
 *   goods trade             the partners whose part changed most: the month against a year earlier, and the year to
 *                           date against the same months a year earlier (not seasonally adjusted: partner data is not)
 *
 * Series with no breakdown in the data (gas prices, encounters, laws) get none; the "why" text still explains them.
 */

const OUT = "pipeline/output";

/** A signed change fact: `to` cells minus `from` cells. */
function changeFact(id: string, from: CellRef[], to: CellRef[], value: number, unit: UnitFormat): Fact {
  return { id, text: fmtUnitAbs(value, unit), value, format: { kind: "unit_abs", unit }, derivation: { op: "change", from, to } };
}

// --- Electricity generation by source ---

const POWER_TOTAL = "energy.power_total";
const POWER_SOURCES: [id: string, name: string][] = [
  ["energy.power_gas", "Natural gas"],
  ["energy.power_solar", "Solar"],
  ["energy.power_wind", "Wind"],
  ["energy.power_nuclear", "Nuclear"],
  ["energy.power_coal", "Coal"],
];

/** The 12 monthly points ending at `end`, or null if any is missing. */
function year(series: Series, end: string): Point[] | null {
  const byDate = new Map(series.points.map((p) => [p.date, p]));
  const pts = Array.from({ length: 12 }, (_, i) => byDate.get(addMonths(end, i - 11)));
  return pts.every(Boolean) ? (pts as Point[]) : null;
}

const sum = (ps: Point[]) => ps.reduce((s, p) => s + p.value, 0);
const cells = (ps: Point[]) => ps.flatMap((p) => p.cells);

/** A series' change on the year-ago month and over 12 months, or null when the data does not reach back far enough. */
function seriesChanges(series: Series, key: string, period: string): [Fact, Fact] | null {
  const cur = year(series, period);
  const prev = year(series, addMonths(period, -12));
  if (!cur || !prev) return null;
  const [a, b] = [prev.at(-1)!, cur.at(-1)!];
  return [
    changeFact(`brk_${key}_yoy`, a.cells, b.cells, b.value - a.value, series.unit),
    changeFact(`brk_${key}_year`, cells(prev), cells(cur), sum(cur) - sum(prev), series.unit),
  ];
}

function powerBreakdown(insight: Insight, all: Series[]): { facts: Fact[]; breakdown: Breakdown } | null {
  const total = all.find((s) => s.id === POWER_TOTAL);
  const totals = total && seriesChanges(total, "total", insight.period);
  if (!totals) return null;
  const facts: Fact[] = [...totals];
  const rows: { name: string; yoy: string; year: string }[] = [];
  for (const [id, name] of POWER_SOURCES) {
    const s = all.find((x) => x.id === id);
    const f = s && seriesChanges(s, id.split("_")[1]!, insight.period);
    if (!f) continue;
    facts.push(...f);
    rows.push({ name, yoy: f[0].id, year: f[1].id });
  }
  if (!rows.length) return null;
  const month = fmtDate(insight.period, "month");
  const up = (totals[0].value as number) >= 0;
  return {
    facts,
    breakdown: {
      title: up ? "Where the extra power came from" : "Where generation fell",
      blocks: [
        { label: `${month} vs. ${fmtDate(addMonths(insight.period, -12), "month")}`, rows: rows.map((r) => ({ name: r.name, fact: r.yoy })), total: { name: "All sources", fact: totals[0].id } },
        { label: `12 months to ${month} vs. the 12 before`, rows: rows.map((r) => ({ name: r.name, fact: r.year })), total: { name: "All sources", fact: totals[1].id } },
      ],
      note: `Change in generation, billion kilowatthours. Utility-scale solar only. Hydro and smaller sources are not shown, so the rows do not add up to the total. Source: ${insight.source}.`,
    },
  };
}

// --- Goods trade by partner ---

type PartnerRow = { country_code: string; year: number; exports: (number | null)[]; imports: (number | null)[] };
type Country = { country_code: string; name: string; is_aggregate: boolean };

const TRADE_FLOW: Record<string, { label: string; title: string; flows: { field: "imports" | "exports"; negate: boolean }[] }> = {
  "trade.deficit": { label: "deficit", title: "Where the deficit changed most", flows: [{ field: "imports", negate: false }, { field: "exports", negate: true }] },
  "trade.imports": { label: "imports", title: "Where imports changed most", flows: [{ field: "imports", negate: false }] },
  "trade.exports": { label: "exports", title: "Where exports changed most", flows: [{ field: "exports", negate: false }] },
};
const PARTNERS_SHOWN = 5;

function tradeBreakdown(insight: Insight, unit: UnitFormat, ref?: string): { facts: Fact[]; breakdown: Breakdown } | null {
  const spec = TRADE_FLOW[insight.seriesId];
  if (!spec) return null;
  const y = Number(insight.period.slice(0, 4));
  const m = Number(insight.period.slice(5, 7));
  let cur: PartnerRow[], prev: PartnerRow[], countries: Country[];
  try {
    cur = readOutput<PartnerRow[]>(`${OUT}/trade_by_country/${y}.json`, ref);
    prev = readOutput<PartnerRow[]>(`${OUT}/trade_by_country/${y - 1}.json`, ref);
    countries = readOutput<Country[]>(`${OUT}/countries.json`, ref);
  } catch {
    return null;
  }
  const names = new Map(countries.filter((c) => !c.is_aggregate).map((c) => [c.country_code, c.name]));
  const prevBy = new Map(prev.map((r) => [r.country_code, r]));

  /** The cells and value of one partner's flow over months `from..to` (1-based) of a year's row, or null on a gap. */
  const span = (row: PartnerRow, from: number, to: number) => {
    const out: CellRef[] = [];
    let value = 0;
    for (const f of spec.flows) {
      for (let i = from; i <= to; i++) {
        const v = row[f.field][i - 1];
        if (typeof v !== "number") return null;
        value += f.negate ? -v : v;
        out.push({ file: `${OUT}/trade_by_country/${row.year}.json`, key: { country_code: row.country_code, year: row.year }, field: f.field, index: i - 1, ...(f.negate ? { negate: true } : {}) });
      }
    }
    return { cells: out, value };
  };

  const changes = (from: number, to: number, suffix: string) =>
    cur
      .filter((r) => names.has(r.country_code) && prevBy.has(r.country_code))
      .flatMap((r) => {
        const a = span(prevBy.get(r.country_code)!, from, to);
        const b = span(r, from, to);
        return a && b ? [{ name: names.get(r.country_code)!, fact: changeFact(`brk_${r.country_code.toLowerCase()}_${suffix}`, a.cells, b.cells, b.value - a.value, unit) }] : [];
      })
      .sort((p, q) => Math.abs(q.fact.value as number) - Math.abs(p.fact.value as number))
      .slice(0, PARTNERS_SHOWN);

  const month = changes(m, m, "yoy");
  const ytd = changes(1, m, "ytd");
  if (!month.length) return null;
  const monthText = fmtDate(insight.period, "month");
  return {
    facts: [...month, ...ytd].map((p) => p.fact),
    breakdown: {
      title: spec.title,
      blocks: [
        { label: `${monthText} vs. ${fmtDate(addMonths(insight.period, -12), "month")}`, rows: month.map((p) => ({ name: p.name, fact: p.fact.id })) },
        ...(m > 1 ? [{ label: `January–${monthName(insight.period)} ${y} vs. the same months of ${y - 1}`, rows: ytd.map((p) => ({ name: p.name, fact: p.fact.id })) }] : []),
      ],
      note: `Change in the ${spec.label} with each partner, billions of dollars, the ${PARTNERS_SHOWN} largest changes. Partner figures are not seasonally adjusted, so they do not add up to the headline change. Source: ${insight.source}.`,
    },
  };
}

/** The insight with its breakdown and the breakdown's facts, when its series has one. */
export function withBreakdown(insight: Insight, all: Series[], ref?: string): Insight {
  if (insight.frequency !== "monthly" || insight.kind === "news") return insight;
  const series = all.find((s) => s.id === insight.seriesId);
  const found = insight.seriesId === POWER_TOTAL ? powerBreakdown(insight, all) : series ? tradeBreakdown(insight, series.unit, ref) : null;
  if (!found) return insight;
  const have = new Set(insight.facts.map((f) => f.id));
  return { ...insight, facts: [...insight.facts, ...found.facts.filter((f) => !have.has(f.id))], breakdown: found.breakdown };
}

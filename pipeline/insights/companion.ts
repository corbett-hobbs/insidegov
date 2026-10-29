import { CAPTION_MAX_CHARS } from "./caption";
import { linePoints, unitFact } from "./detect";
import { daysBetween, fmtDate, fmtUnit } from "./format";
import { whereEachStands } from "./news/charts";
import { chartTitle } from "./title";
import type { ChartSpec, Insight, Series } from "./types";

/**
 * A data release that has a natural companion draws it. The trade deficit is the gap between imports and exports, so a
 * deficit post says each part's latest reading and move after its own sentence, draws the two parts as lines on one
 * axis (the news lane's balanceContext does the same for a trade story), and gets a "bigger picture" card beside the
 * country breakdown: each line's peak, low and latest over the chart's window.
 *
 * Only a line chart is swapped: a bar chart (a term comparison) keeps what it has, and so does a series with no
 * companion in the data (or one whose parts have no reading for the post's month).
 */
const BALANCES: Record<string, { imports: string; exports: string; title: string; note: string }> = {
  "trade.deficit": { imports: "trade.imports", exports: "trade.exports", title: "U.S. imports and exports", note: "Goods only, seasonally adjusted; the deficit is imports minus exports" },
};

const dir = (a: number, b: number) => (a > b ? "up" : a < b ? "down" : "unchanged");

export function withCompanion(insight: Insight, all: Series[]): Insight {
  const spec = BALANCES[insight.seriesId];
  if (!spec || insight.kind === "news" || insight.frequency !== "monthly" || insight.chart.type !== "line") return insight;
  // Up to the post's own month: a draft of an older release reads the parts as they stood then.
  const upTo = (id: string) => {
    const s = all.find((x) => x.id === id);
    return s && { ...s, points: s.points.filter((p) => p.date <= insight.period) };
  };
  const imports = upTo(spec.imports);
  const exports = upTo(spec.exports);
  const iL = imports?.points.at(-1);
  const eL = exports?.points.at(-1);
  const iP = imports?.points.at(-2);
  const eP = exports?.points.at(-2);
  if (!imports || !exports || !iL || !eL || !iP || !eP || iL.date !== insight.period || eL.date !== insight.period) return insight;

  const iv = unitFact("line_main_value", iL.value, imports.unit, iL.cells);
  const ev = unitFact("compare_value", eL.value, exports.unit, eL.cells);
  const ip = unitFact("line_main_previous", iP.value, imports.unit, iP.cells);
  const ep = unitFact("compare_previous_value", eP.value, exports.unit, eP.cells);
  const options = [
    { text: `. Imports were ${iv.text}, ${dir(iL.value, iP.value)} from ${ip.text}, and exports were ${ev.text}, ${dir(eL.value, eP.value)} from ${ep.text}`, facts: [iv, ip, ev, ep] },
    { text: `. Imports were ${iv.text} and exports were ${ev.text}`, facts: [iv, ev] },
  ];
  const stem = insight.template.replace(/\.$/, "");
  const clause = options.find((c) => `${stem}${c.text}.`.length <= CAPTION_MAX_CHARS);

  const from = insight.chart.points[0]?.date ?? iL.date;
  const chart: ChartSpec = {
    type: "line",
    unit: imports.unit,
    axisLabel: imports.axisLabel,
    frequency: "monthly",
    points: linePoints(imports, from, iL.date),
    marks: [{ date: iL.date, label: iv.text, emphasis: true }],
    comparison: { label: `Exports: ${fmtUnit(eL.value, exports.unit)}`, mainLabel: "Imports", points: linePoints(exports, from, iL.date) },
  };
  const years = Math.max(1, Math.round(daysBetween(from, iL.date) / 365.25));
  const stands = whereEachStands(imports, imports.unit, exports, from, iL, iv, spec.note, years);
  const template = clause ? `${stem}${clause.text}.` : insight.template;
  // The chart's labels are facts too, so they stay in the draft even when the caption has no room for the sentence.
  const added = [...(clause ? clause.facts : [iv, ev]), ...(stands ? stands.facts : [])];
  const have = new Set(insight.facts.map((f) => f.id));
  return {
    ...insight,
    title: chartTitle(spec.title, chart, { frequency: "monthly", seasonal: false, latest: iL.date }),
    template,
    facts: [...insight.facts, ...added.filter((f) => !have.has(f.id))],
    chart,
    alsoSeriesId: imports.id,
    ...(stands ? { bigger: stands.breakdown } : {}),
    note: spec.note,
    context: [...insight.context, "The chart draws imports and exports (the deficit is the gap between them), not the deficit itself; the caption leads with the deficit and then gives each line's latest reading. It must not say either causes or answers the other."],
    alt: `Line chart of U.S. goods imports and exports (${imports.axisLabel}) through ${fmtDate(iL.date, "month")}. ${template}`,
  };
}

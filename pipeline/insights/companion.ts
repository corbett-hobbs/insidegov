import { CAPTION_MAX_CHARS } from "./caption";
import { linePoints, unitFact } from "./detect";
import { daysBetween, fmtDate, fmtUnit } from "./format";
import { whereEachStands } from "./news/charts";
import { chartTitle } from "./title";
import type { ChartSpec, Fact, Insight, Series } from "./types";

/** A caption sentence and the facts it uses. */
type Clause = { text: string; facts: Fact[] };

/**
 * A data release that has a natural companion draws it. The chart shows both series as lines on one axis, the caption
 * says the companion's latest reading and move after the post's own sentence, and a "bigger picture" card
 * (`Insight.bigger`: each line's peak, low and latest over the chart's window) sits beside any partner breakdown.
 *
 *   trade deficit       the gap between imports and exports, so the lines are the two parts and the sentence gives both
 *   oil imports/exports the two flows beside each other; each post's own sentence already gives its series, so the
 *                       added sentence is the other one's
 *
 * Only a line chart is swapped: a bar chart (a term comparison) keeps what it has, and so does a series with no
 * companion in the data (or one whose parts have no reading for the post's month).
 */
type Spec = {
  /** The line the chart draws first (named by `mainLabel`) and the one beside it. */
  main: string;
  other: string;
  mainLabel: string;
  otherLabel: string;
  /** Whether the added sentence names the main line too (the deficit's own sentence is about the gap, not either part). */
  both: boolean;
  /** Names on the bigger-picture card, shorter than the series' own. */
  names: [main: string, other: string];
  title: string;
  note: string;
};

const TRADE: Spec = { main: "trade.imports", other: "trade.exports", mainLabel: "Imports", otherLabel: "Exports", both: true, names: ["U.S. goods imports", "U.S. goods exports"], title: "U.S. imports and exports", note: "Goods only, seasonally adjusted; the deficit is imports minus exports" };
const OIL_NOTE = "Crude oil plus refined products";
const OIL: Spec = { main: "energy.petroleum_imports", other: "energy.petroleum_exports", mainLabel: "Imports", otherLabel: "Exports", both: false, names: ["U.S. oil imports", "U.S. oil exports"], title: "U.S. oil imports and exports", note: OIL_NOTE };
const OIL_EXPORTS: Spec = { main: "energy.petroleum_exports", other: "energy.petroleum_imports", mainLabel: "Exports", otherLabel: "Imports", both: false, names: ["U.S. oil exports", "U.S. oil imports"], title: "U.S. oil imports and exports", note: OIL_NOTE };

/** The series ids whose posts take a companion, and how. */
const COMPANIONS: Record<string, Spec> = { "trade.deficit": TRADE, "energy.petroleum_imports": OIL, "energy.petroleum_exports": OIL_EXPORTS };

const dir = (a: number, b: number) => (a > b ? "up" : a < b ? "down" : "unchanged");

export function withCompanion(insight: Insight, all: Series[]): Insight {
  const spec = COMPANIONS[insight.seriesId];
  if (!spec || insight.kind === "news" || insight.frequency !== "monthly" || insight.chart.type !== "line") return insight;
  // Up to the post's own month: a draft of an older release reads the parts as they stood then.
  const upTo = (id: string, name: string) => {
    const s = all.find((x) => x.id === id);
    return s && { ...s, name, points: s.points.filter((p) => p.date <= insight.period) };
  };
  const main = upTo(spec.main, spec.names[0]);
  const other = upTo(spec.other, spec.names[1]);
  const mL = main?.points.at(-1);
  const oL = other?.points.at(-1);
  const mP = main?.points.at(-2);
  const oP = other?.points.at(-2);
  if (!main || !other || !mL || !oL || !mP || !oP || mL.date !== insight.period || oL.date !== insight.period) return insight;

  const mv = unitFact("line_main_value", mL.value, main.unit, mL.cells);
  const ov = unitFact("compare_value", oL.value, other.unit, oL.cells);
  const mp = unitFact("line_main_previous", mP.value, main.unit, mP.cells);
  const op = unitFact("compare_previous_value", oP.value, other.unit, oP.cells);
  const options: Clause[] = spec.both
    ? [
        { text: `. ${spec.mainLabel} were ${mv.text}, ${dir(mL.value, mP.value)} from ${mp.text}, and ${spec.otherLabel.toLowerCase()} were ${ov.text}, ${dir(oL.value, oP.value)} from ${op.text}`, facts: [mv, mp, ov, op] },
        { text: `. ${spec.mainLabel} were ${mv.text} and ${spec.otherLabel.toLowerCase()} were ${ov.text}`, facts: [mv, ov] },
      ]
    : [
        { text: `. ${spec.otherLabel} were ${ov.text}, ${dir(oL.value, oP.value)} from ${op.text}`, facts: [ov, op] },
        { text: `. ${spec.otherLabel} were ${ov.text}`, facts: [ov] },
      ];
  const stem = insight.template.replace(/\.$/, "");
  const clause = options.find((c) => `${stem}${c.text}.`.length <= CAPTION_MAX_CHARS);

  const from = insight.chart.points[0]?.date ?? mL.date;
  const chart: ChartSpec = {
    type: "line",
    unit: main.unit,
    axisLabel: main.axisLabel,
    frequency: "monthly",
    points: linePoints(main, from, mL.date),
    marks: [{ date: mL.date, label: mv.text, emphasis: true }],
    comparison: { label: `${spec.otherLabel}: ${fmtUnit(oL.value, other.unit)}`, mainLabel: spec.mainLabel, points: linePoints(other, from, mL.date) },
  };
  const years = Math.max(1, Math.round(daysBetween(from, mL.date) / 365.25));
  const stands = whereEachStands(main, main.unit, other, from, mL, mv, spec.note, years);
  const template = clause ? `${stem}${clause.text}.` : insight.template;
  // The chart's labels are facts too, so they stay in the draft even when the caption has no room for the sentence.
  const added = [mv, ov, ...(clause ? clause.facts : []), ...(stands ? stands.facts : [])];
  const have = new Set(insight.facts.map((f) => f.id));
  return {
    ...insight,
    title: chartTitle(spec.title, chart, { frequency: "monthly", seasonal: false, latest: mL.date }),
    template,
    facts: [...insight.facts, ...added.filter((f, i) => !have.has(f.id) && added.findIndex((g) => g.id === f.id) === i)],
    chart,
    alsoSeriesId: insight.seriesId === "trade.deficit" ? main.id : other.id,
    ...(stands ? { bigger: stands.breakdown } : {}),
    note: spec.note,
    context: [...insight.context, `The chart draws ${spec.mainLabel.toLowerCase()} and ${spec.otherLabel.toLowerCase()} together on one axis${insight.seriesId === "trade.deficit" ? "; the caption leads with the deficit, the gap between them, and then gives each line's latest reading" : ""}. The caption must not say either causes or answers the other.`],
    alt: `Line chart of ${spec.title.replace(/^U\.S\. /, "")} (${main.axisLabel}) through ${fmtDate(mL.date, "month")}. ${template}`,
  };
}

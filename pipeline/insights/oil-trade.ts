import { changeFact, dateFact, shareFact, unitFact } from "./detect";
import { fmtDate } from "./format";
import type { Breakdown, Fact, Insight, Point, Series, StackedBars, UnitFormat } from "./types";

/**
 * The oil trade post's card (replacing the peak, low and latest card for oil imports and exports): "What the U.S. buys
 * and sells abroad". Two stacked bars on one scale, imports and exports in million barrels a day, each split into crude
 * oil and refined products with the shares printed under it, and a closing line on the gap between them.
 *
 * Every figure is a fact traced to the EIA rows (verify.ts): the totals (PAIMPUS, PAEXPUS) and the crude parts
 * (COIMPUS, COEXPUS) are read as they are, refined products are the total minus crude, the shares are a part as a
 * percent of its total, and the gap is exports minus imports. The words are written from those same facts and say
 * nothing about why.
 */

/** The four series the card reads, by role. Crude oil is a part of its total. */
export const OIL_SERIES = { importsTotal: "energy.petroleum_imports", importsCrude: "energy.crude_imports", exportsTotal: "energy.petroleum_exports", exportsCrude: "energy.crude_exports" } as const;

const BAR_UNIT: UnitFormat = { scale: 0.001, decimals: 2, suffix: "M/day" };
const NET_UNIT: UnitFormat = { scale: 0.001, decimals: 2, suffix: "M barrels a day" };

export const OIL_TRADE_TITLE = "What the U.S. buys and sells abroad";
const NOTE = "Barrels a day, monthly average. Crude oil plus refined products (gasoline, diesel, jet fuel).";

/** The series' point for `date`, or undefined. */
const at = (s: Series | undefined, date: string): Point | undefined => s?.points.find((p) => p.date === date);

/**
 * The card for the month `period`, with its facts, or null when any of the four readings is missing for that month or
 * crude oil is not a part of its total (then the caller keeps the card it had).
 */
export function oilTradeCard(all: Series[], period: string, source: string): { breakdown: Breakdown; facts: Fact[] } | null {
  const find = (id: string) => all.find((s) => s.id === id);
  const imp = at(find(OIL_SERIES.importsTotal), period);
  const impCrude = at(find(OIL_SERIES.importsCrude), period);
  const exp = at(find(OIL_SERIES.exportsTotal), period);
  const expCrude = at(find(OIL_SERIES.exportsCrude), period);
  if (!imp || !impCrude || !exp || !expCrude) return null;
  if ([imp, exp].some((t) => t.value <= 0) || impCrude.value > imp.value || expCrude.value > exp.value || impCrude.value < 0 || expCrude.value < 0) return null;

  // Whole percents, unless the two shares of a bar would not add up to 100 once rounded (then one decimal for all).
  const adds = (crude: Point, total: Point) => Math.round((crude.value / total.value) * 100) + Math.round(((total.value - crude.value) / total.value) * 100) === 100;
  const decimals = adds(impCrude, imp) && adds(expCrude, exp) ? 0 : 1;

  const facts: Fact[] = [dateFact("oil_month", period, "month")];
  const bar = (key: "imports" | "exports", label: string, total: Point, crude: Point) => {
    const t = unitFact(`oil_${key}_total`, total.value, BAR_UNIT, total.cells);
    const c = unitFact(`oil_${key}_crude`, crude.value, BAR_UNIT, crude.cells);
    const r = changeFact(`oil_${key}_refined`, crude, total, BAR_UNIT);
    const cs = shareFact(`oil_${key}_crude_share`, crude, total, decimals);
    const rs = shareFact(`oil_${key}_refined_share`, crude, total, decimals, true);
    facts.push(t, c, r, cs, rs);
    return { label, total: t.id, parts: [{ name: "Crude oil", fact: c.id, share: cs.id }, { name: "Refined products", fact: r.id, share: rs.id }], shares: [cs, rs] as const };
  };
  const i = bar("imports", "Imports", imp, impCrude);
  const e = bar("exports", "Exports", exp, expCrude);
  const net = changeFact("oil_net", imp, exp, NET_UNIT);
  facts.push(net);
  const exporter = (net.value as number) >= 0;
  const stacked: StackedBars = {
    bars: [i, e].map(({ label, total, parts }) => ({ label, total, parts })),
    net: exporter ? { lead: "The U.S. sent out", fact: net.id, tail: "more than it took in" } : { lead: "The U.S. took in", fact: net.id, tail: "more than it sent out" },
    words: "",
  };
  stacked.words = oilTradeWords(i.shares, e.shares, stacked.net, net.text);
  return {
    facts,
    breakdown: { title: OIL_TRADE_TITLE, kicker: `U.S. oil trade, ${fmtDate(period, "month")}`, blocks: [], note: `${NOTE} Source: ${source}.`, stacked },
  };
}

/** What a bar mostly is, in words, with its share: "crude oil (83%)" or "refined products such as gasoline, diesel and jet fuel (68%)". */
function mostly(shares: readonly [Fact, Fact], gloss: boolean): { crude: boolean; text: string } {
  const crude = (shares[0].value as number) > (shares[1].value as number);
  return crude ? { crude, text: `crude oil (${shares[0].text})` } : { crude, text: `refined products${gloss ? " such as gasoline, diesel and jet fuel" : ""} (${shares[1].text})` };
}

/** One or two plain sentences: what imports and exports mostly are, then the gap. Figures are the facts' own text. */
function oilTradeWords(imports: readonly [Fact, Fact], exports: readonly [Fact, Fact], net: StackedBars["net"], netText: string): string {
  const a = mostly(imports, true);
  const b = mostly(exports, a.crude);
  const first = a.crude === b.crude ? `Most U.S. oil imports and exports are ${a.crude ? "crude oil" : "refined products such as gasoline, diesel and jet fuel"} (${a.crude ? imports[0].text : imports[1].text} and ${b.crude ? exports[0].text : exports[1].text}).` : `Most of what the U.S. imports is ${a.text}, while most of what it exports is ${b.text}.`;
  return `${first} ${net.lead} ${netText} ${net.tail}.`;
}

/** The card's bars as the renderers draw them: names, values, and the printed shares, read from the post's facts. */
export function stackedRows(insight: Pick<Insight, "facts">, s: StackedBars): { label: string; total: number; totalText: string; parts: { name: string; value: number; share: string }[] }[] {
  const f = (id: string) => insight.facts.find((x) => x.id === id)!;
  return s.bars.map((b) => ({ label: b.label, total: f(b.total).value as number, totalText: f(b.total).text, parts: b.parts.map((p) => ({ name: p.name, value: f(p.fact).value as number, share: f(p.share).text })) }));
}

/** The gap line as printed: "The U.S. sent out 3.78M barrels a day more than it took in". */
export function netLine(insight: Pick<Insight, "facts">, s: StackedBars): string {
  return `${s.net.lead} ${insight.facts.find((x) => x.id === s.net.fact)!.text} ${s.net.tail}`;
}

/** The card as text, for alt text: each bar's total and split, then the gap. */
export function stackedAlt(insight: Pick<Insight, "facts">, b: Breakdown): string {
  const s = b.stacked!;
  const bars = stackedRows(insight, s).map((r) => `${r.label} ${r.totalText}, ${r.parts.map((p) => `${p.share} ${p.name.toLowerCase()}`).join(" and ")}.`);
  return `${b.title}. ${b.kicker ?? ""}. ${bars.join(" ")} ${netLine(insight, s)}.`;
}

import { describe, expect, it } from "vitest";
import { slidePlan } from "./carousel";
import { ONE_POST_PER_PERIOD, postGroup, selectInsights, seriesInsightsAt } from "./collect";
import { withCompanion } from "./companion";
import { loadAdministrations, loadDataset } from "./datasets";
import { addMonths } from "./format";
import { seriesContext } from "./news/charts";
import { OIL_SERIES, oilTradeCard, stackedAlt, stackedRows } from "./oil-trade";
import { breakdownsOf } from "./research";
import { checkReplies, planThread } from "./thread";
import type { Insight, Series } from "./types";
import { CellIndex, verifyInsight } from "./verify";

const energy = loadDataset("energy").series;
const byId = (id: string): Series => energy.find((s) => s.id === id)!;
const admins = loadAdministrations();
const latest = byId(OIL_SERIES.importsTotal).points.at(-1)!.date;

/** The months (newest first) where all four oil readings exist. */
const oilMonths = byId(OIL_SERIES.importsTotal).points
  .map((p) => p.date)
  .filter((d) => Object.values(OIL_SERIES).every((id) => byId(id).points.some((p) => p.date === d)))
  .reverse();

/** A minimal oil insight for `seriesId` in `period`, as a detector would hand it to the companion. */
function oilInsight(seriesId: string, period: string, over: Partial<Insight> = {}): Insight {
  return {
    id: `${seriesId}:move_up:${period}`, dataset: "energy", seriesId, kind: "move_up", period, frequency: "monthly", headline: "Oil", title: "t", template: "U.S. oil moved.", facts: [], context: [],
    url: "/presidency/energy", source: "U.S. Energy Information Administration", score: 1, alt: "a",
    chart: { type: "line", unit: null, axisLabel: "", frequency: "monthly", points: [{ date: addMonths(period, -36), value: 1 }], marks: [] },
    ...over,
  } as never as Insight;
}

describe("energy series that post only when the news is about them", () => {
  const ids = ["energy.crude_production", "energy.gas_production", "energy.lng_exports", "energy.crude_exports", "energy.crude_imports"];

  it("are marked news-only, and the oil trade pair is not", () => {
    for (const id of ids) expect(byId(id).newsOnly, id).toBe(true);
    for (const id of [OIL_SERIES.importsTotal, OIL_SERIES.exportsTotal]) expect(byId(id).newsOnly, id).toBeUndefined();
    // A news-only series has no use for a routine reading.
    for (const id of ids) expect(byId(id).headline, id).toBeUndefined();
  });

  it("draft nothing from a release, however notable the reading and including the quarterly term comparison", () => {
    for (const id of ids) {
      const s = byId(id);
      expect(seriesInsightsAt(s, admins, s.points.map((p) => p.date)), id).toEqual([]);
    }
  });

  it("leave the oil trade pair as the energy release's oil post, with a routine reading from imports alone", () => {
    const month = [OIL_SERIES.importsTotal, OIL_SERIES.exportsTotal].flatMap((id) => seriesInsightsAt(byId(id), admins, [latest]));
    expect(month.every((i) => i.seriesId.startsWith("energy.petroleum_"))).toBe(true);
    // Imports carry the routine reading, so a month with nothing notable still has one oil post.
    expect(byId(OIL_SERIES.importsTotal).headline).toBe(true);
    expect(byId(OIL_SERIES.exportsTotal).headline).toBeUndefined();
    expect(selectInsights(energy.flatMap((s) => seriesInsightsAt(s, admins, [latest])), { max: 9, perSeries: 2, perDataset: 9 }).filter((i) => /petroleum/.test(i.seriesId)).length).toBe(1);
  });

  it("can still be charted for a story, and an LNG story carries what LNG is", () => {
    for (const [id, years] of [["energy.crude_production", 10], ["energy.gas_production", 10], ["energy.lng_exports", 12]] as const) {
      const insight = seriesContext(byId(id), { years, peak: true, lead: "X is in the news.", id: `news:${id}:2026-10-27` })!;
      expect(insight, id).not.toBeNull();
      expect(verifyInsight(insight, new CellIndex()), id).toEqual([]);
    }
    const lng = seriesContext(byId("energy.lng_exports"), { years: 12, peak: true, lead: "U.S. natural gas exports are in the news.", id: "news:lng:2026-10-27" })!;
    const thread = planThread(lng)!;
    expect(thread.replies.map((r) => r.text).join(" ")).toMatch(/Liquefied natural gas is natural gas cooled into a liquid/);
    expect(slidePlan(lng).find((s) => s.kind === "explainer")?.lines?.join(" ")).toMatch(/Liquefied natural gas is natural gas cooled into a liquid/);
  });
});

describe("one oil post per period", () => {
  const pick = (insights: Insight[]) => selectInsights(insights, { max: 9, perSeries: 2, perDataset: 9 });

  it("names the pair as one group", () => {
    expect(ONE_POST_PER_PERIOD).toContainEqual([OIL_SERIES.importsTotal, OIL_SERIES.exportsTotal]);
    expect(postGroup(OIL_SERIES.exportsTotal)).toBe(postGroup(OIL_SERIES.importsTotal));
    expect(postGroup("trade.deficit")).toBeUndefined();
  });

  it("keeps the higher-scoring of a notable imports and a notable exports reading in the same month", () => {
    const imports = oilInsight(OIL_SERIES.importsTotal, "2026-08-01", { score: 12 });
    const exports = oilInsight(OIL_SERIES.exportsTotal, "2026-08-01", { score: 30 });
    expect(pick([imports, exports]).map((i) => i.id)).toEqual([exports.id]);
    expect(pick([exports, imports]).map((i) => i.id)).toEqual([exports.id]);
  });

  it("keeps one oil post when the same series has two notable readings, and lets other series and other months through", () => {
    const a = oilInsight(OIL_SERIES.importsTotal, "2026-08-01", { score: 12, kind: "extreme_high" });
    const b = oilInsight(OIL_SERIES.importsTotal, "2026-08-01", { score: 9, kind: "move_up" });
    const other = oilInsight("energy.power_total", "2026-08-01", { score: 5 });
    const later = oilInsight(OIL_SERIES.exportsTotal, "2026-09-01", { score: 4 });
    expect(pick([a, b, other, later]).map((i) => i.id).sort()).toEqual([a.id, other.id, later.id].sort());
  });

  it("falls back to the routine reading only when neither flow is notable", () => {
    const routine = oilInsight(OIL_SERIES.importsTotal, "2026-08-01", { score: 1.8, kind: "latest" });
    const notable = oilInsight(OIL_SERIES.exportsTotal, "2026-08-01", { score: 11, kind: "extreme_high" });
    expect(pick([routine]).map((i) => i.id)).toEqual([routine.id]);
    expect(pick([routine, notable]).map((i) => i.id)).toEqual([notable.id]);
  });
});

describe("the oil trade card", () => {
  it("traces every figure to the EIA rows, in every month the four readings exist", () => {
    expect(oilMonths.length).toBeGreaterThan(24);
    const index = new CellIndex();
    for (const month of oilMonths.slice(0, 60)) {
      const card = oilTradeCard(energy, month, "EIA")!;
      expect(card, month).not.toBeNull();
      expect(verifyInsight({ facts: card.facts } as Insight, index), month).toEqual([]);
    }
  });

  it("reads August 2026 as 83% and 32% crude, with the U.S. sending out 3.78M barrels a day more than it took in", () => {
    const card = oilTradeCard(energy, "2026-08-01", "EIA")!;
    const insight = { facts: card.facts } as Insight;
    const rows = stackedRows(insight, card.breakdown.stacked!);
    expect(rows.map((r) => [r.label, r.totalText, r.parts.map((p) => p.share)])).toEqual([
      ["Imports", "8.11M/day", ["83%", "17%"]],
      ["Exports", "11.89M/day", ["32%", "68%"]],
    ]);
    expect(card.breakdown.stacked!.words).toContain("The U.S. sent out 3.78M barrels a day more than it took in.");
    expect(card.breakdown.kicker).toBe("U.S. oil trade, August 2026");
    expect(card.breakdown.title).toBe("What the U.S. buys and sells abroad");
  });

  it("splits each bar into parts that add to its total, with shares that add to 100", () => {
    for (const month of oilMonths.slice(0, 60)) {
      const card = oilTradeCard(energy, month, "EIA")!;
      const insight = { facts: card.facts } as Insight;
      for (const r of stackedRows(insight, card.breakdown.stacked!)) {
        expect(r.parts[0]!.value + r.parts[1]!.value, `${month} ${r.label}`).toBeCloseTo(r.total, 6);
        const shares = r.parts.map((p) => parseFloat(p.share));
        expect(shares[0]! + shares[1]!, `${month} ${r.label}`).toBeCloseTo(100, 6);
      }
    }
  });

  it("is left out (the peak, low and latest card stays) when a reading is missing or crude exceeds its total", () => {
    expect(oilTradeCard(energy, "1901-01-01", "EIA")).toBeNull();
    const broken = energy.map((s) => (s.id === OIL_SERIES.importsCrude ? { ...s, points: s.points.map((p) => ({ ...p, value: 1e9 })) } : s));
    expect(oilTradeCard(broken, latest, "EIA")).toBeNull();
  });

  it("replaces the levels card for oil imports and for exports, in the thread, the alt text and the carousel", () => {
    for (const id of [OIL_SERIES.importsTotal, OIL_SERIES.exportsTotal]) {
      const out = withCompanion(oilInsight(id, latest), energy);
      expect(out.bigger?.stacked).toBeDefined();
      expect(out.bigger?.levels).toBeUndefined();
      expect(verifyInsight(out, new CellIndex())).toEqual([]);
      expect(breakdownsOf(out)).toHaveLength(1);

      const plan = planThread(out)!;
      const cards = plan.replies.filter((r) => r.chart !== undefined);
      expect(cards).toHaveLength(1);
      expect(cards[0]!.chart).toBe(0);
      expect(cards[0]!.text).toMatch(/^What the U\.S\. buys and sells abroad\n\n/);
      expect(cards[0]!.text.length).toBeLessThanOrEqual(280);
      // Plain words and figures that are facts: the same checks the poster runs.
      expect(checkReplies(plan.replies, out.facts)).toEqual([]);
      expect(cards[0]!.alt).toBe(stackedAlt(out, out.bigger!).slice(0, 1000));

      expect(slidePlan(out).filter((s) => s.kind === "breakdown").map((s) => !!s.breakdown?.stacked)).toEqual([true]);
    }
  });

  it("says what the bars mostly are, whichever way they fall", () => {
    // Scaled crude readings keep their cells, so only the wording is checked (the facts would not verify against the rows).
    const scaled = (id: string, k: number) => energy.map((s) => (s.id === id ? { ...s, points: s.points.map((p) => ({ ...p, value: p.value * k })) } : s));
    const words = (all: Series[]) => oilTradeCard(all, latest, "EIA")!.breakdown.stacked!.words;
    expect(words(energy)).toMatch(/^Most of what the U\.S\. imports is crude oil \(83%\), while most of what it exports is refined products such as gasoline, diesel and jet fuel \(68%\)\./);
    expect(words(scaled(OIL_SERIES.exportsCrude, 3))).toMatch(/^Most U\.S\. oil imports and exports are crude oil \(83% and \d+%\)\./);
    expect(words(scaled(OIL_SERIES.importsCrude, 0.1))).toMatch(/^Most U\.S\. oil imports and exports are refined products such as gasoline, diesel and jet fuel \(\d+% and 68%\)\./);
    const reversed = scaled(OIL_SERIES.importsCrude, 0.1).map((s) => (s.id === OIL_SERIES.exportsCrude ? { ...s, points: s.points.map((p) => ({ ...p, value: p.value * 3 })) } : s));
    expect(words(reversed)).toMatch(/^Most of what the U\.S\. imports is refined products such as gasoline, diesel and jet fuel \(\d+%\), while most of what it exports is crude oil \(\d+%\)\./);
  });
});

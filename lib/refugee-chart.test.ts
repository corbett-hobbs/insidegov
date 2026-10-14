import { describe, expect, it } from "vitest";
import { axisText, compactCount, gridTicks, groupLabel, groupRules, niceCountTicks, niceMax, rulePlacements, spanLabel } from "./refugee-chart";
import type { RefugeeMarker } from "./refugee-types";

const mk = (n: number, date: string): RefugeeMarker => ({ n, id: `m${n}`, date, instrument: "", citation: null, signed: date, ended: null, title: "", summary: "", effect: "", status: "in_effect", statusAsOf: date });

describe("axis", () => {
  it("rounds the top up to a readable number with headroom", () => {
    expect(niceMax(125_000, 1.12)).toBe(150_000);
    expect(niceMax(100_034)).toBe(120_000);
    expect(niceMax(3_388)).toBe(4_000);
    expect(niceMax(0)).toBeGreaterThan(0);
  });
  it("ticks have at most five intervals and start at zero", () => {
    for (const top of [4_000, 15_000, 40_000, 150_000, 250_000]) {
      const t = gridTicks(top);
      expect(t[0]).toBe(0);
      expect(t.length - 1).toBeLessThanOrEqual(5);
      expect(t.length).toBeGreaterThanOrEqual(2);
    }
  });
  it("formats ticks and counts", () => {
    expect(axisText(0)).toBe("0");
    expect(axisText(12_500)).toBe("12.5k");
    expect(compactCount(16_287)).toBe("16k");
    expect(compactCount(1_383)).toBe("1.4k");
    expect(compactCount(716)).toBe("716");
    expect(niceCountTicks(16_370).top).toBeGreaterThanOrEqual(16_370);
  });
});

describe("numbered rules", () => {
  const ms = [mk(1, "2017-01-27"), mk(2, "2017-03-16"), mk(3, "2017-10-24"), mk(4, "2020-10-27"), mk(5, "2021-02-04")];
  it("keeps only the rules inside the shown years, positioned on the fiscal axis", () => {
    const ps = rulePlacements(ms, 2018, 2025);
    expect(ps.map((p) => p.marker.n)).toEqual([3, 4, 5]);
    expect(ps[0].at).toBeCloseTo(0.07, 1); // Oct 24, 2017 is early in FY2018
    expect(rulePlacements(ms, 2003, 2008)).toEqual([]);
  });
  it("merges rules closer than a pill, listing each, and leaves the rest alone", () => {
    const ps = rulePlacements(ms, 2003, 2025);
    const slotW = 24;
    const groups = groupRules(ps, slotW);
    expect(groups.map(groupLabel)).toEqual(["1–3", "4–5"]);
    expect(groups[0].markers.map((m) => m.n)).toEqual([1, 2, 3]);
    expect(groupRules(ps, 80).map(groupLabel)).toEqual(["1–2", "3", "4–5"]);
    expect(groupRules(ps, 200).map(groupLabel)).toEqual(["1", "2", "3", "4", "5"]);
  });
});

describe("spanLabel", () => {
  it("never drops a label", () => {
    expect(spanLabel("Congo (Kinshasa)", "COD", 400, false)).toEqual({ flat: "Congo (Kinshasa)", slant: "" });
    expect(spanLabel("Congo (Kinshasa)", "COD", 60, false)).toEqual({ flat: "COD", slant: "" });
    expect(spanLabel("Afghanistan", "AFG", 20, false)).toEqual({ flat: "", slant: "AFG" });
    expect(spanLabel("Somalia", "SOM", 50, true)).toEqual({ flat: "", slant: "Somalia" });
    for (const w of [1, 10, 33, 34, 80, 500]) {
      const l = spanLabel("Somalia", "SOM", w, w < 100);
      expect(l.flat !== "" || l.slant !== "").toBe(true);
    }
  });
});

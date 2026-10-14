import { describe, expect, it } from "vitest";
import { LPR_GROUPS, axisText, gridTicks, groupValues, lprMarkers, niceMax } from "./lpr-chart";
import type { LprNoteOut, LprYear } from "./lpr-types";

const note = (id: string): LprNoteOut => ({ id, kind: "context", metric: null, fyStart: 2000, fyEnd: null, title: `T ${id}`, text: id });
const NOTES = ["fy2008-special-immigrants", "covid-19-lpr", "covid-19-naturalizations", "fy2025-preliminary"].map(note);

describe("lpr chart helpers", () => {
  it("folds refugees and asylees into one group and keeps the total", () => {
    const y = { classes: { immediate_relatives: 10, family_preference: 20, employment_preference: 30, diversity: 4, refugees: 5, asylees: 6, other: 7 } } as unknown as LprYear;
    const g = groupValues(y)!;
    expect(g.humanitarian).toBe(11);
    expect(Object.values(g).reduce((a, b) => a + b, 0)).toBe(82);
    expect(LPR_GROUPS).toHaveLength(6);
    expect(groupValues({ classes: null } as LprYear)).toBeNull();
  });

  it("has at most five intervals and a round top", () => {
    for (const max of [700_000, 1_500_000, 1_000_000]) {
      const t = gridTicks(niceMax(max, 1.14));
      expect(t.length).toBeLessThanOrEqual(6);
      expect(t[0]).toBe(0);
    }
    expect(axisText(1_500_000)).toBe("1.5M");
    expect(axisText(500_000)).toBe("500k");
  });

  it("numbers only the markers inside the window, per measure", () => {
    expect(lprMarkers(NOTES, "lpr", 2003, 2025, true).map((m) => [m.n, m.at])).toEqual([[1, 2008], [2, 2020.5], [3, 2025]]);
    expect(lprMarkers(NOTES, "naturalizations", 2003, 2025, true).map((m) => [m.n, m.title])).toEqual([[1, "T covid-19-naturalizations"], [2, "T fy2025-preliminary"]]);
    expect(lprMarkers(NOTES, "lpr", 2010, 2019, false)).toEqual([]);
    expect(lprMarkers(NOTES, "lpr", 2003, 2024, false).map((m) => m.n)).toEqual([1, 2]);
  });
});

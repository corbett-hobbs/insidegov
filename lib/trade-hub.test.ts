import { describe, expect, it } from "vitest";
import { buildHubTariff, fmtRate, type AxisTerm } from "./trade-hub";
import { monthIndex } from "./trade-derive";

const N = monthIndex("2026-08") + 1;
const before = (p: string) => (i: number) => i < monthIndex(p);
/** Duties of `pct` on $100 of imports every month from 1993-01 to 2026-08, 2025 on at 7%. */
const duties = Array.from({ length: N }, (_, i) => (before("1993-01")(i) ? null : before("2025-01")(i) ? 2.4 : 7));
const imports = Array.from({ length: N }, (_, i) => (before("1993-01")(i) ? null : 100));

const term = (label: string, party: "D" | "R", startYear: number, endYear: number | null, from: string, to: string): AxisTerm => ({
  label,
  party,
  startYear,
  endYear,
  m0: monthIndex(from),
  m1: monthIndex(to),
});
const TERMS = [
  term("Bush 41", "R", 1989, 1993, "1991-01", "1993-01"),
  term("Clinton", "D", 1993, 2001, "1993-01", "2001-01"),
  term("Biden", "D", 2021, 2025, "2021-01", "2025-01"),
  term("Trump", "R", 2025, null, "2025-01", "2026-08"),
];

describe("buildHubTariff", () => {
  const hub = buildHubTariff(duties, imports, TERMS);

  it("trims the series to the months that have a rate", () => {
    expect(hub.first).toBe("1993-01");
    expect(hub.rates).toHaveLength(N - monthIndex("1993-01"));
    expect(hub.rates[0]).toBe(2.4);
    expect(hub.rates.at(-1)).toBe(7);
  });

  it("names the newest month and its rate", () => {
    expect(hub.latest).toEqual({ label: "August 2026", rate: 7 });
  });

  it("compares with the full year before the sitting president took office", () => {
    expect(hub.baseline).toEqual({ year: 2024, rate: 2.4 });
  });

  it("clips terms to the series and drops ones wholly before it", () => {
    expect(hub.terms[0]).toEqual({ label: "Bush 41", party: "R", startYear: 1989, current: false, s: 0, e: 1 });
    expect(hub.terms.at(-1)).toEqual({ label: "Trump", party: "R", startYear: 2025, current: true, s: monthIndex("2025-01") - monthIndex("1993-01"), e: hub.rates.length });
    const early = buildHubTariff(duties, imports, [term("Reagan", "R", 1981, 1989, "1991-01", "1992-12")]);
    expect(early.terms).toEqual([]);
  });

  it("leaves the baseline out when that year is incomplete", () => {
    const gap = imports.map((v, i) => (i === monthIndex("2024-06") ? null : v));
    expect(buildHubTariff(duties, gap, TERMS).baseline).toBeNull();
  });

  it("ignores trailing months that are not published yet", () => {
    const longer = [...duties, null, null];
    expect(buildHubTariff(longer, [...imports, null, null], TERMS).latest.label).toBe("August 2026");
  });

  it("prints one decimal", () => {
    expect(fmtRate(6.872)).toBe("6.9%");
  });
});

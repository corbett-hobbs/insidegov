import { describe, expect, it } from "vitest";
import { encountersFact, executiveOrdersFact, gasFact, lawsFact, sprFact, tariffFact, yearEarlier } from "./fast-facts";

describe("yearEarlier", () => {
  const pts = [
    { date: "2025-10-20", value: 4.1 },
    { date: "2026-03-02", value: 3.5 },
    { date: "2026-10-19", value: 4.3 },
  ];
  it("finds the reading about a year before the newest", () => {
    expect(yearEarlier(pts)?.value).toBe(4.1);
  });
  it("is null when the series is shorter than a year", () => {
    expect(yearEarlier(pts.slice(1))).toBeNull();
  });
});

describe("gasFact", () => {
  it("prints dollars, the year-ago price and the week", () => {
    const f = gasFact([
      { date: "2025-10-20", value: 4.096 },
      { date: "2026-10-19", value: 4.284 },
    ]);
    expect(f.figure).toBe("$4.28");
    expect(f.caption).toBe("a gallon of regular, up from $4.10 a year ago");
    expect(f.asOf).toBe("week of Oct 19");
  });
});

describe("tariffFact", () => {
  it("compares with the same month a year earlier", () => {
    const rates = [...Array(12).fill(2), 10.489, ...Array(11).fill(6), 6.872];
    const f = tariffFact(rates, "August 2026");
    expect(f.figure).toBe("6.9%");
    expect(f.caption).toBe("average tariff on imports, down from 10.5% a year earlier");
    expect(f.asOf).toBe("Aug 2026");
  });
  it("refuses a series that ends on a gap", () => {
    expect(() => tariffFact([1, null], "August 2026")).toThrow();
  });
});

describe("sprFact", () => {
  it("rounds thousand barrels to millions", () => {
    const f = sprFact([
      { date: "2025-10-17", value: 408564 },
      { date: "2026-10-16", value: 282683 },
    ]);
    expect(f.figure).toBe("283M");
    expect(f.caption).toBe("barrels in the Strategic Petroleum Reserve, down from 409M a year ago");
  });
});

describe("lawsFact and executiveOrdersFact", () => {
  it("dates the laws count by the data's last day", () => {
    const f = lawsFact(134, "2026-10-20");
    expect(f.figure).toBe("134");
    expect(f.asOf).toBe("through Oct 20");
  });
  it("gives this year's orders so far against last year's total", () => {
    const f = executiveOrdersFact(66, 2026, 238, "2026-10-19");
    expect(f.figure).toBe("66");
    expect(f.caption).toBe("signed so far in 2026, after 238 in 2025");
  });
});

describe("encountersFact", () => {
  const years = [
    { fy: 2022, months: 12, preliminary: false, total: 2_766_582 },
    { fy: 2023, months: 12, preliminary: false, total: 3_201_144 },
    { fy: 2025, months: 12, preliminary: false, total: 691_906 },
    { fy: 2026, months: 11, preliminary: true, total: 348_866 },
  ];
  it("compares a year in progress with the peak and says it is preliminary", () => {
    const f = encountersFact(years);
    expect(f.figure).toBe("349K");
    expect(f.caption).toBe("border encounters since October (preliminary), about 11% of FY2023’s 3.2M peak");
    expect(f.asOf).toBe("Oct to Aug");
  });
  it("drops the caveat once the year is final", () => {
    const f = encountersFact(years.map((y) => (y.fy === 2026 ? { ...y, months: 12, preliminary: false, total: 380_000 } : y)));
    expect(f.caption).toBe("border encounters in FY2026, about 12% of FY2023’s 3.2M peak");
    expect(f.asOf).toBe("FY2026");
  });
  it("never counts a part-year as the peak", () => {
    const f = encountersFact([...years.slice(0, 3), { fy: 2026, months: 11, preliminary: true, total: 9_000_000 }]);
    expect(f.caption).toContain("FY2023");
  });
});

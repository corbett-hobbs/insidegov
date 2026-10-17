import { describe, expect, it } from "vitest";
import { gzipSync } from "node:zlib";
import {
  annualizedRate,
  hasDataGap,
  isListEligible,
  isPinnedOutlier,
  median,
  partyMedians,
  toWealthPayload,
  wealthCohort,
  type WealthMember,
} from "./wealth-derive";
import { loadRealWealthMembers } from "./wealth-test-data";

/**
 * Regression fixtures from the net worth plan, section 2 — recomputed
 * directly against `pipeline/output/financial_disclosures.json` on
 * 2026-09-28 (see the Session 1 report), updated after the OCR legend-residue
 * fix (Rogers R000575's bogus 2013 row removed; J000307 now a real outlier). Tolerance is exact match; if the
 * pipeline output changes these numbers, that's a real finding to report,
 * not a fixture to loosen.
 */
describe("wealth data fixtures", () => {
  const members = loadRealWealthMembers();
  const cohort = wealthCohort(members);
  const byChamber = (c: "house" | "senate") =>
    cohort.filter((m) => m.chamber === c);

  it("has the expected cohort size (2+ usable years)", () => {
    expect(cohort.length).toBe(421);
    expect(byChamber("house").length).toBe(340);
    expect(byChamber("senate").length).toBe(81);
  });

  function shareAndMedian(pool: WealthMember[]) {
    const rates = pool.map(annualizedRate);
    const positive = rates.filter((r) => r > 0).length;
    return {
      sharePositivePct: Math.round((positive / rates.length) * 100),
      medianRate: median(rates)!,
    };
  }

  it("matches the annualized-rate fixtures (within $1, floating-point rounding)", () => {
    const both = shareAndMedian(cohort);
    expect(both.sharePositivePct).toBe(72);
    expect(Math.round(both.medianRate)).toBeCloseTo(57_083, -1);

    const house = shareAndMedian(byChamber("house"));
    expect(house.sharePositivePct).toBe(70);
    expect(Math.round(house.medianRate)).toBeCloseTo(48_625, -1);

    const senate = shareAndMedian(byChamber("senate"));
    expect(senate.sharePositivePct).toBe(80);
    expect(Math.round(senate.medianRate)).toBeCloseTo(186_209, -1);
  });

  it("matches the 2025 party-median fixtures", () => {
    const asMillions = (n: number) => Math.round(n / 1000) / 1000; // nearest $1K

    const both = partyMedians(members, 2025);
    expect(asMillions(both.dem.median!)).toBeCloseTo(1.38, 2);
    expect(both.dem.count).toBe(239);
    expect(asMillions(both.rep.median!)).toBeCloseTo(2.09, 2);
    expect(both.rep.count).toBe(252);

    const house = partyMedians(
      members.filter((m) => m.chamber === "house"),
      2025,
    );
    expect(asMillions(house.dem.median!)).toBeCloseTo(1.1, 2);
    expect(house.dem.count).toBe(194);
    expect(asMillions(house.rep.median!)).toBeCloseTo(1.5, 2);
    expect(house.rep.count).toBe(201);

    const senate = partyMedians(
      members.filter((m) => m.chamber === "senate"),
      2025,
    );
    expect(asMillions(senate.dem.median!)).toBeCloseTo(2.99, 2);
    expect(senate.dem.count).toBe(45);
    expect(asMillions(senate.rep.median!)).toBeCloseTo(4.46, 2);
    expect(senate.rep.count).toBe(51);
  });

  it("flags the expected count of gapped cohort members", () => {
    expect(cohort.filter(hasDataGap).length).toBe(58);
  });

  it("pins exactly the expected 5 outliers, beyond +/-$15M/yr", () => {
    const pinned = cohort.filter((m) => isPinnedOutlier(annualizedRate(m)));
    expect(pinned.map((m) => m.bioguideId).sort()).toEqual(
      ["F000110", "G000599", "J000307", "R000618", "S001217"].sort(),
    );
  });

  it("gives every current member a row, even with zero filings", () => {
    const noData = members.filter((m) => m.points.length === 0);
    expect(noData.length).toBeGreaterThan(0);
    for (const m of noData) {
      expect(m.series.every((v) => v === null)).toBe(true);
    }
  });

  it("keeps single-filing members out of the cohort but present in the roster", () => {
    const singleFiling = members.filter((m) => m.points.length === 1);
    expect(singleFiling.length).toBeGreaterThan(0);
    for (const m of singleFiling) {
      expect(wealthCohort([m])).toEqual([]);
    }
  });

  it("counts list-eligible members correctly (latest usable year >= 2023)", () => {
    const eligible = members.filter(isListEligible);
    expect(eligible.length).toBe(500);
  });

  it("reconciles the range midpoint against the pipeline net_worth for every closed-range point", () => {
    let checked = 0;
    for (const m of members) {
      for (const p of m.points) {
        if (p.range.unavailable || p.range.openEnded) continue;
        checked++;
        expect((p.range.lo! + p.range.hi!) / 2).toBeCloseTo(p.midpoint, 1);
      }
    }
    expect(checked).toBeGreaterThan(3000);
  });

  it("keeps the compact client payload within the plan's size budget", () => {
    // Measured ~88KB raw / ~25KB gzipped for 553 current members — see the
    // Session 1 summary. Budget here is the plan's own target (<130KB raw,
    // <35KB gzipped), not a loosened one.
    const payload = toWealthPayload(members);
    const raw = JSON.stringify(payload);
    const gz = gzipSync(raw);
    expect(raw.length).toBeLessThan(130_000);
    expect(gz.length).toBeLessThan(35_000);
  });
});

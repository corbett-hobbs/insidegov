import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { enforcementRow, isNationalRemovals } from "./enforcement-entities";
import { convictedOrPendingShare, criminalityBars, criminalityYMax, viewCoverage } from "./immigration-breakdown";

const rows = (JSON.parse(readFileSync(join(process.cwd(), "pipeline", "output", "enforcement_series.json"), "utf8")) as unknown[]).map((r) => enforcementRow.parse(r));
const national = new Map(rows.filter(isNationalRemovals).map((r) => [r.period, r.value]));
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

describe("criminal-history bars (real files)", () => {
  it("each view covers the years ICE prints, and nothing else", () => {
    expect(criminalityBars(rows, "all").map((b) => b.fy)).toEqual(range(2013, 2025));
    expect(criminalityBars(rows, "ice").map((b) => b.fy)).toEqual(range(2017, 2024));
    expect(criminalityBars(rows, "cbp").map((b) => b.fy)).toEqual(range(2017, 2024));
    expect(viewCoverage(rows, "ice")).toEqual({ first: 2017, last: 2024 });
  });
  it("complete years add up to the national total; FY2025 is the combined figure alone", () => {
    for (const b of criminalityBars(rows, "all")) {
      if (b.fy === 2025) {
        expect(b.parts.map((p) => p.key)).toEqual(["convicted_or_pending"]);
        expect(b.status).toBe("preliminary");
        expect(b.denominator).toBe(national.get(2025));
        expect(b.total).toBe(166_939);
      } else expect(b.total).toBe(national.get(b.fy));
    }
  });
  it("never mixes schemes within a year and never back-fills a zero", () => {
    const keys = (fy: number) => criminalityBars(rows, "all").find((b) => b.fy === fy)!.parts.map((p) => p.key);
    expect(keys(2014)).toEqual(["convicted", "not_convicted"]);
    expect(keys(2016)).toEqual(["convicted", "pending_charges", "other_immigration_violator"]);
  });
  it("ICE + Border Patrol bars add up to the whole, and Border Patrol is flagged derived", () => {
    const all = criminalityBars(rows, "all");
    const ice = criminalityBars(rows, "ice");
    const cbp = criminalityBars(rows, "cbp");
    for (const i of ice) {
      const c = cbp.find((b) => b.fy === i.fy)!;
      expect(i.total + c.total).toBe(all.find((b) => b.fy === i.fy)!.total);
      expect(c.derived).toBe(true);
      expect(i.derived).toBe(false);
      for (const p of c.parts) expect(p.value).toBeGreaterThanOrEqual(0);
    }
  });
  it("spot checks against the reports", () => {
    const cbp24 = criminalityBars(rows, "cbp").find((b) => b.fy === 2024)!;
    expect(cbp24.parts.find((p) => p.key === "other_immigration_violator")!.value).toBe(182_721 - 3_425);
    expect(cbp24.total).toBe(223_752);
    expect(Math.round(convictedOrPendingShare(criminalityBars(rows, "all").find((b) => b.fy === 2024)!) * 100)).toBe(33);
    expect(Math.round(convictedOrPendingShare(criminalityBars(rows, "all").find((b) => b.fy === 2025)!) * 100)).toBe(38);
  });
  it("one fixed ceiling holds every bar in every view", () => {
    const max = criminalityYMax(rows);
    expect(max).toBe(500_000);
    for (const v of ["all", "ice", "cbp"] as const) for (const b of criminalityBars(rows, v)) expect(Math.max(b.total, b.denominator)).toBeLessThan(max);
  });
});

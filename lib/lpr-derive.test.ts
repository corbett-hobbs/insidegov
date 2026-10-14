import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { administration } from "./executive-orders-entities";
import { assertLprInvariants, buildLprPayload, rankLprCountries } from "./lpr-derive";
import { lprCountryRow, lprNoteRow, lprRegionRow, lprSeriesRow } from "./lpr-entities";
import { LPR_CLASS_STACK } from "./lpr-types";
import { HISTORICAL_ADMINISTRATIONS } from "./troops-presidents";

const read = (f: string) => JSON.parse(readFileSync(`pipeline/output/${f}`, "utf8")) as unknown[];
const series = read("lpr_series.json").map((r) => lprSeriesRow.parse(r));
const byCountry = read("lpr_by_country.json").map((r) => lprCountryRow.parse(r));
const byRegion = read("lpr_by_region.json").map((r) => lprRegionRow.parse(r));
const notes = read("lpr_notes.json").map((r) => lprNoteRow.parse(r));
const admins = read("administrations.json").map((r) => administration.parse(r));
const p = buildLprPayload({ series, byCountry, byRegion, notes, admins: [...HISTORICAL_ADMINISTRATIONS, ...admins.filter((a) => !HISTORICAL_ADMINISTRATIONS.some((h) => h.term_id === a.term_id))] });
const year = (fy: number) => p.years.find((y) => y.fy === fy)!;

describe("buildLprPayload (real files)", () => {
  it("runs FY1977–FY2025 with detail from FY1999 and only FY2025 preliminary", () => {
    expect([p.firstFy, p.firstDetailFy, p.lastFy]).toEqual([1977, 1999, 2025]);
    expect(p.years.filter((y) => y.preliminary).map((y) => y.fy)).toEqual([2025]);
    expect(year(1998).classes).toBeNull();
    expect(year(1998).newArrivals).toBeNull();
  });

  it("classes and types add up to each year's total within OHSS's rounding", () => {
    for (const y of p.years.filter((x) => x.classes)) {
      const sum = LPR_CLASS_STACK.reduce((s, c) => s + y.classes![c], 0);
      expect(Math.abs(sum - y.lpr)).toBeLessThanOrEqual(y.rounded ? 50 : 0);
      expect(Math.abs(y.newArrivals! + y.adjustments! - y.lpr)).toBeLessThanOrEqual(y.rounded ? 15 : 0);
    }
  });

  it("keeps naturalizations as their own count and attributes years to the president in office on Sept 30", () => {
    expect(year(2024)).toMatchObject({ lpr: 1364090, naturalizations: 818570, party: "D", blended: false });
    expect(year(1977)).toMatchObject({ blended: true, termId: "1977-01-20" });
    expect(year(2025).days.map((d) => d.last)).toEqual(["Biden", "Trump"]);
    expect(p.terms[0].last).toBe("Ford");
  });

  it("labels FY2025's countries as nationality and does not compare them with FY2024's birth countries", () => {
    const y25 = p.countryYears.find((c) => c.metric === "lpr" && c.fy === 2025)!;
    expect(y25).toMatchObject({ basis: "nationality", preliminary: true });
    const ranked = rankLprCountries(p, "lpr", 2025);
    expect(ranked[0]).toMatchObject({ key: "MEX", rank: 1, change: null });
    const r24 = rankLprCountries(p, "lpr", 2024);
    expect(r24.slice(0, 2).map((r) => r.key)).toEqual(["MEX", "CUB"]);
    expect(r24.find((r) => r.key === "CUB")!.change).toBe(184040 - 81600);
    expect(r24.some((r) => r.key === "XUN" || r.key === "XOT")).toBe(false);
  });
});

describe("invariants fail loudly", () => {
  it("rejects classes that do not add up", () => {
    const bad = series.map((r) => (r.period === 2010 && r.class === "diversity" && r.admission_type === null ? { ...r, value: r.value + 1 } : r));
    expect(() => assertLprInvariants(bad, byCountry, notes)).toThrow(/FY2010 all: classes sum/);
  });

  it("rejects a gap in the years", () => {
    expect(() => assertLprInvariants(series.filter((r) => !(r.period === 1985 && r.metric === "naturalizations")), byCountry, notes)).toThrow(/naturalizations years not contiguous at FY1986/);
  });

  it("rejects a preliminary year that is not the newest", () => {
    const bad = series.map((r) => (r.period === 2020 ? { ...r, status: "preliminary" as const } : r));
    expect(() => assertLprInvariants(bad, byCountry, notes)).toThrow(/FY2020 is preliminary/);
  });

  it("rejects countries that do not add up to the national total", () => {
    const bad = byCountry.filter((r) => !(r.fy === 2012 && r.metric === "lpr" && r.country_key === "MEX"));
    expect(() => assertLprInvariants(series, bad, notes)).toThrow(/lpr\|2012: countries sum/);
  });

  it("rejects a cited note that does not exist", () => {
    expect(() => assertLprInvariants(series, byCountry, notes.filter((n) => n.id !== "rounding"))).toThrow(/unknown note rounding/);
  });
});

describe("regions (OHSS continents)", () => {
  it("has a region year for every country year, on the same basis, adding up to the national total", () => {
    expect(p.regionYears.length).toBe(p.countryYears.length);
    for (const c of p.countryYears) {
      const r = p.regionYears.find((x) => x.metric === c.metric && x.fy === c.fy)!;
      expect(r.basis).toBe(c.basis);
      expect(r.preliminary).toBe(c.preliminary);
      const sum = Object.values(r.regions).reduce((a, b) => a + b, 0);
      const national = c.metric === "lpr" ? year(c.fy).lpr : year(c.fy).naturalizations!;
      expect(Math.abs(sum - national)).toBeLessThanOrEqual(25);
    }
  });

  it("fails when a year's regions go missing", () => {
    expect(() => buildLprPayload({ series, byCountry, byRegion: byRegion.filter((r) => !(r.metric === "naturalizations" && r.fy === 2010)), notes, admins: [...HISTORICAL_ADMINISTRATIONS, ...admins.filter((a) => !HISTORICAL_ADMINISTRATIONS.some((h) => h.term_id === a.term_id))] })).toThrow(/no regions/);
  });
});

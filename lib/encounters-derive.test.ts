import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assertEncountersInvariants, buildEncountersPayload } from "./encounters-derive";
import { encountersNoteRow, encountersSeriesRow } from "./encounters-entities";
import { administration } from "./executive-orders-entities";
import { HISTORICAL_ADMINISTRATIONS } from "./troops-presidents";

const read = (f: string) => JSON.parse(readFileSync(`pipeline/output/${f}`, "utf8")) as unknown[];
const series = read("encounters_series.json").map((r) => encountersSeriesRow.parse(r));
const notes = read("encounters_notes.json").map((r) => encountersNoteRow.parse(r));
const admins = read("administrations.json").map((r) => administration.parse(r));
const p = buildEncountersPayload({ series, notes, admins: [...HISTORICAL_ADMINISTRATIONS, ...admins.filter((a) => !HISTORICAL_ADMINISTRATIONS.some((h) => h.term_id === a.term_id))] });
const year = (fy: number) => p.years.find((y) => y.fy === fy)!;

describe("buildEncountersPayload (real files)", () => {
  it("runs from FY1980, the page's first year, with port figures from FY2004", () => {
    expect([p.firstFy, p.firstOfoFy]).toEqual([1980, 2004]);
    expect(p.years.map((y) => y.fy)).toEqual(Array.from({ length: p.lastFy - 1979 }, (_, i) => 1980 + i));
    expect(year(2003)).toMatchObject({ detail: "usbp_only", nationwide: { ofo: null, title42: null } });
    expect(year(2004)).toMatchObject({ detail: "components", ofoRounded: true });
    expect(year(2015).ofoRounded).toBe(false);
  });

  it("shows unpublished parts as null, never zero", () => {
    for (const y of p.years) {
      for (const s of [y.nationwide, y.southwest]) {
        if (y.fy < 2004) expect(s.ofo).toBeNull();
        if (y.fy < 2020 || y.fy > 2023) expect(s.title42).toBeNull();
      }
    }
  });

  it("adds each year's parts to its total, with the southwest inside the nationwide figure", () => {
    for (const y of p.years) {
      for (const s of [y.nationwide, y.southwest]) expect(s.usbp + (s.ofo ?? 0) + (s.title42 ?? 0)).toBe(s.total);
      expect(y.southwest.total).toBeLessThanOrEqual(y.nationwide.total);
    }
    expect(year(2023).nationwide).toMatchObject({ total: 3201144, title42: 579084, title42ByComponent: { usbp: 550278, ofo: 28806 } });
    expect(year(2000).nationwide.total).toBe(1676438);
  });

  it("numbers the definition changes by date", () => {
    expect(p.markers.map((m) => [m.n, m.id])).toEqual([
      [1, "port-figures-begin"],
      [2, "crew-members-2008"],
      [3, "title-42-begins"],
      [4, "cbp-one-and-parole"],
      [5, "title-42-ends"],
    ]);
  });

  it("attributes years to presidents through the shared terms", () => {
    expect(p.terms[0].last).toBe("Carter");
    expect(year(2021)).toMatchObject({ party: "D", blended: true });
    expect(year(2021).days.map((d) => d.last)).toEqual(["Trump", "Biden"]);
    expect(p.years.filter((y) => y.preliminary).map((y) => y.fy)).toEqual([p.lastFy]);
  });
});

describe("assertEncountersInvariants", () => {
  it("fails on Title 42 outside FY2020–FY2023", () => {
    const bad = series.map((r) => (r.period === 2020 && r.authority === "title42" ? { ...r, period: 2019 } : r));
    expect(() => assertEncountersInvariants(bad, notes)).toThrow(/Title 42 row outside/);
  });

  it("fails when the southwest exceeds the nationwide figure", () => {
    const bad = series.map((r) => (r.period === 1990 && r.scope === "southwest" ? { ...r, value: r.value * 2 } : r));
    expect(() => assertEncountersInvariants(bad, notes)).toThrow(/southwest .* exceeds nationwide/);
  });

  it("fails when an earlier year is preliminary", () => {
    const bad = series.map((r) => (r.period === 2024 ? { ...r, status: "preliminary" as const } : r));
    expect(() => assertEncountersInvariants(bad, notes)).toThrow(/FY2024 is preliminary but not the newest year/);
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { administration } from "./executive-orders-entities";
import { CARD_NOTE_IDS, PAYLOAD_FIRST_FY, buildRefugeePayload, rankCountries, topByYear, topRuns } from "./refugee-derive";
import { refugeeCountryRow, refugeeDeterminationRow, refugeeNote, refugeePolicyRow, refugeeRegionRow, refugeeSeriesRow } from "./refugee-entities";
import { GEO_STACK } from "./refugee-types";

const read = (f: string) => JSON.parse(readFileSync(`pipeline/output/${f}`, "utf8")) as unknown[];
const input = {
  series: read("refugee_series.json").map((r) => refugeeSeriesRow.parse(r)),
  regions: read("refugee_regions.json").map((r) => refugeeRegionRow.parse(r)),
  countries: read("refugee_by_country.json").map((r) => refugeeCountryRow.parse(r)),
  policy: read("refugee_policy.json").map((r) => refugeePolicyRow.parse(r)),
  notes: read("refugee_notes.json").map((r) => refugeeNote.parse(r)),
  determinations: read("refugee_determinations.json").map((r) => refugeeDeterminationRow.parse(r)),
  admins: read("administrations.json").map((r) => administration.parse(r)),
};
const p = buildRefugeePayload(input);
const year = (fy: number) => p.years.find((y) => y.fy === fy)!;

describe("buildRefugeePayload (real files)", () => {
  it("runs FY2001 to the latest reported year, with only that year preliminary", () => {
    expect(p.firstFy).toBe(PAYLOAD_FIRST_FY);
    expect(p.lastFy).toBe(2026);
    expect(p.years.filter((y) => y.preliminary).map((y) => y.fy)).toEqual([2026]);
  });

  it("regions and countries add up to every year's admissions", () => {
    for (const y of p.years) {
      expect(GEO_STACK.reduce((s, g) => s + y.regions[g], 0), `FY${y.fy} regions`).toBe(y.admissions);
      expect(p.countryYears.find((c) => c.fy === y.fy)!.total, `FY${y.fy} countries`).toBe(y.admissions);
    }
  });

  it("carries the ceiling, the mid-year revision and the president who held office on Sept 30", () => {
    expect(year(2025)).toMatchObject({ ceiling: 125_000, admissions: 38_102, blended: true });
    expect(year(2021)).toMatchObject({ ceiling: 62_500, ceilingInitial: 15_000, revised: true, admissions: 11_411 });
    expect(year(2026)).toMatchObject({ ceiling: 17_500, ceilingInitial: 7_500, revised: true });
    const trump = p.terms.find((t) => t.termId === year(2025).termId)!;
    expect(trump.last).toBe("Trump");
    expect(year(2024).termId).not.toBe(year(2025).termId);
  });

  it("numbers the rules by the date they took effect", () => {
    expect(p.markers.map((m) => m.n)).toEqual(p.markers.map((_, i) => i + 1));
    expect([...p.markers.map((m) => m.date)].sort()).toEqual(p.markers.map((m) => m.date));
    expect(p.markers.find((m) => m.id === "eo-14163")?.date).toBe("2025-01-27");
  });

  it("shows only the allow-listed notes on a year's card, and every one exists", () => {
    for (const y of p.years) for (const n of y.cardNotes) expect(CARD_NOTE_IDS).toContain(n.id);
    expect(year(2025).cardNotes.map((n) => n.id)).toContain("usrap-suspension-2025");
    expect(year(2020).cardNotes.map((n) => n.id)).toContain("covid-19");
  });

  it("gives each region its cap where the year has one, and says why not otherwise", () => {
    const r2024 = p.regionYears.find((r) => r.fy === 2024)!;
    expect(r2024.noCaps).toBeNull();
    expect(r2024.rows.find((r) => r.group === "africa")).toMatchObject({ admissions: 34_017, cap: [30_000, 50_000] });
    expect(p.regionYears.find((r) => r.fy === 2017)!.rows.find((r) => r.group === "unallocated")).toMatchObject({ admissions: null, cap: [14_000, 14_000] });
    expect(p.regionYears.find((r) => r.fy === 2026)!.noCaps).toBe("group");
    expect(p.regionYears.find((r) => r.fy === 2020)!.noCaps).toBe("category");
    // Largest region first.
    for (const r of p.regionYears) {
      const adm = r.rows.filter((x) => x.admissions !== null).map((x) => x.admissions!);
      expect(adm).toEqual([...adm].sort((a, b) => b - a));
    }
  });
});

describe("ranked views", () => {
  it("ranks countries largest first with the change from the year before", () => {
    const r = rankCountries(p, 2025);
    expect(r[0]).toMatchObject({ key: "AFG", name: "Afghanistan", value: 6_758, rank: 1, change: 6_758 - 14_708 });
    expect(r.map((x) => x.rank)).toEqual(r.map((_, i) => i + 1));
    expect(r.reduce((s, x) => s + x.value, 0)).toBe(38_102);
    expect(rankCountries(p, PAYLOAD_FIRST_FY)[0].change).toBeNull();
    expect(rankCountries(p, 1999)).toEqual([]);
  });

  it("a country new in the year counts its whole figure as the change", () => {
    const r = rankCountries(p, 2026);
    expect(r[0]).toMatchObject({ key: "ZAF", value: 16_287 });
    expect(r[0].change).toBe(16_287 - (rankCountries(p, 2025).find((x) => x.key === "ZAF")?.value ?? 0));
  });

  it("finds the No. 1 country per year and its runs", () => {
    const top = topByYear(p, 2003, 2026);
    expect(top).toHaveLength(24);
    expect(top[0].ranked.length).toBe(3);
    expect(top.find((t) => t.fy === 2026)!.preliminary).toBe(true);
    const runs = topRuns(top);
    const name = (ci: number) => p.countries[ci].name;
    expect(runs.map((r) => [name(r.ci), r.to - r.from + 1])).toEqual([
      ["Ukraine", 1], ["Somalia", 3], ["Myanmar", 2], ["Iraq", 2], ["Myanmar", 1], ["Bhutan", 1], ["Iraq", 2], ["Myanmar", 1], ["Congo (Kinshasa)", 9], ["Afghanistan", 1], ["South Africa", 1],
    ]);
  });
});

describe("invariants fail loudly", () => {
  it("rejects regions that do not add up to the admissions", () => {
    const bad = { ...input, regions: input.regions.map((r) => (r.fy === 2010 && r.region_group === "africa" ? { ...r, admissions: (r.admissions ?? 0) + 1 } : r)) };
    expect(() => buildRefugeePayload(bad)).toThrow(/FY2010 regions sum/);
  });
  it("rejects countries that do not add up", () => {
    const i = input.countries.findIndex((c) => c.fy === 2012);
    const bad = { ...input, countries: input.countries.map((c, k) => (k === i ? { ...c, admissions: c.admissions + 1 } : c)) };
    expect(() => buildRefugeePayload(bad)).toThrow(/FY2012 countries sum/);
  });
});

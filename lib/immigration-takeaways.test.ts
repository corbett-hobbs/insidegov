import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { IMMIGRATION_TAKEAWAYS } from "../components/immigration/takeaways";
import { buildEncountersPayload } from "./encounters-derive";
import { encountersNoteRow, encountersSeriesRow } from "./encounters-entities";
import { enforcementNote, enforcementReport, enforcementRow, iceCatalog } from "./enforcement-entities";
import { administration } from "./executive-orders-entities";
import { buildImmigrationData } from "./immigration-derive";
import { buildLprPayload, rankLprCountries } from "./lpr-derive";
import { lprCountryRow, lprNoteRow, lprRegionRow, lprSeriesRow } from "./lpr-entities";
import { LPR_CLASS_STACK } from "./lpr-types";
import { buildRefugeePayload, rankCountries, topByYear, topRuns } from "./refugee-derive";
import { refugeeCountryRow, refugeeDeterminationRow, refugeeNote, refugeePolicyRow, refugeeRegionRow, refugeeSeriesRow } from "./refugee-entities";
import { buildRemovalsCountryPayload, rankYear } from "./removals-country-derive";
import { removalsCountryReport, removalsCountryRow } from "./removals-country-entities";
import { removalsHistoryReport, removalsHistoryRow } from "./removals-history-entities";
import { HISTORICAL_ADMINISTRATIONS } from "./troops-presidents";

/**
 * Every figure an Immigration card's takeaway cites, checked against the committed pipeline output through the same derive
 * functions the page uses (so fiscal years, the preliminary flags and the INS/ICE split are the page's own). A data refresh
 * that makes a sentence untrue fails here: rewrite the takeaway in components/immigration/takeaways.ts, then this check.
 * Each card's default window: the page slider starts at FY1980 (the refugee series' first year); green cards, refugees and
 * encounters show the newest year, removals and criminal history end at ICE's last year, and the country cards cover the
 * years their country tables exist.
 */

const read = (f: string) => JSON.parse(readFileSync(`pipeline/output/${f}`, "utf8"));
const parse = <T,>(f: string, schema: { parse: (r: unknown) => T }) => (read(f) as unknown[]).map((r) => schema.parse(r));
const admins = [...HISTORICAL_ADMINISTRATIONS, ...parse("administrations.json", administration).filter((a) => !HISTORICAL_ADMINISTRATIONS.some((h) => h.term_id === a.term_id))];

const lpr = buildLprPayload({ series: parse("lpr_series.json", lprSeriesRow), byCountry: parse("lpr_by_country.json", lprCountryRow), byRegion: parse("lpr_by_region.json", lprRegionRow), notes: parse("lpr_notes.json", lprNoteRow), admins });
const refugees = buildRefugeePayload({
  series: parse("refugee_series.json", refugeeSeriesRow),
  regions: parse("refugee_regions.json", refugeeRegionRow),
  countries: parse("refugee_by_country.json", refugeeCountryRow),
  policy: parse("refugee_policy.json", refugeePolicyRow),
  notes: parse("refugee_notes.json", refugeeNote),
  determinations: parse("refugee_determinations.json", refugeeDeterminationRow),
  admins,
});
const encounters = buildEncountersPayload({ series: parse("encounters_series.json", encountersSeriesRow), notes: parse("encounters_notes.json", encountersNoteRow), admins });
const ice = buildImmigrationData(parse("enforcement_series.json", enforcementRow), parse("enforcement_notes.json", enforcementNote), enforcementReport.parse(read("enforcement_report.json")), admins, {
  rows: parse("removals_history_series.json", removalsHistoryRow),
  report: removalsHistoryReport.parse(read("removals_history_report.json")),
});
const byCountry = buildRemovalsCountryPayload(parse("removals_by_country.json", removalsCountryRow), removalsCountryReport.parse(read("removals_by_country_report.json")), iceCatalog.parse(JSON.parse(readFileSync("pipeline/reference/ice-removals-catalog.json", "utf8"))).sources);

const PAGE_FIRST = 1980;
const between = <T extends { fy: number }>(rows: readonly T[], from: number, to: number) => rows.filter((r) => r.fy >= from && r.fy <= to);
const at = <T extends { fy: number }>(rows: readonly T[], fy: number) => rows.find((r) => r.fy === fy)!;
const argmax = <T,>(rows: readonly T[], f: (r: T) => number) => rows.reduce((a, b) => (f(b) > f(a) ? b : a));
const argmin = <T,>(rows: readonly T[], f: (r: T) => number) => rows.reduce((a, b) => (f(b) < f(a) ? b : a));
const millions = (v: number, digits: number) => (v / 1e6).toFixed(digits);
const pct = (part: number, whole: number) => Math.round((part / whole) * 100);

const lprYears = between(lpr.years, PAGE_FIRST, lpr.lastFy);
const lprTop = (metric: "lpr" | "naturalizations") => lpr.countryYears.filter((c) => c.metric === metric).map((c) => ({ fy: c.fy, ranked: rankLprCountries(lpr, metric, c.fy), total: (metric === "lpr" ? at(lpr.years, c.fy).lpr : at(lpr.years, c.fy).naturalizations)! }));
const removals = ice.removalsYears;
const enc = encounters.years.map((y) => ({ fy: y.fy, total: y.nationwide.total }));
const convictedShare = (fy: number, view: "all" | "ice") => {
  const b = at(ice.criminality.views[view], fy);
  return (b.parts.find((p) => p.key === "convicted")?.value ?? 0) / b.total;
};

const cases: Record<keyof typeof IMMIGRATION_TAKEAWAYS, { says: string[]; check: () => void }> = {
  greenCards: {
    says: ["1.83 million in FY1991", "From FY2001 through FY2025", "703,542 in FY2003", "1.36 million in FY2024", "immediate relatives of U.S. citizens were the largest class every year"],
    check: () => {
      expect(lpr.lastFy).toBe(2025);
      const peak = argmax(lprYears, (y) => y.lpr);
      expect([peak.fy, millions(peak.lpr, 2)]).toEqual([1991, "1.83"]);
      const recent = between(lprYears, 2001, 2025);
      expect(argmin(recent, (y) => y.lpr)).toMatchObject({ fy: 2003, lpr: 703_542 });
      const hi = argmax(recent, (y) => y.lpr);
      expect([hi.fy, millions(hi.lpr, 2)]).toEqual([2024, "1.36"]);
      // Every year with class detail (FY1999 on), so every year of FY2001–FY2025.
      for (const y of between(lprYears, 1999, 2025)) expect(argmax(LPR_CLASS_STACK, (c) => y.classes![c]), `FY${y.fy}`).toBe("immediate_relatives");
    },
  },
  naturalizations: {
    says: ["passed 1 million in two years, FY1996 and FY2008", "low of 141,000 in FY1982", "From FY2009 through FY2025", "619,910 in FY2010", "969,380 in FY2022"],
    check: () => {
      const nat = lprYears.map((y) => ({ fy: y.fy, v: y.naturalizations! }));
      expect(nat.every((y) => y.v !== null)).toBe(true);
      expect(nat.filter((y) => y.v > 1_000_000).map((y) => y.fy)).toEqual([1996, 2008]);
      expect(argmin(nat, (y) => y.v)).toEqual({ fy: 1982, v: 141_000 });
      const recent = between(nat, 2009, 2025);
      expect(argmin(recent, (y) => y.v)).toEqual({ fy: 2010, v: 619_910 });
      expect(argmax(recent, (y) => y.v)).toEqual({ fy: 2022, v: 969_380 });
    },
  },
  greenCardCountries: {
    says: ["Mexico led every year from FY1999 through FY2025", "13% to 23% of each year’s green cards", "In FY2024 Cuba was second with 184,040", "more than twice its count in any earlier year"],
    check: () => {
      const ys = lprTop("lpr");
      expect([ys[0].fy, ys.at(-1)!.fy]).toEqual([1999, 2025]);
      expect(ys.every((y) => y.ranked[0].name === "Mexico")).toBe(true);
      const shares = ys.map((y) => pct(y.ranked[0].value, y.total));
      expect([Math.min(...shares), Math.max(...shares)]).toEqual([13, 23]);
      const fy24 = at(ys, 2024);
      expect(fy24.ranked[1]).toMatchObject({ name: "Cuba", value: 184_040 });
      const cubaBefore = between(ys, 1999, 2023).map((y) => y.ranked.find((r) => r.name === "Cuba")?.value ?? 0);
      expect(184_040).toBeGreaterThan(2 * Math.max(...cubaBefore));
    },
  },
  naturalizationCountries: {
    says: ["Mexico led every year from FY1999 through FY2025", "11% to 25% of each year’s new citizens", "231,815 in FY2008", "the most from any one country in any year"],
    check: () => {
      const ys = lprTop("naturalizations");
      expect([ys[0].fy, ys.at(-1)!.fy]).toEqual([1999, 2025]);
      expect(ys.every((y) => y.ranked[0].name === "Mexico")).toBe(true);
      const shares = ys.map((y) => pct(y.ranked[0].value, y.total));
      expect([Math.min(...shares), Math.max(...shares)]).toEqual([11, 25]);
      const best = argmax(ys, (y) => y.ranked[0].value);
      expect([best.fy, best.ranked[0].name, best.ranked[0].value]).toEqual([2008, "Mexico", 231_815]);
    },
  },
  refugeeCeiling: {
    says: ["peaked at 207,116 in FY1980", "low of 11,411 in FY2021", "FY2024’s 100,034 arrivals", "the most of any year after FY1994", "ceiling of 125,000"],
    check: () => {
      const ys = refugees.years;
      expect(ys[0].fy).toBe(PAGE_FIRST);
      expect(argmax(ys, (y) => y.admissions)).toMatchObject({ fy: 1980, admissions: 207_116 });
      expect(argmin(ys, (y) => y.admissions)).toMatchObject({ fy: 2021, admissions: 11_411 });
      expect(at(ys, 2024)).toMatchObject({ admissions: 100_034, ceiling: 125_000, preliminary: false });
      expect(argmax(between(ys, 1995, refugees.lastFy), (y) => y.admissions).fy).toBe(2024);
      expect(at(ys, 1994).admissions).toBeGreaterThan(100_034);
    },
  },
  refugeeCountries: {
    says: ["From FY2001 through FY2025", "50 to 85 countries a year", "the most in FY2024", "In FY2026 (preliminary), all but five came from South Africa"],
    check: () => {
      const counts = between(refugees.countryYears, 2001, 2025).map((c) => ({ fy: c.fy, n: rankCountries(refugees, c.fy).length }));
      expect(counts[0].fy).toBe(2001);
      expect(argmin(counts, (c) => c.n)).toEqual({ fy: 2021, n: 50 });
      expect(argmax(counts, (c) => c.n)).toEqual({ fy: 2024, n: 85 });
      expect(refugees.lastFy).toBe(2026);
      expect(at(refugees.years, 2026).preliminary).toBe(true);
      const fy26 = rankCountries(refugees, 2026);
      expect(fy26[0].name).toBe("South Africa");
      expect(at(refugees.years, 2026).admissions - fy26[0].value).toBe(5);
    },
  },
  refugeeTop: {
    says: ["From FY2001 through FY2015, six countries took turns", "The Democratic Republic of the Congo then led every year from FY2016 through FY2024", "the longest run on the chart"],
    check: () => {
      const ys = topByYear(refugees, 2001, refugees.lastFy);
      const leader = (fy: number) => refugees.countries[at(ys, fy).ranked[0].ci].name;
      expect(new Set(between(ys, 2001, 2015).map((y) => leader(y.fy))).size).toBe(6);
      expect(leader(2015)).not.toBe("Democratic Republic of the Congo");
      for (let fy = 2016; fy <= 2024; fy++) expect(leader(fy), `FY${fy}`).toBe("Democratic Republic of the Congo");
      expect(leader(2025)).not.toBe("Democratic Republic of the Congo");
      const runs = topRuns(ys).filter((r) => r.ci >= 0);
      const longest = argmax(runs, (r) => r.to - r.from);
      expect(refugees.countries[longest.ci].name).toBe("Democratic Republic of the Congo");
      expect(runs.filter((r) => r.to - r.from >= longest.to - longest.from)).toHaveLength(1);
    },
  },
  encounters: {
    says: ["From FY1980 through FY2020", "0.5 million to 1.7 million border encounters a year", "topped 2.7 million in each of FY2022–FY2024", "peaking at 3.2 million in FY2023", "0.7 million in FY2025"],
    check: () => {
      expect(encounters.firstFy).toBe(PAGE_FIRST);
      const early = between(enc, 1980, 2020).map((y) => y.total);
      expect([millions(Math.min(...early), 1), millions(Math.max(...early), 1)]).toEqual(["0.5", "1.7"]);
      expect(Math.min(...between(enc, 2022, 2024).map((y) => y.total))).toBeGreaterThan(2_700_000);
      const peak = argmax(enc, (y) => y.total);
      expect([peak.fy, millions(peak.total, 1)]).toEqual([2023, "3.2"]);
      expect(at(encounters.years, 2025).preliminary).toBe(false);
      expect(millions(at(enc, 2025).total, 1)).toBe("0.7");
    },
  },
  removals: {
    says: ["peaked at 409,849 in FY2012", "fell to 59,011 in FY2021", "the fewest of any ICE year (FY2003 on)", "FY2025’s preliminary 442,637", "the most of any year on the chart, which starts in FY1980"],
    check: () => {
      expect([ice.historyFirstFy, ice.firstFy, ice.lastFy]).toEqual([1980, 2003, 2025]);
      const final = removals.filter((y) => y.status === "final");
      expect(argmax(final, (y) => y.value)).toMatchObject({ fy: 2012, value: 409_849 });
      expect(argmin(ice.years, (y) => y.value)).toMatchObject({ fy: 2021, value: 59_011 });
      expect(at(removals, 2025)).toMatchObject({ value: 442_637, status: "preliminary" });
      expect(argmax(removals, (y) => y.value).fy).toBe(2025);
      // FY2012 is the peak before the preliminary year.
      expect(argmax(between(removals, 1980, 2024), (y) => y.value).fy).toBe(2012);
    },
  },
  criminalHistory: {
    says: ["from FY2013 through FY2022, 53% to 66% each year had a criminal conviction on record", "in FY2024, 25% did", "ICE’s own officers arrested, the share stayed above 75% from FY2017 through FY2024"],
    check: () => {
      expect(ice.criminality.views.all[0].fy).toBe(2013);
      const shares = between(ice.criminality.views.all, 2013, 2022).map((b) => pct(b.parts.find((p) => p.key === "convicted")!.value, b.total));
      expect([Math.min(...shares), Math.max(...shares)]).toEqual([53, 66]);
      expect(Math.round(convictedShare(2024, "all") * 100)).toBe(25);
      const iceView = ice.criminality.views.ice;
      expect([iceView[0].fy, iceView.at(-1)!.fy]).toEqual([2017, 2024]);
      for (const b of iceView) expect(convictedShare(b.fy, "ice"), `FY${b.fy}`).toBeGreaterThan(0.75);
    },
  },
  removalsCountries: {
    says: ["Mexico led ICE removals by country of citizenship every year from FY2014 through FY2024", "Guatemala second or third", "peaked at 62% in FY2016", "32% by FY2024"],
    check: () => {
      const ys = byCountry.years.map((y) => ({ fy: y.fy, total: y.total, ranked: rankYear(y).map((r) => ({ name: byCountry.countries[r.ci].name, v: r.removals })) }));
      expect([ys[0].fy, ys.at(-1)!.fy]).toEqual([2014, 2024]);
      for (const y of ys) {
        expect(y.ranked[0].name, `FY${y.fy}`).toBe("Mexico");
        expect([y.ranked[1].name, y.ranked[2].name], `FY${y.fy}`).toContain("Guatemala");
      }
      const share = ys.map((y) => ({ fy: y.fy, s: y.ranked[0].v / y.total }));
      const peak = argmax(share, (x) => x.s);
      expect([peak.fy, Math.round(peak.s * 100)]).toEqual([2016, 62]);
      expect(Math.round(at(share, 2024).s * 100)).toBe(32);
    },
  },
};

describe("Immigration card takeaways", () => {
  for (const [key, c] of Object.entries(cases) as [keyof typeof IMMIGRATION_TAKEAWAYS, (typeof cases)[keyof typeof IMMIGRATION_TAKEAWAYS]][]) {
    it(`${IMMIGRATION_TAKEAWAYS[key].title}: "${IMMIGRATION_TAKEAWAYS[key].takeaway.slice(0, 48)}…" holds`, () => {
      for (const phrase of c.says) expect(IMMIGRATION_TAKEAWAYS[key].takeaway).toContain(phrase);
      c.check();
    });
  }

  it("stays short: two sentences, at most 45 words", () => {
    for (const s of Object.values(IMMIGRATION_TAKEAWAYS)) {
      // "U.S." is not a sentence end.
      const sentences = s.takeaway.replace(/U\.S\./g, "US").split(/(?<=\.)\s+(?=[A-Z])/);
      expect(sentences.length, s.title).toBeLessThanOrEqual(2);
      expect(s.takeaway.split(/\s+/).length, s.title).toBeLessThanOrEqual(45);
    }
  });

  it("avoids the words rule 7c rules out", () => {
    for (const s of Object.values(IMMIGRATION_TAKEAWAYS)) expect(s.takeaway, s.title).not.toMatch(/\b(soared|plunged|thanks to|since|still)\b/i);
  });
});

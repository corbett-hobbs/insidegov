import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { IMMIGRATION_CONTEXT, IMMIGRATION_TAKEAWAYS } from "../components/immigration/takeaways";
import type { ContextEntry } from "./chart-context";
import { SOURCE_LINKS } from "./source-links";
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
    says: ["1.8M in FY1991", "From FY2001 through FY2025", "703.5k in FY2003", "1.4M in FY2024", "immediate relatives of U.S. citizens were the largest class every year"],
    check: () => {
      expect(lpr.lastFy).toBe(2025);
      const peak = argmax(lprYears, (y) => y.lpr);
      expect([peak.fy, millions(peak.lpr, 1)]).toEqual([1991, "1.8"]);
      const recent = between(lprYears, 2001, 2025);
      expect(argmin(recent, (y) => y.lpr)).toMatchObject({ fy: 2003, lpr: 703_542 });
      const hi = argmax(recent, (y) => y.lpr);
      expect([hi.fy, millions(hi.lpr, 1)]).toEqual([2024, "1.4"]);
      // Every year with class detail (FY1999 on), so every year of FY2001–FY2025.
      for (const y of between(lprYears, 1999, 2025)) expect(argmax(LPR_CLASS_STACK, (c) => y.classes![c]), `FY${y.fy}`).toBe("immediate_relatives");
    },
  },
  naturalizations: {
    says: ["passed 1M in two years, FY1996 and FY2008", "low of 141k in FY1982", "From FY2009 through FY2025", "619.9k in FY2010", "969.4k in FY2022"],
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
    says: ["Mexico led every year from FY1999 through FY2025", "13% to 23% of each year’s green cards", "In FY2024 Cuba was second with 184k", "more than twice its count in any earlier year"],
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
    says: ["Mexico led every year from FY1999 through FY2025", "11% to 25% of each year’s new citizens", "231.8k in FY2008", "the most from any one country in any year"],
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
    says: ["peaked at 207.1k in FY1980", "low of 11.4k in FY2021", "FY2024’s 100k arrivals", "the most of any year after FY1994", "ceiling of 125k"],
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
    says: ["From FY1980 through FY2020", "0.5M to 1.7M border encounters a year", "topped 2.7M in each of FY2022–FY2024", "peaking at 3.2M in FY2023", "0.7M in FY2025"],
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
    says: ["peaked at 409.8k in FY2012", "fell to 59k in FY2021", "the fewest of any ICE year (FY2003 on)", "FY2025’s preliminary 442.6k", "the most of any year on the chart, which starts in FY1980"],
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

/**
 * The context lines (rule 7d). Figures from pipeline/output are checked here; facts that come from a cited document outside
 * the pipeline (the proclamations, the DHS reports, the State Department's FY2015 report, the 2007 fee rule, CBP's July 2021
 * release, ICE's 2023 testimony) are pinned to the phrase the line uses, so an edit has to come back here, and each line's
 * sources must exist.
 */
const refugeeMonthly = read("refugee_monthly.json") as { fy: number; month: string; admissions: number }[];
const determinations = parse("refugee_determinations.json", refugeeDeterminationRow);
const contextCases: Record<keyof typeof IMMIGRATION_CONTEXT, { says: string[]; check: () => void }> = {
  greenCards: {
    says: [
      "The FY1989–FY1991 peak includes legalizations under the 1986 Immigration Reform and Control Act",
      "nearly 2.7M green cards, almost all in 1989–1992",
      "Proclamation 10014 suspended entry for many immigrants from abroad (April 2020–February 2021)",
      "during the FY2020–FY2021 dip, which DHS ties to the pandemic",
    ],
    check: () => {
      // DHS's IRCA fact sheet (2009): "Nearly 2.7 million persons became LPRs under IRCA"; 95% of pre-1982 entrants got status
      // in 1989–1991 and 99% of special agricultural workers in 1990–1992.
      const lpr = (fy: number) => at(lprYears, fy).lpr;
      expect(argmax(lprYears, (y) => y.lpr).fy).toBe(1991);
      expect(lpr(1990)).toBeGreaterThan(Math.max(...between(lprYears, 1992, 2025).map((y) => y.lpr)));
      expect(lpr(1989)).toBeGreaterThan(lpr(1988));
      // Proclamation 10014 took effect April 23, 2020 for aliens outside the U.S. without an immigrant visa (spouses and
      // under-21 children of citizens exempt); Proclamation 10149 revoked it on February 24, 2021. DHS's FY2021 flow report
      // calls the pandemic "the most evident reason" 2021 was so low and says it "contributed" to 2020's 17-year low; it does
      // not mention the proclamation.
      for (const fy of [2020, 2021]) {
        expect(lpr(fy), `FY${fy}`).toBeLessThan(0.75 * lpr(2019));
        expect(lpr(fy), `FY${fy}`).toBeLessThan(0.75 * lpr(2022));
      }
    },
  },
  naturalizations: {
    says: [
      "DHS attributes the mid-1990s rise partly to 2.7M people legalized under the 1986 Immigration Reform and Control Act becoming eligible",
      "the FY2008 record mainly to nearly 1.4M applications filed in 2007 ahead of a fee increase",
      "took effect July 30, 2007",
    ],
    check: () => {
      // DHS (Naturalizations 2008) names IRCA first of three reasons for the mid-1990s rise, and calls FY2008's record "primarily
      // attributable" to the 2007 applications. The fee rule (72 FR 29851) took effect July 30, 2007.
      expect(argmax(between(lprYears, 1990, 1999), (y) => y.naturalizations!).fy).toBe(1996);
      expect(argmax(lprYears, (y) => y.naturalizations!).fy).toBe(2008);
    },
  },
  refugeeCeiling: {
    says: ["The FY2021 low came under a ceiling first set at 15k (October 2020) and raised to 62.5k (May 2021)", "Executive Order 14163 suspended refugee entry from January 27, 2025", "37.6k of FY2025’s 38.1k refugees arrived before February"],
    check: () => {
      expect(argmin(refugees.years, (y) => y.admissions).fy).toBe(2021);
      expect(at(refugees.years, 2021)).toMatchObject({ ceilingInitial: 15_000, ceiling: 62_500, revised: true });
      const fy21 = determinations.filter((d) => d.fy === 2021);
      expect(fy21.find((d) => d.sequence === 1)).toMatchObject({ ceiling: 15_000, signed: "2020-10-27" });
      expect(fy21.at(-1)).toMatchObject({ ceiling: 62_500, signed: "2021-05-03" });
      const fy25 = refugeeMonthly.filter((m) => m.fy === 2025);
      expect(fy25.filter((m) => m.month <= "2025-01").reduce((a, m) => a + m.admissions, 0)).toBe(37_596);
      expect(at(refugees.years, 2025).admissions).toBe(38_102);
      expect(refugees.markers.some((m) => m.title.includes("Refugee entry suspended") && m.date === "2025-01-27")).toBe(true);
    },
  },
  refugeeCountries: {
    says: ["Executive Order 14204 (February 7, 2025)", "The FY2026 determination allocates its 7.5k admissions primarily to them", "a May 2026 determination added 10k more for Afrikaners alone"],
    check: () => {
      expect(refugees.markers.some((m) => m.title.includes("Afrikaners") && m.date === "2025-02-07")).toBe(true);
      const fy26 = determinations.filter((d) => d.fy === 2026);
      expect(fy26[0]).toMatchObject({ kind: "annual", ceiling: 7_500 });
      expect(fy26[0].allocation_text).toContain("primarily be allocated among Afrikaners");
      expect(fy26[1]).toMatchObject({ kind: "emergency", signed: "2026-05-21", previous_ceiling: 7_500, ceiling: 17_500 });
      expect(fy26[1].allocation_text).toContain("additional admissions shall be allocated among Afrikaners");
      expect(rankCountries(refugees, 2026)[0].name).toBe("South Africa");
    },
  },
  refugeeTop: {
    says: [
      "The State Department’s FY2015 report said fighting between Congo’s government and M23 rebels since mid-2012",
      "left the east too insecure for refugees to return",
      "Congolese admissions would rise steadily",
      "The DRC led from FY2016",
      "FY2018–FY2023 determinations all gave Africa the largest share",
    ],
    check: () => {
      // The report (September 2014), Africa section: "Intensified conflict in eastern DRC since mid-2012 has led an additional
      // 170,000 Congolese to seek asylum" and "renewed hostilities between the GDRC and the M23 rebel group ... erased most of
      // these gains and North and South Kivu provinces and Katanga remain mostly too insecure for large-scale refugee return."
      // Its overview: "In the coming years that number will rise steadily."
      const leader = (fy: number) => refugees.countries[at(topByYear(refugees, fy, fy), fy).ranked[0].ci].name;
      expect(leader(2015)).not.toBe("Democratic Republic of the Congo");
      expect(leader(2016)).toBe("Democratic Republic of the Congo");
      // Congolese arrivals did rise each year from FY2014 to the FY2016 lead.
      const drc = (fy: number) => rankCountries(refugees, fy).find((c) => c.key === "COD")!.value;
      expect(drc(2014)).toBeLessThan(drc(2015));
      expect(drc(2015)).toBeLessThan(drc(2016));
      // Africa's allocation is the largest region's (the unallocated reserve is not a region) in every regional determination
      // from FY2018 through FY2023, and in none just outside that span (FY2017's Near East/South Asia was larger; FY2024's
      // Latin America/Caribbean range matched Africa's top and started higher).
      const africaLargest = (d: (typeof determinations)[number]) => {
        const regions = d.allocations.filter((a) => a.region_group !== "unallocated");
        const africa = regions.find((a) => a.region_group === "africa")!;
        return regions.every((a) => a === africa || (a.max < africa.max && a.min < africa.min));
      };
      const regional = determinations.filter((d) => d.allocation_basis === "region");
      const span = regional.filter((d) => d.fy >= 2018 && d.fy <= 2023);
      expect(span.map((d) => d.fy)).toEqual([2018, 2019, 2021, 2021, 2022, 2023]);
      for (const d of span) expect(africaLargest(d), d.id).toBe(true);
      for (const fy of [2017, 2024]) expect(africaLargest(regional.find((d) => d.fy === fy)!), `FY${fy}`).toBe(false);
    },
  },
  encounters: {
    says: [
      "CBP said Title 42 expulsions (from March 2020) added repeat crossings",
      "27% of July 2021’s southwest encounters, against 14% in FY2014–FY2019",
      "In the drop to FY2025’s 0.7M",
      "Border Patrol’s monthly count at least halved within two months of each entry proclamation (June 2024, January 2025)",
    ],
    check: () => {
      // The 27% and 14% are CBP's (July 2021 release, southwest border), outside the pipeline. The monthly drops are checked here.
      expect(encounters.markers.map((m) => m.date)).toContain("2020-03-21");
      const monthly = read("encounters_monthly.json") as { month: string; scope: string; component: string; value: number }[];
      const bp = (m: string) => monthly.filter((r) => r.scope === "nationwide" && r.component === "usbp" && r.month === m).reduce((a, r) => a + r.value, 0);
      // Proclamation 10773 took effect June 5, 2024; Proclamation 10888 was signed January 20, 2025.
      expect(bp("2024-07") / bp("2024-05")).toBeLessThanOrEqual(0.5);
      expect(bp("2025-02") / bp("2024-12")).toBeLessThanOrEqual(0.5);
      expect(millions(at(enc, 2025).total, 1)).toBe("0.7");
      expect(at(enc, 2025).total).toBeLessThan(at(enc, 2024).total);
    },
  },
  removals: {
    says: [
      "ICE says its work shifted to expulsions under the CDC’s Title 42 order (March 2020–May 2023), cutting removals to the FY2021 low",
      "CBP counted 1.1M expulsions in both FY2021 and FY2022",
      "After it ended, removals rose to 271.5k in FY2024, 82% after Border Patrol arrests",
    ],
    check: () => {
      // ICE's September 6, 2023 Senate testimony: "ICE resources and operations shifted to expulsions of noncitizens under
      // Title 42, resulting in a marked decrease in traditional removals between Fiscal Year (FY) 2020 and FY 2021."
      expect(encounters.markers.map((m) => m.date)).toEqual(expect.arrayContaining(["2020-03-21", "2023-05-11"]));
      expect(argmin(ice.years, (y) => y.value).fy).toBe(2021);
      for (const fy of [2021, 2022]) expect(millions(at(encounters.years, fy).nationwide.title42!, 1), `FY${fy}`).toBe("1.1");
      const y = at(removals, 2024);
      expect((y.value / 1000).toFixed(1)).toBe("271.5");
      expect(pct(y.agency!.cbp, y.value)).toBe(82);
      expect(argmax(between(removals, 2020, 2024), (r) => r.value).fy).toBe(2024);
    },
  },
};

/**
 * Figures a card's Data notes carry over from a removed context line: the criminal-history card's share of Border Patrol
 * handoffs with no known record, and the removals card's Title 42 exclusion.
 */
const notesOf = (file: string) => readFileSync(`components/immigration/${file}`, "utf8");
const enforcementNotes = parse("enforcement_notes.json", enforcementNote);

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
      // Counts are abbreviated (207.1k, 1.8M), never printed in full.
      expect(s.takeaway, s.title).not.toMatch(/\d,\d{3}/);
    }
  });

  it("avoids the words rule 7c rules out", () => {
    for (const s of Object.values(IMMIGRATION_TAKEAWAYS)) expect(s.takeaway, s.title).not.toMatch(/\b(soared|plunged|thanks to|since|still)\b/i);
  });

  it("criminal-history Data notes: 80% of FY2024's Border Patrol handoffs had no known record", () => {
    expect(notesOf("CriminalHistoryCard.tsx")).toContain("80% of FY2024&rsquo;s Border Patrol handoffs had none");
    const def = enforcementNotes.find((n) => n.id === "criminality-definition")!.text;
    expect(def).toContain("at the time of the enforcement action");
    expect(def).toContain("'illegal reentry,'");
    const b = at(ice.criminality.views.cbp, 2024);
    expect(b.total).toBe(223_752);
    expect(pct(b.parts.find((p) => p.key === "other_immigration_violator")!.value, b.total)).toBe(80);
  });

  it("removals Data notes: Title 42 expulsions are not counted", () => {
    expect(notesOf("RemovalsCard.tsx")).toContain("Title 42 expulsions (March 2020 to May 2023) are not counted");
    expect(enforcementNotes.some((n) => n.id === "title42-expulsions-excluded")).toBe(true);
  });

  for (const [key, c] of Object.entries(contextCases) as [keyof typeof IMMIGRATION_CONTEXT, (typeof contextCases)[keyof typeof IMMIGRATION_CONTEXT]][]) {
    it(`context, ${IMMIGRATION_TAKEAWAYS[key].title}: holds and names real sources`, () => {
      const line: ContextEntry = IMMIGRATION_CONTEXT[key];
      for (const phrase of c.says) expect(line.text).toContain(phrase);
      for (const src of line.sources) expect(SOURCE_LINKS[src.id], src.id).toMatch(/^https:\/\//);
      c.check();
    });
  }

  it("every context line belongs to a card, stays short and makes no causal claim of its own", () => {
    expect(Object.keys(IMMIGRATION_CONTEXT).sort()).toEqual(Object.keys(contextCases).sort());
    for (const [key, line] of Object.entries(IMMIGRATION_CONTEXT)) {
      expect(line.text.replace(/U\.S\./g, "US").split(/(?<=\.)\s+(?=[A-Z])/).length, key).toBeLessThanOrEqual(2);
      expect(line.text.split(/\s+/).length, key).toBeLessThanOrEqual(45);
      expect(line.text, key).not.toMatch(/\d,\d{3}/);
      // A cause is only ever the agency's own ("DHS attributes"), never the page's.
      expect(line.text, key).not.toMatch(/\b(because|due to|caused|led to|drove|thanks to|soared|plunged)\b/i);
    }
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { enforcementNote, enforcementReport, enforcementRow, isNationalRemovals } from "./enforcement-entities";
import { administration } from "./executive-orders-entities";
import { removalsHistoryReport, removalsHistoryRow } from "./removals-history-entities";
import { HISTORICAL_ADMINISTRATIONS } from "./troops-presidents";
import {
  assertBreakdownInvariants,
  assertRemovalsHistoryInvariants,
  assertEnforcementInvariants,
  buildImmigrationData,
  criminalityScheme,
  filterYears,
  seriesValues,
  showsPendingSlot,
  termOptionLabel,
  termsNewestFirst,
  yDomainMax,
} from "./immigration-derive";
import { fyPosition, labelsBar, shadeSpan, slotLayout, termSegments, valueLabel, visibleMarkers, yearLabel, yearLabelMode } from "./immigration-chart";

const OUT = join(process.cwd(), "pipeline", "output");
const read = (f: string) => JSON.parse(readFileSync(join(OUT, f), "utf8"));
const rows = (read("enforcement_series.json") as unknown[]).map((r) => enforcementRow.parse(r));
const notes = (read("enforcement_notes.json") as unknown[]).map((r) => enforcementNote.parse(r));
const report = enforcementReport.parse(read("enforcement_report.json"));
const admins = (read("administrations.json") as unknown[]).map((r) => administration.parse(r));
const historyRows = (read("removals_history_series.json") as unknown[]).map((r) => removalsHistoryRow.parse(r));
const historyReport = removalsHistoryReport.parse(read("removals_history_report.json"));
const allAdmins = [...HISTORICAL_ADMINISTRATIONS, ...admins.filter((a) => !HISTORICAL_ADMINISTRATIONS.some((h) => h.term_id === a.term_id))];
const history = { rows: historyRows, report: historyReport };
const data = buildImmigrationData(rows, notes, report, allAdmins, history);

describe("series invariants (real files)", () => {
  it("23 contiguous years, one preliminary, days and attribution consistent", () => {
    expect(rows.filter(isNationalRemovals)).toHaveLength(23);
    expect(() => assertEnforcementInvariants(rows, report, admins)).not.toThrow();
  });
  it("fails loudly when the data drifts", () => {
    expect(() => assertEnforcementInvariants(rows.filter((r) => r.period !== 2003), report, admins)).toThrow(/starts at 2004/);
    const bad = rows.map((r) => (r.period === 2021 ? { ...r, administration_term_id: "2017-01-20" } : r));
    expect(() => assertEnforcementInvariants(bad, report, admins)).toThrow(/majority term/);
    const bad2 = rows.map((r) => (r.period === 2013 ? { ...r, value: 1 } : r));
    expect(() => assertEnforcementInvariants(bad2, report, admins)).toThrow(/anchor/);
  });
});

describe("breakdowns (real files)", () => {
  const values = (metric: Parameters<typeof seriesValues>[1]["metric"], agency: "ice" | "cbp" | null = null, crim: Parameters<typeof seriesValues>[1]["criminality"] = null) =>
    seriesValues(rows, { metric, arresting_agency: agency, criminality: crim });
  const years = (xs: { fy: number }[]) => xs.map((x) => x.fy);
  const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

  it("covers the years ICE prints, and nothing else", () => {
    expect(years(values("removals", "ice"))).toEqual(range(2008, 2024));
    expect(years(values("removals", null, "convicted"))).toEqual(range(2013, 2024));
    expect(years(values("removals", null, "not_convicted"))).toEqual([2013, 2014, 2015]);
    expect(years(values("removals", null, "pending_charges"))).toEqual(range(2016, 2024));
    expect(years(values("removals", null, "convicted_or_pending"))).toEqual([2025]);
    expect(years(values("removals", "ice", "convicted"))).toEqual(range(2017, 2024));
    // No ICE document on file prints FY2021–FY2022 arrest totals: absent, not summed or filled.
    expect(years(values("administrative_arrests"))).toEqual([2016, 2017, 2018, 2019, 2020, 2023, 2024]);
    expect(years(values("administrative_arrests", null, "convicted"))).toEqual(range(2016, 2024));
    expect(years(values("at_large_arrests"))).toEqual(range(2016, 2024));
    expect(years(values("detainers_issued"))).toEqual(range(2016, 2024));
    expect(years(values("initial_book_ins", "cbp"))).toEqual(range(2016, 2020));
    expect(years(values("detention_adp"))).toEqual(range(2018, 2025));
    expect(years(values("detention_adp", "ice"))).toEqual(range(2018, 2024));
  });

  it("splits criminality two ways through FY2015, three ways from FY2016, combined only in FY2025", () => {
    expect([2013, 2015, 2016, 2024, 2025, 2012].map((fy) => criminalityScheme(rows, fy, "removals"))).toEqual(["two_way", "two_way", "three_way", "three_way", "partial", null]);
    expect(criminalityScheme(rows, 2016, "removals", "ice")).toBeNull();
    expect(criminalityScheme(rows, 2017, "removals", "ice")).toBe("three_way");
    expect(values("removals", null, "pending_charges").some((v) => v.value === 0)).toBe(false);
  });

  it("only FY2025 is preliminary, in every series", () => {
    const prelim = rows.filter((r) => r.status === "preliminary");
    expect([...new Set(prelim.map((r) => r.period))]).toEqual([2025]);
    expect(prelim.map((r) => [r.metric, r.arresting_agency, r.criminality])).toEqual([
      ["removals", null, null],
      ["removals", null, "convicted_or_pending"],
      ["administrative_arrests", null, "convicted_or_pending"],
      ["detention_adp", null, null],
    ]);
  });

  it("holds ICE's own figures (spot checks against the reports)", () => {
    const at = (fy: number, metric: Parameters<typeof seriesValues>[1]["metric"], agency: "ice" | "cbp" | null = null, crim: Parameters<typeof seriesValues>[1]["criminality"] = null) =>
      values(metric, agency, crim).find((v) => v.fy === fy)?.value;
    expect([at(2008, "removals", "ice"), at(2008, "removals", "cbp")]).toEqual([234_770, 134_451]); // FY2015 report Fig. 6: interior was the larger part
    expect([at(2021, "administrative_arrests", null, "pending_charges"), at(2021, "administrative_arrests", null, "other_immigration_violator")]).toEqual([8_813, 28_650]);
    expect(at(2024, "at_large_arrests")).toBe(33_242);
    expect([at(2024, "detention_adp"), at(2024, "detention_adp", "ice")! + at(2024, "detention_adp", "cbp")!]).toEqual([37_722, 37_721]);
  });

  it("fails loudly when a breakdown stops adding up", () => {
    expect(() => assertBreakdownInvariants(rows, report)).not.toThrow();
    const bump = rows.map((r) => (r.period === 2019 && r.metric === "removals" && r.arresting_agency === "cbp" && r.criminality === null ? { ...r, value: r.value + 1 } : r));
    expect(() => assertBreakdownInvariants(bump, report)).toThrow(/FY2019 removals agencies sum to 267259/);
    const noExc = { ...report, breakdowns: { exceptions: [] } };
    expect(() => assertBreakdownInvariants(rows, noExc)).toThrow(/FY2024 detention_adp agencies sum to 37721, total 37722/);
    const mixed = [...rows, { ...rows.find((r) => r.period === 2014 && r.criminality === "convicted")!, criminality: "pending_charges" as const }];
    expect(() => assertBreakdownInvariants(mixed, report)).toThrow(/mixes criminality schemes/);
  });
});

describe("page data", () => {
  it("y-domain is fixed from the full series", () => {
    expect(data.yMax).toBe(480_000);
    expect(yDomainMax([442_637])).toBe(480_000);
  });
  it("counts come from the data", () => {
    expect(data.finalCount).toBe(22);
    expect(data.corroboratedCount).toBe(10);
  });
  it("terms are oldest first, dropdown newest first", () => {
    expect(data.terms.map((t) => termOptionLabel(t))).toEqual([
      "George W. Bush (2001–2009)",
      "Barack Obama (2009–2017)",
      "Donald Trump (2017–2021)",
      "Joe Biden (2021–2025)",
      "Donald Trump (2025–)",
    ]);
    expect(termsNewestFirst(data.terms)[0].termId).toBe("2025-01-20");
  });
  it("filters by administration; the pending slot follows the newest one", () => {
    expect(filterYears(data.years, "all")).toHaveLength(23);
    expect(filterYears(data.years, "2021-01-20").map((y) => y.fy)).toEqual([2021, 2022, 2023, 2024]);
    expect(filterYears(data.years, "2025-01-20").map((y) => y.fy)).toEqual([2025]);
    expect(showsPendingSlot(data, "all")).toBe(true);
    expect(showsPendingSlot(data, "2025-01-20")).toBe(true);
    expect(showsPendingSlot(data, "2021-01-20")).toBe(false);
  });
  it("card notes exclude marker-covered and the Oct 5 note", () => {
    const withNotes = data.years.filter((y) => y.cardNotes.length).map((y) => y.fy);
    expect(withNotes).toEqual([2010, 2021, 2025]);
  });
  it("blended years carry both administrations", () => {
    const fy21 = data.years.find((y) => y.fy === 2021)!;
    expect(fy21.days.map((d) => `${d.last} ${d.days}`)).toEqual(["Trump 111", "Biden 254"]);
    expect(fy21.figureRead).toBe(true);
    expect(fy21.corroborated).toBe(false);
  });
});

describe("agency split and detention on each year", () => {
  const year = (fy: number) => data.years.find((y) => y.fy === fy)!;
  it("the split covers FY2008–FY2024 only, and adds up to the year's total", () => {
    expect(data.years.filter((y) => y.agency).map((y) => y.fy)).toEqual(Array.from({ length: 17 }, (_, i) => 2008 + i));
    for (const y of data.years) if (y.agency) expect(y.agency.ice + y.agency.cbp).toBe(y.value);
    expect(year(2007).agency).toBeNull();
    expect(year(2025).agency).toBeNull();
    expect(year(2024).agency).toEqual({ ice: 47_732, cbp: 223_752 });
  });
  it("detention runs FY2018–FY2025 with the agency split through FY2024, FY2025 preliminary", () => {
    expect(data.years.filter((y) => y.detention).map((y) => y.fy)).toEqual([2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]);
    expect(year(2017).detention).toBeNull();
    expect(year(2019).detention).toEqual({ value: 50_165, status: "final", ice: 20_115, cbp: 30_050 });
    expect(year(2025).detention).toEqual({ value: 48_706, status: "preliminary", ice: null, cbp: null });
  });
  it("criminality views are on the page data", () => {
    expect(data.criminality.views.all).toHaveLength(13);
    expect(data.criminality.yMax).toBe(500_000);
  });
});

describe("chart geometry", () => {
  it("caps slot at 80 and bar at 52", () => {
    expect(slotLayout(1032, 24).slotW).toBeCloseTo(43);
    expect(slotLayout(1032, 24).barW).toBeCloseTo(38);
    expect(slotLayout(1032, 2)).toEqual({ slotW: 80, barW: 52 });
  });
  it("closes the gap between bars as the slots narrow", () => {
    const dense = slotLayout(300, 46);
    expect(dense.slotW - dense.barW).toBeCloseTo(1, 1);
    expect(dense.barW / dense.slotW).toBeGreaterThan(0.8);
    expect(slotLayout(1032, 24).slotW - slotLayout(1032, 24).barW).toBeCloseTo(5);
  });
  it("positions dates on the fiscal-year axis like the mock", () => {
    expect(fyPosition("2006-10-01")).toBe(2007);
    expect(fyPosition("2003-03-01") - 2003).toBeCloseTo(151 / 365, 5);
    const x = (iso: string) => 44 + (fyPosition(iso) - 2003) * 43;
    expect(x("2003-03-01")).toBeCloseTo(61.8, 0);
    expect(x("2013-06-01")).toBeCloseTo(502.6, 0);
    expect(x("2020-03-01")).toBeCloseTo(792.9, 0);
    expect(x("2023-05-12")).toBeCloseTo(930.3, 0);
  });
  it("hides markers outside the shown years and clips the Title 42 shade", () => {
    const biden = visibleMarkers(data.markers, 2021, 2024).map((p) => p.marker.n);
    expect(biden).toEqual([5]);
    const trump = visibleMarkers(data.markers, 2017, 2020).map((p) => p.marker.n);
    expect(trump).toEqual([4]);
    const t42 = data.markers[3];
    expect(shadeSpan(t42, 2021, 4)![0]).toBe(0);
    expect(shadeSpan(t42, 2003, 6)).toBeNull();
  });
  it("label density", () => {
    expect(labelsBar(2015, 8)).toBe(true);
    expect(labelsBar(2015, 9)).toBe(false);
    expect(labelsBar(2021, 23)).toBe(true);
    expect(labelsBar(2000, 46)).toBe(true); // the INS era's peak
    expect(valueLabel(410_000, 35)).toBe("410k");
    expect(valueLabel(410_000, 45)).toBe("410,000");
    expect(yearLabelMode(43)).toBe("four");
    expect(yearLabelMode(25)).toBe("two");
    expect(yearLabelMode(14)).toBe("every4");
    expect([2003, 2004, 2007].map((y) => yearLabel(y, "every4"))).toEqual(["2003", null, "2007"]);
    expect(yearLabelMode(7)).toBe("every8");
    expect([1983, 1987, 1991, 2023, 2024].map((y) => yearLabel(y, "every8"))).toEqual(["1983", null, "1991", "2023", null]);
  });
  it("term segments break on administration changes and the pending slot extends the last", () => {
    const seg = termSegments(data.years, true);
    expect(seg.map((s) => [s.party, s.from, s.to])).toEqual([["R", 0, 6], ["D", 6, 14], ["R", 14, 18], ["D", 18, 22], ["R", 22, 24]]);
  });
});

describe("INS-era years on the removals card (real files)", () => {
  const ins = data.removalsYears.filter((y) => y.era === "ins");
  it("run FY1980–FY2002 and join ICE's FY2003 with no gap; the other cards keep ICE's years only", () => {
    expect(data.removalsYears.map((y) => y.fy)).toEqual(Array.from({ length: 46 }, (_, i) => 1980 + i));
    expect(ins).toHaveLength(23);
    expect(data.years[0].fy).toBe(2003);
    expect(data.years.every((y) => y.era === "ice")).toBe(true);
    expect(data.historyFirstFy).toBe(1980);
    expect(data.history.edition).toBe(2023);
  });
  it("INS years are final, one neutral bar (no agency split, no detention), carry the INS-era note, and ICE's headline stays ICE's", () => {
    expect(ins.every((y) => y.status === "final" && y.agency === null && y.detention === null && y.cardNotes.some((n) => n.id === "ins-era"))).toBe(true);
    expect(data.removalsYears.find((y) => y.fy === 2003)).toMatchObject({ era: "ice", value: 157_080 });
    expect(data.removalsYears.find((y) => y.fy === 2002)).toMatchObject({ era: "ins", value: 165_170 });
  });
  it("terms include the pre-1993 presidents, oldest first, while the ICE terms are unchanged", () => {
    expect(data.removalsTerms[0].president).toBe("Jimmy Carter");
    expect(data.removalsTerms.map((t) => t.last).slice(0, 5)).toEqual(["Carter", "Reagan", "Bush", "Clinton", "Bush"]);
    expect(data.terms[0].president).toBe("George W. Bush");
  });
  it("the y-axis still comes from ICE's series (the INS era is lower)", () => {
    expect(Math.max(...ins.map((y) => y.value))).toBeLessThan(data.yMax);
    expect(data.yMax).toBe(480_000);
  });
  it("marker 1 names the agency change", () => {
    expect(data.markers[0].title).toMatch(/ICE takes over from the INS/);
    expect(data.markers[0].text).toMatch(/Immigration and Naturalization Service/);
    expect(data.markers[0].text).toMatch(/not necessarily the same counting rules/);
  });
  it("fails loudly when the history stops joining ICE or the edition drifts", () => {
    const run = (h: typeof historyRows, rep = historyReport) => assertRemovalsHistoryInvariants(h, rep, rows, allAdmins);
    expect(() => run(historyRows)).not.toThrow();
    expect(() => run(historyRows.slice(0, -1))).toThrow(/ends at FY2001|disagrees/);
    expect(() => run(historyRows.slice(1))).toThrow(/not contiguous/);
    expect(() => run(historyRows.map((r) => (r.period === 1990 ? { ...r, edition: 2022 } : r)))).toThrow(/edition/);
    expect(() => run(historyRows, { ...historyReport, ice_comparison: [{ ...historyReport.ice_comparison[0], ice: 1 }] })).toThrow(/not the series/);
  });
});

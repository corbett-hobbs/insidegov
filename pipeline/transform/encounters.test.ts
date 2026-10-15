import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cbpCatalog, encountersVintages, type CbpCatalog } from "../../lib/encounters-entities";
import { HISTORICAL_ADMINISTRATIONS } from "../../lib/troops-presidents";
import { listVintages, vintageRank } from "../fetch/cbp";
import { ADMINISTRATIONS } from "./administrations";
import {
  buildEncounters,
  calendarMonth,
  EncountersDataError,
  parseEncountersCsv,
  parseNationwideHistory,
  parseSouthwestSectors,
  type EncountersBuildInput,
} from "./encounters";

// ---- the real inputs ----

const RAW = "pipeline/raw/cbp";
const catalog = cbpCatalog.parse(JSON.parse(readFileSync("pipeline/reference/cbp-encounters-catalog.json", "utf8")));
const texts = new Map(catalog.sources.map((s) => [s.id, readFileSync(`${RAW}/${s.text_file}`, "utf8")]));
const vintages = encountersVintages.parse(JSON.parse(readFileSync(`${RAW}/encounters-vintages.json`, "utf8"))).map((vintage) => ({ vintage, csv: readFileSync(`${RAW}/${vintage.file}`, "utf8") }));
const administrations = [...HISTORICAL_ADMINISTRATIONS, ...ADMINISTRATIONS.filter((a) => !HISTORICAL_ADMINISTRATIONS.some((h) => h.term_id === a.term_id))];
const input: EncountersBuildInput = { catalog, texts, vintages, administrations };
const built = buildEncounters(input);

const withCatalog = (edit: (c: CbpCatalog) => void): EncountersBuildInput => {
  const c = structuredClone(catalog);
  edit(c);
  return { ...input, catalog: c };
};
const withText = (id: string, edit: (t: string) => string): EncountersBuildInput => ({ ...input, texts: new Map([...texts, [id, edit(texts.get(id)!)]]) });

const HEADER = "Fiscal Year,Month Grouping,Month (abbv),Component,Land Border Region,Area of Responsibility,AOR (Abbv),Demographic,Citizenship,Title of Authority,Encounter Type,Encounter Count";

// ---- readers ----

describe("CBP history tables", () => {
  it("reads the two-column nationwide table FY1925–FY2020", () => {
    const m = parseNationwideHistory(texts.get("usbp-nationwide-history")!);
    expect([Math.min(...m.keys()), Math.max(...m.keys())]).toEqual([1925, 2020]);
    expect([m.get(1925), m.get(1986), m.get(2000), m.get(2020)]).toEqual([22199, 1692544, 1676438, 405036]);
  });

  it("reads the southwest sectors and fails when they stop adding up", () => {
    const text = texts.get("usbp-southwest-sectors")!;
    expect(parseSouthwestSectors(text).get(1986)).toBe(1615844);
    expect(() => parseSouthwestSectors(text.replace("1,615,844", "1,615,845"))).toThrow(/FY1986: sectors add up to 1615844, printed total 1615845/);
  });
});

describe("encounters CSV reader", () => {
  it("maps fiscal-year months to calendar months", () => {
    expect([calendarMonth(2020, "OCT"), calendarMonth(2020, "DEC"), calendarMonth(2020, "JAN"), calendarMonth(2020, "SEP")]).toEqual(["2019-10", "2019-12", "2020-01", "2020-09"]);
  });

  it("sums regions into nationwide and keeps the southwest apart", () => {
    const csv = [
      HEADER,
      "2026 (FYTD),FYTD,OCT,U.S. Border Patrol,Southwest Land Border,El Paso Sector,El Paso,Single Adults,MEXICO,Title 8,Apprehensions,7",
      "2026 (FYTD),FYTD,OCT,U.S. Border Patrol,Northern Land Border,Swanton Sector,Swanton,Single Adults,CANADA,Title 8,Apprehensions,3",
      "2026 (FYTD),FYTD,OCT,Office of Field Operations,Other,Miami Field Office,Miami,Single Adults,CUBA,Title 8,Inadmissibles,\"1,200\"",
    ].join("\n");
    const y = parseEncountersCsv(csv, "fixture").get(2026)!;
    expect(y.inProgress).toBe(true);
    const oct = y.months.get("2025-10")!;
    expect([oct.get("nationwide|usbp|title8"), oct.get("southwest|usbp|title8"), oct.get("nationwide|ofo|title8"), oct.get("southwest|ofo|title8")]).toEqual([10, 7, 1200, undefined]);
  });

  it("fails on an encounter type that contradicts the data dictionary", () => {
    const csv = `${HEADER}\n2023,FYTD,OCT,U.S. Border Patrol,Other,Miami Sector,Miami,Single Adults,CUBA,Title 8,Inadmissibles,1`;
    expect(() => parseEncountersCsv(csv, "fixture")).toThrow(/is "Inadmissibles", expected "Apprehensions"/);
  });

  it("fails on a completed year with missing months", () => {
    const csv = `${HEADER}\n2023,FYTD,OCT,U.S. Border Patrol,Other,Miami Sector,Miami,Single Adults,CUBA,Title 8,Apprehensions,1`;
    expect(() => parseEncountersCsv(csv, "fixture")).toThrow(/FY2023 is not labelled year-to-date but has 1 months/);
  });
});

describe("listing page discovery", () => {
  const html = readFileSync(`${RAW}/cbp-nationwide-encounters-document.html`, "utf8");
  it("finds the area-of-responsibility files and ranks the newest", () => {
    const listed = listVintages(html);
    expect(listed.some((v) => v.file === "nationwide-encounters-fy20-fy23-aor.csv" && v.posted === "2023-11" && v.through === null)).toBe(true);
    const newest = listed.reduce((a, b) => (vintageRank(b) > vintageRank(a) ? b : a));
    expect(newest.fy_end).toBeGreaterThanOrEqual(2026);
    expect(listed.every((v) => !v.file.includes("-state"))).toBe(true);
  });
  it("ranks a year-end file after every month of its range", () => {
    expect(vintageRank({ fy_end: 2026, through: null, posted: "2026-11" })).toBeGreaterThan(vintageRank({ fy_end: 2026, through: "sep", posted: "2026-10" }));
    expect(vintageRank({ fy_end: 2027, through: "oct", posted: "2026-11" })).toBeGreaterThan(vintageRank({ fy_end: 2026, through: null, posted: "2026-11" }));
  });
});

// ---- the build over the real files ----

describe("buildEncounters (real files)", () => {
  const row = (fy: number, scope: string, component: string, authority = "title8") => built.series.find((r) => r.period === fy && r.scope === scope && r.component === component && r.authority === authority);
  const total = (fy: number, scope: string) => built.series.filter((r) => r.period === fy && r.scope === scope).reduce((s, r) => s + r.value, 0);

  it("covers FY1980 to the newest year, ports from FY2004 and Title 42 FY2020–FY2023", () => {
    const fys = [...new Set(built.series.map((r) => r.period))];
    expect(fys[0]).toBe(1980);
    expect(row(2003, "nationwide", "ofo")).toBeUndefined();
    expect(row(2004, "nationwide", "ofo")).toMatchObject({ value: 170510, publisher: "DHS OHSS", rounding: 10 });
    expect(row(2015, "nationwide", "ofo")).toMatchObject({ value: 255342, publisher: "CBP", method: "printed" });
    const t42 = [...new Set(built.series.filter((r) => r.authority === "title42").map((r) => r.period))];
    expect(t42).toEqual([2020, 2021, 2022, 2023]);
  });

  it("matches CBP's printed nationwide totals, year by year", () => {
    expect([total(2019, "nationwide"), total(2020, "nationwide"), total(2022, "nationwide"), total(2023, "nationwide"), total(2024, "nationwide"), total(2025, "nationwide")]).toEqual([
      1148024, 646822, 2766582, 3201144, 2901142, 691906,
    ]);
    expect(row(1986, "southwest", "usbp")?.value).toBe(1615844);
  });

  it("marks only the year in progress preliminary, with its months", () => {
    const prelim = built.series.filter((r) => r.status === "preliminary");
    expect(new Set(prelim.map((r) => r.period)).size).toBe(1);
    expect(prelim[0].months).toBeLessThan(12);
    expect(prelim[0].note_ids).toContain("operational-data");
    expect(row(2025, "nationwide", "usbp")?.note_ids).not.toContain("operational-data");
  });

  it("attributes years to the president in office on Sept 30, with the day split", () => {
    expect(row(2021, "nationwide", "usbp")).toMatchObject({ administration_term_id: "2021-01-20", blended: true });
    expect(row(2025, "nationwide", "usbp")?.administration_days.map((d) => d.term_id)).toEqual(["2021-01-20", "2025-01-20"]);
    expect(row(1980, "nationwide", "usbp")?.blended).toBe(false);
  });

  it("keeps Title 42 rows inside March 2020 – May 2023 by month", () => {
    const months = built.monthly.filter((r) => r.authority === "title42" && r.value > 0).map((r) => r.month);
    expect(months.every((m) => m >= "2020-03" && m <= "2023-05")).toBe(true);
    expect(months).toContain("2020-03");
    expect(months).toContain("2023-05");
  });

  it("monthly rows add up to the fiscal-year rows", () => {
    for (const r of built.series.filter((x) => x.period >= 2020)) {
      const sum = built.monthly.filter((m) => m.fy === r.period && m.scope === r.scope && m.component === r.component && m.authority === r.authority).reduce((s, m) => s + m.value, 0);
      expect(sum).toBe(r.value);
    }
  });
});

// ---- the gates ----

describe("gates", () => {
  it("fails when a curated quote is not in its source", () => {
    expect(() => buildEncounters(withCatalog((c) => void (c.printed[0].evidence = "Total Inadmissibles 1 255,342 274,821 216,371")))).toThrow(EncountersDataError);
  });

  it("fails when a page's parts stop adding up to its total and no exception covers it", () => {
    expect(() => buildEncounters(withCatalog((c) => void (c.exceptions = c.exceptions.filter((e) => e.id !== "fy2024-usbp-misprint"))))).toThrow(/FY2024: parts add up to 2921142, printed total 2901142/);
  });

  it("fails on a stale exception", () => {
    expect(() =>
      buildEncounters(
        withCatalog((c) =>
          c.exceptions.push({ id: "stale", kind: "misprint", fy: 2019, scope: "nationwide", component: "usbp", between: ["fy2025-page-usbp", "csv"], values: [1, 2], resolution: "test" }),
        ),
      ),
    ).toThrow(/exception stale is no longer needed/);
  });

  it("fails when CBP and OHSS disagree beyond the tolerance", () => {
    expect(() => buildEncounters(withCatalog((c) => void (c.overlap_tolerance = 0.005)))).toThrow(/CBP 1266214, OHSS 1255920 \(0\.813%, beyond 0\.5%\)/);
  });

  it("fails when a page's figure differs from the CSV for a year both have", () => {
    // The page's OFO figure and its total both one higher, so the page still adds up and only the CSV disagrees.
    const bad = withText("cbp-enforcement-fy2025", (t) => t.replace("241,786", "241,787").replace("646,822", "646,823"));
    const c = structuredClone(catalog);
    for (const [id, from, to] of [["fy2025-page-ofo", 241786, 241787], ["fy2025-page-total", 646822, 646823]] as const) {
      const p = c.printed.find((x) => x.id === id)!;
      p.values["2020"] = to;
      p.evidence = p.evidence.replace(from.toLocaleString("en-US"), to.toLocaleString("en-US"));
    }
    expect(() => buildEncounters({ ...bad, catalog: c })).toThrow(/FY2020 nationwide ofo: fy2025-page-ofo prints 241787, the series has 241786/);
  });

  it("fails when Title 42 appears outside its months", () => {
    const csv = vintages[1].csv.replace(/^(2024,FYTD,OCT,[^\n]*?),Title 8,Apprehensions,/m, "$1,Title 42,Expulsions,");
    expect(csv).not.toBe(vintages[1].csv);
    expect(() => buildEncounters({ ...input, vintages: [vintages[0], { ...vintages[1], csv }] })).toThrow(/Title 42 .* in 2023-10, outside 2020-03..2023-05/);
  });

  it("fails when a year drops out of every kept file", () => {
    expect(() => buildEncounters({ ...input, vintages: [vintages[1]] })).toThrow(/usbp_tables_last_fiscal_year is FY2019, but the CSVs start in FY2023/);
  });
});

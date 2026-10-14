import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { refugeeCatalog, type RefugeeCatalog } from "../../lib/refugee-entities";
import { HISTORICAL_ADMINISTRATIONS } from "../../lib/troops-presidents";
import { ADMINISTRATIONS } from "./administrations";
import { indexCountries, resolveCountry } from "./removals-country-names";
import { REFUGEE_NAME_TABLES } from "./refugee-country-names";
import {
  buildRefugee,
  parseCumulative,
  parseRange,
  parseWorkbook,
  parseYearSheet,
  RefugeeDataError,
  type FrIndexRow,
  type RefugeeBuildInput,
} from "./refugee";

// ---- fixtures ----

const SHEET = `## sheet: 2099
Department of State
Fiscal Year 2099
Africa |  | 1,000
 | Somalia |  | 30 | 10 | 10 | 10 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0
 | Sudan |  | 20 | 0 | 0 | 0 | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0
 | Total Africa |  | 50 | 10 | 10 | 10 | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0
East Asia |  | 500 - 900
 | Burma |  | 5 | 5 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0
 | Total East Asia |  | 5 | 5 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0
 | Grand Totals | 2000 | 55 | 15 | 10 | 10 | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0
`;

describe("State Department workbook readers", () => {
  it("reads ranges, single numbers and blanks", () => {
    expect(parseRange("30,000 - 50,000", "x")).toEqual({ min: 30000, max: 50000 });
    expect(parseRange("5,000", "x")).toEqual({ min: 5000, max: 5000 });
    expect(parseRange("", "x")).toBeNull();
    expect(() => parseRange("50,000 - 30,000", "x")).toThrow(RefugeeDataError);
  });

  it("reads a year sheet: regions, ceilings, countries and months", () => {
    const y = parseYearSheet(parseWorkbook(SHEET)[0]);
    expect(y.fy).toBe(2099);
    expect(y.total).toBe(55);
    expect(y.ceiling).toBe(2000);
    expect(y.regions.map((r) => [r.group, r.total, r.ceiling])).toEqual([
      ["africa", 50, { min: 1000, max: 1000 }],
      ["east_asia", 5, { min: 500, max: 900 }],
    ]);
    expect(y.countries.map((c) => c.name)).toEqual(["Somalia", "Sudan", "Burma"]);
    expect(y.months.slice(0, 4)).toEqual([15, 10, 10, 20]);
  });

  it("fails when countries do not add up to the region total", () => {
    const bad = SHEET.replace(" | Sudan |  | 20 | 0 | 0 | 0 | 20", " | Sudan |  | 21 | 0 | 0 | 0 | 21");
    expect(() => parseYearSheet(parseWorkbook(bad)[0])).toThrow(/countries sum to 51, printed 50/);
  });

  it("fails when a country's months do not add up to its year", () => {
    const bad = SHEET.replace(" | Burma |  | 5 | 5 | 0", " | Burma |  | 5 | 4 | 0");
    expect(() => parseYearSheet(parseWorkbook(bad)[0])).toThrow(/months sum to 4/);
  });

  it("fails when cumulative region columns do not add up to the total", () => {
    const head = "## sheet: Cumulative Summary\nYear | Africa | Asia |  | Central Asia | Union | Kosovo | Caribbean | South Asia | PSI | Total\n";
    expect(parseCumulative(parseWorkbook(head + "1990 | 1 | 2 |  | 3 | 4 | 0 | 5 | 6 | 7 | 28\n")[0])[0].byGroup.get("europe")).toBe(7);
    expect(() => parseCumulative(parseWorkbook(head + "1990 | 1 | 2 |  | 3 | 4 | 0 | 5 | 6 | 7 | 29\n")[0])).toThrow(/sum to 28, printed total 29/);
  });
});

describe("refugee country names", () => {
  const index = indexCountries([
    { country_code: "COD", name: "Congo, Democratic Republic of the Congo (formerly Za" },
    { country_code: "COG", name: "Congo, Republic of the Congo" },
    { country_code: "KOR", name: "South Korea (Republic of Korea)" },
    { country_code: "PRK", name: "North Korea (Democratic People's Republic of Korea)" },
    { country_code: "CHN", name: "China" },
    { country_code: "PSE", name: "Palestine" },
  ]);
  const key = (n: string) => resolveCountry(n, index, REFUGEE_NAME_TABLES).country_key;

  it("maps the State Department's spellings", () => {
    expect(key("Dem. Rep. Congo")).toBe("COD");
    expect(key("Congo")).toBe("COG");
    expect(key("Republic of the Congo")).toBe("COG");
    expect(key("Korea, Republic of South")).toBe("KOR");
    expect(key("Korea, North")).toBe("PRK");
  });

  it("keeps Tibet apart from China and maps Palestinian Authority documents to PSE", () => {
    expect(key("Tibet")).toBe("XTB");
    expect(resolveCountry("Tibet", index, REFUGEE_NAME_TABLES).display_name).toBe("Tibet");
    expect(key("China")).toBe("CHN");
    expect(key("PA")).toBe("PSE");
  });
});

// ---- the real catalog and snapshots ----

const RAW = "pipeline/raw/refugee";
const realCatalog = (): RefugeeCatalog => refugeeCatalog.parse(JSON.parse(readFileSync("pipeline/reference/refugee-catalog.json", "utf8")));
const realInput = (catalog = realCatalog()): RefugeeBuildInput => ({
  catalog,
  texts: new Map(catalog.sources.map((s) => [s.id, readFileSync(`${RAW}/${s.text_file}`, "utf8")])),
  frIndex: JSON.parse(readFileSync(`${RAW}/fr-refugee-admissions-index.json`, "utf8")) as FrIndexRow[],
  administrations: [...HISTORICAL_ADMINISTRATIONS, ...ADMINISTRATIONS.filter((a) => !HISTORICAL_ADMINISTRATIONS.some((h) => h.term_id === a.term_id))],
  countries: indexCountries(
    (JSON.parse(readFileSync("pipeline/output/countries.json", "utf8")) as { country_code: string; name: string; kind: string }[]).filter((c) => c.kind === "country" || c.kind === "former"),
  ),
});

describe("buildRefugee over the real files", () => {
  const built = buildRefugee(realInput());
  const year = (fy: number) => built.series.find((r) => r.period === fy)!;

  it("covers FY1980–FY2027 with no ceiling invented for FY1980", () => {
    expect(built.series[0].period).toBe(1980);
    expect(built.series.at(-1)!.period).toBe(2027);
    expect(year(1980).ceiling).toBeNull();
    expect(year(1980).admissions).toBe(207_116);
    expect(year(2027).admissions).toBeNull();
    expect(year(2027).ceiling_status).toBe("preliminary");
  });

  it("carries mid-year revisions as initial vs. final", () => {
    expect([year(1988).ceiling_initial, year(1988).ceiling]).toEqual([72_500, 87_500]);
    expect([year(1999).ceiling_initial, year(1999).ceiling]).toEqual([78_000, 91_000]);
    expect([year(2021).ceiling_initial, year(2021).ceiling]).toEqual([15_000, 62_500]);
    expect([year(2026).ceiling_initial, year(2026).ceiling]).toEqual([7_500, 17_500]);
    expect(year(2026).determination_ids).toEqual(["PD 2025-13", "PD 2026-14"]);
    expect(built.determinations.filter((d) => d.fy === 2021).map((d) => d.previous_ceiling)).toEqual([null, 15_000, 15_000]);
  });

  it("marks compilation years and the one unlocated revision", () => {
    expect(year(1981).ceiling_source_kind).toBe("compilation");
    expect(year(1989)).toMatchObject({ ceiling: 116_500, ceiling_initial: 94_000, ceiling_revised: true, ceiling_source_kind: "compilation" });
    expect(year(2016).ceiling_source_kind).toBe("determination");
  });

  it("keeps FY2025's ceiling from the outgoing administration and shows the January collapse by month", () => {
    expect(year(2025)).toMatchObject({ ceiling: 125_000, admissions: 38_102, blended: true });
    const months = built.monthly.filter((m) => m.fy === 2025);
    expect(months[0].month).toBe("2024-10");
    expect(months.slice(0, 4).reduce((s, m) => s + m.admissions, 0)).toBe(37_596);
  });

  it("reconciles countries to the national total every year", () => {
    for (const fy of new Set(built.byCountry.map((r) => r.fy))) {
      const sum = built.byCountry.filter((r) => r.fy === fy).reduce((s, r) => s + r.admissions, 0);
      expect(sum, `FY${fy}`).toBe(year(fy).admissions);
    }
  });

  it("builds the restriction table with keyed countries", () => {
    const pp = built.policy.find((p) => p.id === "pp-10998")!;
    expect(pp.effective).toBe("2026-01-01");
    expect(pp.countries.filter((c) => c.level === "full")).toHaveLength(20);
    expect(pp.countries.filter((c) => c.level === "partial")).toHaveLength(20);
    expect(built.policy.find((p) => p.id === "eo-14163")).toMatchObject({ status: "in_effect", effective: "2025-01-27", ended: null });
  });

  it("attributes fiscal years before 1993 with the historical presidents", () => {
    expect(year(1985).administration_term_id).toBe("1981-01-20");
    expect(year(1989)).toMatchObject({ administration_term_id: "1989-01-20", blended: true });
  });
});

describe("gates", () => {
  it("fails on a quote that is not in the source", () => {
    const c = realCatalog();
    c.determinations[0].ceiling_evidence = "admission of up to 71,000 refugees";
    c.determinations[0].ceiling = 71_000;
    expect(() => buildRefugee(realInput(c))).toThrow(/quoted evidence not found/);
  });

  it("fails when allocations do not add up to the ceiling", () => {
    const c = realCatalog();
    const d = c.determinations.find((x) => x.id === "PD 2015-14")!;
    d.allocations = d.allocations.filter((a) => a.key !== "unallocated_reserve");
    expect(() => buildRefugee(realInput(c))).toThrow(/allocations sum to 79000, ceiling is 85000/);
  });

  it("fails when a new Federal Register determination is not in the catalog", () => {
    const input = realInput();
    expect(() =>
      buildRefugee({ ...input, frIndex: [...input.frIndex, { document_number: "2027-99999", title: "Emergency Presidential Determination on Refugee Admissions for Fiscal Year 2027", publication_date: "2027-03-01" }] }),
    ).toThrow(/not reviewed[\s\S]*2027-99999/);
  });

  it("fails when CRS disagrees with a determination outside the documented exception", () => {
    const c = realCatalog();
    const row = c.compiled_ceilings.rows.find((r) => r.fy === 1995)!;
    const input = realInput(c);
    const texts = new Map(input.texts);
    texts.set("crs-r47399", texts.get("crs-r47399")!.replace(row.evidence.split(" ").join("\n"), "1995\n113,000\n99,974"));
    row.ceiling = 113_000;
    row.evidence = "1995 113,000 99,974";
    expect(() => buildRefugee({ ...input, texts })).toThrow(/FY1995: CRS final ceiling 113000 != last determination PD 95-1 \(112000\)/);
  });
});

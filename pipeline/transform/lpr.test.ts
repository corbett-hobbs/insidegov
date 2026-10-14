import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { lprCatalog, type LprCatalog, type OhssSource, type OhssTable } from "../../lib/lpr-entities";
import { HISTORICAL_ADMINISTRATIONS } from "../../lib/troops-presidents";
import { readXls, readXlsx } from "../fetch/workbook-lib";
import { extractText } from "../fetch/ohss";
import { ADMINISTRATIONS } from "./administrations";
import { buildLpr, cellRef, LprDataError, locateTable, parseCount, parseExtract, readClassByYear, readCountryByYear, readLong, readQuarterlyClass, type LprBuildInput } from "./lpr";
import { LPR_NAME_TABLES } from "./lpr-country-names";
import { indexCountries, resolveCountry } from "./removals-country-names";

// ---- fixtures ----

const source = (over: Partial<OhssSource> = {}): OhssSource => ({
  id: "fixture",
  title: "fixture",
  publisher: "OHSS",
  url: "https://example.gov/x.xlsx",
  page_url: "https://example.gov/",
  file: "x.xlsx",
  text_file: "x.txt",
  kind: "xlsx",
  edition: { kind: "yearbook", fy: 2099 },
  posted: null,
  ...over,
});
const table = (over: Partial<OhssTable>): OhssTable => ({ id: "t", source: "fixture", sheet: "Table 6", title: "", layout: "class_by_year", metric: "lpr", rounding: null, ...over });

const CLASS_TITLE = "PERSONS OBTAINING LAWFUL PERMANENT RESIDENT STATUS BY TYPE AND MAJOR CLASS OF ADMISSION: FISCAL YEARS 2098 TO 2099";
// Two years; every section adds up. Parolees is "D" in 2098 (withheld), so 2098's other class is a residual.
const CLASS_SHEET = `## sheet: Table 6
1\tTable 6.
2\t${CLASS_TITLE}
4\tType and class of admission | 2098 | 2099
5\tTOTAL
6\tTotal | 1000 | 1100
7\tImmediate relatives of U.S. citizens | 400 | 450
8\tSpouses | 250 | 300
9\tChildren 1 | 100 | 100
10\tParents | 50 | 50
11\tFamily-sponsored preferences | 200 | 200
12\tFirst: Unmarried sons/daughters of U.S. citizens and their children | 200 | 200
13\tEmployment-based preferences | 150 | 160
14\tFirst: Priority workers | 150 | 160
15\tDiversity | 50 | 50
16\tRefugees | 100 | 120
17\tAsylees | 40 | 50
18\tParolees | D | 10
19\tOther | 50 | 60
20\tADJUSTMENTS OF STATUS
21\tTotal | 600 | 650
22\tImmediate relatives of U.S. citizens | 250 | 280
23\tFamily-sponsored preferences | 20 | 20
24\tEmployment-based preferences | 140 | 150
25\tDiversity | - | -
26\tRefugees | 100 | 120
27\tAsylees | 40 | 50
28\tParolees | D | 10
29\tOther | 40 | 20
30\tNEW ARRIVALS
31\tTotal | 400 | 450
32\tImmediate relatives of U.S. citizens | 150 | 170
33\tFamily-sponsored preferences | 180 | 180
34\tEmployment-based preferences | 10 | 10
35\tDiversity | 50 | 50
36\tRefugees | - | -
37\tAsylees | - | -
38\tParolees | - | -
39\tOther | 10 | 40
40\tD Data withheld to limit disclosure.
`;

const ctxOf = (text: string, t: OhssTable) => locateTable(t, source(), parseExtract(text));

describe("OHSS extract readers", () => {
  it("reads counts, zeros, withheld and not-applicable cells", () => {
    expect(parseCount("1,234", "B2", "x")).toEqual({ value: 1234, withheld: false, cell: "B2" });
    expect(parseCount("-", "B2", "x").value).toBe(0);
    expect(parseCount("D", "B2", "x")).toMatchObject({ value: null, withheld: true });
    expect(parseCount("X", "B2", "x")).toMatchObject({ value: null, notApplicable: true });
    expect(parseCount("NA", "B2", "x")).toMatchObject({ value: null, notApplicable: true });
    expect(() => parseCount("n/a", "B2", "x")).toThrow(LprDataError);
    expect(cellRef(27, 10)).toBe("K27");
  });

  it("reads a class table: classes, other as a sum or a residual, and types", () => {
    const t = readClassByYear(ctxOf(CLASS_SHEET, table({ title: CLASS_TITLE })));
    const y99 = t.get(2099)!.get(null)!;
    expect(y99.total.value).toBe(1100);
    expect(y99.classes.get("other")).toEqual({ value: 70, cells: ["C18", "C19"], method: "sum" });
    const y98 = t.get(2098)!.get(null)!;
    // 1000 - (400 + 200 + 150 + 50 + 100 + 40) = 60, of which 50 is the printed "Other" row.
    expect(y98.classes.get("other")).toMatchObject({ value: 60, method: "residual" });
    expect(t.get(2099)!.get("new_arrival")!.total.value).toBe(450);
  });

  it("fails when sub-classes do not add up to their class", () => {
    const bad = CLASS_SHEET.replace("8\tSpouses | 250 | 300", "8\tSpouses | 251 | 300");
    expect(() => readClassByYear(ctxOf(bad, table({ title: CLASS_TITLE })))).toThrow(/immediate_relatives sub-classes/);
  });

  it("fails when classes do not add up to the total", () => {
    const bad = CLASS_SHEET.replace("19\tOther | 50 | 60", "19\tOther | 50 | 61");
    expect(() => readClassByYear(ctxOf(bad, table({ title: CLASS_TITLE })))).toThrow(/FY2099 all classes/);
  });

  it("allows rounding slack only on a table marked rounded, and checks the marking", () => {
    const rounded = CLASS_SHEET.replace(/D \| 10/g, "10 | 10");
    // Off by 10 in 2099: within the rounding bound of a rounded table, a failure in an exact one.
    const off = rounded.replace("19\tOther | 50 | 60", "19\tOther | 50 | 70");
    expect(readClassByYear(ctxOf(off, table({ title: CLASS_TITLE, rounding: 10 }))).get(2099)!.get(null)!.classes.get("other")!.value).toBe(80);
    expect(() => readClassByYear(ctxOf(off, table({ title: CLASS_TITLE })))).toThrow(/FY2099 all classes/);
    const notRounded = rounded.replace("10\tParents | 50 | 50", "10\tParents | 55 | 50");
    expect(() => readClassByYear(ctxOf(notRounded, table({ title: CLASS_TITLE, rounding: 10 })))).toThrow(/not rounded to 10/);
  });

  it("fails when new arrivals and adjustments do not add up to the total", () => {
    const bad = CLASS_SHEET.replace("39\tOther | 10 | 40", "39\tOther | 10 | 41").replace("31\tTotal | 400 | 450", "31\tTotal | 400 | 451");
    expect(() => readClassByYear(ctxOf(bad, table({ title: CLASS_TITLE })))).toThrow(/new arrivals \+ adjustments/);
  });

  it("fails on a class of admission it does not know", () => {
    const bad = CLASS_SHEET.replace("19\tOther | 50 | 60", "19\tMystery visas | 50 | 60");
    expect(() => readClassByYear(ctxOf(bad, table({ title: CLASS_TITLE })))).toThrow(/unknown class of admission "Mystery visas"/);
  });

  it("fails when the title moved or the header years disagree with it", () => {
    expect(() => ctxOf(CLASS_SHEET, table({ title: CLASS_TITLE.replace("2098", "2097") }))).toThrow(/title .* not found/);
    const bad = CLASS_SHEET.replace("4\tType and class of admission | 2098 | 2099", "4\tType and class of admission | 2098 | 2100");
    expect(() => readClassByYear(ctxOf(bad, table({ title: CLASS_TITLE })))).toThrow(/header years/);
  });

  it("reads Table 1 pairs with footnoted years, and the naturalization table's Total column", () => {
    const t1 = `## sheet: Table 1
2\tPERSONS OBTAINING LAWFUL PERMANENT RESIDENT STATUS: FISCAL YEARS 2096 TO 2099
4\tYear | Number | Year | Number
5\t2096 | 10 | 2098 1 | 30
6\t2097 | 20 | 2099¹ | 40
`;
    const long = readLong(ctxOf(t1, table({ sheet: "Table 1", title: "PERSONS OBTAINING LAWFUL PERMANENT RESIDENT STATUS: FISCAL YEARS 2096 TO 2099", layout: "lpr_long" })));
    expect([...long].map(([fy, c]) => [fy, c.value, c.cell])).toEqual([
      [2096, 10, "B5"],
      [2098, 30, "D5"],
      [2097, 20, "B6"],
      [2099, 40, "D6"],
    ]);
    const nat = `## sheet: Table 20
4\tNATZ: FISCAL YEARS 2098 TO 2099
6\tYear | Petitions filed | Persons naturalized |  |  |  | Petitions denied
7\t |  | Total | Civilian | Military | Not reported
8\t2098 | 5 | 70 | 60 | 10 | 0 | 1
9\t2099 | 6 | 80 | 80 | NA | 0 | 2
`;
    const n = readLong(ctxOf(nat, table({ sheet: "Table 20", title: "NATZ: FISCAL YEARS 2098 TO 2099", layout: "naturalization_long", metric: "naturalizations" })));
    expect(n.get(2099)).toMatchObject({ value: 80, cell: "C9" });
  });

  it("reads a by-country table and checks regions and the COUNTRY total", () => {
    const title = "PERSONS OBTAINING LAWFUL PERMANENT RESIDENT STATUS BY REGION AND COUNTRY OF BIRTH: FISCAL YEARS 2099 TO 2099";
    const t3 = `## sheet: Table 3
2\t${title}
4\tRegion and country of birth | 2099
5\tREGION
6\tTotal | 100
7\tAfrica | 60
8\tAsia | 40
9\tCOUNTRY
10\tTotal | 100
11\tKenya | 55
12\tKosovo | X
13\tJapan | 40
14\tAll other countries1 | 4
15\tUnknown | 1
16\t1 Includes countries with fewer than 10.
`;
    const c = readCountryByYear(ctxOf(t3, table({ sheet: "Table 3", title, layout: "country_by_year", basis: "birth" })));
    expect(c.get(2099)!.rows.map((r) => r.name)).toEqual(["Kenya", "Kosovo", "Japan", "All other countries", "Unknown"]);
    const bad = t3.replace("8\tAsia | 40", "8\tAsia | 41");
    expect(() => readCountryByYear(ctxOf(bad, table({ sheet: "Table 3", title, layout: "country_by_year", basis: "birth" })))).toThrow(/regions/);
  });

  it("reads a quarterly class table and checks the quarters", () => {
    const title = "PERSONS OBTAINING LAWFUL PERMANENT RESIDENT STATUS BY TYPE AND MAJOR CLASS OF ADMISSION: FISCAL YEAR 2099";
    const row = (label: string, t: number[], a: number[], n: number[]) => `${label} | ${[...t, ...a, ...n].join(" | ")}`;
    const q = (all: number, adj: number, neu: number) => [
      [all, all, 0, 0, 0],
      [adj, adj, 0, 0, 0],
      [neu, neu, 0, 0, 0],
    ];
    const lines = [
      ["Total", 700, 400, 300],
      ["Immediate relatives of U.S. citizens", 300, 200, 100],
      ["Family-sponsored preferences", 100, 0, 100],
      ["Employment-based preferences", 100, 90, 10],
      ["Diversity", 50, 0, 50],
      ["Refugees", 80, 80, 0],
      ["Asylees", 30, 30, 0],
      ["Other", 40, 0, 40],
    ] as const;
    const text = `## sheet: Table 1B
2\t${title}
4\tType and class of admission | Total |  |  |  |  | Adjustments of status |  |  |  |  | New arrivals
5\t | Total | Quarter 1 | Quarter 2 | Quarter 3 | Quarter 4 | Total | Quarter 1 | Quarter 2 | Quarter 3 | Quarter 4 | Total | Quarter 1 | Quarter 2 | Quarter 3 | Quarter 4
${lines.map(([l, a, b, c], i) => `${6 + i}\t${row(l, ...(q(a, b, c) as [number[], number[], number[]]))}`).join("\n")}
`;
    const t = table({ sheet: "Table 1B", title, layout: "quarterly_class" });
    const ctx = locateTable(t, source({ edition: { kind: "quarterly", fy: 2099 } }), parseExtract(text));
    expect(readQuarterlyClass(ctx, 2099).get(2099)!.get("adjustment")!.total.value).toBe(400);
    const badQuarters = text.replace("Diversity | 50 | 50 | 0", "Diversity | 50 | 49 | 0");
    expect(() => readQuarterlyClass(locateTable(t, source({ edition: { kind: "quarterly", fy: 2099 } }), parseExtract(badQuarters)), 2099)).toThrow(/quarters/);
  });
});

describe("workbook readers on the real snapshots", () => {
  it("reads an Excel 97 .xls (BIFF8) from the FY2008 Yearbook zip, cell for cell", () => {
    const s = (lprCatalog.parse(JSON.parse(readFileSync("pipeline/reference/lpr-catalog.json", "utf8"))) as LprCatalog).sources.find((x) => x.id === "ohss-yearbook-2008-lpr")!;
    const sheets = parseExtract(extractText(s, `pipeline/raw/ohss/${s.file}`));
    const t6 = sheets.find((x) => x.name === "Table 06D.xls!Table 6")!;
    const total = t6.rows.find((r) => r.cells[0] === "Total")!;
    expect(total.row).toBe(6);
    expect(total.cells.slice(1, 3)).toEqual(["644787", "841002"]);
    expect(t6.rows.find((r) => r.cells[0] === "Parolees")!.cells[1]).toBe("D");
  });

  it("reads an .xlsx with the row numbers Excel shows", () => {
    const sheets = readXlsx("pipeline/raw/ohss/ohss-yearbook-2024-lpr.xlsx");
    const t3 = sheets.find((x) => x.name === "Table 3")!;
    const mexico = t3.rows.find((r) => r.cells[0] === "Mexico")!;
    expect(mexico.row).toBe(138);
    expect(mexico.cells[10]).toBe("202600");
  });

  it("rejects a file that is not a compound document", () => {
    expect(() => readXls(Buffer.from("not a workbook at all, just text padding".repeat(20)))).toThrow(/not an OLE compound file/);
  });
});

describe("OHSS country names", () => {
  const countries = indexCountries(
    (JSON.parse(readFileSync("pipeline/output/countries.json", "utf8")) as { country_code: string; name: string; kind: string }[]).filter((c) => c.kind === "country" || c.kind === "former"),
  );
  const key = (n: string) => resolveCountry(n, countries, LPR_NAME_TABLES).country_key;

  it("maps Yearbook and quarterly spellings, former states and territories", () => {
    expect(key("China, People's Republic")).toBe("CHN");
    expect(key("Korea, South")).toBe("KOR");
    expect(key("Korea")).toBe("KOR");
    expect(key("Soviet Union (former)")).toBe("SUN");
    expect(key("Serbia and Montenegro (former)")).toBe("SCG");
    expect(key("U.S. Virgin Islands")).toBe("VIR");
    expect(key("United States")).toBe("USA");
  });
});

// ---- the real catalog and snapshots ----

const RAW = "pipeline/raw/ohss";
const realCatalog = (): LprCatalog => lprCatalog.parse(JSON.parse(readFileSync("pipeline/reference/lpr-catalog.json", "utf8")));
const realInput = (catalog = realCatalog()): LprBuildInput => ({
  catalog,
  texts: new Map(catalog.sources.map((s) => [s.id, readFileSync(`${RAW}/${s.text_file}`, "utf8")])),
  administrations: [...HISTORICAL_ADMINISTRATIONS, ...ADMINISTRATIONS.filter((a) => !HISTORICAL_ADMINISTRATIONS.some((h) => h.term_id === a.term_id))],
  countries: indexCountries(
    (JSON.parse(readFileSync("pipeline/output/countries.json", "utf8")) as { country_code: string; name: string; kind: string }[]).filter((c) => c.kind === "country" || c.kind === "former"),
  ),
  refugeeAdmissions: new Map(
    (JSON.parse(readFileSync("pipeline/output/refugee_series.json", "utf8")) as { period: number; admissions: number | null }[]).flatMap((r) => (r.admissions === null ? [] : [[r.period, r.admissions] as const])),
  ),
});

describe("buildLpr over the real files", () => {
  const built = buildLpr(realInput());
  const row = (fy: number, metric: "lpr" | "naturalizations", type: "new_arrival" | "adjustment" | null = null, cls: string | null = null) =>
    built.series.find((r) => r.period === fy && r.metric === metric && r.admission_type === type && r.class === cls);

  it("covers FY1977–FY2025, with classes and countries from FY1999 and only FY2025 preliminary", () => {
    expect(row(1977, "lpr")?.value).toBe(458760);
    expect(row(1998, "lpr", null, "other")).toBeUndefined();
    expect(row(1999, "lpr", null, "diversity")?.value).toBe(47535);
    expect(row(2025, "lpr")).toMatchObject({ value: 1320080, status: "preliminary", table: "q2025-lpr-class" });
    expect(new Set(built.series.filter((r) => r.status === "preliminary").map((r) => r.period))).toEqual(new Set([2025]));
  });

  it("takes each year from the newest edition that covers it", () => {
    expect(row(2007, "lpr")?.table).toBe("yb2008-lpr-class");
    expect(row(2008, "lpr")?.table).toBe("yb2017-lpr-class");
    expect(row(2013, "lpr")?.table).toBe("yb2022-lpr-class");
    expect(row(2015, "lpr")?.table).toBe("yb2024-lpr-class");
    expect(row(2008, "naturalizations")?.table).toBe("yb2024-naturalizations-total");
    // FY2008's special immigrants as the newer edition counts them.
    expect(row(2008, "lpr", null, "employment_preference")?.value).toBe(164741);
  });

  it("records the sheet and cell of every value", () => {
    expect(row(2024, "lpr")).toMatchObject({ sheet: "Table 6", cells: ["K8"], rounding: 10 });
    expect(row(1999, "lpr", null, "other")?.method).toBe("residual");
    const mexico = built.byCountry.find((r) => r.fy === 2024 && r.metric === "lpr" && r.country_key === "MEX")!;
    expect(mexico).toMatchObject({ value: 202600, sheet: "Table 3", cells: ["K138"], basis: "birth" });
  });

  it("keeps FY2025's countries by nationality and every Yearbook year by birth", () => {
    const bases = new Set(built.byCountry.filter((r) => r.fy === 2025).map((r) => r.basis));
    expect(bases).toEqual(new Set(["nationality"]));
    expect(built.byCountry.filter((r) => r.fy < 2025).every((r) => r.basis === "birth")).toBe(true);
  });

  it("keeps a withheld remainder so each older year adds up", () => {
    const y = built.byCountry.filter((r) => r.fy === 2000 && r.metric === "lpr");
    expect(y.reduce((s, r) => s + r.value, 0)).toBe(row(2000, "lpr")!.value);
    expect(y.find((r) => r.kind === "withheld")?.value).toBe(4);
  });

  it("uses the FY2017 quarterly table only for its total (documented defect)", () => {
    const q = built.report.vintages.quarterly_vs_yearbook;
    expect(q.totals.some((t) => t.fy === 2017)).toBe(false);
    expect(built.series.some((r) => r.table === "q2017-lpr-class")).toBe(false);
  });

  it("reports quarterly revisions and the refugee cross-check", () => {
    const fy2024 = built.report.vintages.quarterly_vs_yearbook.totals.find((t) => t.metric === "lpr" && t.fy === 2024);
    expect(fy2024).toMatchObject({ quarterly: 1356760, yearbook: 1364090 });
    expect(built.report.refugee_arrivals_vs_state_department.find((r) => r.fy === 2020)?.diff).toBe(0);
  });
});

describe("gates", () => {
  it("fails on an unrecorded restatement between Yearbook editions", () => {
    const catalog = realCatalog();
    catalog.restatements = catalog.restatements.filter((r) => r.id !== "fy2008-special-immigrants");
    expect(() => buildLpr(realInput(catalog))).toThrow(/yb2008-lpr-class vs yb2017-lpr-class: 6 values, FY2008/);
  });

  it("fails on a recorded restatement that no longer occurs", () => {
    const catalog = realCatalog();
    catalog.restatements.push({ ...catalog.restatements[0], id: "stale", fy_start: 2001, fy_end: 2001 });
    expect(() => buildLpr(realInput(catalog))).toThrow(/cover no difference: stale/);
  });

  it("fails on a note quote that is not in its source", () => {
    const catalog = realCatalog();
    catalog.notes[0] = { ...catalog.notes[0], quote: "a sentence OHSS never wrote" };
    expect(() => buildLpr(realInput(catalog))).toThrow(/quote not found/);
  });

  it("fails on a country name with no key", () => {
    const input = realInput();
    const texts = new Map(input.texts);
    texts.set("ohss-yearbook-2024-lpr", texts.get("ohss-yearbook-2024-lpr")!.replace("Mexico |", "Atlantis |"));
    expect(() => buildLpr({ ...input, texts })).toThrow(/no country_key .*Atlantis/);
  });

  it("fails when a quarterly total is far from the Yearbook (a misread table)", () => {
    // Add 82,000 Q1 naturalizations to Mexico, North America and both totals: internally consistent, 10% off the Yearbook.
    const input = realInput();
    const texts = new Map(input.texts);
    const q = texts.get("ohss-quarterly-fy2024")!;
    const [head, rest] = q.split("## sheet: Table 3");
    const bump = (line: string) => {
      const [n, body] = line.split("\t");
      const cells = body.split(" | ");
      cells[1] = String(Number(cells[1]) + 82000);
      cells[2] = String(Number(cells[2]) + 82000);
      return `${n}\t${cells.join(" | ")}`;
    };
    const t3 = rest.split("\n").map((l) => (/^\d+\t(Total|North America|Mexico) \|/.test(l) ? bump(l) : l)).join("\n");
    texts.set("ohss-quarterly-fy2024", `${head}## sheet: Table 3${t3}`);
    expect(() => buildLpr({ ...input, texts })).toThrow(/naturalizations FY2024: quarterly q2024-naturalizations-nationality 900150/);
  });

  it("fails when a source's table is missing from its extract", () => {
    const input = realInput();
    const texts = new Map(input.texts);
    texts.set("ohss-yearbook-2022-lpr", texts.get("ohss-yearbook-2022-lpr")!.replace("## sheet: Table 6", "## sheet: Table 6 (renamed)"));
    expect(() => buildLpr({ ...input, texts })).toThrow(/sheet "Table 6" not in/);
  });
});

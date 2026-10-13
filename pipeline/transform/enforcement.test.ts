import { describe, expect, it } from "vitest";
import { expectedFinalFiscalYear, iceCatalog, iceValue, isNationalRemovals, latestFinalFiscalYear, type IceCatalog } from "../../lib/enforcement-entities";
import { ADMINISTRATIONS } from "./administrations";
import {
  ANCHORS,
  EnforcementDataError,
  attributeFiscalYear,
  buildEnforcement,
  containsNumber,
  fiscalYearBounds,
  normalizeText,
  tableValue,
} from "./enforcement";

const days = (fy: number) => attributeFiscalYear(fy, ADMINISTRATIONS);
const share = (fy: number) => Object.fromEntries(days(fy).administration_days.map((d) => [d.term_id, d.days]));

const OBAMA = "2009-01-20";
const BUSH = "2001-01-20";
const TRUMP1 = "2017-01-20";
const BIDEN = "2021-01-20";
const TRUMP2 = "2025-01-20";

describe("fiscalYearBounds", () => {
  it("runs Oct 1 of the prior calendar year to Sep 30", () => {
    expect(fiscalYearBounds(2013)).toEqual({ start: "2012-10-01", end: "2013-09-30" });
  });
});

describe("attributeFiscalYear", () => {
  it("attributes a normal year wholly to the sitting administration", () => {
    expect(days(2013)).toEqual({ administration_term_id: OBAMA, blended: false, administration_days: [{ term_id: OBAMA, days: 365 }] });
    expect(days(2012).administration_days).toEqual([{ term_id: OBAMA, days: 366 }]); // leap year
    expect(days(2005).administration_term_id).toBe(BUSH);
  });

  // Jan 20 belongs to the incoming administration: 111 days (Oct 1–Jan 19) before, 254 after.
  it.each([
    [2009, BUSH, OBAMA],
    [2017, OBAMA, TRUMP1],
    [2021, TRUMP1, BIDEN],
    [2025, BIDEN, TRUMP2],
  ])("FY%i is blended and attributed to the incoming administration", (fy, outgoing, incoming) => {
    const a = days(fy);
    expect(a.blended).toBe(true);
    expect(a.administration_term_id).toBe(incoming);
    expect(share(fy)).toEqual({ [outgoing]: 111, [incoming]: 254 });
  });

  it("treats Trump's two terms as separate tenures", () => {
    expect(days(2020).administration_term_id).toBe(TRUMP1);
    expect(days(2026).administration_term_id).toBe(TRUMP2);
  });

  it("fails loudly outside every tenure", () => {
    expect(() => days(1990)).toThrow(EnforcementDataError);
  });
});

describe("tableValue", () => {
  const t = "FY2003 | FY2004 | FY2005\nTotal | 10 | 20 | 30\nAtlanta | 1 | 2 | 3";
  it("indexes the row by the header column", () => {
    expect(tableValue(t, "Total", 2003)).toBe(10);
    expect(tableValue(t, "Total", 2005)).toBe(30);
    expect(tableValue(t, "Total", 2099)).toBeNull();
  });
});

describe("normalizeText", () => {
  it("collapses whitespace and typographic punctuation", () => {
    expect(normalizeText("ICE’s  “x”\n 1–2")).toBe("ICE's \"x\" 1-2");
  });
});

// A tiny catalog over two sources: an xlsx-style table and a prose document.
const base = (): IceCatalog =>
  iceCatalog.parse({
    retrieved_at: "2026-09-30",
    sources: [
      { id: "tbl", title: "Table", publisher: "ICE", url: "https://example.gov/t.xlsx", file: "t.xlsx", text_file: "t.txt", kind: "xlsx" },
      { id: "doc", title: "Doc", publisher: "ICE", url: "https://example.gov/d.pdf", file: "d.pdf", text_file: "d.txt", kind: "pdf" },
    ],
    years: [
      { fy: 2013, value: 368644, status: "final", source: "tbl", evidence_kind: "text", evidence: "Total | 368644 | 315943", corroboration: [{ source: "doc", evidence: "ICE conducted a total of 368,644 removals." }], note_ids: ["n"] },
      { fy: 2014, value: 315943, status: "final", source: "tbl", evidence_kind: "text", evidence: "Total | 368644 | 315943" },
      { fy: 2023, value: 142580, status: "final", source: "doc", evidence_kind: "text", evidence: "ERO conducted 142,580 removals" },
    ],
    values: [
      { fy: 2013, metric: "removals", arresting_agency: "ice", value: 133551, status: "final", source: "doc", evidence_kind: "text", evidence: "133,551 interior" },
      { fy: 2013, metric: "removals", arresting_agency: "cbp", value: 235093, status: "final", source: "doc", evidence_kind: "text", evidence: "235,093 border" },
      { fy: 2013, metric: "removals", criminality: "convicted", value: 216810, status: "final", source: "doc", evidence_kind: "text", evidence: "216,810 convicted" },
      { fy: 2013, metric: "removals", criminality: "not_convicted", value: 151834, status: "final", source: "doc", evidence_kind: "text", evidence: "151,834 not convicted" },
      // Bar labels: in the text, but their year and segment come from the rendered page.
      { fy: 2014, metric: "removals", arresting_agency: "ice", value: 102224, status: "final", source: "doc", evidence_kind: "chart_label", evidence: "102,224 213,719", chart: { page: 1, figure: "Figure 6", read: "FY2014 bar, lower segment" } },
      { fy: 2014, metric: "removals", arresting_agency: "cbp", value: 213719, status: "final", source: "doc", evidence_kind: "chart_label", evidence: "102,224 213,719", chart: { page: 1, figure: "Figure 6", read: "FY2014 bar, upper segment" } },
      { fy: 2023, metric: "detention_adp", value: 28289, status: "final", source: "doc", evidence_kind: "text", evidence: "a daily average of 28,289" },
      { fy: 2023, metric: "detention_adp", arresting_agency: "ice", value: 9377, status: "final", source: "doc", evidence_kind: "text", evidence: "ICE 9,377" },
      { fy: 2023, metric: "detention_adp", arresting_agency: "cbp", value: 18912, status: "final", source: "doc", evidence_kind: "text", evidence: "CBP 18,912" },
    ],
    sum_checks: [],
    sum_exceptions: [],
    disagreements: [],
    notes: [
      { id: "n", kind: "caveat", fy_start: 2013, fy_end: null, title: "t", text: "t", source: "doc" },
      { id: "combined", kind: "caveat", fy_start: 2014, fy_end: 2014, title: "combined only", text: "t", source: "doc" },
    ],
  });
const texts = () =>
  new Map([
    ["tbl", "FY2013 | FY2014\nTotal | 368644 | 315943\n"],
    [
      "doc",
      "ICE conducted a total of\n368,644 removals. ERO conducted 142,580 removals. 133,551 interior; 235,093 border; 216,810 convicted, 151,834 not convicted; 12,000 pending. " +
        "Figure 6\n   102,224     213,719\n a daily average of 28,289; ICE 9,377 CBP 18,912. In FY 2014, ICE conducted 213,179 removals of recent border crossers. 160,000 with convictions or charges.",
    ],
  ]);
const build = (catalog = base(), t = texts(), figureFiles: ReadonlySet<string> = new Set()) =>
  buildEnforcement({ catalog, texts: t, figureFiles, administrations: ADMINISTRATIONS });

describe("buildEnforcement", () => {
  it("builds rows, attributes them, and reports the anchors", () => {
    const { series, report } = build();
    expect(series.filter(isNationalRemovals).map((r) => [r.period, r.value, r.scope, r.metric])).toEqual([
      [2013, 368644, "ice", "removals"],
      [2014, 315943, "ice", "removals"],
      [2023, 142580, "ice", "removals"],
    ]);
    expect(series.slice(0, 3).every(isNationalRemovals)).toBe(true);
    expect(series[0].administration_term_id).toBe(OBAMA);
    expect(report.missing_periods).toEqual([2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022]);
    expect(report.anchors.every((a) => a.ok)).toBe(true);
    expect(ANCHORS[2013]).toBe(368644);
  });

  it("does not interpolate: gaps stay gaps", () => {
    expect(build().series.map((r) => r.period)).not.toContain(2016);
  });

  it("fails when quoted evidence is not in the source", () => {
    const t = texts();
    t.set("doc", "something else entirely");
    expect(() => build(base(), t)).toThrow(/FY2013.*not found in doc/);
  });

  it("fails when the table disagrees with the catalog value", () => {
    const c = base();
    c.years[1].value = 315944;
    expect(() => build(c)).toThrow(/FY2014/);
  });

  it("fails when an anchor year differs from ICE's published figure", () => {
    const c = base();
    c.years[2].value = 142581;
    c.years[2].evidence = "ERO conducted 142,580 removals";
    expect(() => build(c)).toThrow(/FY2023/);
  });

  it("fails when interior + border does not equal the total", () => {
    const c = base();
    c.values[1].value = 235000;
    c.values[1].evidence = "235,000 border";
    const t = texts();
    t.set("doc", t.get("doc") + " 235,000 border");
    expect(() => build(c, t)).toThrow(/FY2013 removals by arresting_agency: parts sum to 368,551, the total is 368,644/);
  });

  it("requires the in-progress fiscal year to be preliminary", () => {
    const c = base();
    c.retrieved_at = "2023-06-01";
    expect(() => build(c)).toThrow(/in progress/);
  });

  it("fails when a criminality split misses the national total", () => {
    const c = base();
    c.values[3].value = 12000;
    c.values[3].evidence = "12,000 pending";
    expect(() => build(c)).toThrow(/FY2013 removals by criminality: parts sum to/);
  });

  it("rejects unknown note ids and duplicate periods", () => {
    const c = base();
    c.years[0].note_ids = ["nope"];
    expect(() => build(c)).toThrow(/unknown note id/);
    const d = base();
    d.years.push({ ...d.years[1] });
    expect(() => build(d)).toThrow(/duplicate/);
  });
});

describe("ICE annual-report freshness", () => {
  it("expects a fiscal year to be final only after the grace period", () => {
    expect(expectedFinalFiscalYear("2026-10-01")).toBe(2025);
    expect(expectedFinalFiscalYear("2026-11-29")).toBe(2025);
    expect(expectedFinalFiscalYear("2026-11-30")).toBe(2026);
    expect(expectedFinalFiscalYear("2027-06-15")).toBe(2026);
  });
  it("ignores preliminary years", () => {
    expect(latestFinalFiscalYear([{ fy: 2024, status: "final" }, { fy: 2025, status: "preliminary" }])).toBe(2024);
    expect(latestFinalFiscalYear([])).toBeNull();
  });
});

describe("containsNumber", () => {
  it("matches the number as a whole token, comma after it or not", () => {
    expect(containsNumber("increased from 65,332, or 27 percent", 65332)).toBe(true);
    expect(containsNumber("FY2016 65332", 65332)).toBe(true);
    expect(containsNumber("165,332 removals", 65332)).toBe(false);
    expect(containsNumber("65,332,000 dollars", 65332)).toBe(false);
    expect(containsNumber("1,65,332", 65332)).toBe(false);
  });
});

describe("breakdowns", () => {
  const findRow = (b: ReturnType<typeof build>, fy: number, agency: string | null, crim: string | null, metric = "removals") =>
    b.series.find((r) => r.period === fy && r.metric === metric && r.arresting_agency === agency && r.criminality === crim);

  it("adds agency and criminality rows that carry the year's attribution", () => {
    const b = build();
    expect(findRow(b, 2013, "ice", null)?.value).toBe(133551);
    expect(findRow(b, 2013, null, "not_convicted")?.administration_term_id).toBe(OBAMA);
    expect(b.report.breakdowns.rows).toBe(9);
    expect(b.report.breakdowns.partitions.map((p) => [p.period, p.metric, p.dimension, p.scheme, p.parts_sum, p.total])).toEqual([
      [2013, "removals", "arresting_agency", "agency", 368644, 368644],
      [2013, "removals", "criminality", "two_way", 368644, 368644],
      [2014, "removals", "arresting_agency", "agency", 315943, 315943],
      [2023, "detention_adp", "arresting_agency", "agency", 28289, 28289],
    ]);
  });

  it("reports coverage per series, with gaps left as gaps", () => {
    const c = base();
    c.values.push({ ...c.values[6], fy: 2014, evidence: "a daily average of 28,289", value: 28289 }); // ADP for 2014 too: no 2015–2022
    const cov = build(c).report.breakdowns.coverage.find((x) => x.metric === "detention_adp" && x.arresting_agency === null)!;
    expect(cov.periods).toEqual([2014, 2023]);
    expect(cov.missing_periods).toEqual([2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022]);
  });

  it("never mixes the two criminality schemes in a year", () => {
    const c = base();
    c.values.push({ fy: 2013, metric: "removals", arresting_agency: null, criminality: "pending_charges", value: 12000, status: "final", source: "doc", evidence_kind: "text", evidence: "12,000 pending", corroboration: [], note_ids: [] });
    expect(() => build(c)).toThrow(/not one scheme/);
  });

  it("needs both agencies for an agency split", () => {
    const c = base();
    c.values.splice(5, 1); // drop FY2014 cbp
    expect(() => build(c)).toThrow(/FY2014 removals: the agency breakdown has \[ice\]/);
  });

  it("allows a partial (combined) criminality figure only with a caveat note", () => {
    const partial = { fy: 2014, metric: "removals" as const, arresting_agency: null, criminality: "convicted_or_pending" as const, value: 160000, status: "final" as const, source: "doc", evidence_kind: "text" as const, evidence: "160,000 with convictions", corroboration: [], note_ids: [] as string[] };
    const c = base();
    c.values.push(partial);
    expect(() => build(c)).toThrow(/needs a caveat note/);
    const d = base();
    d.values.push({ ...partial, note_ids: ["combined"] });
    expect(build(d).report.breakdowns.partitions.find((p) => p.period === 2014 && p.scheme === "partial")?.parts_sum).toBe(160000);
  });

  it("keeps national removals out of `values` and statuses in step with the national year", () => {
    const c = base();
    c.values.push({ ...c.values[0], arresting_agency: null });
    expect(() => build(c)).toThrow(/belong in `years`/);
    const d = base();
    d.values[6].status = "preliminary";
    expect(() => build(d)).toThrow(/FY2023 detention_adp.*status "preliminary" but the year is "final"/);
  });

  it("checks a documented sum exception and fails a stale one", () => {
    const c = base();
    c.values[7].value = 9376;
    c.values[7].evidence = "9,376";
    const t = texts();
    t.set("doc", t.get("doc") + " 9,376");
    expect(() => build(c, t)).toThrow(/parts sum to 28,288, the total is 28,289/);
    c.sum_exceptions.push({ fy: 2023, metric: "detention_adp", dimension: "arresting_agency", slice: null, parts_sum: 28288, total: 28289, reason: "rounding" });
    expect(build(c, t).report.breakdowns.partitions.find((p) => p.metric === "detention_adp")?.exception).toBe("rounding");
    c.sum_exceptions[0].parts_sum = 28287;
    expect(() => build(c, t)).toThrow(/stale/);
    const d = base();
    d.sum_exceptions.push({ fy: 2013, metric: "detention_adp", dimension: "arresting_agency", slice: null, parts_sum: 1, total: 2, reason: "r" });
    expect(() => build(d)).toThrow(/matches no breakdown/);
  });

  it("checks printed subtotals against the rows", () => {
    const c = base();
    c.sum_checks.push({ fy: 2023, metric: "detention_adp", arresting_agency: null, criminality: ["convicted", "pending_charges"], value: 28289, source: "doc", evidence: "a daily average of 28,289" });
    expect(() => build(c)).toThrow(/no convicted row/);
    const d = base();
    d.sum_checks.push({ fy: 2013, metric: "removals", arresting_agency: null, criminality: ["convicted", "not_convicted"], value: 368644, source: "doc", evidence: "368,644 removals" });
    expect(build(d).report.breakdowns.sum_checks).toHaveLength(1);
    d.sum_checks[0].value = 216810;
    d.sum_checks[0].evidence = "216,810 convicted";
    expect(() => build(d)).toThrow(/rows sum to 368,644, ICE prints 216,810/);
  });

  it("records a disagreement only when the printed number is really there and really differs", () => {
    const dis = { fy: 2014, metric: "removals" as const, arresting_agency: "cbp" as const, criminality: null, source: "doc", printed: 213179, evidence: "In FY 2014, ICE conducted 213,179 removals of recent border crossers.", used: 213719, resolution: "typo" };
    const c = base();
    c.disagreements.push(dis);
    expect(build(c).report.breakdowns.disagreements).toEqual([{ period: 2014, metric: "removals", arresting_agency: "cbp", criminality: null, source: "doc", printed: 213179, used: 213719, resolution: "typo" }]);
    c.disagreements[0].used = 213000;
    expect(() => build(c)).toThrow(/says 213,000 is used, the row is 213,719/);
  });

  it("needs a figure snapshot for an image-only chart value", () => {
    const fig = { fy: 2023, metric: "removals" as const, arresting_agency: "ice" as const, criminality: null, value: 44255, status: "final" as const, source: "doc", evidence_kind: "figure" as const, evidence: "Figure 6", chart: { page: 1, figure: "Figure 6", read: "FY2023 bar" }, figure_file: "doc-p01.png", corroboration: [], note_ids: [] };
    const c = base();
    c.values.push(fig, { ...fig, arresting_agency: "cbp", value: 98325 });
    expect(() => build(c)).toThrow(/figure snapshot "doc-p01.png" is missing/);
    expect(build(c, texts(), new Set(["doc-p01.png"])).report.breakdowns.figure_files).toEqual(["doc-p01.png"]);
    expect(() => iceValue.parse({ ...fig, figure_file: undefined })).toThrow(/figure_file/);
    expect(() => iceValue.parse({ ...fig, evidence_kind: "chart_label", chart: undefined, figure_file: undefined })).toThrow(/need `chart`/);
  });
});

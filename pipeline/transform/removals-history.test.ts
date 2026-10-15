import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { enforcementRow, isNationalRemovals } from "../../lib/enforcement-entities";
import { removalsHistoryCatalog, removalsHistoryReport, removalsHistoryRow } from "../../lib/removals-history-entities";
import { HISTORICAL_ADMINISTRATIONS } from "../../lib/troops-presidents";
import { ADMINISTRATIONS } from "./administrations";
import { buildRemovalsHistory, cellNumber, parseTable39, RemovalsHistoryError, removalsByYear } from "./removals-history";

const json = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const catalog = removalsHistoryCatalog.parse(json("pipeline/reference/removals-history-catalog.json"));
const primary = catalog.sources.find((s) => s.role === "primary")!;
const comparison = catalog.sources.find((s) => s.role === "comparison")!;
const text = (file: string) => readFileSync(`pipeline/raw/ohss-removals/${file}`, "utf8");
const ice = new Map((json("pipeline/output/enforcement_series.json") as unknown[]).map((r) => enforcementRow.parse(r)).filter(isNationalRemovals).map((r) => [r.period, r.value] as const));
const admins = [...HISTORICAL_ADMINISTRATIONS, ...ADMINISTRATIONS.filter((a) => !HISTORICAL_ADMINISTRATIONS.some((h) => h.term_id === a.term_id))];
const build = (p = text(primary.text_file)) => buildRemovalsHistory({ primary: { source: primary, text: p }, comparison: { source: comparison, text: text(comparison.text_file) }, ice, administrations: admins });

describe("Table 39 parsing", () => {
  it("reads printed counts and treats NA / X as no number", () => {
    expect(cellNumber("18,010")).toBe(18010);
    expect(cellNumber("950")).toBe(950);
    expect(cellNumber("NA")).toBeNull();
    expect(cellNumber("X")).toBeNull();
  });
  it("finds the Removals column by header, whatever its position (2022 leads with it, 2023 does not)", () => {
    const a = removalsByYear(parseTable39(text(primary.text_file)));
    const b = removalsByYear(parseTable39(text(comparison.text_file)));
    expect(a.get(2002)).toBe(165170);
    expect(b.get(2002)).toBe(165168); // the 2022 edition prints exact counts, the 2023 edition rounds to tens
    expect(a.get(1892)).toBe(2800);
  });
});

describe("INS-era removals series (real files)", () => {
  const { rows, report } = build();
  it("is FY1980 to FY2002, contiguous, from the 2023 edition's Removals column", () => {
    expect(rows.map((r) => r.period)).toEqual(Array.from({ length: 23 }, (_, i) => 1980 + i));
    expect(rows[0]).toMatchObject({ period: 1980, removals: 18010, edition: 2023 });
    expect(rows.find((r) => r.period === 1996)!.removals).toBe(69680);
    expect(rows.find((r) => r.period === 2002)!.removals).toBe(165170);
    expect(rows.every((r) => r.removals % 10 === 0 && r.status === "final")).toBe(true);
  });
  it("never uses returns: FY1986's 1.6 million returns are not in the figure", () => {
    expect(rows.find((r) => r.period === 1986)!.removals).toBe(24590);
  });
  it("attributes years to presidents, splitting a year when the administration changed in it", () => {
    const by = (fy: number) => rows.find((r) => r.period === fy)!;
    expect(by(1980).administration_term_id).toBe("1977-01-20"); // Carter
    expect(by(1981)).toMatchObject({ administration_term_id: "1981-01-20", blended: true });
    expect(by(1990).administration_term_id).toBe("1989-01-20"); // Bush
    expect(by(2002).administration_term_id).toBe("2001-01-20");
  });
  it("sets DHS against ICE for every year both exist, and ICE's FY2003 is 157,080", () => {
    expect(report.ice_comparison.map((c) => c.period)).toEqual(Array.from({ length: 21 }, (_, i) => 2003 + i));
    expect(report.ice_comparison[0]).toEqual({ period: 2003, dhs: 211100, ice: 157080, difference: 54020 });
    expect(report.ice_comparison.every((c) => c.difference === c.dhs - c.ice)).toBe(true);
  });
  it("round-trips through the output schemas and matches the committed files", () => {
    rows.forEach((r) => removalsHistoryRow.parse(r));
    const committed = (json("pipeline/output/removals_history_series.json") as unknown[]).map((r) => removalsHistoryRow.parse(r));
    expect(committed).toEqual(rows);
    const rep = removalsHistoryReport.parse(json("pipeline/output/removals_history_report.json"));
    expect(rep).toMatchObject({ edition: 2023, first_period: 1980, last_period: 2002, rows: 23 });
  });
});

describe("source drift fails loudly", () => {
  const src = text(primary.text_file);
  it("a missing year, a changed column, or a changed note stops the build", () => {
    expect(() => build(src.replace(/^1991 \|.*\n/m, ""))).toThrow(RemovalsHistoryError);
    expect(() => build(src.replace("| Removals |", "| Deportations |"))).toThrow(/unexpected columns/);
    expect(() => build(src.replace("rounded to the nearest ten", "rounded"))).toThrow(/nearest ten/);
  });
  it("a Removals cell that is not a number stops the build", () => {
    expect(() => build(src.replace(/^1985 \| NA \| 1,041,300 \| 23,110/m, "1985 | NA | 1,041,300 | NA"))).toThrow(/FY1985/);
  });
  it("a Removals value shifted into the wrong column fails the total check", () => {
    expect(() => build(src.replace(/^1990 \| NA \| 1,022,530 \| 30,040/m, "1990 | NA | 1,022,530 | 40,040"))).toThrow(/sum of its parts/);
  });
});

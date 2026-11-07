import { describe, expect, it } from "vitest";
import { congressTakeaway, fmtAxis, fmtValue, longLabel, panelTakeaway, tenureText } from "./president-format";
import type { SeriesPanel, SeriesPoint } from "./president-types";

const pt = (label: string, value: number, x = 0): SeriesPoint => ({ label, value, x });
const panel = (format: SeriesPanel["format"], ...segments: SeriesPoint[][]): Pick<SeriesPanel, "title" | "format" | "segments"> => ({
  title: "Unemployment rate, monthly",
  format,
  segments: segments.map((points, i) => ({ termId: String(i), x0: 0, x1: 1, points })),
});

describe("formats", () => {
  it("prints each format", () => {
    expect(fmtValue(7.8, "pct")).toBe("7.8%");
    expect(fmtValue(10, "pct")).toBe("10%");
    expect(fmtValue(-3.14, "pctSigned")).toBe("−3.1%");
    expect(fmtValue(1.2, "pctSigned")).toBe("+1.2%");
    expect(fmtValue(1_130_818, "count")).toBe("1.1M");
    expect(fmtValue(74_654, "count")).toBe("74.7K");
    expect(fmtValue(9_876, "count")).toBe("9,876");
    expect(fmtValue(-46.71, "usdB")).toBe("−$46.7B");
    expect(fmtValue(702.8, "mbbl")).toBe("703M bbl");
    expect(fmtValue(7.7, "num")).toBe("7.7");
  });

  it("keeps axis labels short", () => {
    expect(fmtAxis(1_200_000, "count")).toBe("1.2M");
    expect(fmtAxis(800_000, "count")).toBe("800k");
    expect(fmtAxis(-10, "pctSigned")).toBe("−10%");
  });

  it("spells out month labels for prose only", () => {
    expect(longLabel("Jan 2009")).toBe("January 2009");
    expect(longLabel("FY2010")).toBe("FY2010");
  });
});

describe("panelTakeaway", () => {
  it("names the first and last reading and an inner high", () => {
    const p = panel("pct", [pt("Jan 2009", 7.8), pt("Oct 2009", 10), pt("Jan 2017", 4.7)]);
    expect(panelTakeaway(p, "The unemployment rate")).toBe("The unemployment rate was 7.8% in January 2009 and 4.7% in January 2017, with a high of 10% in October 2009.");
  });

  it("names an inner low when the high is an end", () => {
    const p = panel("count", [pt("FY2009", 1_130_818), pt("FY2013", 990_553), pt("FY2016", 1_183_505)]);
    expect(panelTakeaway(p, "New green cards", "numbered")).toBe("New green cards numbered 1.1M in FY2009 and 1.2M in FY2016, with a low of 990.6K in FY2013.");
  });

  it("joins two terms and says 'on' for a dated week", () => {
    const p = panel("mbbl", [pt("Jan 14, 2017", 695.1), pt("Jan 16, 2021", 638.1)], [pt("Jan 18, 2025", 394.8)]);
    expect(panelTakeaway(p, "The reserve", "held")).toBe("The reserve held 695M bbl on Jan 14, 2017 and 638M bbl on Jan 16, 2021; then 395M bbl on Jan 18, 2025.");
  });

  it("defaults the subject to the panel title before its comma", () => {
    expect(panelTakeaway(panel("pct", [pt("Jan 2009", 7.8)]))).toBe("Unemployment rate was 7.8% in January 2009.");
  });
});

describe("congressTakeaway", () => {
  it("lists the arrangements that occurred", () => {
    expect(congressTakeaway({ rows: [], days: { both: 730, one: 1461, neither: 731 } }, "D")).toBe("Democrats held both chambers for 2 years, one chamber for 4 years and neither for 2 years.");
  });

  it("says so when one arrangement held throughout", () => {
    expect(congressTakeaway({ rows: [], days: { both: 0, one: 0, neither: 895 } }, "R")).toBe("Republicans held neither chamber of Congress during the time in office.");
    expect(congressTakeaway({ rows: [], days: { both: 1036, one: 0, neither: 0 } }, "D")).toBe("Democrats held both chambers of Congress throughout the time in office.");
  });
});

describe("tenureText", () => {
  it("prints years and months", () => {
    expect(tenureText(2922)).toBe("8 years");
    expect(tenureText(1036)).toBe("2 years, 10 months");
    expect(tenureText(20)).toBe("20 days");
  });
});

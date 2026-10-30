import { describe, expect, it } from "vitest";
import { applyEdits, numeralsOnly } from "./takeaway-refresh";

describe("numeralsOnly", () => {
  it("allows changed figures, years and decimals", () => {
    expect(numeralsOnly("eased to 116% in early 2023", "eased to 115% in early 2024")).toBe(true);
    expect(numeralsOnly("$5.01 a gallon", "$5.1 a gallon")).toBe(true);
    expect(numeralsOnly("7,790 jobs", "12,345,678 jobs")).toBe(true);
  });
  it("rejects any change to words, signs or punctuation", () => {
    expect(numeralsOnly("fell to 54%", "rose to 54%")).toBe(false);
    expect(numeralsOnly("(−7.4%)", "(+7.4%)")).toBe(false);
    expect(numeralsOnly("in 2023.", "in 2023")).toBe(false);
    expect(numeralsOnly("in March 2023", "in April 2023")).toBe(false);
    expect(numeralsOnly("up 3%", "up 3 and 4%")).toBe(false);
  });
  it("rejects a no-op", () => {
    expect(numeralsOnly("116%", "116%")).toBe(false);
  });
});

describe("applyEdits", () => {
  const files = { "a.ts": 'says "116% in 2023", "116%"', "b.ts": "x" };
  it("applies a numeric edit that matches once", () => {
    expect(applyEdits(files, [{ file: "a.ts", old: "116% in 2023", new: "115% in 2023" }])).toEqual({
      files: { ...files, "a.ts": 'says "115% in 2023", "116%"' },
    });
  });
  it("refuses an ambiguous match, an unknown file, a non-numeric change and an empty list", () => {
    expect("error" in applyEdits(files, [{ file: "a.ts", old: "116%", new: "115%" }])).toBe(true);
    expect("error" in applyEdits(files, [{ file: "c.ts", old: "x", new: "y" }])).toBe(true);
    expect("error" in applyEdits(files, [{ file: "a.ts", old: "116% in 2023", new: "116% by 2023" }])).toBe(true);
    expect("error" in applyEdits(files, [])).toBe(true);
  });
});

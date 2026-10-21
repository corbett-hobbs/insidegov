import { describe, expect, it } from "vitest";
import { codeParam, enumParam, flagParam, intParam, withParams, yearsParam } from "./url-state";

describe("url state params", () => {
  it("parses and clamps a year window; the full span is the default", () => {
    expect(yearsParam.parse("2001-2010", 1993, 2026)).toEqual([2001, 2010]);
    expect(yearsParam.parse("2010-2001", 1993, 2026)).toEqual([2001, 2010]);
    expect(yearsParam.parse("1980-2030", 1993, 2026)).toEqual([1993, 2026]);
    expect(yearsParam.parse("2008", 1993, 2026)).toEqual([2008, 2008]);
    expect(yearsParam.parse("1900-1950", 1993, 2026)).toBeUndefined();
    expect(yearsParam.parse("abc", 1993, 2026)).toBeUndefined();
    expect(yearsParam.format([1993, 2026], 1993, 2026)).toBeNull();
    expect(yearsParam.format(null, 1993, 2026)).toBeNull();
    expect(yearsParam.format([2001, 2010], 1993, 2026)).toBe("2001-2010");
    expect(yearsParam.format([2008, 2008], 1993, 2026)).toBe("2008");
  });

  it("round-trips enums, flags, ints and codes, dropping defaults", () => {
    const m = enumParam(["balance", "flows"] as const, "balance");
    expect(m.parse("flows")).toBe("flows");
    expect(m.parse("nope")).toBeUndefined();
    expect(m.format("balance")).toBeNull();
    expect(flagParam.parse("1")).toBe(true);
    expect(flagParam.format(false)).toBeNull();
    expect(intParam.parse("104", 1, 119)).toBe(104);
    expect(intParam.parse("120", 1, 119)).toBeUndefined();
    expect(intParam.parse("1e2", 1, 119)).toBeUndefined();
    expect(intParam.format(119, 119)).toBeNull();
    expect(codeParam.parse("chn", new Set(["CHN"]))).toBe("CHN");
    expect(codeParam.parse("XXX", new Set(["CHN"]))).toBeUndefined();
  });

  it("sets and removes only the given params", () => {
    expect(withParams("?chamber=house&congress=104", { congress: null, state: "CA" })).toBe("?chamber=house&state=CA");
    expect(withParams("?years=2001-2010", { years: null })).toBe("");
  });
});

import { describe, expect, it } from "vitest";
import { compactDollars, compactNumber } from "./format-number";

describe("compactNumber", () => {
  it("keeps figures under 10,000 exact", () => {
    expect(compactNumber(2464)).toBe("2,464");
    expect(compactNumber(225)).toBe("225");
  });
  it("shortens 10,000 and up to one decimal with K, M or B", () => {
    expect(compactNumber(166_573)).toBe("166.6K");
    expect(compactNumber(442_637)).toBe("442.6K");
    expect(compactNumber(12_624)).toBe("12.6K");
    expect(compactNumber(1_100_000)).toBe("1.1M");
    expect(compactNumber(283_000_000)).toBe("283M");
    expect(compactNumber(47_812_000_000)).toBe("47.8B");
  });
  it("carries a rounded 1000K into the next unit", () => {
    expect(compactNumber(999_960)).toBe("1M");
  });
  it("keeps the sign", () => {
    expect(compactNumber(-12_500)).toBe("−12.5K");
    expect(compactDollars(-145_000)).toBe("−$145K");
  });
  it("prefixes dollars", () => {
    expect(compactDollars(1_734_000)).toBe("$1.7M");
    expect(compactDollars(16_001)).toBe("$16K");
    expect(compactDollars(4250)).toBe("$4,250");
  });
});

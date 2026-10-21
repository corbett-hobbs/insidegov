import { describe, expect, it } from "vitest";
import { latestDate, parseDataDate } from "./freshness-dates";

describe("parseDataDate", () => {
  it("reads full dates and year-months", () => {
    expect(parseDataDate("2026-10-15")?.toISOString()).toBe("2026-10-15T00:00:00.000Z");
    expect(parseDataDate("2026-08")?.toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });
  it("rejects junk and impossible dates", () => {
    expect(parseDataDate("2026")).toBeUndefined();
    expect(parseDataDate("2026-02-31")).toBeUndefined();
    expect(parseDataDate(null)).toBeUndefined();
    expect(parseDataDate(5)).toBeUndefined();
  });
});

describe("latestDate", () => {
  it("picks the newest parsable value", () => {
    expect(latestDate(["2026-01-02", "bad", "2026-10-05", undefined])?.toISOString()).toBe("2026-10-05T00:00:00.000Z");
  });
  it("is undefined when nothing parses", () => {
    expect(latestDate(["x", null])).toBeUndefined();
  });
});

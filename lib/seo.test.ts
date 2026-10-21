import { describe, expect, it } from "vitest";
import { clampDescription, fitTitle, pageMetadata, truncateWords } from "./seo";

describe("fitTitle", () => {
  it("adds the first extra that fits, else none", () => {
    expect(fitTitle("Sen. Chuck Schumer (D-NY)", [": Ideology, Laws and Net Worth", ": Net Worth"], 60)).toBe("Sen. Chuck Schumer (D-NY): Ideology, Laws and Net Worth");
    expect(fitTitle("Rep. Alexandria Ocasio-Cortez (D-NY-14)", [": Ideology, Laws and Net Worth", " Net Worth"], 60)).toBe("Rep. Alexandria Ocasio-Cortez (D-NY-14) Net Worth");
    expect(fitTitle("x".repeat(58), [": more"], 60)).toBe("x".repeat(58));
  });
});

describe("truncateWords", () => {
  it("cuts at a word and drops a dangling preposition", () => {
    expect(truncateWords("Amending the Federal Water Pollution Control Act to provide additional authorizations", 50)).toBe("Amending the Federal Water Pollution Control Act…");
  });
});

describe("clampDescription", () => {
  it("keeps short text whole and tidies spacing", () => {
    expect(clampDescription("Designates  March 1986 as Music Month .")).toBe("Designates March 1986 as Music Month.");
  });
  it("ends on a whole sentence when one fits", () => {
    const t = `${"A".repeat(90)} ends here. ${"B".repeat(100)} goes on.`;
    expect(clampDescription(t)).toBe(`${"A".repeat(90)} ends here.`);
  });
  it("does not end a sentence at an abbreviation or inside quotes", () => {
    const t = `Designates the facility in North Canton, Ohio, as the "Lance Cpl. Stacy Dryden Post Office." ${"More text here. ".repeat(8)}`;
    expect(clampDescription(t)).toMatch(/^Designates .*Post Office\."/);
  });
  it("never exceeds the limit", () => {
    expect(clampDescription("word ".repeat(80)).length).toBeLessThanOrEqual(160);
  });
});

describe("pageMetadata", () => {
  it("lets the layout add the site name to a short title", () => {
    const m = pageMetadata({ title: "Laws Passed by Congress", description: "d", path: "/congress/laws" });
    expect(m.title).toBe("Laws Passed by Congress");
    expect(m.openGraph?.title).toBe("Laws Passed by Congress · InsideGov");
    expect(m.alternates?.canonical).toBe("/congress/laws");
  });
  it("sends a long title on its own, within 60 characters", () => {
    const m = pageMetadata({ title: "Sen. Chuck Schumer (D-NY): Ideology, Laws and Net Worth", description: "d", path: "/x" });
    expect(m.title).toEqual({ absolute: "Sen. Chuck Schumer (D-NY): Ideology, Laws and Net Worth" });
    const long = pageMetadata({ title: "Department of Veterans Affairs and Housing and Urban Development Appropriations Act, 2001", description: "d", path: "/x" });
    expect((long.title as { absolute: string }).absolute.length).toBeLessThanOrEqual(60);
  });
  it("uses a topic page's data share card for both Open Graph and Twitter", () => {
    const m = pageMetadata({ title: "T", description: "d", path: "/presidency/trade", topic: "presidency/trade" });
    expect(JSON.stringify(m.openGraph)).toContain("/og/presidency-trade");
    expect(JSON.stringify(m.twitter)).toContain("/og/presidency-trade");
  });
  it("leaves the site card off a route with its own image", () => {
    const m = pageMetadata({ title: "T", description: "d", path: "/x", ownImage: true });
    expect(m.openGraph).not.toHaveProperty("images");
  });
});

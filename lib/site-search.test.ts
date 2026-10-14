import { describe, expect, it } from "vitest";
import { normalize, searchEntries, type SearchEntry } from "./site-search";

const E: SearchEntry[] = [
  { n: "Chuck Schumer", s: "Senator · D-NY", u: "/a", k: "member", a: "New York" },
  { n: "Supreme Court ideology", s: "Page", u: "/b", k: "page", a: "scotus justices" },
  { n: "Ways and Means", s: "House committee", u: "/c", k: "committee" },
  { n: "Sonia Sotomayor", s: "Justice", u: "/d", k: "justice" },
  { n: "Ron Wyden", s: "Senator · D-OR", u: "/e", k: "member", a: "Oregon" },
];

describe("normalize", () => {
  it("drops accents, punctuation and case", () => {
    expect(normalize("  Luján, Ben-Ray ")).toBe("lujan ben ray");
  });
});

describe("searchEntries", () => {
  it("matches word prefixes in any order", () => {
    expect(searchEntries(E, "schu")[0].u).toBe("/a");
    expect(searchEntries(E, "schumer chuck")[0].u).toBe("/a");
  });
  it("matches aliases, below name matches", () => {
    expect(searchEntries(E, "scotus")[0].u).toBe("/b");
    expect(searchEntries(E, "new york")[0].u).toBe("/a");
  });
  it("requires every word to match", () => {
    expect(searchEntries(E, "chuck wyden")).toEqual([]);
  });
  it("returns nothing for an empty query", () => {
    expect(searchEntries(E, "  ")).toEqual([]);
  });
});

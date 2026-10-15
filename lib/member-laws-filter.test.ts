import { describe, expect, it } from "vitest";
import type { MemberLaws } from "./laws-types";
import { buildSearchIndex, lawKey, makeSummarySearch } from "./laws-search";
import { NO_LAW_FILTER, filterLaws, isFiltered, tileCounts } from "./member-laws-filter";

// rows: [congress, number, date, title, area, ..., major flag at [9], ..., summary at [11], short title at [12]]
const row = (n: number, title: string, major: 0 | 1, area = 0): MemberLaws["rows"][number] =>
  [119, n, `2026-0${n}-01`, title, area, 0, 0, 0, 0, major, 0, "", ""] as unknown as MemberLaws["rows"][number];
const laws = {
  rows: [row(1, "Alpha defense act", 1), row(2, "Beta parks act", 0), row(3, "Gamma defense act", 0), row(4, "Delta tax act", 1)],
  roles: [1, 0, 0, 1],
  areas: [{ name: "Armed Forces" }],
} as unknown as MemberLaws;

describe("member laws filter", () => {
  it("with nothing active, tiles are the member's totals", () => {
    expect(tileCounts(laws, NO_LAW_FILTER)).toEqual({ sponsored: 2, cosponsored: 2, major: 2 });
    expect(filterLaws(laws, NO_LAW_FILTER)).toEqual([0, 1, 2, 3]);
    expect(isFiltered(NO_LAW_FILTER)).toBe(false);
  });
  it("role is pick-one; major combines with it", () => {
    expect(filterLaws(laws, { ...NO_LAW_FILTER, role: "sponsored" })).toEqual([0, 3]);
    expect(filterLaws(laws, { ...NO_LAW_FILTER, role: "cosponsored" })).toEqual([1, 2]);
    expect(filterLaws(laws, { role: "sponsored", major: true, terms: [] })).toEqual([0, 3]);
    expect(filterLaws(laws, { role: "cosponsored", major: true, terms: [] })).toEqual([]);
  });
  it("each tile counts the rest of the selection, not its own dimension", () => {
    // Major on: the role tiles split the major laws; the major tile still counts them.
    expect(tileCounts(laws, { role: "all", major: true, terms: [] })).toEqual({ sponsored: 2, cosponsored: 0, major: 2 });
    // Cosponsored picked: the major tile counts major laws among the cosponsored; the role tiles still show both roles.
    expect(tileCounts(laws, { role: "cosponsored", major: false, terms: [] })).toEqual({ sponsored: 2, cosponsored: 2, major: 0 });
    // Search "defense" narrows every tile.
    expect(tileCounts(laws, { role: "all", major: false, terms: ["defense"] })).toEqual({ sponsored: 1, cosponsored: 1, major: 1 });
  });
  it("search matches title, area and pub. l. number", () => {
    expect(filterLaws(laws, { ...NO_LAW_FILTER, terms: ["armed", "beta"] })).toEqual([1]);
    expect(filterLaws(laws, { ...NO_LAW_FILTER, terms: ["119-3"] })).toEqual([2]);
    expect(isFiltered({ ...NO_LAW_FILTER, terms: ["x"] })).toBe(true);
  });
  it("also matches the start of a word in the full summary, once the index is loaded", () => {
    const summaryHas = makeSummarySearch(buildSearchIndex([[lawKey(119, 2), "Funds national parks and trails."]]));
    expect(filterLaws(laws, { ...NO_LAW_FILTER, terms: ["trail"] })).toEqual([]);
    expect(filterLaws(laws, { ...NO_LAW_FILTER, terms: ["trail"], summaryHas })).toEqual([1]);
    expect(filterLaws(laws, { ...NO_LAW_FILTER, terms: ["beta", "trail"], summaryHas })).toEqual([1]);
    expect(filterLaws(laws, { ...NO_LAW_FILTER, terms: ["alpha", "trail"], summaryHas })).toEqual([]);
  });
});

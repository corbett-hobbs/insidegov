import { describe, expect, it } from "vitest";
import { bandTerms, ordinal, SLIDER_BOUNDS, sliceOf, termSegmentsFor, windowRows } from "./demographics-chart";
import type { DemoCongress, DemoPresident } from "./demographics-types";

const row = (congress: number, termId: string): DemoCongress => ({
  congress,
  date: "",
  year: 1789 + 2 * (congress - 1),
  termId,
  seats: 1,
  age: { D: { median: null, average: null, n: 0 }, R: { median: null, average: null, n: 0 }, O: { median: null, average: null, n: 0 } },
  ageAll: { median: null, average: null, n: 0 },
  ageMissing: 0,
  seatsBy: { D: 0, R: 0, O: 0 },
  women: { D: 0, R: 0, O: 0 },
  tenure: [1, 0, 0, 0],
  servedSum: 1,
  tenureBy: { D: [1, 0, 0, 0], R: [0, 0, 0, 0], O: [0, 0, 0, 0] },
  servedBy: { D: 1, R: 0, O: 0 },
});
const presidents: DemoPresident[] = [
  { id: "a", president: "Alice Aa", last: "Aa", party: "D" },
  { id: "b", president: "Bob Bb", last: "Bb", party: "R" },
  { id: "c", president: "Cy Cc", last: "Cc", party: "D" },
];
const rows = [row(73, "a"), row(74, "a"), row(75, "b"), row(76, "b"), row(77, "b")]; // 1933, 1935, 1937, 1939, 1941

describe("demographics chart helpers", () => {
  it("draws a Congress when the year it convened is inside the window", () => {
    expect(windowRows(rows, [1935, 1939]).map((r) => r.congress)).toEqual([74, 75, 76]);
    expect(windowRows(rows, SLIDER_BOUNDS)).toHaveLength(5);
    expect(windowRows(rows, [1934, 1934])).toEqual([]);
  });
  it("spans each president over the years of the Congresses they held most of, and skips presidents who held none", () => {
    const t = bandTerms(rows, presidents);
    expect(t.map((x) => [x.id, x.from, x.to])).toEqual([["a", 1933, 1936], ["b", 1937, 1942]]);
  });
  it("makes one term-band run per president, one slot per Congress", () => {
    expect(termSegmentsFor(rows, presidents).map((s) => [s.id, s.s, s.e])).toEqual([["a", 0, 1], ["b", 2, 4]]);
  });
  it("writes ordinals", () => {
    expect([73, 101, 102, 111, 112, 113, 119].map(ordinal)).toEqual(["73rd", "101st", "102nd", "111th", "112th", "113th", "119th"]);
  });
  it("slices one Congress by party, and everyone when none is picked", () => {
    const r = { ...row(80, "a"), seats: 3, seatsBy: { D: 1, R: 1, O: 1 }, women: { D: 1, R: 0, O: 0 }, tenure: [2, 1, 0, 0] as [number, number, number, number], servedSum: 4, tenureBy: { D: [0, 1, 0, 0], R: [1, 0, 0, 0], O: [1, 0, 0, 0] } as DemoCongress["tenureBy"], servedBy: { D: 2, R: 1, O: 1 } };
    expect(sliceOf(r, null)).toMatchObject({ seats: 3, women: 1, servedSum: 4, tenure: [2, 1, 0, 0] });
    expect(sliceOf(r, "D")).toMatchObject({ seats: 1, women: 1, servedSum: 2, tenure: [0, 1, 0, 0] });
    expect(sliceOf(r, "O")).toMatchObject({ seats: 1, women: 0, tenure: [1, 0, 0, 0] });
  });
});

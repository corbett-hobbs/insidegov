import { describe, expect, it } from "vitest";
import { castsById, isPartySplit, majorityOf, partySplits, pctWith, tallyRows, withParty, type MemberVoteRow } from "./member-votes";

const party = (id: string) => (id.startsWith("d") ? "D" : id.startsWith("r") ? "R" : "I");

describe("member votes", () => {
  it("keeps the slot that voted when a member holds two roster slots", () => {
    expect([...castsById(["a", "a", ""], "014")]).toEqual([["a", "1"]]);
    expect([...castsById(["a", "a"], "04")]).toEqual([["a", "4"]]);
  });

  it("counts yeas and nays by party and ignores everything else", () => {
    const s = partySplits(castsById(["d1", "d2", "d3", "r1", "r2", "i1", "d4"], "1124211"), party);
    expect(s).toEqual({ D: [3, 1], R: [0, 1] });
  });

  it("scores a vote against the party majority", () => {
    const s = { D: [10, 2] as [number, number], R: [1, 9] as [number, number] };
    expect(isPartySplit(s)).toBe(true);
    expect(withParty("1", "D", s)).toBe(1);
    expect(withParty("2", "D", s)).toBe(0);
    expect(withParty("1", "R", s)).toBe(0);
    expect(withParty("4", "D", s)).toBe(2);
    expect(withParty("1", "I", s)).toBe(2);
    expect(withParty("1", "D", { D: [5, 5], R: [0, 0] })).toBe(2);
    expect(majorityOf([0, 0])).toBeNull();
    expect(isPartySplit({ D: [9, 1], R: [8, 2] })).toBe(false);
  });

  it("tallies rows, skipping uncounted votes", () => {
    const rows: MemberVoteRow[] = [
      ["a", 0, 1, 1, 1, 0, 0],
      ["b", 0, 2, 0, 1, 0, 0],
      ["c", 0, 1, 1, 0, 0, 0],
      ["d", 0, 4, 2, 0, 0, 0],
    ];
    const t = tallyRows(rows);
    expect(t).toEqual({ all: { with: 2, against: 1 }, split: { with: 1, against: 1 } });
    expect(pctWith(t.all)).toBe(67);
    expect(pctWith({ with: 0, against: 0 })).toBeNull();
  });
});

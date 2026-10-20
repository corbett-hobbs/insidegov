import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { earlyLawVotesFile, earlyLawVotesRef, type EarlyLawVotesRef, type RawEarlyLawVotesFile } from "../../lib/early-law-votes-entities";
import { buildEarlyLawVotes, chamberVote } from "./early-law-votes";

// Members 1-2 Democrats, 3 a Republican, 4 a Farmer-Laborite, 99 the President (Voteview files his position under the chamber).
const parties = new Map([
  ["74|H|1", 100],
  ["74|H|2", 100],
  ["74|H|3", 200],
  ["74|H|4", 537],
  ["74|S|1", 100],
]);
const presidents = new Set([99]);
const raw = (rolls: RawEarlyLawVotesFile["congresses"][string]["rolls"]): RawEarlyLawVotesFile => ({
  fetched: "2026-10-20",
  congresses: { "74": { rosters: { H: [1, 2, 3, 4, 99], S: [1] }, rolls } },
});

describe("chamberVote", () => {
  it("splits votes cast by party, counting a third-party member in the totals only and leaving out the President", () => {
    const r = raw([["H", 39, "1935-04-19", 3, 1, "HR7260", "TO PASS H.R. 7260", "16111"]]);
    expect(chamberVote(r, 74, "H", 39, parties, presidents, false, "t")).toEqual({ roll: 39, date: "1935-04-19", yea: 3, nay: 1, D: [1, 1], R: [1, 0] });
  });
  it("leaves paired and announced positions out of the split when Voteview's counts are votes cast", () => {
    const r = raw([["H", 39, "1935-04-19", 2, 1, "HR7260", "", "12610"]]);
    expect(chamberVote(r, 74, "H", 39, parties, presidents, false, "t")).toMatchObject({ D: [1, 0], R: [0, 1] });
  });
  it("counts paired and announced positions when Voteview's counts include them", () => {
    const r = raw([["H", 39, "1935-04-19", 3, 1, "HR7260", "", "23160"]]);
    expect(chamberVote(r, 74, "H", 39, parties, presidents, false, "t")).toMatchObject({ D: [2, 0], R: [1, 0] });
  });
  it("rejects member votes that do not add up to Voteview's counts", () => {
    const r = raw([["H", 39, "1935-04-19", 40, 1, "HR7260", "", "16111"]]);
    expect(() => chamberVote(r, 74, "H", 39, parties, presidents, false, "t")).toThrow(/add up/);
  });
  it("rejects a pick that did not carry, and an override pick short of two thirds", () => {
    const r = raw([["H", 5, "1935-01-01", 2, 2, "HR1", "", "11660"]]);
    expect(() => chamberVote(r, 74, "H", 5, parties, presidents, false, "t")).toThrow(/did not carry/);
    const o = raw([["H", 6, "1935-01-01", 3, 2, "HR1", "", "11160"]]);
    expect(() => chamberVote(o, 74, "H", 6, parties, presidents, true, "t")).toThrow(/two thirds/);
  });
  it("names a missing roll call", () => {
    expect(() => chamberVote(raw([]), 74, "S", 82, parties, presidents, false, "social-security-act")).toThrow(/social-security-act: 74 S roll call 82/);
  });
});

describe("buildEarlyLawVotes", () => {
  it("keeps a chamber with no recorded vote as null and carries override votes", () => {
    const ref: EarlyLawVotesRef = { _note: "", last_reviewed: "2026-10-20", laws: [{ timeline: "x", mayhew: "80-01", congress: 74, bills: ["HR1"], house: 39, house_override: 40 }] };
    const r = raw([
      ["H", 39, "1935-04-19", 3, 1, "HR1", "", "11161"],
      ["H", 40, "1935-05-01", 3, 1, "HR1", "", "11161"],
    ]);
    const [law] = buildEarlyLawVotes(ref, r, parties, presidents);
    expect(law).toMatchObject({ timeline: "x", mayhew: "80-01", congress: 74, senate: null, house: { roll: 39 }, house_override: { roll: 40 } });
  });
});

describe("committed files", () => {
  const ref = earlyLawVotesRef.parse(JSON.parse(readFileSync("pipeline/reference/early-law-votes.json", "utf8")));
  const out = earlyLawVotesFile.parse(JSON.parse(readFileSync("pipeline/output/early_law_votes.json", "utf8")));
  const by = new Map(out.laws.map((l) => [l.timeline ?? l.mayhew, l]));
  it("has one output row per reference entry", () => {
    expect(out.laws.length).toBe(ref.laws.length);
  });
  it("matches well-known votes", () => {
    // Civil Rights Act of 1964: the House's final vote is H.Res. 789 accepting the Senate's bill (2 July), the Senate's its passage.
    expect(by.get("civil-rights-act-of-1964")).toMatchObject({ house: { yea: 289, nay: 126, D: [153, 91], R: [136, 35] }, senate: { yea: 73, nay: 27, D: [46, 21], R: [27, 6] } });
    expect(by.get("social-security-act")).toMatchObject({ house: { yea: 372, nay: 33 }, senate: { yea: 77, nay: 6 } });
    expect(by.get("lend-lease-act")).toMatchObject({ house: { date: "1941-03-11", yea: 317, nay: 71 }, senate: { yea: 60, nay: 31 } });
    expect(by.get("labor-management-relations-act")).toMatchObject({ house_override: { yea: 331, nay: 83 }, senate_override: { yea: 68, nay: 25 } });
    // Passed by voice vote in both chambers: no roll call.
    expect(by.get("securities-act-of-1933")).toMatchObject({ house: null, senate: null });
  });
});

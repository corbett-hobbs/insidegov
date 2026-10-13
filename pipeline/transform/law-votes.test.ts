import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { lawVotesShard } from "../../lib/law-votes-entities";
import type { RawLawVotesFile } from "../../lib/law-votes-entities";
import type { RollcallTuple } from "../fetch/voteview-rollcalls-lib";
import { buildLawVotesFile, readVotes } from "../fetch/voteview-law-votes-lib";
import { chamberVotes, foldCast, tally } from "./law-votes";

describe("foldCast", () => {
  it("folds Voteview's cast codes to yea, nay, present, did not vote and not a member", () => {
    expect(["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].map(foldCast).join("")).toBe("1112223340");
  });
});

describe("readVotes and buildLawVotesFile", () => {
  const csv = ["congress,chamber,rollnumber,icpsr,cast_code,prob", "118,House,5,100,1,90.0", "118,House,5,200,6,80.0", "118,House,6,100,9,1.0", "118,House,7,100,1,1.0", ""].join("\n");
  it("keeps only the wanted roll calls and writes one character per roster member", () => {
    const h = readVotes(csv, new Set([5, 6]));
    expect([...h.keys()]).toEqual([5, 6]);
    const f = buildLawVotesFile(118, "2026-10-13", { H: h, S: new Map() });
    expect(f.rosters).toEqual({ H: [100, 200], S: [] });
    expect(f.rolls).toEqual([["H", 5, "16"], ["H", 6, "90"]]);
  });
  it("refuses a file that is not a votes file", () => {
    expect(() => readVotes("a,b\n1,2", new Set([1]))).toThrow(/header/);
  });
});

describe("chamberVotes", () => {
  const raw: RawLawVotesFile = { congress: 118, fetched: "2026-10-13", rosters: { H: [1, 2, 3, 4], S: [] }, rolls: [["H", 9, "1169"]] };
  it("does not count the President's position, which Voteview files under the chamber", () => {
    const withPresident: RawLawVotesFile = { ...raw, rosters: { H: [1, 2, 3, 99913], S: [] }, rolls: [["H", 9, "1161"]] };
    expect(chamberVotes(withPresident, "H", row(2, 1), "118-pub-1", new Set([99913]))).toEqual([9, "1120"]);
  });
  const row = (yea: number, nay: number): RollcallTuple => [118, "H", 9, "2024-01-01", 1, 9, yea, nay, "HR1"];
  it("folds the casts and agrees with the roll call's own counts", () => {
    expect(tally("1124")).toEqual({ yea: 2, nay: 1 });
    expect(chamberVotes(raw, "H", row(2, 1), "118-pub-1")).toEqual([9, "1124"]);
  });
  it("accepts Voteview's counts when they differ by a paired vote, and rejects a real disagreement", () => {
    expect(() => chamberVotes(raw, "H", row(2, 2), "118-pub-1")).not.toThrow();
    expect(() => chamberVotes(raw, "H", row(40, 1), "118-pub-1")).toThrow(/add up to/);
  });
  it("names a roll call the raw file lacks", () => {
    expect(() => chamberVotes(raw, "S", row(2, 1), "118-pub-1")).toThrow(/no member votes/);
  });
});

describe("law_votes shards (real data)", () => {
  const shard = lawVotesShard.parse(JSON.parse(readFileSync("pipeline/output/law_votes/117.json", "utf8")));
  it("hold the omnibus's House vote: 225 yea, 201 nay, one character per roster member", () => {
    const v = shard.laws["117-pub-328"]!.H!;
    expect(v[1]).toHaveLength(shard.rosters.H.length);
    expect([...v[1]].filter((c) => c === "1")).toHaveLength(225);
    expect([...v[1]].filter((c) => c === "2")).toHaveLength(201);
  });
});

import { describe, expect, it } from "vitest";
import {
  filterMembers,
  isRanking,
  leaderTitle,
  nameMatches,
  NO_FILTERS,
  partyLetter,
  pickLeaders,
  seatLabel,
  sortMembers,
  type DirectoryMember,
} from "./members-directory";

function member(p: Partial<DirectoryMember> & { bioguideId: string; name: string }): DirectoryMember {
  return {
    chamber: "house",
    lastName: p.name.split(" ").at(-1)!,
    state: "CA",
    district: 1,
    party: "Democrat",
    group: "dem",
    hasPhoto: true,
    since: null,
    ideology: null,
    netWorth: null,
    netWorthOpenEnded: false,
    views: null,
    leaderRole: null,
    ...p,
  };
}

const schumer = member({ bioguideId: "S000148", name: "Chuck Schumer", chamber: "senate", state: "NY", district: null, since: "1999-01-03", ideology: -0.38, views: 1500, netWorth: 1_000_000, leaderRole: "minority_leader" });
const thune = member({ bioguideId: "T000250", name: "John Thune", chamber: "senate", state: "SD", district: null, party: "Republican", group: "rep", since: "2005-01-04", ideology: 0.45, views: 900, netWorth: 3_000_000, leaderRole: "majority_leader" });
const sanders = member({ bioguideId: "S000033", name: "Bernie Sanders", chamber: "senate", state: "VT", district: null, party: "Independent", since: "2007-01-04", ideology: -0.52, views: 4600 });
const lujan = member({ bioguideId: "L000570", name: "Ben Ray Luján", chamber: "senate", state: "NM", district: null, since: "2021-01-03", ideology: -0.33, views: 300, netWorth: 500_000 });
const johnson = member({ bioguideId: "J000299", name: "Mike Johnson", state: "LA", district: 4, party: "Republican", group: "rep", since: "2017-01-03", ideology: 0.6, views: 2000, leaderRole: "speaker" });
const newbie = member({ bioguideId: "N000001", name: "Nora New", state: "CA", district: 12, since: "2025-01-03" });
const atLarge = member({ bioguideId: "A000001", name: "Alex Atlarge", state: "AK", district: 0, party: "Republican", group: "rep", since: "2023-01-03", ideology: 0.2, views: 120 });

const all = [schumer, thune, sanders, lujan, johnson, newbie, atLarge];
const ids = (ms: DirectoryMember[]) => ms.map((m) => m.name);

describe("nameMatches", () => {
  it("matches every word, case- and accent-insensitively", () => {
    expect(nameMatches("Ben Ray Luján", "lujan")).toBe(true);
    expect(nameMatches("Ben Ray Luján", "ben luj")).toBe(true);
    expect(nameMatches("Chuck Schumer", "schumer chuck")).toBe(true);
    expect(nameMatches("Chuck Schumer", "chuck thune")).toBe(false);
  });

  it("an empty or blank query matches everyone", () => {
    expect(nameMatches("Anyone", "")).toBe(true);
    expect(nameMatches("Anyone", "   ")).toBe(true);
  });
});

describe("filterMembers", () => {
  it("applies chamber, party, state and name together", () => {
    expect(filterMembers(all, NO_FILTERS)).toHaveLength(all.length);
    expect(ids(filterMembers(all, { ...NO_FILTERS, chamber: "house" }))).toEqual(["Mike Johnson", "Nora New", "Alex Atlarge"]);
    expect(ids(filterMembers(all, { ...NO_FILTERS, chamber: "senate", party: "Republican" }))).toEqual(["John Thune"]);
    expect(ids(filterMembers(all, { ...NO_FILTERS, state: "CA" }))).toEqual(["Nora New"]);
    expect(ids(filterMembers(all, { ...NO_FILTERS, query: "jo" }))).toEqual(["John Thune", "Mike Johnson"]);
  });

  it("filters party by registration: an independent is not a Democrat", () => {
    expect(ids(filterMembers(all, { ...NO_FILTERS, party: "Independent" }))).toEqual(["Bernie Sanders"]);
    expect(ids(filterMembers(all, { ...NO_FILTERS, party: "Democrat" }))).not.toContain("Bernie Sanders");
  });
});

describe("sortMembers", () => {
  it("Most looked up: most views first, members with no article last (A-Z)", () => {
    expect(ids(sortMembers(all, "interest"))).toEqual([
      "Bernie Sanders", "Mike Johnson", "Chuck Schumer", "John Thune", "Ben Ray Luján", "Alex Atlarge", "Nora New",
    ]);
  });

  it("Name: by last name", () => {
    expect(ids(sortMembers(all, "name"))).toEqual([
      "Alex Atlarge", "Mike Johnson", "Ben Ray Luján", "Nora New", "Bernie Sanders", "Chuck Schumer", "John Thune",
    ]);
  });

  it("State: by state name, senators before House districts in order", () => {
    const ca = [
      member({ bioguideId: "X3", name: "Zed District10", state: "CA", district: 10 }),
      member({ bioguideId: "X1", name: "Ann Senator", state: "CA", chamber: "senate", district: null }),
      member({ bioguideId: "X2", name: "Bob District2", state: "CA", district: 2 }),
    ];
    expect(ids(sortMembers([...ca, atLarge, lujan], "state"))).toEqual([
      "Alex Atlarge", "Ann Senator", "Bob District2", "Zed District10", "Ben Ray Luján",
    ]);
  });

  it("Ideology both ways, unscored members last either way", () => {
    expect(ids(sortMembers(all, "ideology-left"))).toEqual([
      "Bernie Sanders", "Chuck Schumer", "Ben Ray Luján", "Alex Atlarge", "John Thune", "Mike Johnson", "Nora New",
    ]);
    expect(ids(sortMembers(all, "ideology-right")).slice(0, 2)).toEqual(["Mike Johnson", "John Thune"]);
    expect(sortMembers(all, "ideology-right").at(-1)!.name).toBe("Nora New");
  });

  it("Longest serving: earliest first term start first", () => {
    expect(ids(sortMembers(all, "seniority")).slice(0, 3)).toEqual(["Chuck Schumer", "John Thune", "Bernie Sanders"]);
  });

  it("Highest net worth: richest first, no estimate last", () => {
    expect(ids(sortMembers(all, "net-worth")).slice(0, 3)).toEqual(["John Thune", "Chuck Schumer", "Ben Ray Luján"]);
  });

  it("does not mutate its input", () => {
    const copy = [...all];
    sortMembers(all, "name");
    expect(all).toEqual(copy);
  });

  it("ranks only on measures, not on the A-Z and state indexes", () => {
    expect(isRanking("interest")).toBe(true);
    expect(isRanking("net-worth")).toBe(true);
    expect(isRanking("name")).toBe(false);
    expect(isRanking("state")).toBe(false);
  });
});

describe("pickLeaders", () => {
  it("pins the Speaker, then House and Senate floor leaders, whatever the input order", () => {
    expect(ids(pickLeaders([...all].reverse()))).toEqual(["Mike Johnson", "John Thune", "Chuck Schumer"]);
  });

  it("keeps only the leaders that survive the filters", () => {
    expect(ids(pickLeaders(filterMembers(all, { ...NO_FILTERS, chamber: "senate" })))).toEqual(["John Thune", "Chuck Schumer"]);
    expect(pickLeaders(filterMembers(all, { ...NO_FILTERS, state: "CA" }))).toEqual([]);
  });

  it("titles each post", () => {
    expect(leaderTitle("house", "speaker")).toBe("Speaker of the House");
    expect(leaderTitle("senate", "majority_leader")).toBe("Senate Majority Leader");
    expect(leaderTitle("house", "minority_leader")).toBe("House Minority Leader");
  });
});

describe("labels", () => {
  it("seatLabel: state for senators, state-district for the House, AL at-large", () => {
    expect(seatLabel(schumer)).toBe("NY");
    expect(seatLabel(johnson)).toBe("LA-4");
    expect(seatLabel(atLarge)).toBe("AK-AL");
    expect(seatLabel({ chamber: "house", state: "DC", district: null })).toBe("DC-AL");
  });

  it("partyLetter", () => {
    expect(partyLetter("Democrat")).toBe("D");
    expect(partyLetter("Republican")).toBe("R");
    expect(partyLetter("Independent")).toBe("I");
  });
});

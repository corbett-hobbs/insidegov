import { describe, expect, it } from "vitest";
import { committeeCommonName, committeeSeo, decisionSeo, justiceSeo, memberSeo, presidentSeo } from "./entity-seo";

describe("memberSeo", () => {
  const schumer = { name: "Chuck Schumer", lastName: "Schumer", chamber: "senate" as const, party: "Democrat", caucus: "Democrat", partyAbbr: "D", state: "NY", stateName: "New York", district: null, firstTermYear: 1999, peers: { toward: 20, away: 26, of: 47 }, lawsSponsored: 33, netWorth: 2_672_524 };
  it("titles with the role, party-state and what the page shows", () => {
    expect(memberSeo(schumer).title).toBe("Sen. Chuck Schumer (D-NY): Ideology, Laws and Net Worth");
  });
  it("leads with where the member sits in their caucus, then the record", () => {
    expect(memberSeo(schumer).description).toBe("Chuck Schumer votes near the middle of Senate Democrats. See where Schumer has stood since 1999, the 33 laws Schumer sponsored and an estimated $2.7M net worth.");
    expect(memberSeo({ ...schumer, peers: { toward: 13, away: 33, of: 47 } }).description).toMatch(/^Chuck Schumer votes more liberally than 72% of Senate Democrats\./);
    expect(memberSeo({ ...schumer, peers: { toward: 41, away: 5, of: 47 } }).description).toMatch(/^Chuck Schumer votes more conservatively than 89% of Senate Democrats\./);
  });
  it("ranks a member near either end of the caucus", () => {
    const murkowski = { ...schumer, name: "Lisa Murkowski", lastName: "Murkowski", party: "Republican", caucus: "Republican", partyAbbr: "R", peers: { toward: 53, away: 1, of: 55 } };
    expect(memberSeo(murkowski).description).toMatch(/^Lisa Murkowski is the Senate's 2nd most liberal Republican\./);
    const sanders = { ...schumer, name: "Bernie Sanders", lastName: "Sanders", party: "Independent", partyAbbr: "I", peers: { toward: 2, away: 44, of: 47 } };
    expect(memberSeo(sanders).description).toMatch(/^Bernie Sanders is the Senate's 3rd most liberal member of the Democratic caucus\./);
  });
  it("joins the record with 'and' and words a negative net worth", () => {
    const aoc = { ...schumer, name: "Alexandria Ocasio-Cortez", lastName: "Ocasio-Cortez", chamber: "house" as const, district: 14, firstTermYear: 2019, peers: { toward: 63, away: 157, of: 221 }, lawsSponsored: 0, netWorth: -145_000 };
    expect(memberSeo(aoc).description).toBe("Alexandria Ocasio-Cortez votes more liberally than 71% of House Democrats. See where Ocasio-Cortez has stood since 2019 and an estimated net worth below zero.");
  });
  it("falls back to the plain description for a member with no score yet", () => {
    const s = memberSeo({ ...schumer, peers: null });
    expect(s.description).toMatch(/^Chuck Schumer, Democratic U\.S\. senator from New York since 1999\./);
    expect(s.description.length).toBeLessThanOrEqual(160);
  });
});

describe("justiceSeo", () => {
  const thomas = { name: "Clarence Thomas", last: "Thomas", role: "Associate Justice", served: "Served 1991–present · 34 terms", sitting: true, lean: "Conservative throughout", rank: { n: 2, of: 49, side: "conservative" as const }, medianTerms: 0, benchRank: { n: 1, side: "conservative" as const }, hasVotes: true };
  it("leads with the ideology trajectory and an all-time rank", () => {
    const s = justiceSeo(thomas);
    expect(s.title).toBe("Justice Clarence Thomas: Ideology and Voting Record");
    expect(s.description).toBe("Clarence Thomas has voted conservative throughout 34 terms, the 2nd most conservative of 49 justices since 1937. See how Thomas voted in every case.");
  });
  it("calls a swing justice the Court's median, and words a move", () => {
    const s = justiceSeo({ ...thomas, name: "Anthony Kennedy", last: "Kennedy", sitting: false, served: "Served 1988–2018 · 31 terms", lean: "From right of center to center", rank: { n: 20, of: 49, side: "conservative" }, medianTerms: 17, benchRank: null });
    expect(s.description).toMatch(/^Anthony Kennedy moved from right of center to near the center over 31 terms, the Court's median justice in 17 terms\./);
  });
  it("ranks a sitting justice on today's Court when not an all-time extreme", () => {
    const s = justiceSeo({ ...thomas, name: "Neil Gorsuch", last: "Gorsuch", served: "Served 2017–present · 9 terms", lean: "Right of center throughout", rank: { n: 15, of: 49, side: "conservative" }, benchRank: { n: 3, side: "conservative" } });
    expect(s.description).toMatch(/now the Court's 3rd most conservative member\./);
  });
  it("keeps every description under 160 characters with a decisions line", () => {
    const s = justiceSeo({ ...thomas, name: "Ruth Bader Ginsburg", last: "Ginsburg", sitting: false, served: "Served 1993–2020 · 27 terms", lean: "From center to liberal", rank: { n: 8, of: 49, side: "liberal" } });
    expect(s.description.length).toBeLessThanOrEqual(160);
    expect(s.description).toMatch(/ See (how Ginsburg voted|every vote Ginsburg cast)/);
  });
});

describe("presidentSeo", () => {
  const obama = { name: "Barack Obama", terms: [{ ordinal: "44th", years: "2009–2017" }], party: "D" as const, serving: false, laws: { signed: 1289, major: 45 }, executiveOrders: 276, justices: 2, congress: { both: 713, one: 1461, neither: 731 }, sections: ["misery", "fiscal", "arrivals", "trade"] };
  it("titles the presidency and leads with the record in office", () => {
    const s = presidentSeo(obama);
    expect(s.title).toBe("Barack Obama Presidency: Laws, Economy and Record");
    expect(s.description).toBe("Barack Obama signed 1,289 laws (45 major), issued 276 executive orders and appointed 2 justices. Democrats held both chambers of Congress for 2 of 8 years.");
  });
  it("says 'has' once for a serving president", () => {
    const s = presidentSeo({ ...obama, name: "Donald Trump", party: "R", serving: true });
    expect(s.description).toMatch(/^Donald Trump has signed 1,289 laws \(45 major\), issued 276 executive orders and appointed 2 justices\./);
  });
  it("names only the sections the page has, and never economy figures", () => {
    const s = presidentSeo({ ...obama, name: "Franklin D. Roosevelt", terms: [{ ordinal: "32nd", years: "1933–1945" }], laws: null, executiveOrders: null, justices: 8, congress: { both: 4422, one: 0, neither: 0 }, sections: ["fiscal"] });
    expect(s.description).toBe("Franklin D. Roosevelt appointed 8 justices. Democrats held both chambers of Congress throughout. See the federal budget during the term.");
    expect(s.description).not.toMatch(/%/);
  });
});

describe("committeeSeo", () => {
  it("uses the name a committee is reported by", () => {
    expect(committeeCommonName({ committeeId: "SSAS", name: "Senate Committee on Armed Services", shortName: "Armed Services", chamber: "senate" })).toBe("Senate Armed Services Committee");
    expect(committeeCommonName({ committeeId: "HLIG", name: "House Permanent Select Committee on Intelligence", shortName: "Intelligence", chamber: "house" })).toBe("House Intelligence Committee");
    expect(committeeCommonName({ committeeId: "JSTX", name: "Joint Committee on Taxation", shortName: "Joint Taxation", chamber: "joint" })).toBe("Joint Committee on Taxation");
    const s = committeeSeo({ committeeId: "HSBU", name: "House Committee on the Budget", shortName: "Budget", chamber: "house", latestCongress: 119, memberCount: 36, chair: "Jodey Arrington", rankingMember: "Brendan Boyle" });
    expect(s.title).toBe("House Budget Committee: Members, Chair and Bills");
    expect(s.description.length).toBeLessThanOrEqual(160);
  });
});

describe("decisionSeo", () => {
  it("leads with the case name and year", () => {
    const s = decisionSeo({ shortName: "Katz v. United States", decided: "1967-12-18", lead: "The Court redefined what counts as a search under the Fourth Amendment.", maj: 7, min: 1, area: null, disposition: null });
    expect(s.title).toBe("Katz v. United States (1967): Supreme Court Decision");
    expect(s.description).toBe("Katz v. United States (1967): The Court redefined what counts as a search under the Fourth Amendment.");
  });
  it("describes a case with no summary from its vote", () => {
    const s = decisionSeo({ shortName: "Ramsey v. New York", decided: "1979-03-05", lead: null, maj: 9, min: 0, area: "Criminal procedure", disposition: "Petition denied or appeal dismissed" });
    expect(s.description).toMatch(/^Ramsey v\. New York, a 1979 Supreme Court criminal procedure case decided 9–0\./);
  });
});

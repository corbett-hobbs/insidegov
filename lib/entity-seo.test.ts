import { describe, expect, it } from "vitest";
import { committeeCommonName, committeeSeo, decisionSeo, justiceSeo, memberSeo, presidentSeo } from "./entity-seo";

describe("memberSeo", () => {
  const schumer = { name: "Chuck Schumer", lastName: "Schumer", chamber: "senate" as const, party: "Democrat", partyAbbr: "D", state: "NY", stateName: "New York", district: null, firstTermYear: 1999, hasWealth: true };
  it("titles with the role, party-state and what the page shows", () => {
    const s = memberSeo(schumer);
    expect(s.title).toBe("Sen. Chuck Schumer (D-NY): Ideology, Laws and Net Worth");
    expect(s.description).toBe("Chuck Schumer, Democratic U.S. senator from New York since 1999. How Schumer votes, laws sponsored, committees and estimated net worth.");
  });
  it("names a House district and stays under 160 characters", () => {
    const s = memberSeo({ ...schumer, name: "Alexandria Ocasio-Cortez", lastName: "Ocasio-Cortez", chamber: "house", district: 14, firstTermYear: 2019 });
    expect(s.title.startsWith("Rep. Alexandria Ocasio-Cortez (D-NY-14)")).toBe(true);
    expect(s.description.length).toBeLessThanOrEqual(160);
    expect(s.description).toMatch(/^Alexandria Ocasio-Cortez, Democratic/);
  });
});

describe("justiceSeo", () => {
  const thomas = { name: "Clarence Thomas", last: "Thomas", role: "Associate Justice", served: "Served 1991–present · 34 terms", sitting: true, lean: "Conservative throughout", rank: { n: 2, of: 49, side: "conservative" as const }, medianTerms: 0, benchRank: { n: 1, side: "conservative" as const }, hasVotes: true };
  it("leads with the ideology trajectory and an all-time rank", () => {
    const s = justiceSeo(thomas);
    expect(s.title).toBe("Justice Clarence Thomas: Ideology and Voting Record");
    expect(s.description).toBe("Clarence Thomas has voted conservative throughout 34 terms, the 2nd most conservative of 49 justices since 1937. Plus the landmark rulings and 5–4 splits.");
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
    expect(s.description).toMatch(/Plus /);
  });
});

describe("presidentSeo", () => {
  it("titles the presidency and lists both terms", () => {
    const s = presidentSeo({ name: "Donald Trump", terms: [{ ordinal: "45th", years: "2017–2021" }, { ordinal: "47th", years: "2025–" }] });
    expect(s.title).toBe("Donald Trump Presidency: Laws, Economy and Record");
    expect(s.description).toMatch(/^Donald Trump, (the )?45th and 47th president \(2017–2021, 2025–\): laws signed/);
    expect(s.description.length).toBeLessThanOrEqual(160);
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

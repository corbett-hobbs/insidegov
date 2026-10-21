import { describe, expect, it } from "vitest";
import { lawMetaDescription, lawSeo, lawShortTitle, lawSummaryLead, lawTitle } from "./law-seo";

describe("lawShortTitle", () => {
  it("passes a short title or popular name through", () => {
    expect(lawShortTitle("Tax Cuts and Jobs Act")).toBe("Tax Cuts and Jobs Act");
    expect(lawShortTitle("Consolidated Appropriations Act, 2023")).toBe("Consolidated Appropriations Act, 2023");
  });
  it("names a designation by what it names", () => {
    expect(lawShortTitle("To designate the facility of the United States Postal Service located at 13308 Midland Road in Poway, California, as the Ray Chavez Post Office Building.")).toBe("Ray Chavez Post Office Building Designation");
    expect(lawShortTitle('A joint resolution to designate March 1986, as "Music in Our Schools Month".')).toBe("Music in Our Schools Month");
    expect(lawShortTitle('An act to name the United States Customs House in Ogdensburg, New York the "Robert C. McEwen United States Customs House".')).toBe("Robert C. McEwen United States Customs House Designation");
  });
  it("names a rule disapproval and an appropriations year", () => {
    expect(lawShortTitle('Providing for congressional disapproval under chapter 8 of title 5, United States Code, of the rule submitted by the National Park Service relating to "Glen Canyon National Recreation Area: Motor Vehicles".')).toBe("Disapproval of National Park Service Rule on Glen Canyon National Recreation Area: Motor Vehicles");
    expect(lawShortTitle("Disapproving the rule submitted by the Department of the Interior known as the Stream Protection Rule.")).toBe("Disapproval of the Stream Protection Rule");
    expect(lawShortTitle("Making emergency supplemental appropriations for the fiscal year ending September 30, 2024, and for other purposes.")).toBe("Emergency Supplemental Appropriations for Fiscal Year 2024");
  });
  it("turns a formal title into a heading", () => {
    expect(lawShortTitle("An Act to authorize various Federal reclamation projects and programs, and for other purposes.")).toBe("Authorizing various Federal reclamation projects and programs");
    expect(lawShortTitle("A bill to authorize and direct the Secretary of Energy to sell the Alaska Power Administration.")).toBe("Authorizing and directing the Secretary of Energy to sell the Alaska Power Administration");
    expect(lawShortTitle("To permit the use of certain lands.")).toBe("Permitting the use of certain lands");
    expect(lawShortTitle("A bill to amend title 28, United States Code, to exempt States from the statute of limitations applicable to quiet title actions against the United States.").length).toBeLessThanOrEqual(100);
  });
});

describe("lawTitle", () => {
  it("adds the year only when the name has none and it fits", () => {
    expect(lawTitle("Tax Cuts and Jobs Act", "2017-12-22")).toBe("Tax Cuts and Jobs Act (2017)");
    expect(lawTitle("Government Employee Fair Treatment Act of 2019", "2019-01-16")).toBe("Government Employee Fair Treatment Act of 2019");
  });
});

describe("lawSummaryLead", () => {
  it("skips status notes, title lines and headings, and strips CRS lead-ins", () => {
    expect(lawSummaryLead(["Government Employee Fair Treatment Act of 2019", "This bill requires back pay."], ["Government Employee Fair Treatment Act of 2019"])).toBe("This bill requires back pay.");
    expect(lawSummaryLead(["(Senate agreed to House amendment with an amendment)", "Single Audit Act of 1984 - Amends title 31 of the United States Code to add a chapter."])).toBe("Amends title 31 of the United States Code to add a chapter.");
    expect(lawSummaryLead(["Protecting Access to Medicare Act of 2014 - Title I: Medicare Extenders - (Sec. 101) Amends title XVIII of the Social Security Act."])).toBe("Amends title XVIII of the Social Security Act.");
    expect(lawSummaryLead(["Title I: Head Start Programs", "Amends the Head Start Act to reauthorize its programs."])).toBe("Amends the Head Start Act to reauthorize its programs.");
    expect(lawSummaryLead(["Reclamation Authorizations Act - =Title I: Kanopolis Unit, Kansas= - Reauthorizes the Kanopolis Unit."])).toBe("Reauthorizes the Kanopolis Unit.");
  });
});

describe("lawMetaDescription", () => {
  const base = { shortTitle: "X Act", officialTitle: "X Act", president: "Donald Trump", year: 2019, veto: false };
  it("adds who signed it when there is room, without doubling a period", () => {
    expect(lawMetaDescription({ ...base, summary: ['Designates March 1986 as "Music Month."'] })).toBe('Designates March 1986 as "Music Month." Signed by Donald Trump in 2019.');
    expect(lawMetaDescription({ ...base, veto: true, summary: ["This bill extends a federal program."] })).toBe("This bill extends a federal program. Enacted over Donald Trump's veto in 2019.");
  });
  it("falls back to a plain sentence with no summary", () => {
    expect(lawMetaDescription({ ...base, summary: null })).toBe("X Act, signed into law by Donald Trump in 2019: its path through Congress, sponsors and legislative history.");
  });
});

describe("lawSeo", () => {
  const tcja = {
    lawId: "115-pub-97",
    shortTitle: "Tax Cuts and Jobs Act",
    officialTitle: "An Act to provide for reconciliation",
    summary: ["This bill amends the Internal Revenue Code to reduce tax rates."],
    president: "Donald Trump",
    date: "2017-12-22",
    veto: false,
    originChamber: "House" as const,
    passage: { house: [0, 224, 201] as [0, number, number], senate: [0, 51, 48] as [0, number, number], override: null },
    chartChambers: ["House", "Senate"] as ("House" | "Senate")[],
    hasCommittees: true,
  };
  it("leads a recorded-vote law with the tally and the vote chart", () => {
    const s = lawSeo(tcja);
    expect(s.title).toBe("Tax Cuts and Jobs Act: How Congress Voted (2017)");
    expect(s.description).toBe("The Tax Cuts and Jobs Act passed the House 224–201 and the Senate 51–48. See how every member voted by ideology, its path through committee and what it does.");
  });
  it("names the chamber that passed it first, and a voice vote as such", () => {
    const s = lawSeo({ ...tcja, originChamber: "Senate", chartChambers: ["Senate"], passage: { house: [1, null, null], senate: [0, 86, 11], override: null } });
    expect(s.description).toMatch(/^The Tax Cuts and Jobs Act passed the Senate 86–11 and the House by voice vote\. See how every senator voted/);
  });
  it("describes a veto override by its override votes", () => {
    const s = lawSeo({ ...tcja, shortTitle: "William M. (Mac) Thornberry National Defense Authorization Act for Fiscal Year 2021", veto: true, passage: { ...tcja.passage, override: [322, 87, 81, 13] } });
    expect(s.description).toMatch(/322–87 in the House and 81–13 in the Senate/);
    expect(s.description.length).toBeLessThanOrEqual(160);
    expect(s.title).toBe("William M. (Mac) Thornberry National Defense Authorization Act for Fiscal Year 2021"); // pageMetadata cuts it to 60
  });
  it("uses a hand-written lead where the recorded action misstates the vote", () => {
    const s = lawSeo({ ...tcja, lawId: "118-pub-50", shortTitle: "Ukraine, Israel and Taiwan Security Supplemental Appropriations Act, 2024", chartChambers: ["Senate"], passage: { house: [2, null, null], senate: [0, 79, 18], override: null } });
    expect(s.description).toMatch(/^The House passed it in four parts, Ukraine aid 311–112 and Israel aid 366–58; the Senate passed the package 79–18\. See how every senator voted by ideology/);
    expect(s.description).not.toMatch(/unanimous consent/);
    expect(s.description.length).toBeLessThanOrEqual(160);
  });
  it("keeps the plain summary for a law with no recorded vote", () => {
    const s = lawSeo({ ...tcja, shortTitle: "Ray Chavez Post Office Building Designation", summary: ['Designates the facility in Poway, California, as the "Ray Chavez Post Office Building."'], date: "2020-12-21", chartChambers: [], passage: { house: [1, null, null], senate: [1, null, null], override: null } });
    expect(s.title).toBe("Ray Chavez Post Office Building Designation (2020)");
    expect(s.description).toBe('Designates the facility in Poway, California, as the "Ray Chavez Post Office Building." Passed by voice vote; signed by Donald Trump in 2020.');
  });
});

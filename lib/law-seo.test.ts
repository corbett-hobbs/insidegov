import { describe, expect, it } from "vitest";
import { lawMetaDescription, lawShortTitle, lawSummaryLead, lawTitle } from "./law-seo";

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
    expect(lawMetaDescription({ ...base, summary: null })).toBe("X Act, signed into law by Donald Trump in 2019: the votes in Congress, sponsors and legislative history.");
  });
});

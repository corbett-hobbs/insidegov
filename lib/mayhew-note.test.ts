import { describe, expect, it } from "vitest";
import { mayhewNote } from "./mayhew-note";

const note = (q: string, title = "Some Unrelated Act", scope: "whole" | "part" = "whole") => mayhewNote(q, title, scope);

describe("mayhewNote", () => {
  it("drops a label that repeats the title, the year and a veto note, keeping his description", () => {
    expect(note("Water Quality Act of 1987. $18 billion to sewage treatment plants, etc. Over Reagan’s veto.", "Water Quality Act of 1987")).toBe("$18 billion to sewage treatment plants, etc.");
  });
  it("keeps a label that says something the title does not", () => {
    expect(note("Disaster relief. $14 billion for hurricane relief in Florida.", "Consolidated Appropriations Act, 2005")).toBe("Disaster relief. $14 billion for hurricane relief in Florida.");
  });
  it("strips month notes from the 2011-on entries and keeps the rest", () => {
    expect(note("USA Freedom Act. Rollback of NSA telephone surveillance authority. (June)", "USA FREEDOM Act of 2015")).toBe("Rollback of NSA telephone surveillance authority.");
    expect(note("Reform of Veterans Affairs Department to allow privatization of care. (June)")).toBe("Reform of Veterans Affairs Department to allow privatization of care.");
    expect(note("Superstorm Sandy aid. $60.2 billion for insurance backup. (January—in two statutory installments)", "Disaster Relief Appropriations Act, 2013")).toBe("Superstorm Sandy aid. $60.2 billion for insurance backup.");
    expect(note("Ukraine aid. In four installments. March, May, October, December.")).toBe("Ukraine aid. In four installments.");
  });
  it("does not split after St.", () => {
    expect(note("Garn-St. Germain Depository Institutions Act of 1982. Part deregulation, part support of savings and loans.", "Garn-St. Germain Depository Institutions Act of 1982")).toBe("Part deregulation, part support of savings and loans.");
  });
  it("gives nothing for an entry that is only a capitalised label", () => {
    expect(note("PERSIAN GULF RESOLUTION.")).toBeNull();
    expect(note("SIXTEEN EXECUTIVE REGULATIONS REPEALED THROUGH USE OF THE CONGRESSIONAL REVIEW ACT (CRA).")).toBeNull();
  });
  it("drops a capitalised label and keeps the description after it", () => {
    expect(note("INFLATION REDUCTION ACT. Portmanteau healthcare and climate package.")).toBe("Portmanteau healthcare and climate package.");
    expect(note("INFRASTRUCTURE – a historic $1.2 trillion for investment in highways. Bipartisan compromise. November.")).toBe("A historic $1.2 trillion for investment in highways. Bipartisan compromise.");
  });
  it("cleans a quote cut off by the table's columns", () => {
    expect(note("BUSH TAX CUT. $1.35 trillion over 10 years;")).toBe("$1.35 trillion over 10 years.");
  });
  it("says a provision is included, not that it is the law", () => {
    expect(note("Gulf of Mexico opened to oil and gas drilling. 8.3 million acres.", "Tax Relief and Health Care Act of 2006", "part")).toBe("Includes: Gulf of Mexico opened to oil and gas drilling. 8.3 million acres.");
  });
  it("keeps a lone sentence entry as it is", () => {
    expect(note("Curb on unfunded mandates.", "Unfunded Mandates Reform Act of 1995")).toBe("Curb on unfunded mandates.");
  });
  it("keeps a label when what follows it is too short to stand alone, and gives up on a capitalised one", () => {
    expect(note("Airline deregulation. Decontrol of routes, fares. 1978.", "Airline Deregulation Act of 1978")).toBe("Airline deregulation. Decontrol of routes, fares.");
    expect(note("NORTH AMERICAN FREE TRADE AGREEMENT (NAFTA) APPROVED. Mexico and Canada. 1993.")).toBeNull();
  });
  it("gives nothing for a lone name of another act, and drops a year after a closing parenthesis", () => {
    expect(note("Opioid Crisis Response Act of 2018. (October)")).toBeNull();
    expect(note("Line-item veto. By statute, empowered president to kill individual spending items. (Later struck down by the judiciary.) 1996.", "Line Item Veto Act")).toBe("By statute, empowered president to kill individual spending items. (Later struck down by the judiciary.)");
  });
  it("keeps to 300 characters by whole sentences", () => {
    const long = `Label. ${"Word ".repeat(40).trim()}. ${"More ".repeat(40).trim()}.`;
    expect(note(long)!.length).toBeLessThanOrEqual(300);
  });
});

import { describe, expect, it } from "vitest";
import { cleanOrderText, rawTextUrl } from "../fetch/executive-order-texts-lib";
import { OPERATIVE, checkEoSummary, checkedSummaries, numberWord } from "./eo-summaries";

const PAGE = `<html><body><pre>
[Federal Register Volume 90, Number 18 (Wednesday, January 29, 2025)]
[Presidential Documents]
[FR Doc No: 2025-01953]

                         Presidential Documents

[[Page 8339]]

                Executive Order 14151 of January 20, 2025

Ending Programs

                By the authority vested in me as President by the
                Constitution and the laws of the United States of
                America, it is hereby ordered:

                Section 1. Purpose. Agencies spent money on \`\`equity
                action plans'' for years &amp; more.

[[Page 8340]]

                Sec. 2. Implementation. (a) Each agency head shall
                terminate all equity action plans within 60 days of
                the date of this order, and the follow-
                on reports.

                Sec. 3. Executive Order 14035 of June 25, 2021, is
                hereby revoked.

                (Presidential Sig.)&gt;

                THE WHITE HOUSE, January 20, 2025.

[FR Doc. 2025-01953
Filed 1-28-25; 8:45 am]
</pre></body></html>`;

describe("cleanOrderText", () => {
  const text = cleanOrderText(PAGE, 14151)!;
  it("starts at the order heading and stops before the signature", () => {
    expect(text.startsWith("Executive Order 14151 of January 20, 2025")).toBe(true);
    expect(text).not.toMatch(/WHITE HOUSE|Presidential Sig|FR Doc|\[\[Page/);
    expect(text.endsWith("is hereby revoked.")).toBe(true);
  });
  it("joins wrapped lines, keeps hyphens, and plain-quotes GPO quotes and entities", () => {
    expect(text).toContain("Each agency head shall terminate all equity action plans within 60 days");
    expect(text).toContain("the follow-on reports");
    expect(text).toContain('"equity action plans" for years & more');
  });
  it("falls back to the page's only heading when the number is misprinted", () =>
    expect(cleanOrderText(PAGE, 14152)?.startsWith("Executive Order 14151 of January 20, 2025")).toBe(true));
  it("returns null for a page with no order heading", () => expect(cleanOrderText("<pre>Proclamation 9994\n\nText.</pre>", 14152)).toBeNull());
  it("accepts 'Executive Order No. N'", () => expect(cleanOrderText(PAGE.replace("Order 14151 of", "Order No. 14151 of"), 14151)).toContain("is hereby revoked."));
  it("builds the plain-text URL from the publication date", () =>
    expect(rawTextUrl("2025-01-29", "2025-01953")).toBe("https://www.federalregister.gov/documents/full_text/text/2025/01/29/2025-01953.txt"));
});

describe("checkEoSummary", () => {
  const text = cleanOrderText(PAGE, 14151)!;
  const evidence = "Each agency head shall terminate all equity action plans within 60 days of the date of this order";
  const good = "Directs each agency head to terminate all equity action plans within 60 days and revokes Executive Order 14035.";
  it("passes a grounded summary", () => expect(checkEoSummary(good, evidence, text)).toBeNull());
  it("allows two sentences, not three", () => {
    expect(checkEoSummary("Directs each agency head to terminate all equity action plans within 60 days. Revokes Executive Order 14035.", evidence, text)).toBeNull();
    expect(checkEoSummary("Directs agency heads to terminate equity action plans. Revokes Executive Order 14035. Ends programs.", evidence, text)).toMatch(/3 sentences/);
  });
  it("accepts a quote that leaves words out with ...", () =>
    expect(checkEoSummary(good, "Each agency head shall terminate ... within 60 days of the date of this order", text)).toBeNull());
  it("rejects ... pieces quoted out of order", () =>
    expect(checkEoSummary(good, "within 60 days of the date of this order ... Each agency head shall terminate", text)).toMatch(/verbatim/));
  it("rejects a quote that is not in the order", () => expect(checkEoSummary(good, "Each agency head shall terminate every plan at once", text)).toMatch(/verbatim/));
  it("rejects a quote from the purpose section", () => expect(checkEoSummary(good, 'Agencies spent money on "equity action plans" for years', text)).toMatch(/operative/));
  it("accepts a number the order spells out", () => {
    const words = text.replace("within 60 days", "within sixty days");
    expect(checkEoSummary(good, evidence.replace("60", "sixty"), words)).toBeNull();
    expect(numberWord(25)).toBe("twenty-five");
  });
  it("rejects a number the order does not have", () =>
    expect(checkEoSummary("Directs each agency head to terminate all equity action plans within 90 days.", evidence, text)).toMatch(/90/));
  it("rejects an opening of 'This order'", () =>
    expect(checkEoSummary("This order directs each agency head to terminate all equity action plans.", evidence, text)).toMatch(/action verb/));
  it("rejects wording that strays from the order", () =>
    expect(checkEoSummary("Abolishes diversity bureaucracies throughout Washington immediately, saving taxpayers billions.", evidence, text)).toMatch(/words/));
  it("rejects anything over the character limit", () => expect(checkEoSummary(`${good.slice(0, -1)}${" and plans".repeat(30)}.`, evidence, text)).toMatch(/limit/));
});

describe("OPERATIVE", () => {
  it.each([
    "Executive Order 12859 of August 16, 1993, as amended, is further amended by making the following revisions",
    '(a) striking "(u) Assistant to the President" and inserting in lieu thereof "(u) Senior Advisor"',
    "I hereby determine that the actions of the Government constitute an unusual and extraordinary threat",
    "the Archivist shall administer Presidential records",
    "On or after April 2, 2025, a tariff of 25 percent may be imposed on all goods imported into the United States",
    "The rates of basic pay or salaries of the statutory pay systems are set forth on the schedules attached hereto",
  ])("accepts %s", (c) => expect(OPERATIVE.test(c)).toBe(true));
  it("rejects a findings sentence", () => expect(OPERATIVE.test("Americans deserve a government committed to serving every person")).toBe(false));
});

describe("checkedSummaries", () => {
  const text = cleanOrderText(PAGE, 14151)!;
  const evidence = "Executive Order 14035 of June 25, 2021, is hereby revoked";
  const entry = (eo_number: number, summary: string) => ({ eo_number, summary, evidence, model: "m" });
  it("keeps passing entries, drops failing ones and orphans", () => {
    const { summaries, report } = checkedSummaries(
      [entry(14151, "Revokes Executive Order 14035 of June 25, 2021."), entry(14152, "Revokes Executive Order 14035."), entry(1, "Revokes Executive Order 14035.")],
      new Map([[14151, text], [14152, "Executive Order 14152 says nothing relevant here at all."]]),
      new Set([14151, 14152]),
    );
    expect([...summaries.keys()]).toEqual([14151]);
    expect(report).toEqual({ summarized: 1, failing_check: [14152], orphans: [1], by_model: { m: 1 } });
  });
});

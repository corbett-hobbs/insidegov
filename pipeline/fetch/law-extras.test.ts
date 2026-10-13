import { describe, expect, it } from "vitest";
import { rawLawExtras } from "../../lib/law-extras-entities";
import { apiAmendments, apiCosponsorRecords, apiRelatedBills, extrasFromApiBill } from "./congress-gov-lib";
import { dropUnsignedClaims, parseAmendments, parseBillStatusWithExtras, parseCosponsorRecords, parseRelatedBills } from "./billstatus-lib";
import type { RawLaw } from "../../lib/laws-entities";

const long = "<p>" + "A long sentence about the law. ".repeat(200) + "</p>";
const xml = `<?xml version="1.0"?><billStatus><bill>
  <number>10</number><originChamber>House</originChamber><type>HR</type><introducedDate>2024-01-02</introducedDate><congress>118</congress><updateDate>2025-01-01T00:00:00Z</updateDate>
  <actions>
    <item><actionDate>2024-01-02</actionDate><text>Introduced in House</text><type>IntroReferral</type><sourceSystem><code>9</code></sourceSystem></item>
    <item><actionDate>2024-01-03</actionDate><text>Placed on the Union Calendar, Calendar No. 5.</text><type>Calendars</type></item>
    <item><actionDate>2024-02-01</actionDate><text>Became Public Law No: 118-5.</text><type>BecameLaw</type></item>
  </actions>
  <amendments>
    <amendment><number>12</number><congress>118</congress><type>SAMDT</type><purpose>Does a thing.</purpose>
      <sponsors><item><bioguideId>A000001</bioguideId><fullName>Sen. A [D-NY]</fullName></item></sponsors><submittedDate>2024-01-20T05:00:00Z</submittedDate><chamber>Senate</chamber>
      <amendedBill><congress>118</congress><type>HR</type><number>10</number></amendedBill>
      <actions><count>2</count><actions><item><actionDate>2024-01-20</actionDate><text>Amendment submitted</text></item><item><actionDate>2024-01-22</actionDate><text>Amendment agreed to in Senate by Voice Vote.</text></item></actions></actions></amendment>
    <amendment><number>7</number><congress>118</congress><type>HAMDT</type><sponsors><item><name>Rules Committee</name></item></sponsors><chamber>House of Representatives</chamber>
      <latestAction><actionDate>2024-01-05</actionDate><text>On agreeing to the amendment: Agreed to.</text></latestAction></amendment>
  </amendments>
  <relatedBills><item><title>A Companion</title><congress>118</congress><number>11</number><type>S</type><latestAction><actionDate>2024-01-02</actionDate><text>x</text></latestAction>
    <relationshipDetails><item><type>Identical bill</type><identifiedBy>CRS</identifiedBy></item><item><type>Identical bill</type><identifiedBy>House</identifiedBy></item><item><type>Related bill</type></item></relationshipDetails></item></relatedBills>
  <sponsors><item><bioguideId>R000595</bioguideId></item></sponsors>
  <cosponsors>
    <item><bioguideId>B000002</bioguideId><fullName>Rep. B</fullName><sponsorshipDate>2024-01-02</sponsorshipDate><isOriginalCosponsor>True</isOriginalCosponsor></item>
    <item><bioguideId>C000003</bioguideId><sponsorshipDate>2024-01-09</sponsorshipDate><isOriginalCosponsor>False</isOriginalCosponsor><sponsorshipWithdrawnDate>2024-01-15</sponsorshipWithdrawnDate></item>
  </cosponsors>
  <laws><item><type>Public Law</type><number>118-5</number></item></laws>
  <summaries><summary><actionDate>2024-02-01</actionDate><actionDesc>Public Law</actionDesc><cdata><text>${long.replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</text></cdata></summary></summaries>
  <title>Test Act</title>
</bill></billStatus>`;

describe("parseBillStatusWithExtras", () => {
  const [x] = parseBillStatusWithExtras(xml);
  it("keeps every action, not only the floor and presidential ones, and the extras parse against the schema", () => {
    expect(x!.extras.actions!.map((a) => a.type)).toEqual(["IntroReferral", "Calendars", "BecameLaw"]);
    expect(x!.law.actions.map((a) => a.type)).toEqual(["BecameLaw"]);
    expect(() => rawLawExtras.parse(x!.extras)).not.toThrow();
  });
  it("keeps the whole summary while the law record keeps the capped one", () => {
    expect(x!.extras.summary_html!.length).toBeGreaterThan(3000);
    expect(x!.law.summary_html!.length).toBe(3000);
    expect(x!.extras.summary_html!.startsWith(x!.law.summary_html!)).toBe(true);
  });
  it("reads amendments with their own sponsor, date and last step, and none of them as the bill's", () => {
    expect(x!.law.sponsor).toBe("R000595");
    expect(x!.extras.amendments).toEqual([
      { chamber: "Senate", type: "SAMDT", number: "12", sponsor: "A000001", sponsor_name: "Sen. A [D-NY]", submitted: "2024-01-20", purpose: "Does a thing.", latest: { date: "2024-01-22", text: "Amendment agreed to in Senate by Voice Vote." } },
      { chamber: "House", type: "HAMDT", number: "7", sponsor: null, sponsor_name: "Rules Committee", submitted: null, purpose: null, latest: { date: "2024-01-05", text: "On agreeing to the amendment: Agreed to." } },
    ]);
  });
  it("reads related bills with their relationship names once each", () => {
    expect(x!.extras.related).toEqual([{ congress: 118, type: "S", number: "11", title: "A Companion", rel: ["Identical bill", "Related bill"] }]);
  });
  it("keeps withdrawn cosponsors, flagged, while the law's list drops them", () => {
    expect(x!.extras.cosponsors).toEqual([
      { id: "B000002", date: "2024-01-02", original: true, withdrawn: null },
      { id: "C000003", date: "2024-01-09", original: false, withdrawn: "2024-01-15" },
    ]);
    expect(x!.law.cosponsors).toEqual(["B000002"]);
  });
  it("copes with a bill with none of the optional blocks", () => {
    expect(parseAmendments("")).toEqual([]);
    expect(parseRelatedBills("<bill></bill>")).toEqual([]);
    expect(parseCosponsorRecords("<bill></bill>")).toEqual([]);
  });
});

describe("dropUnsignedClaims", () => {
  const law = (type: "hr" | "s", number: string, signed: boolean) => ({ law: { law_id: "119-pub-120", bill_type: type, bill_number: number, became_law: signed ? ["2026-10-07"] : [] } as unknown as RawLaw });
  it("keeps the signed claim and reports the other", () => {
    const notes: string[] = [];
    const out = dropUnsignedClaims([law("hr", "766", false), law("s", "766", true)], notes);
    expect(out.map((e) => e.law.bill_type)).toEqual(["s"]);
    expect(notes).toHaveLength(1);
  });
  it("leaves two signed claims, and distinct ids, alone", () => {
    expect(dropUnsignedClaims([law("hr", "1", true), law("s", "1", true)], [])).toHaveLength(2);
    const other = { law: { ...law("hr", "2", false).law, law_id: "119-pub-121" } };
    expect(dropUnsignedClaims([law("hr", "1", false), other], [])).toHaveLength(2);
  });
});

describe("Congress.gov API mappers", () => {
  it("maps amendments from the type, with a description standing in for the purpose", () => {
    expect(apiAmendments([{ number: "769", type: "HAMDT", description: "An amendment to x." }, { number: "5", type: "SUAMDT" }, { number: "x", type: "SAMDT" }])).toEqual([
      { chamber: "House", type: "HAMDT", number: "769", sponsor: null, sponsor_name: null, submitted: null, purpose: "An amendment to x.", latest: null },
      { chamber: "Senate", type: "SUAMDT", number: "5", sponsor: null, sponsor_name: null, submitted: null, purpose: null, latest: null },
    ]);
  });
  it("maps related bills (numeric numbers) and cosponsors with dates", () => {
    expect(apiRelatedBills([{ congress: 99, type: "hr", number: 2851, title: "T", relationshipDetails: [{ type: "Related bill" }, { type: "Related bill" }] }])).toEqual([{ congress: 99, type: "HR", number: "2851", title: "T", rel: ["Related bill"] }]);
    expect(apiCosponsorRecords([{ bioguideId: "S000663", sponsorshipDate: "1986-02-06", isOriginalCosponsor: true }, { bioguideId: "F000041", sponsorshipWithdrawnDate: "1986-03-01" }, {}])).toEqual([
      { id: "S000663", date: "1986-02-06", original: true, withdrawn: null },
      { id: "F000041", date: null, original: false, withdrawn: "1986-03-01" },
    ]);
  });
  it("builds one slim extras record per law of a bill: the full summary and the cosponsors, nothing else", () => {
    const [a, b] = extrasFromApiBill(["99-pub-1", "99-pub-2"], {
      summaries: [{ actionDate: "1985-03-07", actionDesc: "Introduced in House", text: "x".repeat(4000) }],
      cosponsors: [{ bioguideId: "S000663", sponsorshipDate: "1986-02-06", isOriginalCosponsor: true }],
    });
    expect(a!.summary_html).toHaveLength(4000);
    expect(a!.cosponsors).toEqual([{ id: "S000663", date: "1986-02-06", original: true, withdrawn: null }]);
    expect(Object.keys(a!).sort()).toEqual(["cosponsors", "law_id", "summary_html"]);
    expect(b!.law_id).toBe("99-pub-2");
  });
});

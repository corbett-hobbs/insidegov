import { describe, expect, it } from "vitest";
import type { ScdbCodebook } from "../../lib/decisions-entities";
import { buildCaseDetails, buildCaseLeads, fixMojibake, isoOrNull } from "./decision-details";
import { parseCodebookPage } from "../fetch/scdb-codebook-lib";

const codebook: ScdbCodebook = {
  source: "http://scdb.wustl.edu/documentation.php",
  fetched: "2026-10-17",
  vars: {
    issue: { "10560": "statutory construction of criminal laws: sentencing guidelines Note: see also" },
    petitioner: { "126": "person convicted of crime", "27": "United States" },
    petitionerState: { "6": "California" },
    caseSource: { "29": "U.S. Court of Appeals, Sixth Circuit", "116": "Tennessee Eastern U.S. District Court" },
    jurisdiction: { "1": "cert" },
    certReason: { "11": "to resolve question presented" },
    lcDisposition: { "2": "affirmed" },
    caseDisposition: { "4": "reversed and remanded" },
    partyWinning: { "1": "petitioning party received a favorable disposition" },
    declarationUncon: { "1": "no declaration of unconstitutionality", "2": "act of congress declared unconstitutional" },
    lawType: { "6": "Infrequently litigated statutes" },
    lawSupp: { "600": "Infrequently litigated statutes" },
    authorityDecision1: { "4": "statutory construction" },
  },
};

const HEAD = "caseId,docket,dateArgument,dateRearg,petitioner,petitionerState,respondent,respondentState,jurisdiction,caseOrigin,caseOriginState,caseSource,caseSourceState,lcDisposition,lcDisagreement,certReason,caseDisposition,caseDispositionUnusual,partyWinning,precedentAlteration,declarationUncon,issue,lawType,lawSupp,lawMinor,authorityDecision1,authorityDecision2,majOpinWriter,majOpinAssigner";
const ROW = "2021-001,20-5279,10/4/2021,,126,,27,,1,999,,29,,2,0,11,4,0,1,0,1,10560,6,600,1 U.S.C. Â§ 109,4,,112,111";

describe("buildCaseDetails", () => {
  it("labels each coded field and nulls a code the codebook lacks", () => {
    const { rows, report } = buildCaseDetails(`${HEAD}\n${ROW}\n`, ["2021-001"], codebook);
    expect(rows[0]).toMatchObject({
      docket: "20-5279",
      argued: "2021-10-04",
      reargued: null,
      petitioner: "person convicted of crime",
      respondent: "United States",
      origin: null,
      source: "U.S. Court of Appeals, Sixth Circuit",
      lc_disposition: "affirmed",
      disposition: "reversed and remanded",
      petitioner_won: true,
      unconstitutional: null,
      issue: "statutory construction of criminal laws: sentencing guidelines",
      law_minor: "1 U.S.C. § 109",
      authority: ["statutory construction"],
      maj_writer: 112,
    });
    expect(report.unknown_codes).toEqual({ caseOrigin: { "999": 1 } });
  });
  it("fails on a case missing from the file", () => {
    expect(() => buildCaseDetails(`${HEAD}\n${ROW}\n`, ["2021-002"], codebook)).toThrow(/not in the SCDB file/);
  });
});

describe("helpers", () => {
  it("reads US dates and undoes Latin-1 mojibake", () => {
    expect(isoOrNull("3/7/2022")).toBe("2022-03-07");
    expect(isoOrNull(" ")).toBeNull();
    expect(fixMojibake("35 U.S.C. Â§ 33")).toBe("35 U.S.C. § 33");
    expect(fixMojibake("plain")).toBe("plain");
  });
});

describe("buildCaseLeads", () => {
  it("keeps articles about the case and ends each lead on a finished sentence", () => {
    const leads = {
      A: "A v. B, 1 U.S. 1 (1950), was a case.[1]\nThe Court held that the law applies. Then it said more and\nA dangling fragment",
      L: "This is a list of all the United States Supreme Court cases from volume 331:",
      P: "Boblo Island was an amusement park.",
    };
    const out = buildCaseLeads(
      [
        { case_id: "1", title: "A", summary: false },
        { case_id: "2", title: "L", summary: false },
        { case_id: "3", title: "P", summary: false },
      ],
      leads,
    );
    expect(out).toEqual([{ case_id: "1", title: "A", paragraphs: ["A v. B, 1 U.S. 1 (1950), was a case.", "The Court held that the law applies."] }]);
  });
});

describe("parseCodebookPage", () => {
  it("reads code and label rows after the Values heading", () => {
    const html = `<p>Intro</p><b>Values:</b><table><tr><td>1</td><td>stay, petition, or motion granted</td></tr><tr><td>2</td><td>affirmed &amp; modified</td></tr></table><td width="25%">sidebar<tr><td>9</td><td>x</td></tr>`;
    expect(parseCodebookPage(html, "t")).toEqual({ "1": "stay, petition, or motion granted", "2": "affirmed & modified" });
  });
});

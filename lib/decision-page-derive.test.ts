import { describe, expect, it } from "vitest";
import type { DecisionDetailRow } from "./decisions-entities";
import { buildTimeline, codebookLabel, courtName, dispositionMeaning, justiaUrl, oyezUrl, splitParties } from "./decision-page-derive";
import { decisionPath, decisionSlug, isCaseId } from "./decision-url";

const detail = (over: Partial<DecisionDetailRow> = {}): DecisionDetailRow => ({
  case_id: "2021-001",
  docket: "20-5279",
  argued: "2021-10-04",
  reargued: null,
  petitioner: "person convicted of crime",
  petitioner_state: null,
  respondent: "United States",
  respondent_state: null,
  jurisdiction: "cert",
  origin: "Georgia Northern U.S. District Court",
  origin_state: null,
  source: "U.S. Court of Appeals, Sixth Circuit",
  source_state: null,
  lc_disposition: "affirmed",
  lc_dissent: false,
  cert_reason: "federal court conflict",
  disposition: "reversed and remanded",
  disposition_unusual: false,
  petitioner_won: true,
  precedent_altered: false,
  unconstitutional: null,
  issue: "statutory construction of criminal laws: sentencing guidelines",
  law_type: "Infrequently litigated statutes",
  law: "Infrequently litigated statutes",
  law_minor: "Armed Career Criminal Act",
  authority: ["statutory construction"],
  maj_writer: 112,
  maj_assigner: 111,
  ...over,
});

describe("codebookLabel", () => {
  it("drops a trailing note, long parentheticals and dangling tails", () => {
    expect(codebookLabel("employer. If employer's relations with employees are governed by the nature of the employer's business")).toBe("Employer");
    expect(codebookLabel("U.S. Court of Appeals, District of Columbia Circuit (includes the Court of Appeals for the District of Columbia but not the District of Columbia Court of Appeals, which has local jurisdiction)")).toBe("U.S. Court of Appeals, District of Columbia Circuit");
    expect(codebookLabel("employee, or job applicant, including beneficiaries of")).toBe("Employee, or job applicant");
    expect(codebookLabel("union, labor organization, or official of")).toBe("Union, labor organization, or official");
    expect(codebookLabel("affirmed (includes modified)")).toBe("Affirmed");
    expect(codebookLabel("First Amendment, miscellaneous (cf. comity: First Amendment)")).toBe("First Amendment, miscellaneous");
    expect(codebookLabel("federal pre-emption of state legislation or regulation. cf. state regulation of business. rarely involves union activity.")).toBe("Federal pre-emption of state legislation or regulation");
  });
  it("keeps a short parenthetical that changes the meaning", () => {
    expect(codebookLabel("affirmed and reversed (or vacated) in part")).toBe("Affirmed and reversed (or vacated) in part");
  });
});

describe("courtName", () => {
  it("names a generic state court by its state", () => {
    expect(courtName("State Supreme Court", "Missouri")).toBe("Missouri Supreme Court");
    expect(courtName("State Trial Court", "Illinois")).toBe("Illinois trial court");
  });
  it("leaves a court that names its own place alone", () => {
    expect(courtName("U.S. Court of Appeals, Fifth Circuit", null)).toBe("U.S. Court of Appeals, Fifth Circuit");
    expect(courtName(null, "Texas")).toBeNull();
  });
});

describe("splitParties", () => {
  it("splits the caption and attaches each side's category", () => {
    const p = splitParties("Dobbs v. Jackson Women’s Health Organization", detail({ petitioner: "state department or agency", petitioner_state: "Mississippi" }));
    expect(p.petitioner).toEqual({ name: "Dobbs", kind: "State department or agency (Mississippi)" });
    expect(p.respondent).toEqual({ name: "Jackson Women’s Health Organization", kind: "United States" });
  });
  it("has no names for a one-party caption and hides 'Unidentifiable'", () => {
    const p = splitParties("In re Gault", detail({ petitioner: "Unidentifiable" }));
    expect(p.petitioner).toEqual({ name: null, kind: null });
  });
});

describe("dispositionMeaning", () => {
  it("explains the ruling and names the court below", () => {
    expect(dispositionMeaning("reversed and remanded", "U.S. Court of Appeals, Fifth Circuit", false)).toBe(
      "Reversed and remanded: the Supreme Court overturned the decision of the U.S. Court of Appeals, Fifth Circuit and sent the case back to that court for further proceedings that follow the Supreme Court’s ruling.",
    );
    expect(dispositionMeaning("affirmed (includes modified)", null, false)).toMatch(/^Affirmed: the Supreme Court upheld the decision of the lower court/);
  });
  it("gives an equally divided Court its own sentence, and nothing for an unknown code", () => {
    expect(dispositionMeaning("affirmed (includes modified)", "Illinois Supreme Court", true)).toMatch(/^Affirmed by an equally divided Court: .*the decision of the Illinois Supreme Court stands/);
    expect(dispositionMeaning("no disposition", null, false)).toBeNull();
    expect(dispositionMeaning(null, null, false)).toBeNull();
  });
});

describe("buildTimeline", () => {
  it("runs from the decision back to the trial court", () => {
    const steps = buildTimeline(detail(), { date: "2022-03-07", maj: 9, min: 0, disposition: "Reversed and remanded", petitionerWon: true, petitioner: "Wooden" });
    expect(steps.map((s) => s.kind)).toEqual(["Decided", "Argued", "Taken up", "Court below", "Began"]);
    expect(steps[2]!.text).toBe("The Supreme Court agreed to hear the case (certiorari). Federal appeals courts had ruled differently on the question.");
    expect(steps[0]).toEqual({ date: "2022-03-07", kind: "Decided", text: "Decided 9–0: reversed and remanded. Wooden won." });
  });
  it("folds the trial court into the court below when they are the same", () => {
    const steps = buildTimeline(detail({ origin: "State Supreme Court", origin_state: "Ohio", source: "State Supreme Court", source_state: "Ohio", jurisdiction: "appeal", reargued: "2022-01-10" }), { date: "2022-03-07", maj: 5, min: 4, disposition: null, petitionerWon: null, petitioner: null });
    expect(steps.map((s) => s.kind)).toEqual(["Decided", "Reargued", "Argued", "Taken up", "Court below"]);
    expect(steps[4]!.text).toBe("Began in and was decided by the Ohio Supreme Court: affirmed.");
    expect(steps[0]!.text).toBe("Decided 5–4.");
  });
});

describe("links", () => {
  it("builds Justia only from a U.S. Reports cite, Oyez only from 1955 on", () => {
    expect(justiaUrl("384 U.S. 436")).toBe("https://supreme.justia.com/cases/federal/us/384/436/");
    expect(justiaUrl("142 S. Ct. 1063")).toBeNull();
    expect(oyezUrl(2021, "20-5279")).toBe("https://www.oyez.org/cases/2021/20-5279");
    expect(oyezUrl(1953, "1")).toBeNull();
    expect(oyezUrl(2000, "105 ORIG")).toBeNull();
  });
});

describe("decision URLs", () => {
  it("slugs the case name without 'et al.' and validates ids", () => {
    expect(decisionSlug("United States v. Pullman Company et al.")).toBe("united-states-v-pullman-company");
    expect(decisionPath("2021-019", "Dobbs v. Jackson Women’s Health Organization")).toBe("/supreme-court/decisions/2021-019/dobbs-v-jackson-womens-health-organization");
    expect(isCaseId("2021-019")).toBe(true);
    expect(isCaseId("2021-19")).toBe(false);
  });
});

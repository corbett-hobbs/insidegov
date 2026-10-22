import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DecisionsDataError, decisionCountRow, decisionGroupCatalog, decisionsMeta, scdbCodebook, type ChiefReferenceEntry, type DecisionGroupEntry, type IssueAreaCatalogEntry } from "../../lib/decisions-entities";
import { buildChiefSpans, buildCounts, buildMeta, checkChiefReference, checkGroups, dissentBucket, groupId, issueAreaId, parseScdb, recountFromCsv, runGates, selectCases } from "./decisions";

const catalog: IssueAreaCatalogEntry[] = [
  { id: "a", scdb_code: 1, label: "A" },
  { id: "b", scdb_code: 2, label: "B" },
];
const groups: DecisionGroupEntry[] = [
  { id: "ga", label: "GA", description: "d", issues: [], law_supp: [], issue_areas: ["a"] },
  { id: "gb", label: "GB", description: "d", issues: [], law_supp: [], issue_areas: ["b"] },
];
const chiefs: ChiefReferenceEntry[] = [
  { scdb_chief: "Smith", name: "Al Smith", justice_id: 1, appointing_president: "Harry S Truman", appointing_party: "Democratic" },
  { scdb_chief: "Jones", name: "Bo Jones", justice_id: 2, appointing_president: "Richard M. Nixon", appointing_party: "Republican" },
];

const HEADER = "caseId,term,decisionType,majVotes,minVotes,voteUnclear,issueArea,chief,dateDecision,caseName,usCite,sctCite,ledCite,lexisCite,docket,decisionDirection,majOpinWriter,issue,lawSupp";
const csv = (...lines: string[]) => [HEADER, ...lines].join("\n") + "\n";
const SAMPLE = csv(
  "1,1946,1,9,0,,1,Smith,11/18/1946,CASE,1 U.S. 1,,,,D1,2,,,",
  "2,1946,1,5,4,,2,Smith,11/18/1946,CASE,1 U.S. 1,,,,D1,1,,,",
  "3,1946,6,8,1,,,Smith,11/18/1946,CASE,1 U.S. 1,,,,D1,,,,", // per curiam, no issue area
  "4,1946,2,9,0,,1,Smith,11/18/1946,CASE,1 U.S. 1,,,,D1,,,,", // summary: excluded
  "5,1946,4,9,0,,1,Smith,11/18/1946,CASE,1 U.S. 1,,,,D1,,,,", // decree: excluded
  "6,1946,1,5,4,1,1,Smith,11/18/1946,CASE,1 U.S. 1,,,,D1,,,,", // unclear: excluded
  "7,1947,1,6,3,,1,Jones,11/18/1946,CASE,1 U.S. 1,,,,D1,3,,,",
  "8,1947,5,4,4,,1,Jones,11/18/1946,CASE,1 U.S. 1,,,,D1,,,,", // 4-4 tie: bucket 4
  "9,1947,1,7,1,,2,Smith,11/18/1946,CASE,1 U.S. 1,,,,D1,,,,",
);

describe("decisions transform", () => {
  it("clips dissents at 4", () => {
    expect([0, 1, 2, 3, 4, 5].map(dissentBucket)).toEqual([0, 1, 2, 3, 4, 4]);
  });

  it("applies the unit-of-analysis rule and counts exclusions", () => {
    const sel = selectCases(parseScdb(SAMPLE));
    expect(sel.cases.map((c) => c.caseId)).toEqual(["1", "2", "3", "7", "8", "9"]);
    expect(sel.exclusions).toEqual({ summary_dispositions: 1, decrees: 1, unclear_votes: 1 });
  });

  it("builds one row per term and topic, unclassified kept as null", () => {
    const rows = buildCounts(selectCases(parseScdb(SAMPLE)).cases, catalog, groups);
    expect(rows.every((r) => decisionCountRow.safeParse(r).success)).toBe(true);
    expect(rows).toEqual([
      { term: 1946, group_id: "ga", n: 1, d0: 1, d1: 0, d2: 0, d3: 0, d4: 0 },
      { term: 1946, group_id: "gb", n: 1, d0: 0, d1: 0, d2: 0, d3: 0, d4: 1 },
      { term: 1946, group_id: null, n: 1, d0: 0, d1: 1, d2: 0, d3: 0, d4: 0 },
      { term: 1947, group_id: "ga", n: 2, d0: 0, d1: 0, d2: 0, d3: 1, d4: 1 },
      { term: 1947, group_id: "gb", n: 1, d0: 0, d1: 1, d2: 0, d3: 0, d4: 0 },
    ]);
  });

  it("fails loudly on an unknown issue area or chief", () => {
    expect(() => issueAreaId(99, catalog)).toThrow(/unknown SCDB issueArea code 99/);
    const cases = selectCases(parseScdb(csv("1,1946,1,9,0,,1,Nobody,11/18/1946,CASE,1 U.S. 1,,,,D1,,,,"))).cases;
    expect(() => buildChiefSpans(cases, chiefs)).toThrow(/unknown SCDB chief "Nobody"/);
    expect(() => selectCases(parseScdb(csv("1,1946,3,9,0,,1,Smith,11/18/1946,CASE,1 U.S. 1,,,,D1,,,,")))).toThrow(/unknown decisionType 3/);
  });

  it("fails on a duplicate caseId", () => {
    expect(() => parseScdb(csv("1,1946,1,9,0,,1,Smith,11/18/1946,CASE,1 U.S. 1,,,,D1,,,,", "1,1946,1,9,0,,1,Smith,11/18/1946,CASE,1 U.S. 1,,,,D1,,,,"))).toThrow(/duplicate caseId/);
  });

  it("builds chief spans from the modal chief of each term", () => {
    const spans = buildChiefSpans(selectCases(parseScdb(SAMPLE)).cases, chiefs);
    expect(spans.map((s) => [s.scdb_chief, s.start_term, s.end_term])).toEqual([["Smith", 1946, 1946], ["Jones", 1947, 1947]]);
  });

  it("checks the chief reference against the Court track", () => {
    const justices = [
      { justice_id: 1, chief_justice_appointment: { president: "Harry S Truman", party: "Democratic" } },
      { justice_id: 2, chief_justice_appointment: { president: "Richard M. Nixon", party: "Republican" } },
    ];
    const presidents = [
      { president: "Harry S. Truman", party: "Democratic" },
      { president: "Richard Nixon", party: "Republican" },
    ];
    expect(() => checkChiefReference(chiefs, justices, presidents)).not.toThrow();
    expect(() => checkChiefReference(chiefs, [justices[0]!, { justice_id: 2, chief_justice_appointment: null }], presidents)).toThrow(/not a Chief Justice/);
    expect(() => checkChiefReference(chiefs, justices, presidents.slice(0, 1))).toThrow(/not in the presidents table/);
    expect(() => checkChiefReference([{ ...chiefs[0]!, appointing_party: "Republican" }], justices, presidents)).toThrow(/court track says/);
  });
});

describe("gates", () => {
  const REAL = readFileSync("pipeline/raw/scdb/SCDB_2026_01_caseCentered_Citation.csv").toString("latin1");
  const rows = parseScdb(REAL);
  const sel = selectCases(rows);
  const realCatalog = JSON.parse(readFileSync("pipeline/reference/decision-issue-areas.json", "utf8")).areas as IssueAreaCatalogEntry[];
  const realChiefs = JSON.parse(readFileSync("pipeline/reference/chief-justices.json", "utf8")).chiefs as ChiefReferenceEntry[];
  const realGroups = decisionGroupCatalog.parse(JSON.parse(readFileSync("pipeline/reference/decision-groups.json", "utf8"))).groups;
  const codebook = scdbCodebook.parse(JSON.parse(readFileSync("pipeline/reference/scdb-codebook.json", "utf8")));
  const counts = buildCounts(sel.cases, realCatalog, realGroups);
  const meta = decisionsMeta.parse({
    ...buildMeta({ version: "2026_01", sourceFile: "x.csv", cases: sel.cases, selection: sel, catalog: realCatalog, groups: realGroups, spans: buildChiefSpans(sel.cases, realChiefs) }),
    landmarks: { count: 339, page: "p", url: "https://en.wikipedia.org/wiki/p", revision_id: 1, revision_date: "2026-09-19", license: "CC BY-SA 4.0" },
  });
  const recount = recountFromCsv(REAL);

  it("pass on the real release and match the plan's facts", () => {
    expect(() => runGates({ version: "2026_01", counts, meta, recount })).not.toThrow();
    expect(sel.cases).toHaveLength(8251);
    expect(sel.exclusions.unclear_votes).toBe(82);
    expect(meta.unclassified_count).toBe(67);
    expect(meta.chief_spans.map((s) => s.scdb_chief)).toEqual(["Vinson", "Warren", "Burger", "Rehnquist", "Roberts"]);
  });

  it("fail when a row is lost, a bucket moves, a term goes missing or an anchor drifts", () => {
    const lost = counts.map((r, i) => (i === 5 ? { ...r, n: r.n - 1, d0: r.d0 > 0 ? r.d0 - 1 : r.d0, d1: r.d0 > 0 ? r.d1 : r.d1 - 1 } : r));
    expect(() => runGates({ version: "2026_01", counts: lost, meta, recount })).toThrow(DecisionsDataError);
    const i4 = counts.findIndex((r) => r.d4 > 0);
    const moved = counts.map((r, i) => (i === i4 ? { ...r, d4: r.d4 - 1, d3: r.d3 + 1 } : r));
    expect(() => runGates({ version: "2026_01", counts: moved, meta, recount })).toThrow(/5-4 count/);
    expect(() => runGates({ version: "2026_01", counts: counts.filter((r) => r.term !== 1960), meta, recount })).toThrow(/gate failed/);
    expect(() => runGates({ version: "2026_01", counts, meta: { ...meta, unclassified_count: 1 }, recount })).toThrow(/unclassified/);
    expect(() => runGates({ version: "2026_01", counts, meta: { ...meta, exclusions: { ...meta.exclusions, unclear_votes: 81 } }, recount })).toThrow(/exclusions/);
  });

  it("fail when the case list disagrees with the counts", async () => {
    const { buildCaseRows } = await import("./decisions");
    const caseRows = buildCaseRows(sel.cases, realCatalog, realGroups);
    expect(() => runGates({ version: "2026_01", counts, caseRows, meta, recount })).not.toThrow();
    expect(() => runGates({ version: "2026_01", counts, caseRows: caseRows.slice(1), meta, recount })).toThrow(/case list has/);
    const moved = caseRows.map((r, i) => (i === 0 ? { ...r, band: (r.band + 1) % 5 } : r));
    expect(() => runGates({ version: "2026_01", counts, caseRows: moved, meta, recount })).toThrow(/case list disagrees/);
    expect(() => runGates({ version: "2026_01", counts, caseRows: caseRows.map((r, i) => (i === 1 ? { ...r, case_id: caseRows[0]!.case_id } : r)), meta, recount })).toThrow(/duplicate case_id/);
  });

  it("give every classified case one topic, and put well-known cases where a reader looks for them", async () => {
    const { buildCaseRows } = await import("./decisions");
    const rows = buildCaseRows(sel.cases, realCatalog, realGroups);
    expect(() => checkGroups(realGroups, realCatalog, codebook, new Set(sel.cases.map((c) => c.caseId)))).not.toThrow();
    expect(rows.filter((r) => r.group_id === null)).toHaveLength(67);
    const topic = (name: RegExp, term: number) => rows.find((r) => r.term === term && name.test(r.name))?.group_id;
    expect(topic(/^District of Columbia v. Heller/, 2007)).toBe("speech-religion-guns");
    expect(topic(/^Citizens United/, 2009)).toBe("elections");
    expect(topic(/^Obergefell/, 2014)).toBe("abortion-privacy-lgbtq");
    expect(topic(/^Bostock/, 2019)).toBe("abortion-privacy-lgbtq");
    expect(topic(/^Trump v. United States/, 2023)).toBe("presidential-agency-power");
    expect(topic(/^Trump, President of U.S. v. Hawaii/, 2017)).toBe("immigration");
    expect(topic(/^West Virginia v. Environmental/, 2021)).toBe("environment-energy");
    expect(topic(/^McGirt/, 2019)).toBe("states-tribes");
    expect(topic(/^Janus v. American/, 2017)).toBe("workers-unions");
    expect(topic(/^Miranda v. Arizona/, 1965)).toBe("crime-policing");
  });

  it("the committed outputs are the transform of the committed raw file", () => {
    const committed = readFileSync("pipeline/output/decisions_counts.json", "utf8");
    const normalized = `[\n${counts.map((r) => JSON.stringify(r)).join(",\n")}\n]\n`;
    expect(committed).toBe(normalized);
  });
});

describe("topics", () => {
  const area = (code: number | null) => ({ caseId: "1946-001", term: 1946, issueArea: code, issue: 10010, lawSupp: 200 }) as Parameters<typeof groupId>[0];
  const g = (o: Partial<DecisionGroupEntry> & { id: string }): DecisionGroupEntry => ({ label: o.id, description: "d", issues: [], law_supp: [], ...o });

  it("tries hand-picked cases, then codes in catalog order, then the issue area", () => {
    const picked = [g({ id: "p", cases: { "1946-001": "Case" } }), g({ id: "c", issues: [10010], issue_areas: ["a"] }), g({ id: "b", issue_areas: ["b"] })];
    expect(groupId(area(1), catalog, picked)).toBe("p");
    expect(groupId(area(2), catalog, picked.slice(1))).toBe("c");
    expect(groupId(area(2), catalog, [g({ id: "l", law_supp: [200] }), ...picked.slice(1)])).toBe("l");
    expect(groupId(area(2), catalog, [g({ id: "x", issue_areas: ["a"] }), g({ id: "b", issue_areas: ["b"] })])).toBe("b");
    expect(groupId(area(null), catalog, picked)).toBeNull();
    expect(() => groupId(area(2), catalog, [g({ id: "x", issue_areas: ["a"] })])).toThrow(/in no topic/);
  });

  it("fail the build on a bad catalog", () => {
    const codebook = scdbCodebook.parse(JSON.parse(readFileSync("pipeline/reference/scdb-codebook.json", "utf8")));
    const scope = new Set(["1946-001"]);
    const ok = [g({ id: "x", issue_areas: ["a"], issues: [10010] }), g({ id: "y", issue_areas: ["b"] })];
    expect(() => checkGroups(ok, catalog, codebook, scope)).not.toThrow();
    expect(() => checkGroups([ok[0]!], catalog, codebook, scope)).toThrow(/issue area b is in 0 topics/);
    expect(() => checkGroups([ok[0]!, g({ id: "y", issue_areas: ["b", "a"] })], catalog, codebook, scope)).toThrow(/issue area a is in 2 topics/);
    expect(() => checkGroups([ok[0]!, g({ id: "y", issue_areas: ["b"], issues: [10010] })], catalog, codebook, scope)).toThrow(/in both x and y/);
    expect(() => checkGroups([ok[0]!, g({ id: "y", issue_areas: ["b"], issues: [99999] })], catalog, codebook, scope)).toThrow(/not in the SCDB codebook/);
    expect(() => checkGroups([ok[0]!, g({ id: "y", issue_areas: ["b"], cases: { "2001-001": "Gone" } })], catalog, codebook, scope)).toThrow(/not a case on the page/);
  });
});

describe("case rows", () => {
  it("builds one row per case, and the gates catch a list that disagrees with the counts", async () => {
    const { buildCaseRows } = await import("./decisions");
    const sel = selectCases(parseScdb(SAMPLE));
    const rows = buildCaseRows(sel.cases, catalog, groups);
    expect(rows).toHaveLength(6);
    expect(rows[0]).toMatchObject({ date: "1946-11-18", name: "Case", cite: "1 U.S. 1", band: 0, direction: "liberal" });
    // 1 conservative, 2 liberal; 3 (unspecifiable) and blank carry no direction.
    expect(rows.map((r) => r.direction)).toEqual(["liberal", "conservative", null, null, null, null]);
  });
});

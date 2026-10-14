import { describe, expect, it } from "vitest";
import { diffIndex, summarise } from "./refugee-index-diff";

const r = (n: string, title = "t", date = "2026-01-01") => ({
  title,
  document_number: n,
  citation: null,
  publication_date: date,
  signing_date: null,
  subtype: "Presidential Determination",
  presidential_document_number: `No. ${n}`,
});

describe("diffIndex", () => {
  it("separates new, removed and retitled documents", () => {
    const d = diffIndex([r("a"), r("b"), r("c")], [r("a"), r("c", "new title"), r("d")]);
    expect(d.added.map((x) => x.document_number)).toEqual(["d"]);
    expect(d.removed.map((x) => x.document_number)).toEqual(["b"]);
    expect(d.changed.map((x) => x.after.document_number)).toEqual(["c"]);
  });
  it("says so when the index is unchanged", () => {
    expect(summarise(diffIndex([r("a")], [r("a")]))).toMatch(/No change to the index/);
  });
  it("names a new determination", () => {
    const text = summarise(diffIndex([], [r("2027-00001", "Presidential Determination on Refugee Admissions for Fiscal Year 2028")]));
    expect(text).toMatch(/Fiscal Year 2028/);
    expect(text).toContain("https://www.federalregister.gov/d/2027-00001");
  });
});

import { describe, expect, it } from "vitest";
import { fieldNamesOf, fieldTypesOf, paramsFromObject, parseQuery, runQuery, toCsv, type Query, type Row } from "./api-query";

const ROWS: Row[] = [
  { id: 1, country: "MEX", name: "Mexico", year: 2019, value: 10, date: "2019-05-01", tags: ["a"] },
  { id: 2, country: "CAN", name: "Canada", year: 2020, value: 30, date: "2020-01-15", tags: [] },
  { id: 3, country: "MEX", name: "Mexico", year: 2021, value: null, date: "2021-09-30", tags: ["b"] },
  { id: 4, country: "CHN", name: "China", year: 2021, value: 20, date: "2021-12-31", tags: [] },
];
const FIELDS = fieldNamesOf(ROWS);
const LIMITS = { defaultLimit: 100, maxLimit: 1000 };

function q(qs: string): Query {
  const r = parseQuery(new URLSearchParams(qs), FIELDS, LIMITS);
  if (!r.ok) throw new Error(r.error);
  return r.query;
}
const ids = (qs: string) => runQuery(ROWS, q(qs)).rows.map((r) => r.id);

describe("parseQuery", () => {
  it("defaults and clamps paging", () => {
    expect(q("")).toMatchObject({ limit: 100, offset: 0, filters: [], sort: [], fields: null });
    expect(q("limit=99999").limit).toBe(1000);
    expect(q("limit=0").limit).toBe(1);
    expect(q("offset=5").offset).toBe(5);
  });

  it("rejects unknown fields and bad numbers, naming the fix", () => {
    const bad = parseQuery(new URLSearchParams("contry=MEX"), FIELDS, LIMITS);
    expect(bad).toMatchObject({ ok: false });
    expect(bad.ok === false && bad.error).toContain("Available fields");
    expect(parseQuery(new URLSearchParams("limit=ten"), FIELDS, LIMITS).ok).toBe(false);
    expect(parseQuery(new URLSearchParams("sort=-nope"), FIELDS, LIMITS).ok).toBe(false);
    expect(parseQuery(new URLSearchParams("fields=id,nope"), FIELDS, LIMITS).ok).toBe(false);
    expect(parseQuery(new URLSearchParams("year="), FIELDS, LIMITS).ok).toBe(false);
    expect(parseQuery(new URLSearchParams("year=.."), FIELDS, LIMITS).ok).toBe(false);
  });
});

describe("runQuery filters", () => {
  it("equality, case-insensitive for strings", () => {
    expect(ids("country=MEX")).toEqual([1, 3]);
    expect(ids("country=mex")).toEqual([1, 3]);
    expect(ids("year=2021")).toEqual([3, 4]);
    expect(ids("country=MEX&year=2021")).toEqual([3]);
  });

  it("ranges on numbers and ISO dates", () => {
    expect(ids("year=2019..2020")).toEqual([1, 2]); // both ends included
    expect(ids("year=2021..")).toEqual([3, 4]);
    expect(ids("year=..2019")).toEqual([1]);
    expect(ids("date=2020-01-15..")).toEqual([2, 3, 4]);
    expect(ids("value=..20")).toEqual([1, 4]);
    expect(ids("value=0..")).toEqual([1, 2, 4]); // null never satisfies a range
    expect(ids("year=abc..")).toEqual([]); // not a number: matches nothing, never everything
  });

  it("does not match through nested values", () => {
    expect(ids("tags=a")).toEqual([]);
  });
});

describe("runQuery shaping", () => {
  it("sorts ascending and descending with nulls last", () => {
    expect(ids("sort=value")).toEqual([1, 4, 2, 3]);
    expect(ids("sort=-value")).toEqual([2, 4, 1, 3]);
    expect(ids("sort=-year,id")).toEqual([3, 4, 2, 1]);
  });

  it("reports the unpaged total, then pages and projects fields", () => {
    const r = runQuery(ROWS, q("sort=id&limit=2&offset=1&fields=id,name"));
    expect(r.total).toBe(4);
    expect(r.rows).toEqual([
      { id: 2, name: "Canada" },
      { id: 3, name: "Mexico" },
    ]);
  });
});

describe("paramsFromObject", () => {
  it("builds the same query from an MCP arguments object", () => {
    const p = paramsFromObject({ filters: { country: "MEX", year: "2020.." }, sort: ["-year", "id"], limit: 5 });
    expect(p.get("country")).toBe("MEX");
    expect(p.get("sort")).toBe("-year,id");
    expect(p.get("year")).toBe("2020..");
    expect(p.get("limit")).toBe("5");
  });
});

describe("field metadata and CSV", () => {
  it("infers a type per field from the first non-null value", () => {
    expect(fieldTypesOf(ROWS, FIELDS)).toMatchObject({ id: "number", name: "string", value: "number", tags: "array" });
  });

  it("quotes commas, quotes and newlines; nested values become JSON", () => {
    const csv = toCsv([{ a: 'x,"y"', b: ["p"], c: null, d: "l1\nl2" }], ["a", "b", "c", "d"]);
    expect(csv).toBe('a,b,c,d\r\n"x,""y""","[""p""]",,"l1\nl2"\r\n');
  });
});

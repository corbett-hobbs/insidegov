import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { clemencyYear, type ClemencyGrant } from "../../lib/clemency-entities";
import { fiscalYear, parseWarrantDetails, sentenceYearOf } from "./clemency";
import { buildGrants } from "./clemency-run";

const grants = buildGrants();
const count = (term: string, type: string) => grants.filter((g: ClemencyGrant) => g.term === term && g.type === type && !g.amended && g.people == null && !g.inGroup).length;
const years = (JSON.parse(readFileSync("pipeline/output/clemency_years.json", "utf8")) as { years: unknown[] }).years.map((y) => clemencyYear.parse(y));
const dojTotal = (term: string) => years.filter((y) => y.term === term).reduce((n, y) => ({ p: n.p + y.pardons, c: n.c + y.commutations, g: n.g + y.group }), { p: 0, c: 0, g: 0 });

describe("the recipient lists reconcile to DOJ's statistics", () => {
  // Listed vs counted. The two DOJ sources differ slightly, and the Data notes say so; a wider gap means the parser broke or DOJ changed a page.
  it.each([
    ["clinton", "p", 396, 396],
    ["clinton", "c", 65, 61],
    ["bush43", "p", 192, 189],
    ["bush43", "c", 11, 11],
    ["obama", "p", 210, 212],
    ["obama", "c", 1716, 1715],
    ["trump1", "p", 144, 144],
    ["trump1", "c", 94, 94],
    ["biden", "p", 80, 80],
    ["biden", "c", 181, 176],
  ] as const)("%s %s: %d listed, %d counted", (term, type, listed, counted) => {
    expect(count(term, type)).toBe(listed);
    const t = dojTotal(term);
    expect(type === "p" ? t.p : t.c).toBe(counted);
  });
  it("keeps Biden's group warrants at DOJ's count", () => {
    expect(dojTotal("biden").g).toBe(3989);
    expect(dojTotal("biden").c + dojTotal("biden").g).toBe(4165);
  });
  it("gives the current term's counts from its own list, with proclamations in the group", () => {
    const t = dojTotal("trump2");
    expect(t.p).toBe(count("trump2", "p"));
    expect(t.c).toBe(count("trump2", "c"));
    expect(t.g).toBe(1577);
  });
});

describe("the settled data rules", () => {
  it("counts an amended warrant once", () => {
    const z = grants.filter((g) => g.name === "Imaad Shah Zuberi");
    expect(z.map((g) => [g.date, Boolean(g.amended)])).toEqual([["2025-05-28", false], ["2025-10-01", true]]);
  });
  it("keeps Bush's 18 pardons dated January 1, 2009 inside his last 90 days and fiscal 2009, whichever real date they had", () => {
    const b = grants.filter((g) => g.term === "bush43" && g.date === "2009-01-01");
    expect(b).toHaveLength(18);
    expect(fiscalYear("2008-10-22")).toBe(2009);
  });
  it("never publishes register numbers", () => {
    expect(readFileSync("pipeline/output/clemency_grants.json", "utf8")).not.toMatch(/\b\d{5}-\d{3}\b/);
  });
  it("reads warrant 2's disclosure table in full", () => {
    expect(parseWarrantDetails(readFileSync("pipeline/raw/clemency/biden-warrant-1387881.txt", "utf8"))).toHaveLength(561);
  });
  it("ignores dollar amounts when reading a sentence's year", () => {
    expect(sentenceYearOf("$2,014 fine; $1990 restitution (May 2, 2003)", 2010)).toBe(2003);
  });
  it("assigns Clinton his last-day grants, not Bush", () => {
    expect(grants.filter((g) => g.date === "2001-01-20").every((g) => g.term === "clinton")).toBe(true);
  });
});

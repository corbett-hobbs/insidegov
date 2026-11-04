import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CLEMENCY_TAKEAWAYS as T, HERO_CONTEXT } from "../components/clemency/takeaways";
import { SOURCE_LINKS } from "./source-links";
import { buildClemencyPayload } from "./clemency-derive";
import type { ClemencyFile, ClemencyGrant } from "./clemency-types";

/** Every figure a Pardons takeaway quotes, against pipeline/output. A refresh that makes a sentence untrue fails here: rewrite the sentence, then this. */
const file = JSON.parse(readFileSync("pipeline/output/clemency_years.json", "utf8")) as ClemencyFile;
const grants = JSON.parse(readFileSync("pipeline/output/clemency_grants.json", "utf8")) as ClemencyGrant[];
const d = buildClemencyPayload(file, grants);
const p = (t: string) => d.presidents.find((x) => x.term === t)!;
const round = (a: number, b: number) => Math.round((a / b) * 100);
const fy = (y: number) => file.years.filter((r) => r.fy === y);
const sum = (rows: typeof file.years, f: (r: (typeof file.years)[number]) => number) => rows.reduce((n, r) => n + f(r), 0);
const all = (r: (typeof file.years)[number]) => r.pardons + r.commutations + r.group;
const allFy = [...new Set(file.years.map((r) => r.fy))];
const say = (text: string, ...bits: string[]) => bits.forEach((b) => expect(text).toContain(b));

describe("the Pardons takeaways", () => {
  it("hero", () => {
    const peak = Math.max(...allFy.map((y) => sum(fy(y), all)));
    expect(sum(fy(2025), all)).toBe(peak);
    expect(Math.round(peak / 100) * 100).toBe(5700);
    expect(Math.round(sum(fy(2025), (r) => r.group) / 100) * 100).toBe(5500);
    const noGroup = allFy.map((y) => ({ y, n: sum(fy(y), (r) => r.pardons + r.commutations) })).sort((a, b) => b.n - a.n)[0]!;
    expect(noGroup).toEqual({ y: 2017, n: 1186 });
    expect(sum(fy(2017).filter((r) => r.term === "obama"), all) / 1186).toBeGreaterThan(0.99);
    expect(Math.max(...allFy.filter((y) => y <= 2015).map((y) => sum(fy(y), all)))).toBe(258);
    say(T.hero.takeaway, "about 5,700", "about 5,500", "1,186", "258");
  });
  it("context line", () => {
    const b = grants.filter((g) => g.term === "biden" && g.people);
    expect(b.map((g) => g.people).sort()).toEqual([1499, 2490]);
    expect(file.proclamations.find((x) => x.number === 10887)?.people).toBe(1500);
    say(HERO_CONTEXT.text, "1,499", "2,490", "about 1,500");
    for (const s of HERO_CONTEXT.sources!) expect(SOURCE_LINKS[s.id as keyof typeof SOURCE_LINKS]).toBeTruthy();
  });
  it("presidents", () => {
    expect(p("biden").total).toBe(4245);
    expect(Math.max(...d.presidents.map((x) => x.total))).toBe(4245);
    expect(p("biden").group).toBe(3989);
    expect(Math.round(p("trump2").total / 10) * 10).toBe(1740);
    expect(Math.round(p("trump2").group / 10) * 10).toBe(1580);
    expect(file.updated.slice(0, 7)).toBe("2026-10");
    say(T.presidents.takeaway, "4,245", "3,989", "about 1,740", "about 1,580", "October 2026");
  });
  it("outcomes", () => {
    const share = (t: string) => Math.round(p(t).outcome!.share * 100);
    expect(["clinton", "bush43", "obama", "trump1", "biden"].map(share)).toEqual([9, 2, 7, 3, 15]);
    expect(p("trump1").outcome).toMatchObject({ closed: 8123, denied: 180 });
    say(T.outcomes.takeaway, "9%", "2%", "7%", "3%", "8,123", "180", "15%");
  });
  it("offenses", () => {
    const s = (t: string, c: "drugs" | "fraud" | "regulatory") => round(p(t).offense.counts[c], p(t).offense.n);
    expect([s("obama", "drugs"), s("biden", "drugs"), s("trump2", "drugs"), s("trump2", "fraud"), s("trump2", "regulatory")]).toEqual([91, 85, 17, 25, 24]);
    say(T.offenses.takeaway, "91%", "85%", "17%", "25%", "24%");
  });
  it("timing", () => {
    const l = (t: string) => round(p(t).timing.counts.last90, p(t).timing.n);
    expect([l("biden"), l("trump1")]).toEqual([96, 82]);
    expect(round(p("trump2").timing.counts.first, p("trump2").timing.n)).toBe(97);
    say(T.timing.takeaway, "96%", "82%", "97%");
  });
  it("years from sentence", () => {
    const m = ["clinton", "bush43", "obama", "trump1", "biden"].map((t) => p(t).age!.median);
    expect(Math.min(...m)).toBe(12);
    expect(Math.max(...m)).toBe(24);
    expect(p("trump2").age!.median).toBe(2);
    say(T.age.takeaway, "2 years", "between 12 and 24");
  });
  it("petitions", () => {
    const at = (y: number) => d.pending.find((x) => x.fy === y)!.value;
    expect(at(2008)).toBe(3055);
    expect(at(2023)).toBe(17596);
    expect(Math.max(...d.pending.map((x) => x.value))).toBe(17596);
    expect(d.endOfBidenPending).toBe(10418);
    say(T.pending.takeaway, "3,055", "17,596", "10,418");
  });
});

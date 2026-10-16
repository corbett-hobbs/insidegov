import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EO_TAKEAWAYS } from "../components/executive-orders/takeaways";

/**
 * Every figure an Executive orders card's takeaway cites, checked against the
 * committed pipeline output (the page aggregates these files as-is, by signing
 * year). A data refresh that makes a sentence untrue fails here: rewrite the
 * takeaway in components/executive-orders/takeaways.ts, then this check.
 * The data starts in 1994, so Clinton's 1993 orders are missing and his term
 * total is not a full term; no takeaway compares it.
 */

type Order = { signing_date: string; term_id: string; topic: string };
type Admin = { term_id: string; president: string; start: string; end: string | null };
const orders = JSON.parse(readFileSync("pipeline/output/executive_orders.json", "utf8")) as Order[];
const admins = JSON.parse(readFileSync("pipeline/output/administrations.json", "utf8")) as Admin[];

const count = (os: Order[]) => {
  const m = new Map<number, number>();
  for (const o of os) m.set(Number(o.signing_date.slice(0, 4)), (m.get(Number(o.signing_date.slice(0, 4))) ?? 0) + 1);
  return m;
};
const byYear = count(orders);
const tradeByYear = count(orders.filter((o) => o.topic === "trade"));
const years = [...byYear.keys()].sort((a, b) => a - b);
const between = (from: number, to: number) => years.filter((y) => y >= from && y <= to);
const termOf = (president: string, startYear: number) => admins.find((a) => a.president === president && a.start.startsWith(`${startYear}-`))!;

const cases: Record<keyof typeof EO_TAKEAWAYS, { says: string[]; check: () => void }> = {
  perYear: {
    says: ["From 1994 through 2024", "19 to 91 executive orders a year", "In 2025, the year Trump returned, there were 238", "34 were on trade", "never passed 5 in a year"],
    check: () => {
      expect(years[0]).toBe(1994);
      const before = between(1994, 2024).map((y) => byYear.get(y)!);
      expect(Math.min(...before)).toBe(19);
      expect(Math.max(...before)).toBe(91);
      expect(termOf("Donald Trump", 2025).end).toBeNull();
      expect(byYear.get(2025)).toBe(238);
      expect(tradeByYear.get(2025)).toBe(34);
      expect(Math.max(...between(1994, 2024).map((y) => tradeByYear.get(y) ?? 0))).toBe(5);
    },
  },
};

describe("Executive orders card takeaways", () => {
  for (const [key, c] of Object.entries(cases) as [keyof typeof EO_TAKEAWAYS, (typeof cases)[keyof typeof EO_TAKEAWAYS]][]) {
    it(`${EO_TAKEAWAYS[key].title}: "${EO_TAKEAWAYS[key].takeaway.slice(0, 48)}…" holds`, () => {
      for (const phrase of c.says) expect(EO_TAKEAWAYS[key].takeaway).toContain(phrase);
      c.check();
    });
  }

  it("stays short: two sentences, at most 45 words", () => {
    for (const s of Object.values(EO_TAKEAWAYS)) {
      expect(s.takeaway.split(/(?<=[.;])\s/).filter((x) => x.endsWith(".")).length, s.title).toBeLessThanOrEqual(2);
      expect(s.takeaway.split(/\s+/).length, s.title).toBeLessThanOrEqual(45);
    }
  });
});

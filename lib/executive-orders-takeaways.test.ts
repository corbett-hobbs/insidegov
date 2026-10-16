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
    says: ["19 to 91 orders a year from 1994 through 2024", "238 in 2025", "the most of any year", "Trump signed 225 of them", "Biden’s 162 in his whole term", "34 on trade", "never topped 5 a year"],
    check: () => {
      expect(years[0]).toBe(1994);
      const before = between(1994, 2024).map((y) => byYear.get(y)!);
      expect(Math.min(...before)).toBe(19);
      expect(Math.max(...before)).toBe(91);
      expect(byYear.get(2025)).toBe(238);
      expect(Math.max(...byYear.values())).toBe(238);
      // Jan 1–19, 2025 was Biden's (13 orders), so Trump's share of the year is counted by term.
      const trump2 = termOf("Donald Trump", 2025);
      const trump2025 = orders.filter((o) => o.signing_date.startsWith("2025-") && o.term_id === trump2.term_id);
      expect(trump2025).toHaveLength(225);
      expect(trump2025.filter((o) => o.topic === "trade")).toHaveLength(34);
      const biden = termOf("Joe Biden", 2021);
      expect(biden.end).not.toBeNull();
      expect(orders.filter((o) => o.term_id === biden.term_id)).toHaveLength(162);
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

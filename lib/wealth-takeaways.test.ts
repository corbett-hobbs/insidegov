import { describe, expect, it } from "vitest";
import { WEALTH_TAKEAWAYS } from "../components/wealth/takeaways";
import { compactDollars } from "./format-number";
import { isListEligible, median, wealthCohort, type WealthMember } from "./wealth-derive";
import { firstNetWorth, latestNetWorth, netWorthChange } from "./wealth-scatter";
import { loadRealWealthMembers } from "./wealth-test-data";

/**
 * Every figure a Congress wealth card's takeaway cites, checked against the
 * committed pipeline output through the same derivation the page uses
 * (`wealthCohort` for the scatter, `isListEligible` for the lists), for the
 * default view: both chambers, both parties, no state. A data refresh that
 * makes a sentence untrue fails here: rewrite the takeaway in
 * components/wealth/takeaways.ts, then this check. Figures are band-midpoint
 * estimates, so each is rounded the way the sentence states it.
 */

const members = loadRealWealthMembers();
const cohort = wealthCohort(members);
const ranked = members.filter(isListEligible);
const dem = (pool: WealthMember[]) => pool.filter((m) => m.caucus === "Democrat");
const rep = (pool: WealthMember[]) => pool.filter((m) => m.caucus === "Republican");
const pct = (part: number, whole: number) => Math.round((part / whole) * 100);
const grew = (pool: WealthMember[]) => pool.filter((m) => netWorthChange(m) > 0).length;
const latestYear = (m: WealthMember) => m.points[m.points.length - 1].year;
/** "mostly for 2025": no filing later than 2025, and most latest filings cover it. */
const mostly2025 = (pool: WealthMember[]) => {
  expect(Math.max(...pool.map(latestYear))).toBe(2025);
  expect(pool.filter((m) => latestYear(m) === 2025).length / pool.length).toBeGreaterThan(0.9);
};

const cases: Record<keyof typeof WEALTH_TAKEAWAYS, { says: string[]; check: () => void }> = {
  scatter: {
    says: ["as early as 2013", "mostly for 2025", "from about $970K to $1.6M", "Most dots sit above the no-change line", "77% of Democrats", "67% of Republicans grew"],
    check: () => {
      expect(Math.min(...cohort.map((m) => m.points[0].year))).toBe(2013);
      mostly2025(cohort);
      expect(compactDollars(median(cohort.map(firstNetWorth))!)).toBe("$970K");
      expect(compactDollars(median(cohort.map(latestNetWorth))!)).toBe("$1.6M");
      expect(grew(cohort)).toBeGreaterThan(cohort.length / 2);
      expect(pct(grew(dem(cohort)), dem(cohort).length)).toBe(77);
      expect(pct(grew(rep(cohort)), rep(cohort).length)).toBe(67);
    },
  },
  highest: {
    says: ["292 of 500 ranked members (58%)", "more than $1M", "mostly for 2025", "17 more than $100M", "$1.9M for Republicans", "$1.4M for Democrats"],
    check: () => {
      expect(ranked.length).toBe(500);
      mostly2025(ranked);
      const worth = ranked.map(latestNetWorth);
      expect(worth.filter((v) => v > 1e6).length).toBe(292);
      expect(pct(292, 500)).toBe(58);
      expect(worth.filter((v) => v > 1e8).length).toBe(17);
      expect(compactDollars(median(rep(ranked).map(latestNetWorth))!)).toBe("$1.9M");
      expect(compactDollars(median(dem(ranked).map(latestNetWorth))!)).toBe("$1.4M");
    },
  },
  lowest: {
    says: ["83 of 500 ranked members", "(49 Democrats, 34 Republicans)", "more debt than assets", "mostly for 2025", "below zero", "Another 25 were estimated at under $100K"],
    check: () => {
      expect(ranked.length).toBe(500);
      mostly2025(ranked);
      const below = ranked.filter((m) => latestNetWorth(m) < 0);
      expect(below.length).toBe(83);
      expect(dem(below).length).toBe(49);
      expect(rep(below).length).toBe(34);
      expect(ranked.filter((m) => latestNetWorth(m) >= 0 && latestNetWorth(m) < 100_000).length).toBe(25);
    },
  },
};

describe("Congress wealth card takeaways", () => {
  for (const [key, c] of Object.entries(cases) as [keyof typeof WEALTH_TAKEAWAYS, (typeof cases)[keyof typeof WEALTH_TAKEAWAYS]][]) {
    it(`${WEALTH_TAKEAWAYS[key].title}: "${WEALTH_TAKEAWAYS[key].takeaway.slice(0, 48)}…" holds`, () => {
      for (const phrase of c.says) expect(WEALTH_TAKEAWAYS[key].takeaway).toContain(phrase);
      c.check();
    });
  }

  it("stays short: two sentences, at most 45 words", () => {
    for (const s of Object.values(WEALTH_TAKEAWAYS)) {
      expect(s.takeaway.split(/(?<=[.;])\s/).filter((x) => x.endsWith(".")).length, s.title).toBeLessThanOrEqual(2);
      expect(s.takeaway.split(/\s+/).length, s.title).toBeLessThanOrEqual(45);
    }
  });
});

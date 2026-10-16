import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COURT_TAKEAWAYS } from "../components/court/takeaways";
import { buildCourtPayload } from "./court-derive";
import type { CourtMedianProbability, CourtTermRow, Justice, MqScore } from "./court-entities";
import { fmtScore } from "./court-types";

/**
 * Every figure a Supreme Court ideology card's takeaway cites, checked against
 * the committed pipeline output through the same payload the page draws
 * (lib/court-derive.ts: split terms use the post-replacement record, career is
 * the unweighted mean of a justice's per-term scores). A data refresh that makes
 * a sentence untrue fails here: rewrite the takeaway in
 * components/court/takeaways.ts, then this check.
 */

const read = <T,>(name: string) => JSON.parse(readFileSync(`pipeline/output/court/${name}`, "utf8")) as T[];
const justices = read<Justice>("justices.json");
const data = buildCourtPayload({
  justices,
  scores: read<MqScore>("mq_scores.json"),
  terms: read<CourtTermRow>("court_terms.json"),
  probabilities: read<CourtMedianProbability>("court_median_probabilities.json"),
});
const byId = new Map(data.justices.map((j) => [j.id, j]));
const appointed = new Map(justices.map((j) => [j.justice_id, j.appointment_start]));
const yearOf = (id: number) => Number(appointed.get(id)!.slice(0, 4));
const termsIn = (from: number, to: number) => data.terms.filter((t) => t.term >= from && t.term <= to);
const medianParty = (t: (typeof data.terms)[number]) => byId.get(t.medianJusticeId)!.party;
const named = (short: string) => data.justices.find((j) => j.short === short)!;
const scoreIn = (short: string, term: number) => { const j = named(short); return j.s[term - j.t0]; };
const latest = (ids: number[]) => ids.reduce((a, b) => (appointed.get(a)! > appointed.get(b)! ? a : b));

const cases: Record<keyof typeof COURT_TAKEAWAYS, { says: string[]; check: () => void }> = {
  strip: {
    says: ["From the 1990 term through the 2024 term", "was a Republican appointee every term", "From 1937 through 1989", "Democratic appointee in 44 of 53 terms"],
    check: () => {
      expect(data.firstTerm).toBe(1937);
      expect(data.lastTerm).toBe(2024);
      expect(termsIn(1990, 2024).every((t) => medianParty(t) === "R")).toBe(true);
      expect(medianParty(data.terms[1989 - data.firstTerm])).toBe("D");
      const before = termsIn(1937, 1989);
      expect(before.length).toBe(53);
      expect(before.filter((t) => medianParty(t) === "D").length).toBe(44);
    },
  },
  presidents: {
    says: ["Nine Democratic appointees, most recently White in 1962, have conservative career averages", "six Republican appointees, most recently Souter in 1990, liberal ones", "All 11 justices appointed from 1991 through 2022", "Republican conservative, Democratic liberal"],
    check: () => {
      const dRight = data.justices.filter((j) => j.party === "D" && j.career > 0).map((j) => j.id);
      const rLeft = data.justices.filter((j) => j.party === "R" && j.career < 0).map((j) => j.id);
      expect(dRight.length).toBe(9);
      expect(byId.get(latest(dRight))!.short).toBe("White");
      expect(yearOf(latest(dRight))).toBe(1962);
      expect(rLeft.length).toBe(6);
      expect(byId.get(latest(rLeft))!.short).toBe("Souter");
      expect(yearOf(latest(rLeft))).toBe(1990);
      const later = data.justices.filter((j) => appointed.get(j.id)! > appointed.get(named("Souter").id)!);
      expect(later.length).toBe(11);
      expect(Math.min(...later.map((j) => yearOf(j.id)))).toBe(1991);
      expect(Math.max(...later.map((j) => yearOf(j.id)))).toBe(2022);
      expect(later.every((j) => (j.party === "R" ? j.career > 0 : j.career < 0))).toBe(true);
    },
  },
  trajectory: {
    says: ["lowest in the 1963 term (−1.13)", "highest in 1988 (1.10)", "from 1969 through 2024 it fell below zero only in 2014, 2015 and 2016", "Blackmun went from 1.63 in the 1971 term to −1.93 in 1993"],
    check: () => {
      const lo = data.terms.reduce((a, b) => (b.median < a.median ? b : a));
      const hi = data.terms.reduce((a, b) => (b.median > a.median ? b : a));
      expect([lo.term, fmtScore(lo.median)]).toEqual([1963, "−1.13"]);
      expect([hi.term, fmtScore(hi.median)]).toEqual([1988, "1.10"]);
      expect(termsIn(1969, 2024).filter((t) => t.median < 0).map((t) => t.term)).toEqual([2014, 2015, 2016]);
      expect(fmtScore(scoreIn("Blackmun", 1971))).toBe("1.63");
      expect(fmtScore(scoreIn("Blackmun", 1993))).toBe("−1.93");
      // Those are his highest and lowest terms, and 1993 was his last.
      const b = named("Blackmun");
      expect(Math.max(...b.s)).toBe(scoreIn("Blackmun", 1971));
      expect(Math.min(...b.s)).toBe(scoreIn("Blackmun", 1993));
      expect(b.t1).toBe(1993);
    },
  },
};

describe("Supreme Court ideology card takeaways", () => {
  for (const [key, c] of Object.entries(cases) as [keyof typeof COURT_TAKEAWAYS, (typeof cases)[keyof typeof COURT_TAKEAWAYS]][]) {
    it(`${COURT_TAKEAWAYS[key].title}: "${COURT_TAKEAWAYS[key].takeaway.slice(0, 48)}…" holds`, () => {
      for (const phrase of c.says) expect(COURT_TAKEAWAYS[key].takeaway).toContain(phrase);
      c.check();
    });
  }

  it("stays short: two sentences, at most 45 words", () => {
    for (const s of Object.values(COURT_TAKEAWAYS)) {
      expect(s.takeaway.split(/(?<=[.;])\s/).filter((x) => x.endsWith(".")).length, s.title).toBeLessThanOrEqual(2);
      expect(s.takeaway.split(/\s+/).length, s.title).toBeLessThanOrEqual(45);
    }
  });
});

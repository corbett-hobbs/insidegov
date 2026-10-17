import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COURT_CONTEXT, COURT_TAKEAWAYS } from "../components/court/takeaways";
import { SOURCE_LINKS } from "./source-links";
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

/**
 * The context lines (rule 7d). Dates, appointing presidents, Senate votes and medians come from pipeline/output/court (FJC
 * service dates and votes in justices.json, the median in court_terms.json). Outside the pipeline, pinned to the phrase the line
 * uses: the seats each nominee filled ("Barrett … Ginsburg", "Gorsuch … Scalia") from the Senate's nominations table, and the
 * April 6, 2017 change from Senate roll calls 115-1-105 (cloture on Gorsuch rejected 55–45, "Required for Majority: 3/5") and
 * 115-1-110 (agreed 55–45, "Required for Majority: 1/2").
 */
const raw = new Map(justices.map((j) => [j.name.last, j]));
const termRow = (term: number) => read<CourtTermRow>("court_terms.json").filter((t) => t.term === term);
const seatedOn = (iso: string) => justices.filter((j) => j.service_start <= iso && (j.service_end === null || j.service_end >= iso));
const contextCases: Record<keyof typeof COURT_CONTEXT, { says: string[]; links: Record<string, string>; check: () => void }> = {
  strip: {
    says: ["Ginsburg died on September 18, 2020", "the Senate confirmed Barrett, a Donald J. Trump nominee, 52–48 on October 26", "giving Republican appointees six of the nine seats", "In the 2020 term the likeliest median moved from Chief Justice Roberts to Kavanaugh"],
    links: { fjc: "fjc\\.gov", "martin-quinn": "mqscores" },
    check: () => {
      const g = raw.get("Ginsburg")!;
      expect([g.service_end, g.death_year]).toEqual(["2020-09-18", 2020]);
      const b = raw.get("Barrett")!;
      expect([b.appointing_president, b.confirmation_date, b.service_start]).toEqual(["Donald J. Trump", "2020-10-26", "2020-10-26"]);
      expect(b.senate_vote).toEqual({ ayes: 52, nays: 48 });
      // Before Ginsburg's death five of nine were Republican appointees; once Barrett sat, six.
      const rCount = (iso: string) => seatedOn(iso).filter((j) => j.appointing_party === "Republican").length;
      expect([seatedOn("2020-09-17").length, rCount("2020-09-17")]).toEqual([9, 5]);
      expect([seatedOn("2020-10-27").length, rCount("2020-10-27")]).toEqual([9, 6]);
      const roberts = justices.find((j) => j.name.full.startsWith("John Glover Roberts"))!;
      expect(roberts.chief_justice_appointment).not.toBeNull();
      expect(termRow(2019).map((t) => t.median_justice_id)).toEqual([roberts.justice_id]);
      expect(termRow(2020).map((t) => t.median_justice_id)).toEqual([raw.get("Kavanaugh")!.justice_id]);
    },
  },
  trajectory: {
    says: ["On April 7, 2017", "a day after letting a simple majority end debate on Supreme Court nominees", "the Senate confirmed Gorsuch, a Donald J. Trump nominee, 54–45 to Scalia’s seat", "In 2017, his first full term, the median went from −0.06 to 0.29"],
    links: { "senate-vote-gorsuch-cloture": "senate\\.gov/legislative/LIS/roll_call_votes/vote1151/vote_115_1_00110", "senate-scotus-nominations": "senate\\.gov/legislative/nominations", "martin-quinn": "mqscores" },
    check: () => {
      const g = raw.get("Gorsuch")!;
      expect([g.appointing_president, g.confirmation_date]).toEqual(["Donald J. Trump", "2017-04-07"]);
      expect(g.senate_vote).toEqual({ ayes: 54, nays: 45 });
      // Scalia's seat sat empty from his death until Gorsuch, who joined late in the 2016 term, so 2017 is his first full one.
      expect(raw.get("Scalia")!.service_end).toBe("2016-02-13");
      expect(seatedOn("2016-10-03").length).toBe(8);
      expect(named("Gorsuch").t0).toBe(2016);
      expect(fmtScore(termRow(2016)[0].median_score)).toBe("−0.06");
      expect(fmtScore(termRow(2017)[0].median_score)).toBe("0.29");
      // The last of the takeaway's three terms below zero, and the first term after it.
      expect(termsIn(2017, 2024).every((t) => t.median > 0)).toBe(true);
    },
  },
};

describe("Supreme Court ideology context lines", () => {
  for (const [key, c] of Object.entries(contextCases) as [keyof typeof COURT_CONTEXT, (typeof contextCases)[keyof typeof COURT_CONTEXT]][]) {
    it(`${key}: holds and names real sources`, () => {
      for (const phrase of c.says) expect(COURT_CONTEXT[key].text).toContain(phrase);
      expect(COURT_CONTEXT[key].sources.map((s) => s.id).sort()).toEqual(Object.keys(c.links).sort());
      for (const [id, part] of Object.entries(c.links)) expect(SOURCE_LINKS[id as keyof typeof SOURCE_LINKS], id).toMatch(new RegExp(`^https://.*${part}`));
      c.check();
    });
  }

  it("every context line belongs to a card, stays short and makes no causal or loaded claim", () => {
    expect(Object.keys(COURT_CONTEXT).sort()).toEqual(Object.keys(contextCases).sort());
    for (const [key, line] of Object.entries(COURT_CONTEXT)) {
      expect(line.text.split(/(?<=[a-z0-9]\.)\s+(?=[A-Z])/).length, key).toBeLessThanOrEqual(2);
      expect(line.text.split(/\s+/).length, key).toBeLessThanOrEqual(45);
      expect(line.text, key).not.toMatch(/\b(because|due to|caused|led to|drove|thanks to|extreme|motive)/i);
    }
  });
});

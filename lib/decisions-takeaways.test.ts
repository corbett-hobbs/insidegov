import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DECISIONS_TAKEAWAYS } from "../components/decisions/takeaways";
import { buildDecisionsPayload, sumBucket } from "./decisions-derive";
import type { DecisionCountRow, DecisionsMeta } from "./decisions-entities";
import { administration } from "./executive-orders-entities";
import { HISTORICAL_ADMINISTRATIONS } from "./troops-presidents";

/**
 * Every figure a Supreme Court decisions card's takeaway cites, checked against the committed pipeline output (the page
 * sums `decisions_counts.json` as-is: one row per term and issue area, dissent bands d0..d4). The takeaways describe the
 * default view: every issue area, landmark filter off, every term. A data refresh that makes a sentence untrue fails here:
 * rewrite the takeaway in components/decisions/takeaways.ts, then this check. Shares round the way the page's `fmtPct` does.
 */

type Row = { term: number; issue_area_id: string | null; n: number; d0: number; d1: number; d2: number; d3: number; d4: number };
type Meta = { first_term: number; data_through_term: number; case_count: number; issue_areas: { id: string; label: string }[] };
const rows = JSON.parse(readFileSync("pipeline/output/decisions_counts.json", "utf8")) as Row[];
const meta = JSON.parse(readFileSync("pipeline/output/decisions_meta.json", "utf8")) as Meta;
const caseRows = JSON.parse(readFileSync("pipeline/output/decisions_cases.json", "utf8")) as { term: number; band: number }[];

type Bucket = [number, number, number, number, number];
const add = (b: Bucket, r: Row) => [r.d0, r.d1, r.d2, r.d3, r.d4].forEach((x, i) => (b[i] += x));
const total = (b: Bucket) => b.reduce((a, x) => a + x, 0);
const pct = (b: Bucket, k: number) => Math.round((b[k] / total(b)) * 100);

const byTerm = new Map<number, Bucket>();
const byArea = new Map<string, Bucket>();
const all: Bucket = [0, 0, 0, 0, 0];
for (const r of rows) {
  if (!byTerm.has(r.term)) byTerm.set(r.term, [0, 0, 0, 0, 0]);
  add(byTerm.get(r.term)!, r);
  add(all, r);
  if (r.issue_area_id === null) continue;
  if (!byArea.has(r.issue_area_id)) byArea.set(r.issue_area_id, [0, 0, 0, 0, 0]);
  add(byArea.get(r.issue_area_id)!, r);
}
const terms = [...byTerm.keys()].sort((a, b) => a - b);
const cases = (t: number) => total(byTerm.get(t)!);
const between = (from: number, to: number) => terms.filter((t) => t >= from && t <= to);
const termsWhere = (f: (b: Bucket) => number, v: number) => terms.filter((t) => f(byTerm.get(t)!) === v);
const share = (k: number) => (b: Bucket) => pct(b, k);
/** Issue areas ranked by a band's exact share, highest first. */
const rankBy = (k: number) => [...byArea].sort(([, a], [, b]) => b[k] / total(b) - a[k] / total(a)).map(([id]) => id);

const claims: Record<keyof typeof DECISIONS_TAKEAWAYS, { says: string[]; check: () => void }> = {
  cases: {
    says: ["at least 129 argued cases every term from 1970 through 1989", "a high of 156 in the 1972 and 1983 terms", "From 1993 through 2025 no term topped 94", "four had 57, the fewest"],
    check: () => {
      expect(Math.min(...between(1970, 1989).map(cases))).toBe(129);
      expect(cases(1969)).toBeLessThan(129);
      const peak = Math.max(...terms.map(cases));
      expect(peak).toBe(156);
      expect(terms.filter((t) => cases(t) === peak)).toEqual([1972, 1983]);
      expect(Math.max(...between(1993, 2025).map(cases))).toBe(94);
      expect(cases(1992)).toBeGreaterThan(94);
      const low = Math.min(...terms.map(cases));
      expect(low).toBe(57);
      expect(terms.filter((t) => cases(t) === low)).toHaveLength(4);
      expect(terms.filter((t) => cases(t) === low).every((t) => t >= 1993)).toBe(true);
    },
  },
  split: {
    says: ["From the 1946 through 2025 terms, 38% of argued cases were unanimous and 18% split 5–4", "ranged from 2% in the 1969 term to 34% in 2006", "the unanimous share peaked at 61% in 2013"],
    check: () => {
      expect(pct(all, 0)).toBe(38);
      expect(pct(all, 4)).toBe(18);
      const fiveFour = terms.map((t) => byTerm.get(t)![4] / cases(t));
      expect(terms[fiveFour.indexOf(Math.min(...fiveFour))]).toBe(1969);
      expect(terms[fiveFour.indexOf(Math.max(...fiveFour))]).toBe(2006);
      expect(pct(byTerm.get(1969)!, 4)).toBe(2);
      expect(pct(byTerm.get(2006)!, 4)).toBe(34);
      const unanimous = terms.map((t) => byTerm.get(t)![0] / cases(t));
      expect(terms[unanimous.indexOf(Math.max(...unanimous))]).toBe(2013);
      expect(termsWhere(share(0), 61)).toEqual([2013]);
    },
  },
  areas: {
    says: ["Over the 1946 through 2025 terms", "First Amendment cases split 5–4 most often, 25% of the time", "followed by criminal procedure at 23%", "Judicial power cases were the most often unanimous, at 51%"],
    check: () => {
      expect(rankBy(4).slice(0, 2)).toEqual(["first-amendment", "criminal-procedure"]);
      expect(pct(byArea.get("first-amendment")!, 4)).toBe(25);
      expect(pct(byArea.get("criminal-procedure")!, 4)).toBe(23);
      expect(rankBy(0)[0]).toBe("judicial-power");
      expect(pct(byArea.get("judicial-power")!, 0)).toBe(51);
      // The labels the takeaway uses are the page's own.
      const label = (id: string) => meta.issue_areas.find((a) => a.id === id)!.label;
      expect([label("first-amendment"), label("criminal-procedure"), label("judicial-power")]).toEqual(["First Amendment", "Criminal procedure", "Judicial power"]);
    },
  },
};

describe("Supreme Court decisions card takeaways", () => {
  it("covers the default window: the 1946 through 2025 terms, every case", () => {
    expect(terms[0]).toBe(1946);
    expect(terms[terms.length - 1]).toBe(2025);
    expect([meta.first_term, meta.data_through_term]).toEqual([1946, 2025]);
    expect(terms).toEqual(between(1946, 2025));
    expect(total(all)).toBe(meta.case_count);
    expect(caseRows).toHaveLength(meta.case_count);
  });

  it("card 1's bars, unfiltered, are every case in the term (\"Other areas\" holds the cases with no issue area)", () => {
    const admins = [...HISTORICAL_ADMINISTRATIONS, ...(JSON.parse(readFileSync("pipeline/output/administrations.json", "utf8")) as unknown[]).map((r) => administration.parse(r))];
    const d = buildDecisionsPayload(rows as DecisionCountRow[], meta as unknown as DecisionsMeta, [], admins);
    expect(d.unclassified).toBeGreaterThan(0);
    d.terms.forEach((t, ti) => {
      const drawn = d.topAreas.reduce((n, ai) => n + sumBucket(d.by[ai][ti]), sumBucket(d.other[ti]));
      expect(drawn, String(t)).toBe(cases(t));
    });
  });

  for (const [key, c] of Object.entries(claims) as [keyof typeof DECISIONS_TAKEAWAYS, (typeof claims)[keyof typeof DECISIONS_TAKEAWAYS]][]) {
    it(`${DECISIONS_TAKEAWAYS[key].title}: "${DECISIONS_TAKEAWAYS[key].takeaway.slice(0, 48)}…" holds`, () => {
      for (const phrase of c.says) expect(DECISIONS_TAKEAWAYS[key].takeaway).toContain(phrase);
      c.check();
    });
  }

  it("stays short: two sentences, at most 45 words", () => {
    for (const s of Object.values(DECISIONS_TAKEAWAYS)) {
      expect(s.takeaway.split(/(?<=[.;])\s/).filter((x) => x.endsWith(".")).length, s.title).toBeLessThanOrEqual(2);
      expect(s.takeaway.split(/\s+/).length, s.title).toBeLessThanOrEqual(45);
    }
  });
});

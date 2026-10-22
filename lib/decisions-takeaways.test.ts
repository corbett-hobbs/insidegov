import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DECISIONS_CONTEXT, DECISIONS_TAKEAWAYS } from "../components/decisions/takeaways";
import { buildDecisionsPayload, sumBucket } from "./decisions-derive";
import type { DecisionCountRow, DecisionsMeta } from "./decisions-entities";
import { administration } from "./executive-orders-entities";
import { SOURCE_LINKS } from "./source-links";
import { HISTORICAL_ADMINISTRATIONS } from "./troops-presidents";

/**
 * Every figure a Supreme Court decisions card's takeaway cites, checked against the committed pipeline output (the page
 * sums `decisions_counts.json` as-is: one row per term and issue area, dissent bands d0..d4). The takeaways describe the
 * default view: every issue area, landmark filter off, every term. A data refresh that makes a sentence untrue fails here:
 * rewrite the takeaway in components/decisions/takeaways.ts, then this check. Shares round the way the page's `fmtPct` does.
 */

type Row = { term: number; group_id: string | null; n: number; d0: number; d1: number; d2: number; d3: number; d4: number };
type Meta = { first_term: number; data_through_term: number; case_count: number; groups: { id: string; label: string }[] };
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
  if (r.group_id === null) continue;
  if (!byArea.has(r.group_id)) byArea.set(r.group_id, [0, 0, 0, 0, 0]);
  add(byArea.get(r.group_id)!, r);
}
const terms = [...byTerm.keys()].sort((a, b) => a - b);
const cases = (t: number) => total(byTerm.get(t)!);
const between = (from: number, to: number) => terms.filter((t) => t >= from && t <= to);
const termsWhere = (f: (b: Bucket) => number, v: number) => terms.filter((t) => f(byTerm.get(t)!) === v);
const share = (k: number) => (b: Bucket) => pct(b, k);
/** Topics ranked by a band's exact share, highest first. */
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
    says: ["Over the 1946 through 2025 terms", "abortion, privacy and LGBTQ cases split 5–4 most often, 31% of the time", "followed by speech, religion and guns at 24%", "Courts and procedure cases were the most often unanimous, at 50%"],
    check: () => {
      expect(rankBy(4).slice(0, 2)).toEqual(["abortion-privacy-lgbtq", "speech-religion-guns"]);
      expect(pct(byArea.get("abortion-privacy-lgbtq")!, 4)).toBe(31);
      expect(pct(byArea.get("speech-religion-guns")!, 4)).toBe(24);
      expect(rankBy(0)[0]).toBe("courts-procedure");
      expect(pct(byArea.get("courts-procedure")!, 0)).toBe(50);
      // The topics the takeaway names are the page's own (its "and" stands for the labels' "&").
      const label = (id: string) => meta.groups.find((a) => a.id === id)!.label;
      expect([label("abortion-privacy-lgbtq"), label("speech-religion-guns"), label("courts-procedure")]).toEqual(["Abortion, privacy & LGBTQ", "Speech, religion & guns", "Courts & procedure"]);
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

/**
 * The context lines (rule 7d). The Act's title and date are pinned to the enacted law (102 Stat. 662, outside the pipeline), and
 * the seat Barrett filled to the Senate's nominations table ("Barrett, Amy Coney | Ginsburg | … | 52-48 | C, Oct 26, 2020"); the
 * justices' dates, votes and appointing parties come from pipeline/output/court/justices.json (Federal Judicial Center). The data
 * checks are that each fact sits next to the chart feature the line names.
 */
type Justice = {
  name: { full: string; last: string };
  appointing_president: string;
  appointing_party: string;
  confirmation_date: string;
  senate_vote: { ayes: number; nays: number } | null;
  service_start: string;
  service_end: string | null;
};
const justices = JSON.parse(readFileSync("pipeline/output/court/justices.json", "utf8")) as Justice[];
const justice = (last: string) => justices.filter((j) => j.name.last === last).at(-1)!;
const longDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const sitting = (iso: string) => justices.filter((j) => j.service_start <= iso && (j.service_end === null || j.service_end >= iso)).length;

const contextCases: Record<keyof typeof DECISIONS_CONTEXT, { says: string[]; links: Record<string, string>; check: () => void }> = {
  cases: {
    says: ["Supreme Court Case Selections Act (P.L. 100-352, June 27, 1988)", "at least 129 cases every term from 1970 through 1989", "none topped 94 from 1993"],
    links: { "plaw-100-352": "STATUTE-102-Pg662" },
    check: () => {
      // The same run and ceiling the takeaway states; the Act was signed before the 1988 term opened.
      expect(Math.min(...between(1970, 1989).map(cases))).toBe(129);
      expect(Math.max(...between(1993, 2025).map(cases))).toBe(94);
      expect(cases(1988)).toBeGreaterThanOrEqual(129);
    },
  },
  split: {
    says: ["The Senate confirmed Amy Coney Barrett, a Donald J. Trump nominee, 52\u201348 on October 26, 2020", "to Ginsburg\u2019s seat", "giving Republican appointees six of nine", "The three highest 6\u20133 shares since 1946 followed: 32% in the 2021 term, 36% in 2023 and 30% in 2025"],
    links: { "senate-scotus-nominations": "senate.gov/legislative/nominations", fjc: "fjc.gov" },
    check: () => {
      const b = justice("Barrett");
      expect(b.name.full).toBe("Amy Coney Barrett");
      expect([b.appointing_president, longDate(b.confirmation_date)]).toEqual(["Donald J. Trump", "October 26, 2020"]);
      expect(b.senate_vote).toEqual({ ayes: 52, nays: 48 });
      expect(justice("Ginsburg").service_end).toBe("2020-09-18");
      const seated = (iso: string) => justices.filter((j) => j.service_start <= iso && (j.service_end === null || j.service_end >= iso));
      const rSeats = (iso: string) => seated(iso).filter((j) => j.appointing_party === "Republican").length;
      expect([sitting("2020-09-17"), rSeats("2020-09-17")]).toEqual([9, 5]);
      expect([sitting(b.service_start), rSeats(b.service_start)]).toEqual([9, 6]);
      // The chart's 6–3 band (three dissents) at its three highest term shares, all after the 2020 term Barrett joined, and the
      // chart starts in 1946.
      expect(terms[0]).toBe(1946);
      const top = [...terms].sort((x, y) => byTerm.get(y)![3] / cases(y) - byTerm.get(x)![3] / cases(x)).slice(0, 4);
      expect(top.slice(0, 3).sort()).toEqual([2021, 2023, 2025]);
      expect([2021, 2023, 2025].map((t) => pct(byTerm.get(t)!, 3))).toEqual([32, 36, 30]);
      expect(pct(byTerm.get(top[3])!, 3)).toBeLessThan(30);
    },
  },
};

describe("Supreme Court decisions context lines", () => {
  for (const [key, c] of Object.entries(contextCases) as [keyof typeof DECISIONS_CONTEXT, (typeof contextCases)[keyof typeof DECISIONS_CONTEXT]][]) {
    it(`${key}: holds and names real sources`, () => {
      for (const phrase of c.says) expect(DECISIONS_CONTEXT[key].text).toContain(phrase);
      expect(DECISIONS_CONTEXT[key].sources.map((s) => s.id).sort()).toEqual(Object.keys(c.links).sort());
      for (const [id, part] of Object.entries(c.links)) expect(SOURCE_LINKS[id as keyof typeof SOURCE_LINKS], id).toMatch(new RegExp(`^https://.*${part}`));
      c.check();
    });
  }

  it("every context line belongs to a card, stays short and makes no causal or ideological claim", () => {
    expect(Object.keys(DECISIONS_CONTEXT).sort()).toEqual(Object.keys(contextCases).sort());
    for (const [key, line] of Object.entries(DECISIONS_CONTEXT)) {
      expect(line.text.replace(/P\.L\./g, "PL").replace(/\b([A-Z])\.\s/g, "$1 ").split(/(?<=\.)\s+(?=[A-Z])/).length, key).toBeLessThanOrEqual(2);
      expect(line.text.split(/\s+/).length, key).toBeLessThanOrEqual(45);
      expect(line.text, key).not.toMatch(/\b(because|due to|caused|led to|drove|thanks to|liberal|conservative|ideolog\w*)\b/i);
    }
  });
});

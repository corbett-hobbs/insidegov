import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ECONOMY_CONTEXT, SPECS, USD_SPECS } from "../components/economy/specs";
import { SOURCE_LINKS } from "./source-links";
import { monthlyChange, realHourlyEarnings, yearOverYearPercent, type Point } from "./indicator-derive";

/**
 * Every figure an Economy card's takeaway cites, checked against the committed
 * pipeline output. A data refresh or revision that makes a sentence untrue fails
 * here: rewrite the takeaway in components/economy/specs.ts, then this check.
 * Facts from before the chart's 1991 start ("since 1948", "since 1981") are not
 * in this data and are not checked.
 */

const rows = JSON.parse(readFileSync("pipeline/output/indicator_observations.json", "utf8")) as { series_id: string; date: string; value: number | null }[];
const raw = (id: string): Point[] =>
  rows.filter((r) => r.series_id === id && r.value !== null).map((r) => ({ date: r.date, value: r.value! }));
const shown = <T extends { date: string; value: number | null }>(ps: T[]) =>
  ps.filter((p): p is T & { value: number } => p.value !== null && p.date >= "1991-01-01");

const un = shown(raw("UNRATE"));
const infl = shown(yearOverYearPercent(raw("CPIAUCSL")));
const jobs = shown(monthlyChange(raw("PAYEMS")));
const payroll = raw("PAYEMS");
const gdp = shown(raw("A191RO1Q156NBEA"));
const wage = shown(realHourlyEarnings(raw("AHETPI"), raw("CPIAUCSL")).points);
const inc = shown(raw("MEHOINUSA672N"));
const gas = shown(raw("GASREGW"));
const diesel = shown(raw("GASDESW"));
const mort = shown(raw("MORTGAGE30US"));
const def = shown(raw("FYFSGDA188S"));
const debt = shown(raw("GFDEGDQ188S"));
// Dollar series: FRED's, then Treasury's for any later period, exactly as lib/indicator-data.ts merges them.
const treasury = JSON.parse(readFileSync("pipeline/output/treasury_fiscal.json", "utf8")) as {
  debt: { date: string; total: number }[];
  deficit: { fiscal_year: number; value: number }[];
};
const fredDebt = raw("GFDEBTN");
const debtUsd = shown([...fredDebt, ...treasury.debt.filter((d) => d.date > fredDebt.at(-1)!.date).map((d) => ({ date: d.date, value: d.total }))]);
const fredDef = raw("FYFSD");
const defUsd = shown([...fredDef, ...treasury.deficit.map((d) => ({ date: `${d.fiscal_year}-09-30`, value: d.value })).filter((d) => d.date > fredDef.at(-1)!.date)]);
const usrec = raw("USREC");
const inflBy = new Map(infl.map((p) => [p.date, p.value]));
const misery = un.filter((p) => inflBy.has(p.date)).map((p) => ({ date: p.date, value: p.value + inflBy.get(p.date)! }));

type P = { date: string; value: number };
const max = (ps: P[]) => ps.reduce((a, b) => (b.value > a.value ? b : a));
const min = (ps: P[]) => ps.reduce((a, b) => (b.value < a.value ? b : a));
const within = (ps: P[], from: string, to: string) => ps.filter((p) => p.date >= from && p.date < to);
const at = (ps: P[], date: string) => ps.find((p) => p.date === date)!.value;
const year = (ps: P[], y: number) => at(ps, `${y}-01-01`);
const firstAfter = (ps: P[], from: string, test: (v: number) => boolean) => ps.find((p) => p.date > from && test(p.value))!;
const r1 = (v: number) => Math.round(v * 10) / 10;

const cases: Record<keyof typeof SPECS, { says: string[]; check: () => void }> = {
  mis: {
    says: ["15.1 in April 2020", "topped 12 in 2009, 2011 and 2022", "5.0 in September 2015"],
    check: () => {
      expect(max(misery)).toMatchObject({ date: "2020-04-01" });
      expect(r1(max(misery).value)).toBe(15.1);
      for (const y of [2009, 2011, 2022]) expect(max(within(misery, `${y}`, `${y + 1}`)).value).toBeGreaterThan(12);
      expect(min(misery).date).toBe("2015-09-01");
      expect(r1(min(misery).value)).toBe(5);
    },
  },
  un: {
    says: ["14.8% in April 2020", "under 4% by December 2021", "2009 peak of 10.0%", "until 2016 to fall below 5%"],
    check: () => {
      expect(max(un)).toEqual({ date: "2020-04-01", value: 14.8 });
      expect(firstAfter(un, "2020-04-01", (v) => v < 4).date).toBe("2021-12-01");
      expect(max(within(un, "2009", "2011"))).toEqual({ date: "2009-10-01", value: 10 });
      expect(firstAfter(un, "2009-10-01", (v) => v < 5).date.slice(0, 4)).toBe("2016");
    },
  },
  infl: {
    says: ["nearly a decade at 3% or below", "9.0% in June 2022", "back down to 3.1%"],
    check: () => {
      expect(Math.max(...within(infl, "2012-01-01", "2021-04-01").map((p) => r1(p.value)))).toBeLessThanOrEqual(3);
      expect(max(infl).date).toBe("2022-06-01");
      expect(r1(max(infl).value)).toBe(9);
      expect(r1(at(infl, "2023-06-01"))).toBe(3.1);
    },
  },
  jobs: {
    says: ["lost 20.5 million jobs in April 2020", "pre-pandemic total by June 2022", "took until May 2014"],
    check: () => {
      expect(min(jobs).date).toBe("2020-04-01");
      expect(Math.round(min(jobs).value / 100) / 10).toBe(-20.5);
      expect(firstAfter(payroll, "2020-04-01", (v) => v > at(payroll, "2020-02-01")).date).toBe("2022-06-01");
      const peak2008 = max(within(payroll, "2007-01-01", "2009-01-01"));
      expect(firstAfter(payroll, peak2008.date, (v) => v > peak2008.value).date).toBe("2014-05-01");
    },
  },
  gdp: {
    says: ["only three stretches: 1991, late 2008–2009 and 2020", "(−7.4%)", "(+12.6%)"],
    check: () => {
      const years = [...new Set(gdp.filter((p) => p.value < 0).map((p) => p.date.slice(0, 4)))];
      expect(years).toEqual(["1991", "2008", "2009", "2020"]);
      expect(min(gdp)).toEqual({ date: "2020-04-01", value: -7.4 });
      expect(max(gdp)).toEqual({ date: "2021-04-01", value: 12.6 });
    },
  },
  wage: {
    says: ["flat in the early 1990s", "about a quarter since its 1995 low", "back to its early-2020 level"],
    check: () => {
      const low = min(within(wage, "1991", "2000"));
      expect(low.date.slice(0, 4)).toBe("1995");
      expect(Math.abs(low.value / at(wage, "1991-01-01") - 1)).toBeLessThan(0.03);
      const rise = wage[wage.length - 1].value / low.value - 1;
      expect(rise).toBeGreaterThan(0.2);
      expect(rise).toBeLessThan(0.32);
      expect(Math.abs(at(wage, "2022-06-01") / at(wage, "2020-02-01") - 1)).toBeLessThan(0.02);
    },
  },
  inc: {
    says: ["didn’t pass that level again until 2016", "record in 2019", "about 5% by 2022", "new record in 2025"],
    check: () => {
      const y2007 = year(inc, 2007);
      expect(firstAfter(inc, "2007-01-01", (v) => v > y2007).date.slice(0, 4)).toBe("2016");
      expect(max(within(inc, "1991", "2020")).date.slice(0, 4)).toBe("2019");
      expect(Math.round((1 - year(inc, 2022) / year(inc, 2019)) * 100)).toBe(5);
      expect(max(inc).date.slice(0, 4)).toBe("2025");
    },
  },
  gas: {
    says: ["$5.01 a gallon in June 2022", "2008 high of $4.11", "$2.78 in January to $4.50 in May", "record $6.53 in September"],
    check: () => {
      expect(max(gas).date.slice(0, 7)).toBe("2022-06");
      expect(max(gas).value.toFixed(2)).toBe("5.01");
      expect(max(within(gas, "2008", "2009")).value.toFixed(2)).toBe("4.11");
      expect(min(within(gas, "2026-01", "2026-02")).value.toFixed(2)).toBe("2.78");
      expect(max(within(gas, "2026-05", "2026-06")).value.toFixed(2)).toBe("4.50");
      expect(max(diesel).date.slice(0, 7)).toBe("2026-09");
      expect(max(diesel).value.toFixed(2)).toBe("6.53");
    },
  },
  mort: {
    says: ["record low of 2.65% in January 2021", "7.79% by October 2023", "highest since 2000"],
    check: () => {
      expect(min(mort)).toMatchObject({ value: 2.65 });
      expect(min(mort).date.slice(0, 7)).toBe("2021-01");
      const high = max(within(mort, "2021", "2025"));
      expect(high.value).toBe(7.79);
      expect(high.date.slice(0, 7)).toBe("2023-10");
      expect(max(within(mort, "2001", "2023")).value).toBeLessThan(7.79);
      expect(max(within(mort, "2000", "2001")).value).toBeGreaterThan(7.79);
    },
  },
  def: {
    says: ["surplus only in 1998–2001", "From 2020 through 2025", "only in 2009–2012"],
    check: () => {
      expect(def.filter((p) => p.value > 0).map((p) => p.date.slice(0, 4))).toEqual(["1998", "1999", "2000", "2001"]);
      expect(within(def, "2020", "2026").every((p) => p.value < -5)).toBe(true);
      expect(within(def, "1991", "2020").filter((p) => p.value < -5).map((p) => p.date.slice(0, 4))).toEqual(["2009", "2010", "2011", "2012"]);
    },
  },
  debt: {
    says: ["54% of GDP in 2001", "133% in mid-2020", "116% in early 2023", "123% by early 2026"],
    check: () => {
      expect(min(debt).date.slice(0, 4)).toBe("2001");
      expect(Math.round(min(debt).value)).toBe(54);
      expect(max(debt).date).toBe("2020-04-01");
      expect(Math.round(max(debt).value)).toBe(133);
      expect(min(debt).value * 2).toBeLessThan(max(debt).value);
      expect(Math.round(min(within(debt, "2020-07", "2027")).value)).toBe(116);
      expect(min(within(debt, "2020-07", "2027")).date.slice(0, 4)).toBe("2023");
      expect(Math.round(at(debt, "2026-01-01"))).toBe(123);
    },
  },
};

/** The dollar versions of the deficit and debt cards (the page's default view), in millions of dollars. */
const usdCases: Record<keyof typeof USD_SPECS, { says: string[]; check: () => void }> = {
  def: {
    says: ["record $3.1 trillion in fiscal 2020", "$1.4 trillion in 2022", "$2.0 trillion in 2026", "surplus only in 1998–2001"],
    check: () => {
      expect(min(defUsd)).toMatchObject({ date: "2020-09-30" });
      expect(Math.round(min(defUsd).value / 1e5) / 10).toBe(-3.1);
      expect(max(within(defUsd, "2021", "2027")).date.slice(0, 4)).toBe("2022"); // the smallest deficit since 2020
      expect(Math.round(max(within(defUsd, "2021", "2027")).value / 1e5) / 10).toBe(-1.4);
      expect(Math.round(at(defUsd, "2026-09-30") / 1e5) / 10).toBe(-2);
      expect(defUsd.filter((p) => p.value > 0).map((p) => p.date.slice(0, 4))).toEqual(["1998", "1999", "2000", "2001"]);
    },
  },
  debt: {
    says: ["more than elevenfold", "$3.5 trillion to $40.2 trillion in 2026", "$10 trillion in 2008", "$20 trillion in 2017", "$30 trillion in 2022"],
    check: () => {
      expect(Math.round(debtUsd[0].value / 1e5) / 10).toBe(3.5);
      expect(debtUsd.at(-1)!.value / debtUsd[0].value).toBeGreaterThan(11);
      expect(debtUsd.at(-1)!.date).toBe("2026-07-01");
      expect(Math.round(debtUsd.at(-1)!.value / 1e5) / 10).toBe(40.2);
      for (const [t, y] of [[10e6, "2008"], [20e6, "2017"], [30e6, "2022"]] as const) {
        expect(debtUsd.find((p) => p.value > t)!.date.slice(0, 4)).toBe(y);
      }
    },
  },
};

/**
 * The context lines (rule 7d). NBER's dates are checked against USREC, which flags the months after each peak through the
 * trough (FRED's convention), so a "March to November 2001" recession is flagged April–November. Facts from cited documents
 * outside the pipeline (FOMC rate decisions, enactment dates, CBO's April 16, 2020 CARES Act estimate) are pinned to the phrase
 * the line uses, so an edit has to come back here; where the chart's own data touches them, it is checked against them.
 */
const recessionMonths = (from: string, to: string) => usrec.filter((p) => p.value === 1 && p.date >= from && p.date < to).map((p) => p.date.slice(0, 7));
const monthsBetween = (a: string, b: string) => {
  const out: string[] = [];
  for (let d = new Date(`${a}-01T00:00Z`); d.toISOString().slice(0, 7) <= b; d.setUTCMonth(d.getUTCMonth() + 1)) out.push(d.toISOString().slice(0, 7));
  return out;
};
const contextCases: Record<keyof typeof ECONOMY_CONTEXT, { says: string[]; check: () => void }> = {
  jobs: {
    says: ["a February 2020 peak to an April 2020 trough, two months long", "from December 2007 to June 2009"],
    check: () => {
      expect(recessionMonths("2019", "2023")).toEqual(["2020-03", "2020-04"]);
      expect(recessionMonths("2007", "2011")).toEqual(monthsBetween("2008-01", "2009-06"));
      // The record loss fell in the recession's trough month.
      expect(min(jobs).date).toBe("2020-04-01");
    },
  },
  gdp: {
    says: ["from March to November 2001", "output never fell from a year earlier", "jobs, income and spending, not output alone"],
    check: () => {
      expect(recessionMonths("2000", "2003")).toEqual(monthsBetween("2001-04", "2001-11"));
      expect(within(gdp, "2000", "2003").every((p) => p.value >= 0)).toBe(true);
    },
  },
  mort: {
    says: ["0–0.25% from March 2020 to March 2022", "raised it 11 times, to 5.25–5.50% in July 2023"],
    check: () => {
      // The takeaway's record low sits inside the near-zero stretch, and its 2023 high after the last increase.
      expect(min(mort).date >= "2020-03-15" && min(mort).date < "2022-03-16").toBe(true);
      expect(max(within(mort, "2021", "2025")).date > "2023-07-26").toBe(true);
    },
  },
  def: {
    says: ["CARES Act was enacted March 27, 2020", "American Rescue Plan Act March 11, 2021", "about $1.8T to deficits over 2020–2030"],
    check: () => {
      // Both laws fall in fiscal years 2020 and 2021 (October–September), the two deepest deficits on the chart.
      const deepest = [...def].sort((a, b) => a.value - b.value).slice(0, 2).map((p) => p.date.slice(0, 4));
      expect(deepest).toEqual(["2020", "2021"]);
    },
  },
};

describe("Economy card takeaways", () => {
  for (const [key, c] of Object.entries(cases) as [keyof typeof SPECS, (typeof cases)[keyof typeof SPECS]][]) {
    it(`${SPECS[key].title}: "${SPECS[key].takeaway.slice(0, 48)}…" holds`, () => {
      for (const phrase of c.says) expect(SPECS[key].takeaway).toContain(phrase);
      c.check();
    });
  }

  for (const [key, c] of Object.entries(usdCases) as [keyof typeof USD_SPECS, (typeof usdCases)[keyof typeof USD_SPECS]][]) {
    it(`${USD_SPECS[key].title} in dollars: "${USD_SPECS[key].takeaway.slice(0, 48)}…" holds`, () => {
      for (const phrase of c.says) expect(USD_SPECS[key].takeaway).toContain(phrase);
      c.check();
    });
  }

  it("stays short: two sentences, at most 45 words", () => {
    for (const s of [...Object.values(SPECS), ...Object.values(USD_SPECS)]) {
      expect(s.takeaway.split(/(?<=[.;])\s/).filter((x) => x.endsWith(".")).length, s.title).toBeLessThanOrEqual(2);
      expect(s.takeaway.split(/\s+/).length, s.title).toBeLessThanOrEqual(45);
    }
  });

  for (const [key, c] of Object.entries(contextCases) as [keyof typeof ECONOMY_CONTEXT, (typeof contextCases)[keyof typeof ECONOMY_CONTEXT]][]) {
    it(`context, ${SPECS[key].title}: holds and names real sources`, () => {
      const line = ECONOMY_CONTEXT[key];
      for (const phrase of c.says) expect(line.text).toContain(phrase);
      for (const src of line.sources) expect(SOURCE_LINKS[src.id], src.id).toMatch(/^https:\/\//);
      c.check();
    });
  }

  it("every context line belongs to a card, stays short and makes no causal claim of its own", () => {
    expect(Object.keys(ECONOMY_CONTEXT).sort()).toEqual(Object.keys(contextCases).sort());
    for (const [key, line] of Object.entries(ECONOMY_CONTEXT)) {
      expect(line.text.split(/(?<=\.)\s+(?=[A-Z])/).length, key).toBeLessThanOrEqual(2);
      expect(line.text.split(/\s+/).length, key).toBeLessThanOrEqual(45);
      expect(line.text, key).not.toMatch(/\d,\d{3}/);
      expect(line.text, key).not.toMatch(/\b(because|due to|caused|led to|drove|thanks to|soared|plunged|president|administration|Democrat|Republican)\b/i);
    }
  });
});

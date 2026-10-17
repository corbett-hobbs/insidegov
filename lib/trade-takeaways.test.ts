import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TRADE_CONTEXT, TRADE_TAKEAWAYS } from "../components/trade/takeaways";
import { SOURCE_LINKS } from "./source-links";
import { MONTH_NAMES } from "./indicator-time";
import { ratePercentSeries } from "./trade-chart";
import { monthCount, monthIndex, partnerBalance, partnerTotal } from "./trade-derive";
import type { CountryRow, DutiesByCountryRow, DutiesNationalRow, TradeByCountryRow, TradeNationalRow } from "./trade-entities";
import { topByTotal } from "./trade-map";
import { buildCountryPayload, buildNationalPayload, buildYearPayload } from "./trade-payload";
import { buildScatterRows, scatterWindows, windowText } from "./trade-scatter";

/**
 * Every figure a Trade card's takeaway cites, checked against the committed
 * pipeline output through the same pure builders the page uses (lib/trade-data.ts
 * is `server-only`, so its few lines of file reading are repeated here). A data
 * refresh that makes a sentence untrue fails here: rewrite the takeaway in
 * components/trade/takeaways.ts, then this check. The partners takeaway is about
 * 2026, the page's default year, so the first month of 2027 data fails it on purpose.
 */

const OUT = "pipeline/output";
const read = <T>(file: string) => JSON.parse(readFileSync(`${OUT}/${file}`, "utf8")) as T[];
const shards = <T>(dir: string) => {
  const m = new Map<number, T[]>();
  for (const f of readdirSync(`${OUT}/${dir}`).filter((x) => /^\d{4}\.json$/.test(x))) m.set(Number(f.slice(0, 4)), read<T>(`${dir}/${f}`));
  return m;
};

const countries = read<CountryRow>("countries.json").sort((a, b) => (b.last_year ?? 0) - (a.last_year ?? 0));
const trade = shards<TradeByCountryRow>("trade_by_country");
const duties = shards<DutiesByCountryRow>("duties_by_country");
const national = buildNationalPayload(read<TradeNationalRow>("trade_national.json"), read<DutiesNationalRow>("duties_national.json"));
const lastYear = Number(national.lastPeriod.slice(0, 4));
const through = MONTH_NAMES[Number(national.lastPeriod.slice(5)) - 1];

// Chart 1 (all countries): the seasonally adjusted monthly balance, $ millions.
const bal = national.sa.exports.map((e, i) => (e === null || national.sa.imports[i] === null ? null : e - national.sa.imports[i]!));
const balIn = (from: string, to: string) => bal.slice(monthIndex(from), monthIndex(to) + 1);
const deepest = (from: string, to: string) => {
  const xs = balIn(from, to);
  const v = Math.min(...xs.filter((x): x is number => x !== null));
  return { v, at: monthIndex(from) + xs.indexOf(v) };
};

// Chart 2 (all countries): calculated duties as a percent of imports for consumption.
const rate = ratePercentSeries(national.duties, national.dutyImports);
const peak = (from: string, to: string, sign = 1) => {
  const xs = rate.slice(monthIndex(from), monthIndex(to) + 1);
  const v = sign * Math.max(...xs.filter((x): x is number => x !== null).map((x) => sign * x));
  return { v, at: monthIndex(from) + xs.indexOf(v) };
};

// Chart 3: one year's partners, as the card lists them.
const year = (y: number) => buildYearPayload(y, countries, trade.get(y)!, duties.get(y) ?? []).partners;
const leader = (y: number) => [...year(y)].sort((a, b) => partnerTotal(b) - partnerTotal(a)).map((r) => r[0]);
const biggestDeficit = (y: number) => [...year(y)].sort((a, b) => partnerBalance(a) - partnerBalance(b))[0][0];

// Chart 5: the scatter's rows over its current windows, built as lib/trade-data.ts getScatter() builds them.
const names = new Map<string, string>();
for (const c of countries) if (!c.is_aggregate && !names.has(c.country_code)) names.set(c.country_code, c.name);
const lastDuties = read<DutiesNationalRow>("duties_national.json").map((r) => r.period).sort().pop()!;
const windows = scatterWindows(lastDuties);
const byCode = new Map<string, DutiesByCountryRow[]>();
for (const rows of duties.values()) for (const r of rows) byCode.set(r.country_code, [...(byCode.get(r.country_code) ?? []), r]);
const scatter = buildScatterRows(
  [...byCode].flatMap(([code, rows]) => {
    const name = names.get(code);
    if (!name) return [];
    const p = buildCountryPayload({ country_code: code, name }, [], rows, monthCount(national.lastPeriod));
    return [{ code, name, duties: p.duties, imports: p.dutyImports }];
  }),
  windows,
);
const top5 = topByTotal(year(lastYear), 5).map((c) => scatter.find((r) => r.code === c)!);

const partnersText = TRADE_TAKEAWAYS.partners.takeaway(through);
const scatterText = TRADE_TAKEAWAYS.scatter.takeaway(windowText(windows.baseline), windowText(windows.latest));

const cases: { title: string; text: string; says: string[]; check: () => void }[] = [
  {
    title: TRADE_TAKEAWAYS.balance.title,
    text: TRADE_TAKEAWAYS.balance.takeaway,
    says: ["every month from January 1991 through August 2026", "$76 billion in July 2008", "$35 billion in May 2009", "record $158.7 billion in March 2025"],
    check: () => {
      expect(bal[0]).not.toBeNull(); // the series starts January 1991
      const span = balIn("1991-01", "2026-08");
      expect(span.every((x) => x !== null && x < 0)).toBe(true);
      const before = deepest("1991-01", "2008-12");
      expect([Math.round(before.v / 1000), before.at]).toEqual([-76, monthIndex("2008-07")]);
      const shallowest2009 = Math.max(...(balIn("2009-01", "2009-12") as number[]));
      expect([Math.round(shallowest2009 / 1000), bal.indexOf(shallowest2009)]).toEqual([-35, monthIndex("2009-05")]);
      const record = deepest("1991-01", national.lastPeriod);
      expect([Math.round(record.v / 100) / 10, record.at]).toEqual([-158.7, monthIndex("2025-03")]);
    },
  },
  {
    title: TRADE_TAKEAWAYS.tariff.title,
    text: TRADE_TAKEAWAYS.tariff.takeaway,
    says: ["4.7% of imports in February 1994", "1.1% in March 2008", "3.2% by September 2019", "record 10.8% in October", "more than double the 1994 high"],
    check: () => {
      expect(rate.findIndex((x) => x !== null)).toBe(monthIndex("1993-01"));
      const high = peak("1993-01", "2024-12");
      expect([high.v.toFixed(1), high.at]).toEqual(["4.7", monthIndex("1994-02")]);
      const low = peak("1993-01", national.lastPeriod, -1);
      expect([low.v.toFixed(1), low.at]).toEqual(["1.1", monthIndex("2008-03")]);
      const after = peak("2008-03", "2024-12");
      expect([after.v.toFixed(1), after.at]).toEqual(["3.2", monthIndex("2019-09")]);
      const record = peak("1993-01", national.lastPeriod);
      expect([record.v.toFixed(1), record.at]).toEqual(["10.8", monthIndex("2025-10")]);
      expect(record.v).toBeGreaterThan(2 * high.v);
    },
  },
  {
    title: TRADE_TAKEAWAYS.partners.title,
    text: partnersText,
    says: ["Mexico was the largest", "each year from 2023 through 2025 and again in 2026", "ahead of Canada", "China had the largest deficit every year from 2000 through 2025", "Vietnam did"],
    check: () => {
      expect(lastYear).toBe(2026); // the card's default year; a new year means a new sentence
      for (let y = 2023; y <= 2026; y++) expect(leader(y).slice(0, 2), String(y)).toEqual(["MEX", "CAN"]);
      for (let y = 2000; y <= 2025; y++) expect(biggestDeficit(y), String(y)).toBe("CHN");
      expect(biggestDeficit(2026)).toBe("VNM");
    },
  },
  {
    title: TRADE_TAKEAWAYS.scatter.title,
    text: scatterText,
    says: ["duty rates rose on goods from most countries", "China's rate rose the most", "only imports from China fell", "Taiwan and Vietnam grew the most"],
    check: () => {
      const plotted = scatter.filter((r) => r.plotted);
      expect(plotted.filter((r) => r.rateChangePp! > 0).length / plotted.length).toBeGreaterThan(0.5);
      expect(top5.every((r) => r.plotted)).toBe(true);
      expect([...top5].sort((a, b) => b.rateChangePp! - a.rateChangePp!)[0].code).toBe("CHN");
      expect(top5.filter((r) => r.importsChange! < 0).map((r) => r.code)).toEqual(["CHN"]);
      expect([...top5].sort((a, b) => b.importsChange! - a.importsChange!).slice(0, 2).map((r) => r.code).sort()).toEqual(["TWN", "VNM"]);
    },
  },
];

/**
 * The context lines (rule 7d): every date, rate and count is checked against the tariff action log in pipeline/output, and
 * each cited link must be one that log records for that action.
 */
type Action = { action_id: string; date: string; rate_note?: string; scope_note?: string; description: string; sources: { url: string }[] };
const actions = new Map(JSON.parse(readFileSync(`${OUT}/tariff_actions.json`, "utf8")).actions.map((a: Action) => [a.action_id, a]) as [string, Action][]);
const action = (id: string) => {
  const a = actions.get(id);
  expect(a, id).toBeDefined();
  return a!;
};
const cites = (id: string, src: keyof typeof SOURCE_LINKS) => expect(action(id).sources.map((s) => s.url)).toContain(SOURCE_LINKS[src]);
const contextCases: Record<keyof typeof TRADE_CONTEXT, { says: string[]; check: () => void }> = {
  tariff: {
    says: ["Section 301 tariffs on China began July 2018", "the rate doubled to 3.2% by September 2019", "jumped to 7.2% when 10% IEEPA tariffs on all partners began in April 2025", "fell to 6.8% after the Supreme Court ruled against them in February 2026"],
    check: () => {
      expect(action("2018-07-06-section-301-china-list-1").date).toBe("2018-07-06");
      const base = action("2025-04-05-reciprocal-baseline");
      expect([base.date, base.rate_note, base.description]).toEqual(["2025-04-05", "10 percent", expect.stringContaining("all trading partners")]);
      expect(action("2026-02-20-supreme-court-ieepa-ruling").date).toBe("2026-02-20");
      expect(action("2026-02-24-ieepa-ends-section-122-begins").date).toBe("2026-02-24");
      // What the chart does at those dates: June 2018 (the month before) to September 2019 doubles; March to April 2025 jumps;
      // February to March 2026 falls.
      const r = (m: string) => rate[monthIndex(m)]!;
      expect([r("2018-06").toFixed(1), r("2019-09").toFixed(1)]).toEqual(["1.6", "3.2"]);
      expect(r("2019-09") / r("2018-06")).toBeGreaterThan(1.9);
      expect(r("2019-09") / r("2018-06")).toBeLessThan(2.1);
      expect([r("2025-03").toFixed(1), r("2025-04").toFixed(1)]).toEqual(["3.7", "7.2"]);
      expect(r("2026-03").toFixed(1)).toBe("6.8");
      expect(r("2026-03")).toBeLessThan(r("2026-02"));
      cites("2018-07-06-section-301-china-list-1", "fr-301-china-2018");
      cites("2025-04-05-reciprocal-baseline", "fr-eo-14257");
      cites("2026-02-20-supreme-court-ieepa-ruling", "scotus-learning-resources");
      cites("2026-02-24-ieepa-ends-section-122-begins", "fr-eo-14389");
    },
  },
  scatter: {
    says: ["Between the two windows", "Section 301 duties on some Chinese goods (September 2024)", "a 10% Section 122 surcharge began (February 2026)", "Section 301 tariffs began on 60 economies, China among them (July 2026)", "China's duty rate went from 11.3% to 22.2%"],
    check: () => {
      const review = action("2024-09-27-section-301-china-four-year-review");
      expect([review.date, review.description]).toEqual(["2024-09-27", expect.stringContaining("increases Section 301 duties on selected products of China")]);
      const s122 = action("2026-02-24-ieepa-ends-section-122-begins");
      expect(s122.rate_note).toMatch(/^Section 122 surcharge: 10 percent/);
      const fl = action("2026-07-24-section-301-forced-labor") as Action & { countries: string[] };
      expect([fl.date, fl.rate_note?.startsWith("10 percent or 12.5 percent"), fl.scope_note?.startsWith("60 economies"), fl.countries.includes("CHN")]).toEqual(["2026-07-24", true, true, true]);
      // Every action named falls between the scatter's baseline and the end of its latest window.
      for (const d of ["2024-09", "2026-02", "2026-07"]) expect(d > windows.baseline.to && d <= windows.latest.to, d).toBe(true);
      // What the scatter shows for China across those windows.
      const china = scatter.find((r) => r.code === "CHN")!;
      expect([(china.baseRate! * 100).toFixed(1), (china.latestRate! * 100).toFixed(1)]).toEqual(["11.3", "22.2"]);
      cites("2024-09-27-section-301-china-four-year-review", "fr-301-china-2024");
      cites("2026-02-24-ieepa-ends-section-122-begins", "fr-section-122-2026");
      cites("2026-07-24-section-301-forced-labor", "fr-301-forced-labor-2026");
    },
  },
};

describe("Trade card takeaways", () => {
  for (const c of cases) {
    it(`${c.title}: "${c.text.slice(0, 48)}…" holds`, () => {
      for (const phrase of c.says) expect(c.text).toContain(phrase);
      c.check();
    });
  }

  it("stays short: two sentences, at most 45 words", () => {
    for (const c of cases) {
      const sentences = c.text.replaceAll("U.S.", "US").split(/(?<=[.!?])\s+/).filter(Boolean);
      expect(sentences.length, c.title).toBeLessThanOrEqual(2);
      expect(c.text.split(/\s+/).length, c.title).toBeLessThanOrEqual(45);
    }
  });

  for (const [key, c] of Object.entries(contextCases) as [keyof typeof TRADE_CONTEXT, (typeof contextCases)[keyof typeof TRADE_CONTEXT]][]) {
    it(`context, ${TRADE_TAKEAWAYS[key].title}: holds and names real sources`, () => {
      for (const phrase of c.says) expect(TRADE_CONTEXT[key].text).toContain(phrase);
      for (const src of TRADE_CONTEXT[key].sources) expect(SOURCE_LINKS[src.id], src.id).toMatch(/^https:\/\//);
      c.check();
    });
  }

  it("every context line belongs to a card, stays short and makes no causal claim", () => {
    expect(Object.keys(TRADE_CONTEXT).sort()).toEqual(Object.keys(contextCases).sort());
    for (const [key, line] of Object.entries(TRADE_CONTEXT)) {
      expect(line.text.replace(/U\.S\./g, "US").split(/(?<=\.)\s+(?=[A-Z])/).length, key).toBeLessThanOrEqual(2);
      expect(line.text.split(/\s+/).length, key).toBeLessThanOrEqual(45);
      expect(line.text, key).not.toMatch(/\b(because|due to|caused|led to|drove|thanks to|soared|plunged)\b/i);
    }
  });
});

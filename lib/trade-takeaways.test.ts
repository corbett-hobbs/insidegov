import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TRADE_TAKEAWAYS } from "../components/trade/takeaways";
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
});

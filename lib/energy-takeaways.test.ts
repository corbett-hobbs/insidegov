import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compactNumber, UNCOMPACT_FIGURE } from "./format-number";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ENERGY_CONTEXT, ENERGY_TAKEAWAYS } from "../components/energy/takeaways";
import type { ContextEntry } from "./chart-context";
import { SOURCE_LINKS } from "./source-links";
import { energyObservation } from "./energy-entities";
import { energyActionsFile } from "./energy-actions-entities";
import { buildSeries, groupObservations, monthLabel } from "./energy-derive";
import { FUEL_KEYS, KEY_SERIES, type MonthlyKey } from "./energy-types";
import { dateOfDay } from "./indicator-time";

/**
 * Every figure an Energy card's takeaway cites, checked against the committed pipeline output through the same
 * `buildSeries` the page draws from (monthly arrays from January 1991, month 0). Yearly figures are plain means
 * (or sums, for LNG) of the monthly values. "Records back to 1973" claims read the raw observations, which start
 * there. A data refresh that makes a sentence untrue fails here: rewrite the takeaway in
 * components/energy/takeaways.ts, then this check.
 */

const OUT = join(process.cwd(), "pipeline", "output");
const json = (f: string): unknown => JSON.parse(readFileSync(join(OUT, f), "utf8"));
const raw = groupObservations(z.array(energyObservation).parse(json("energy_observations.json")));
const { monthly: m, spr } = buildSeries(raw);
const actions = energyActionsFile.parse(json("energy_actions.json")).actions;

const yearOf = (i: number) => 1991 + Math.floor(i / 12);
/** Per-year sum and count of a monthly array, full years only unless `partial`. */
function yearly(a: readonly (number | null)[], partial = false) {
  const out = new Map<number, { sum: number; n: number }>();
  a.forEach((v, i) => {
    if (v === null) return;
    const r = out.get(yearOf(i)) ?? { sum: 0, n: 0 };
    r.sum += v;
    r.n += 1;
    out.set(yearOf(i), r);
  });
  if (!partial) for (const [y, r] of out) if (r.n < 12) out.delete(y);
  return out;
}
const mean = (k: MonthlyKey) => new Map([...yearly(m[k])].map(([y, r]) => [y, r.sum / r.n]));
const sum = (k: MonthlyKey, partial = false) => new Map([...yearly(m[k], partial)].map(([y, r]) => [y, r.sum]));
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
/** Index of the largest (or smallest) non-null value. */
const argBy = (a: readonly (number | null)[], better: (x: number, y: number) => boolean) => {
  let best = -1;
  a.forEach((v, i) => {
    if (v !== null && (best < 0 || better(v, a[best] as number))) best = i;
  });
  return best;
};
const argMax = (a: readonly (number | null)[]) => argBy(a, (x, y) => x > y);
const argMin = (a: readonly (number | null)[]) => argBy(a, (x, y) => x < y);
/** A figure in thousands of barrels (a day), in the short form the prose uses: "6.8M", "464.6K". */
const bbl = (thousands: number) => compactNumber(thousands * 1000);
const monthYear = (day: number) => {
  const d = dateOfDay(day);
  return `${d.year}-${d.month + 1}`;
};
/** Raw yearly means from 1973, full years only, for a series id. */
function rawYearly(id: string) {
  const out = new Map<number, number[]>();
  for (const r of raw.get(id) ?? []) {
    const y = Number(r.date.slice(0, 4));
    out.set(y, [...(out.get(y) ?? []), r.value]);
  }
  return new Map([...out].filter(([, v]) => v.length === 12).map(([y, v]) => [y, v.reduce((a, b) => a + b, 0) / 12]));
}

const cases: Record<keyof typeof ENERGY_TAKEAWAYS, { says: string[]; check: () => void }> = {
  electricity: {
    says: ["48% to 53%", "every year from 1991 through 2008", "Natural gas led every year from 2016 through 2025", "peaking at 43% in 2024", "under 1% through 2007", "17% in 2025"],
    check: () => {
      const total = sum("total", true);
      const share = (k: MonthlyKey, y: number) => ((sum(k, true).get(y) as number) / (total.get(y) as number)) * 100;
      expect(yearOf(m.total.findIndex((x) => x !== null))).toBe(1991);
      const coal = range(1991, 2008).map((y) => share("coal", y));
      expect(Math.round(Math.min(...coal))).toBe(48);
      expect(Math.round(Math.max(...coal))).toBe(53);
      expect(share("coal", 2009)).toBeLessThan(47.5);
      for (const y of range(2016, 2025)) for (const k of FUEL_KEYS) if (k !== "gas") expect(share("gas", y), `${y} ${k}`).toBeGreaterThan(share(k, y));
      expect(share("coal", 2015)).toBeGreaterThan(share("gas", 2015));
      const years = [...total.keys()];
      const peak = years.reduce((a, b) => (share("gas", b) > share("gas", a) ? b : a));
      expect(peak).toBe(2024);
      expect(Math.round(share("gas", 2024))).toBe(43);
      const ws = (y: number) => share("wind", y) + share("solar", y);
      for (const y of range(1991, 2007)) expect(ws(y), String(y)).toBeLessThan(1);
      expect(Math.round(ws(2025))).toBe(17);
      expect(yearly(m.total).get(2025)?.n).toBe(12);
    },
  },
  supply: {
    says: ["Production averaged 6.8M barrels a day in 2008, its lowest year", "21.2M in 2025", "the first year in records back to 1973 that it topped products supplied", "Products supplied ranged between 14.5M (April 2020) and 21.7M (August 2005)"],
    check: () => {
      const prod = mean("prod");
      const lowest = [...prod.keys()].reduce((a, b) => ((prod.get(b) as number) < (prod.get(a) as number) ? b : a));
      expect(lowest).toBe(2008);
      expect(bbl(prod.get(2008) as number)).toBe("6.8M");
      expect(bbl(prod.get(2025) as number)).toBe("21.2M");
      const rp = rawYearly(KEY_SERIES.prod);
      const rs = rawYearly(KEY_SERIES.supplied);
      expect(raw.get(KEY_SERIES.prod)?.[0].date).toBe("1973-01-01");
      expect(raw.get(KEY_SERIES.supplied)?.[0].date).toBe("1973-01-01");
      expect(Math.min(...rp.values())).toBe(rp.get(2008));
      const topped = [...rp.keys()].filter((y) => (rp.get(y) as number) > (rs.get(y) as number));
      expect(topped[0]).toBe(2025);
      const hi = argMax(m.supplied);
      expect(monthLabel(hi)).toBe("August 2005");
      expect(bbl(m.supplied[hi] as number)).toBe("21.7M");
      const lo = argMin(m.supplied);
      expect(monthLabel(lo)).toBe("April 2020");
      expect(bbl(m.supplied[lo] as number)).toBe("14.5M");
    },
  },
  oil: {
    says: ["Exports first topped imports in October 2019, in monthly records back to 1973", "net exporter every year from 2020 through 2025", "Net exports peaked at 5.9M barrels a day in May 2026", "against a 13.4M net-import high in August 2006"],
    check: () => {
      const hi = argMax(m.net);
      expect(monthLabel(hi)).toBe("August 2006");
      expect(bbl(m.net[hi] as number)).toBe("13.4M");
      // Net exports are negative net imports; the chart's lowest month is the net-export peak.
      const lo = argMin(m.net);
      expect(monthLabel(lo)).toBe("May 2026");
      expect(bbl(-(m.net[lo] as number))).toBe("5.9M");
      const rows = raw.get(KEY_SERIES.net) ?? [];
      expect(rows[0].date).toBe("1973-01-01");
      expect(rows.find((r) => r.value < 0)?.date).toBe("2019-10-01");
      const net = mean("net");
      for (const y of range(2020, 2025)) expect(net.get(y), String(y)).toBeLessThan(0);
    },
  },
  lng: {
    says: ["under 16B cubic feet a month from 1997 through 2015", "After Sabine Pass’s first cargo sailed in February 2016", "the yearly total rose each year through 2025", "March 2026 set the monthly record of 573.1B"],
    check: () => {
      expect(yearOf(m.lng.findIndex((x) => x !== null))).toBe(1997);
      const early = m.lng.filter((v, i) => v !== null && yearOf(i) <= 2015) as number[];
      expect(Math.max(...early)).toBeLessThan(16000);
      const cargo = actions.find((a) => a.area === "lng" && a.label_short.startsWith("First Sabine Pass"));
      expect(cargo?.date.slice(0, 7)).toBe("2016-02");
      const tot = sum("lng");
      for (const y of range(2017, 2025)) expect(tot.get(y), String(y)).toBeGreaterThan(tot.get(y - 1) as number);
      const rec = argMax(m.lng);
      expect(monthLabel(rec)).toBe("March 2026");
      expect(compactNumber((m.lng[rec] as number) * 1e6)).toBe("573.1B");
    },
  },
  spr: {
    says: ["fell from 638.1M barrels in January 2021 to a low of 346.8M in July 2023", "after peaking at 726.6M in January 2010", "Refilled to 415.4M by March 2026, when an emergency exchange was authorized", "it fell below that low by June 2026"],
    check: () => {
      const peak = spr.reduce((a, b) => (b[1] > a[1] ? b : a));
      expect([monthYear(peak[0]), bbl(peak[1])]).toEqual(["2010-1", "726.6M"]);
      const jan21 = spr.filter(([d]) => monthYear(d) === "2021-1").map(([, v]) => bbl(v));
      expect(new Set(jan21)).toEqual(new Set(["638.1M"]));
      const start = spr.findIndex(([d]) => monthYear(d) === "2021-1");
      const before2026 = spr.slice(start).filter(([d]) => dateOfDay(d).year < 2026);
      const low = before2026.reduce((a, b) => (b[1] < a[1] ? b : a));
      expect(monthYear(low[0])).toBe("2023-7");
      expect(bbl(low[1])).toBe("346.8M");
      const exchange = actions.find((a) => a.area === "spr" && a.kind === "release_exchange" && a.date.startsWith("2026-03"));
      expect(exchange?.label_short).toMatch(/emergency exchange/);
      const exchangeDay = spr.findIndex(([d]) => monthYear(d) === "2026-3");
      const refill = spr.slice(0, exchangeDay + 4).filter(([d]) => d > low[0]).reduce((a, b) => (b[1] > a[1] ? b : a));
      expect(bbl(refill[1])).toBe("415.4M");
      expect(spr.filter(([d]) => d > low[0]).every(([, v]) => v < 415500)).toBe(true);
      const below = spr.find(([d, v]) => d > refill[0] && v < low[1]);
      expect(below && monthYear(below[0])).toBe("2026-6");
    },
  },
};

/**
 * Every figure a context line cites (rule 7d). Dated actions are read from energy_actions.json and chart figures from the
 * same series the card draws; facts from a cited page outside the pipeline (DOE's mandated-sale total, DOE's description of the
 * Sabine Pass order as its first for lower-48 LNG) are pinned to the phrase the line uses, and the source must be the one cited.
 */
const action = (id: string) => {
  const a = actions.find((x) => x.action_id === id);
  expect(a, id).toBeDefined();
  return a!;
};
const cites = (key: keyof typeof ENERGY_CONTEXT, id: string) => expect(ENERGY_CONTEXT[key].sources.map((s) => s.id)).toContain(id);
/** Long date ("March 31, 2022") of an action's ISO date. */
const longDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
/** Last weekly SPR reading in a month ("2022-3"), in the prose's short form ("567.6M"). */
const sprAtEndOf = (ym: string) => bbl((spr.filter(([d]) => monthYear(d) === ym).at(-1) as [number, number])[1]);
const contextCases: Record<keyof typeof ENERGY_CONTEXT, { says: string[]; check: () => void }> = {
  oil: {
    says: ["Public Law 114-113, signed December 18, 2015", "repealed the federal restriction on crude oil exports", "the dashed line under Exports & imports", "rose from 464.6K barrels a day in 2015 to 3M in 2019", "when total exports first topped imports"],
    check: () => {
      const a = action("2015-12-18-crude-export-ban-repealed");
      expect(longDate(a.date)).toBe("December 18, 2015");
      expect(a.description).toMatch(/Public Law 114-113/);
      expect(a.description).toMatch(/bars federal officials from imposing or enforcing a restriction on crude oil exports/);
      expect(a.sources[0].url).toBe(SOURCE_LINKS["plaw-114-113"]);
      const crude = mean("cexp");
      expect(bbl(crude.get(2015) as number)).toBe("464.6K");
      expect(bbl(crude.get(2019) as number)).toBe("3M");
      // Exports first topped imports in October 2019 (the takeaway's claim, checked above).
      expect((raw.get(KEY_SERIES.net) ?? []).find((r) => r.value < 0)?.date.slice(0, 4)).toBe("2019");
    },
  },
  lng: {
    // DOE Order 3357 (November 2013), at 3: Sabine Pass Order 2961 (May 2011, conditional) was "the Department's first order granting a
    // long-term authorization to export LNG produced in the lower-48 states to non-FTA countries"; Order 2961-A made it final.
    says: ["On August 7, 2012, DOE made final Sabine Pass’s approval to export LNG to countries without a free trade agreement", "the first for lower-48 gas", "Yearly exports rose from 28B cubic feet in 2015", "before Sabine Pass’s first cargo", "to 5.5 trillion in 2025"],
    check: () => {
      const a = action("2012-08-07-lng-sabine-pass-final");
      expect(longDate(a.date)).toBe("August 7, 2012");
      expect(a.description).toMatch(/final long-term authorization to export LNG to countries without a free trade agreement/);
      expect(a.sources[0].url).toBe(SOURCE_LINKS["doe-sabine-pass-docket"]);
      cites("lng", "doe-lng-order-3357");
      const cargo = action("2016-02-24-lng-first-sabine-pass-cargo");
      expect(Number(cargo.date.slice(0, 4))).toBeGreaterThan(2015);
      const tot = sum("lng");
      expect(Math.round((tot.get(2015) as number) / 1000)).toBe(28);
      expect(((tot.get(2025) as number) / 1e6).toFixed(1)).toBe("5.5");
    },
  },
  spr: {
    // DOE release history: 2022 IEA coordinated release "180.0" MMbbl; FY2022 mandated sales "38 million barrels … delivered in 2022".
    says: ["Biden authorized selling up to 180M barrels on March 31, 2022", "38M of mandated sales", "fell from 568.3M barrels that month to 372.4M by December", "172M-barrel exchange authorized March 11, 2026", "drew it below the 2023 low by June"],
    check: () => {
      const sale = action("2022-03-31-spr-180-million-sale");
      expect(longDate(sale.date)).toBe("March 31, 2022");
      expect(sale.description).toMatch(/President Biden's March 31, 2022 announcement authorized the sale of up to 180 million barrels/);
      expect(sale.sources.map((x) => x.url)).toContain(SOURCE_LINKS["doe-spr-history"]);
      cites("spr", "doe-spr-history");
      expect(sprAtEndOf("2022-3")).toBe("568.3M");
      expect(sprAtEndOf("2022-12")).toBe("372.4M");
      const ex = action("2026-03-11-spr-172-million-exchange");
      expect(longDate(ex.date)).toBe("March 11, 2026");
      expect(ex.kind).toBe("release_exchange");
      expect(ex.description).toMatch(/172 million barrels from the SPR/);
      expect(ex.sources[0].url).toBe(SOURCE_LINKS["doe-spr-172m-exchange-2026"]);
      // The 2023 low (346.8M, July 2023) is first undercut in June 2026, after the exchange.
      const low = spr.filter(([d]) => dateOfDay(d).year < 2026 && dateOfDay(d).year >= 2023).reduce((a, b) => (b[1] < a[1] ? b : a));
      const below = spr.find(([d, v]) => dateOfDay(d).year >= 2026 && v < low[1]);
      expect(below && monthYear(below[0])).toBe("2026-6");
    },
  },
};

describe("Energy card takeaways", () => {
  for (const [key, c] of Object.entries(cases) as [keyof typeof ENERGY_TAKEAWAYS, (typeof cases)[keyof typeof ENERGY_TAKEAWAYS]][]) {
    it(`${ENERGY_TAKEAWAYS[key].title}: "${ENERGY_TAKEAWAYS[key].takeaway.slice(0, 48)}…" holds`, () => {
      for (const phrase of c.says) expect(ENERGY_TAKEAWAYS[key].takeaway).toContain(phrase);
      c.check();
    });
  }

  it("stays short and descriptive: two sentences, at most 45 words, no causes or open-ended claims", () => {
    for (const s of Object.values(ENERGY_TAKEAWAYS)) {
      const sentences = s.takeaway.replaceAll("U.S.", "US").split(/(?<=\.)\s+/);
      expect(sentences.length, s.title).toBeLessThanOrEqual(2);
      expect(s.takeaway.split(/\s+/).length, s.title).toBeLessThanOrEqual(45);
      expect(s.takeaway, s.title).not.toMatch(/\b(since|still|soared|plunged|thanks to)\b/i);
    }
  });

  for (const [key, c] of Object.entries(contextCases) as [keyof typeof ENERGY_CONTEXT, (typeof contextCases)[keyof typeof ENERGY_CONTEXT]][]) {
    it(`context, ${ENERGY_TAKEAWAYS[key].title}: holds and names real sources`, () => {
      const line: ContextEntry = ENERGY_CONTEXT[key];
      for (const phrase of c.says) expect(line.text).toContain(phrase);
      for (const src of line.sources) expect(SOURCE_LINKS[src.id], src.id).toMatch(/^https:\/\//);
      c.check();
    });
  }

  it("every context line belongs to a card, stays short and makes no causal claim of its own", () => {
    expect(Object.keys(ENERGY_CONTEXT).sort()).toEqual(Object.keys(contextCases).sort());
    for (const [key, line] of Object.entries(ENERGY_CONTEXT)) {
      expect(line.text.replace(/U\.S\./g, "US").split(/(?<=\.)\s+(?=[A-Z])/).length, key).toBeLessThanOrEqual(2);
      expect(line.text.split(/\s+/).length, key).toBeLessThanOrEqual(45);
      expect(line.text, key).not.toMatch(UNCOMPACT_FIGURE);
      // A cause is only ever EIA's or DOE's own ("EIA cites"), never the page's; no price move is pinned on a policy.
      expect(line.text, key).not.toMatch(/\b(because|due to|caused|led to|drove|thanks to|soared|plunged|prices?)\b/i);
    }
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ENERGY_TAKEAWAYS } from "../components/energy/takeaways";
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
const millions = (thousands: number) => (thousands / 1000).toFixed(1);
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
    says: ["Production averaged 6.8 million barrels a day in 2008, its lowest year", "21.2 million in 2025", "the first year in records back to 1973 that it topped products supplied", "Products supplied ranged between 14.5 million (April 2020) and 21.7 million (August 2005)"],
    check: () => {
      const prod = mean("prod");
      const lowest = [...prod.keys()].reduce((a, b) => ((prod.get(b) as number) < (prod.get(a) as number) ? b : a));
      expect(lowest).toBe(2008);
      expect(millions(prod.get(2008) as number)).toBe("6.8");
      expect(millions(prod.get(2025) as number)).toBe("21.2");
      const rp = rawYearly(KEY_SERIES.prod);
      const rs = rawYearly(KEY_SERIES.supplied);
      expect(raw.get(KEY_SERIES.prod)?.[0].date).toBe("1973-01-01");
      expect(raw.get(KEY_SERIES.supplied)?.[0].date).toBe("1973-01-01");
      expect(Math.min(...rp.values())).toBe(rp.get(2008));
      const topped = [...rp.keys()].filter((y) => (rp.get(y) as number) > (rs.get(y) as number));
      expect(topped[0]).toBe(2025);
      const hi = argMax(m.supplied);
      expect(monthLabel(hi)).toBe("August 2005");
      expect(millions(m.supplied[hi] as number)).toBe("21.7");
      const lo = argMin(m.supplied);
      expect(monthLabel(lo)).toBe("April 2020");
      expect(millions(m.supplied[lo] as number)).toBe("14.5");
    },
  },
  oil: {
    says: ["Net petroleum imports peaked at 13.4 million barrels a day in August 2006", "In October 2019 exports topped imports for the first time in monthly records back to 1973", "net exporter every year from 2020 through 2025"],
    check: () => {
      const hi = argMax(m.net);
      expect(monthLabel(hi)).toBe("August 2006");
      expect(millions(m.net[hi] as number)).toBe("13.4");
      const rows = raw.get(KEY_SERIES.net) ?? [];
      expect(rows[0].date).toBe("1973-01-01");
      expect(rows.find((r) => r.value < 0)?.date).toBe("2019-10-01");
      const net = mean("net");
      for (const y of range(2020, 2025)) expect(net.get(y), String(y)).toBeLessThan(0);
    },
  },
  lng: {
    says: ["under 16 billion cubic feet a month from 1997 through 2015", "After Sabine Pass’s first cargo sailed in February 2016", "the yearly total rose each year through 2025", "March 2026 set the monthly record of 573 billion"],
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
      expect(Math.round((m.lng[rec] as number) / 1000)).toBe(573);
    },
  },
  spr: {
    says: ["peaked at 727 million barrels in January 2010", "fell to a low of 347 million in July 2023", "refilled to 415 million by March 2026, when an emergency exchange was authorized", "fell below the 2023 low in June 2026"],
    check: () => {
      const peak = spr.reduce((a, b) => (b[1] > a[1] ? b : a));
      expect(monthYear(peak[0])).toBe("2010-1");
      expect(Math.round(peak[1] / 1000)).toBe(727);
      const before2026 = spr.filter(([d]) => d > peak[0] && dateOfDay(d).year < 2026);
      const low = before2026.reduce((a, b) => (b[1] < a[1] ? b : a));
      expect(monthYear(low[0])).toBe("2023-7");
      expect(Math.round(low[1] / 1000)).toBe(347);
      const exchange = actions.find((a) => a.area === "spr" && a.kind === "release_exchange" && a.date.startsWith("2026-03"));
      expect(exchange?.label_short).toMatch(/emergency exchange/);
      const exchangeDay = spr.findIndex(([d]) => monthYear(d) === "2026-3");
      const refill = spr.slice(0, exchangeDay + 4).filter(([d]) => d > low[0]).reduce((a, b) => (b[1] > a[1] ? b : a));
      expect(Math.round(refill[1] / 1000)).toBe(415);
      expect(spr.filter(([d]) => d > low[0]).every(([, v]) => v < 415500)).toBe(true);
      const below = spr.find(([d, v]) => d > refill[0] && v < low[1]);
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
});

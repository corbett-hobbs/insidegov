import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TROOPS_BREAK_NOTE, TROOPS_CONTEXT, TROOPS_TAKEAWAYS } from "../components/troops/takeaways";
import type { ContextEntry } from "./chart-context";
import { SOURCE_LINKS } from "./source-links";
import { administration } from "./executive-orders-entities";
import { buildTroopsPayload, decodeTroops, periodView, stackByRegion, topHostRuns, topHostsByYear } from "./troops-derive";
import { historyMeta, historyRow, troopsMeta, troopsRow } from "./troops-entities";
import { REGION_IDS } from "./troops-regions";

/**
 * Every figure a National security card's takeaway cites, checked against the committed pipeline output through the
 * same derive functions the page draws with, in its default view (every year, all countries, all branches). A data
 * refresh that makes a sentence untrue fails here: rewrite the takeaway in components/troops/takeaways.ts, then this
 * check. The 2018 claims stay on the permanent-assignment side of the Dec 2017 break, and stop at 2025, the last full
 * September table.
 */

const read = (f: string) => JSON.parse(readFileSync(`pipeline/output/${f}`, "utf8")) as unknown[];
const payload = buildTroopsPayload(
  read("troops_location.json").map((r) => troopsRow.parse(r)),
  troopsMeta.parse(read("troops_location_meta.json")),
  read("administrations.json").map((r) => administration.parse(r)),
  { rows: read("troops_history.json").map((r) => historyRow.parse(r)), meta: historyMeta.parse(read("troops_history_meta.json")) },
);
const data = decodeTroops(payload);
const last = payload.years.length - 1;
const yidx = (fy: number) => payload.years.findIndex((y) => y.fy === fy);
const fyRange = (from: number, to: number) => payload.years.map((_, i) => i).filter((i) => payload.years[i].fy >= from && payload.years[i].fy <= to);
const placeName = (i: number) => payload.places[i].name;
const k = (v: number) => Math.round(v / 1000);

const stacks = stackByRegion(data, 0, 0, last);
const stackOf = (fy: number) => stacks[yidx(fy)];
const views = (from: number, to: number) => fyRange(from, to).map((i) => periodView(data, 0, payload.years[i].period));
const tops = topHostsByYear(data, 0, 0, last);
const runs = topHostRuns(tops).map((r) => ({ name: placeName(r.place), from: payload.years[r.from].fy, to: payload.years[r.to].fy }));
const run = (name: string, from: number) => runs.find((r) => r.name === name && r.from === from);

const cases: Record<keyof typeof TROOPS_TAKEAWAYS, { says: string[]; check: () => void }> = {
  abroad: {
    says: ["highest in 1953, at about 1.08 million", "peaked again at 1.04 million in 1968", "most were in East Asia and the Pacific", "From 2018 through 2025, counting only permanent assignments", "between about 160,000 and 169,000"],
    check: () => {
      expect(payload.years[0].fy).toBe(1953);
      const totals = stacks.map((s) => s.total);
      expect(Math.max(...totals)).toBe(stackOf(1953).total);
      expect(Math.round(stackOf(1953).total / 10_000) / 100).toBe(1.08);
      // 1968 is the highest year after 1953, the top of the 1965-72 rise.
      expect(Math.max(...totals.slice(1))).toBe(stackOf(1968).total);
      expect(Math.round(stackOf(1968).total / 10_000) / 100).toBe(1.04);
      const eap = REGION_IDS.indexOf("east_asia_pacific");
      for (const fy of [1953, 1968]) expect(stackOf(fy).regions[eap] / stackOf(fy).total, `${fy}`).toBeGreaterThan(0.5);
      expect(payload.years[payload.breakYear].fy).toBe(2018);
      const recent = fyRange(2018, 2025).map((i) => stacks[i]);
      expect(recent.every((s) => !payload.years[s.yi].partial && payload.periods[s.pi].basis === "permanently_assigned")).toBe(true);
      expect(k(Math.min(...recent.map((s) => s.total)))).toBe(160);
      expect(k(Math.max(...recent.map((s) => s.total)))).toBe(169);
    },
  },
  map: {
    says: ["From 2018 through 2025", "Japan, Germany and South Korea were the three largest hosts every year", "72% to 74% of troops at foreign hosts", "No more than 12 of the 154 to 168 host countries had 1,000 or more"],
    check: () => {
      const vs = views(2018, 2025);
      expect(vs).toHaveLength(8);
      for (const v of vs) expect(v.ranked.slice(0, 3).map((r) => placeName(r.place))).toEqual(["Japan", "Germany", "South Korea"]);
      const shares = vs.map((v) => Math.round((100 * v.ranked.slice(0, 3).reduce((a, r) => a + r.value, 0)) / v.hostTotal));
      expect(Math.min(...shares)).toBe(72);
      expect(Math.max(...shares)).toBe(74);
      const hosts = vs.map((v) => v.ranked.length);
      expect(Math.min(...hosts)).toBe(154);
      expect(Math.max(...hosts)).toBe(168);
      expect(Math.max(...vs.map((v) => v.ranked.filter((r) => r.value >= 1000).length))).toBe(12);
    },
  },
  firstPlace: {
    says: ["Germany was the largest host every year from 1954 through 2002 except 1966 to 1971, when Vietnam led", "a peak of about 537,000 in 1968", "Iraq led from 2003 to 2009", "Afghanistan from 2010 to 2012", "Japan from 2013 through 2025"],
    check: () => {
      expect(run("Germany", 1954)?.to).toBe(1965);
      expect(run("Vietnam", 1966)?.to).toBe(1971);
      expect(run("Germany", 1972)?.to).toBe(2002);
      expect(run("Iraq", 2003)?.to).toBe(2009);
      expect(run("Afghanistan", 2010)?.to).toBe(2012);
      // Japan's run reaches the latest (partial) year; the takeaway stops at the last full table.
      expect(run("Japan", 2013)?.to).toBeGreaterThanOrEqual(2025);
      const vietnam = fyRange(1966, 1971).map((i) => tops[i].top[0].value);
      expect(Math.max(...vietnam)).toBe(tops[yidx(1968)].top[0].value);
      expect(k(tops[yidx(1968)].top[0].value)).toBe(537);
    },
  },
};

/**
 * Every figure a context line cites (rule 7d), read through the same derive functions as the takeaways. The dated events
 * sit outside the pipeline, so each date and number is pinned to the phrase the line uses and must cite that document.
 */
const tenth = (v: number) => Math.round(v / 100) / 10;
const cites = (key: keyof typeof TROOPS_CONTEXT, id: string) => expect(TROOPS_CONTEXT[key].sources.map((s) => s.id)).toContain(id);
const contextCases: Record<keyof typeof TROOPS_CONTEXT, { says: string[]; check: () => void }> = {
  abroad: {
    // archives.gov: "This armistice signed on July 27, 1953, formally ended the war in Korea." 78 Stat. 384 (Public Law 88-408) is
    // dated August 10, 1964, "To promote the maintenance of international peace and security in southeast Asia".
    says: ["Korean War armistice was signed July 27, 1953, after the June 1953 high", "troops abroad fell to 740.4k by 1955", "Public Law 88-408 (August 10, 1964) authorized force in Southeast Asia", "troops abroad rose from 594.6k that year to the 1.04M peak in 1968"],
    check: () => {
      const y53 = payload.years[yidx(1953)];
      expect(payload.periods[y53.period].snapshot).toBe("june");
      expect(Math.max(...stacks.map((s) => s.total))).toBe(stackOf(1953).total);
      expect(stackOf(1954).total).toBeLessThan(stackOf(1953).total);
      expect(stackOf(1955).total).toBeLessThan(stackOf(1954).total);
      expect(tenth(stackOf(1955).total)).toBe(740.4);
      expect(tenth(stackOf(1964).total)).toBe(594.6);
      for (let fy = 1965; fy <= 1968; fy++) expect(stackOf(fy).total, `${fy}`).toBeGreaterThan(stackOf(fy - 1).total);
      // "the 1.04M peak in 1968": the highest year after 1953, as the takeaway says.
      expect(Math.max(...stacks.slice(1).map((s) => s.total))).toBe(stackOf(1968).total);
      expect(Math.round(stackOf(1968).total / 10_000) / 100).toBe(1.04);
      cites("abroad", "korea-armistice-1953");
      cites("abroad", "plaw-88-408");
    },
  },
  map: {
    // DoD statement, July 29, 2020: "approximately 11,900 military personnel will be repositioned from Germany". Remarks,
    // February 4, 2021: "while this review is taking place, we'll be stopping any planned troop withdrawals from Germany."
    says: ["On July 29, 2020, the Defense Department said about 11,900 troops would be moved out of Germany", "on February 4, 2021, President Biden said planned withdrawals would stop", "Germany stayed the second-largest host", "with 34.0k to 36.3k troops every year from 2018 through 2025"],
    check: () => {
      const vs = views(2018, 2025);
      expect(vs).toHaveLength(8);
      for (const v of vs) expect(placeName(v.ranked[1].place)).toBe("Germany");
      const de = vs.map((v) => v.ranked[1].value);
      expect(tenth(Math.min(...de)).toFixed(1)).toBe("34.0");
      expect(tenth(Math.max(...de))).toBe(36.3);
      cites("map", "dod-eucom-posture-2020");
      cites("map", "biden-state-dept-2021");
    },
  },
  firstPlace: {
    // PLAW-107publ243 is dated Oct. 16, 2002, "To authorize the use of United States Armed Forces against Iraq". State of the
    // Union, February 12, 2013: "over the next year, another 34,000 American troops will come home from Afghanistan."
    says: ["Public Law 107-243 (October 16, 2002) authorized force against Iraq, the largest host from 2003", "President Obama’s February 12, 2013 State of the Union said 34,000 more troops would leave Afghanistan within a year", "Afghanistan fell to 48.8k in 2013, below Japan’s 53.0k"],
    check: () => {
      expect(run("Germany", 1972)?.to).toBe(2002);
      expect(run("Iraq", 2003)).toBeDefined();
      const v12 = views(2012, 2012)[0];
      const v13 = views(2013, 2013)[0];
      const of = (v: typeof v12, name: string) => v.ranked.find((r) => placeName(r.place) === name)!.value;
      expect(placeName(v12.ranked[0].place)).toBe("Afghanistan");
      expect(of(v13, "Afghanistan")).toBeLessThan(of(v12, "Afghanistan"));
      expect(tenth(of(v13, "Afghanistan"))).toBe(48.8);
      expect(tenth(of(v13, "Japan"))).toBe(53);
      expect(placeName(v13.ranked[0].place)).toBe("Japan");
      expect(placeName(v13.ranked[1].place)).toBe("Afghanistan");
      cites("firstPlace", "plaw-107-243");
      cites("firstPlace", "obama-sotu-2013");
    },
  },
};

describe("National security card takeaways", () => {
  for (const [key, c] of Object.entries(contextCases) as [keyof typeof TROOPS_CONTEXT, (typeof contextCases)[keyof typeof TROOPS_CONTEXT]][]) {
    it(`context, ${TROOPS_TAKEAWAYS[key].title}: holds and names real sources`, () => {
      const line: ContextEntry = TROOPS_CONTEXT[key];
      for (const phrase of c.says) expect(line.text).toContain(phrase);
      for (const src of line.sources) expect(SOURCE_LINKS[src.id], src.id).toMatch(/^https:\/\//);
      expect(line.text.split(/(?<=\.)\s/).length).toBeLessThanOrEqual(2);
      expect(line.text.split(/\s+/).length).toBeLessThanOrEqual(45);
      expect(line.text).not.toMatch(/\b(because|due to|led to|drove)\b/i);
      c.check();
    });
  }

  for (const [key, c] of Object.entries(cases) as [keyof typeof TROOPS_TAKEAWAYS, (typeof cases)[keyof typeof TROOPS_TAKEAWAYS]][]) {
    it(`${TROOPS_TAKEAWAYS[key].title}: "${TROOPS_TAKEAWAYS[key].takeaway.slice(0, 48)}…" holds`, () => {
      for (const phrase of c.says) expect(TROOPS_TAKEAWAYS[key].takeaway).toContain(phrase);
      c.check();
    });
  }

  it("Data note on the Dec 2017 counting change holds against troops_location_meta.json", () => {
    const b = troopsMeta.parse(read("troops_location_meta.json")).break;
    expect(b.first_period_after).toBe("2017-12");
    expect(TROOPS_BREAK_NOTE).toContain("from the Dec 2017 table, only personnel permanently assigned to a location, leaving out temporary duty and contingency deployments");
    expect(b.after).toMatch(/permanently assigned personnel only; temporary duty and contingency deployments are not included/);
    const [from, to] = b.after.match(/fell ([\d,]+) → ([\d,]+) between Sep and Dec 2017 while the U.S. total rose, a reallocation, not a withdrawal/)!.slice(1);
    expect(TROOPS_BREAK_NOTE).toContain(`went from ${from} in Sep to ${to} in Dec 2017 while the U.S. total rose, a reallocation, not a withdrawal`);
    expect([...b.contingency_hosts_not_reported].sort()).toEqual(["Afghanistan", "Iraq", "Syria"]);
    expect(b.not_reported_periods[0]).toBe("2017-12");
    expect(b.not_reported_periods.at(-1)).toBe("2021-09");
    expect(TROOPS_BREAK_NOTE).toContain("Afghanistan, Iraq and Syria print blank, not zero, from Dec 2017 through Sep 2021");
  });

  it("stays short: two sentences, at most 45 words", () => {
    for (const s of Object.values(TROOPS_TAKEAWAYS)) {
      expect(s.takeaway.split(/(?<=[.;])\s/).filter((x) => x.endsWith(".")).length, s.title).toBeLessThanOrEqual(2);
      expect(s.takeaway.split(/\s+/).length, s.title).toBeLessThanOrEqual(45);
    }
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEMO_TAKEAWAYS } from "../components/demographics/takeaways";
import type { ChamberView } from "./chamber";
import { fmtShare } from "./chart-bars";
import { SLIDER_BOUNDS, windowRows } from "./demographics-chart";
import { buildDemographics } from "./demographics-derive";
import type { CaucusGroup, DemoCongress } from "./demographics-types";
import { legislator, term } from "./entities";
import { administration } from "./executive-orders-entities";
import { HISTORICAL_ADMINISTRATIONS } from "./troops-presidents";

/**
 * Every figure a Congress demographics card's takeaway cites, checked against the committed pipeline output through the
 * same `buildDemographics` the page uses, in each chamber view's full default window. Shares are compared as the chart
 * prints them (`fmtShare`). A data refresh that makes a sentence untrue fails here: rewrite the takeaway in
 * components/demographics/takeaways.ts, then this check.
 */

const out = (f: string): unknown[] => JSON.parse(readFileSync(`pipeline/output/${f}`, "utf8"));
const payload = buildDemographics(
  out("legislators.json").map((r) => legislator.parse(r)),
  out("terms.json").map((r) => term.parse(r)),
  [...HISTORICAL_ADMINISTRATIONS, ...out("administrations.json").map((r) => administration.parse(r))],
);
const rowsOf = (v: ChamberView) => windowRows(payload.views[v], SLIDER_BOUNDS);
const between = (v: ChamberView, from: number, to: number) => rowsOf(v).filter((r) => r.congress >= from && r.congress <= to);
const at = (v: ChamberView, c: number) => rowsOf(v).find((r) => r.congress === c)!;

/** The Congress where `f` is lowest (or highest) in the view's window, and that value; ties go to the first. */
function extreme(v: ChamberView, f: (r: DemoCongress) => number, dir: "min" | "max", rows = rowsOf(v)) {
  let best = rows[0];
  for (const r of rows) if (dir === "min" ? f(r) < f(best) : f(r) > f(best)) best = r;
  return { congress: best.congress, value: f(best) };
}
const median = (k: CaucusGroup) => (r: DemoCongress) => r.age[k].median!;
const womenAll = (r: DemoCongress) => r.women.D + r.women.R + r.women.O;
/** Share of members in a tenure band (0: up to 2 years … 3: over 20 years), as the chart prints it. */
const band = (i: number) => (r: DemoCongress) => r.tenure[i] / r.seats;
const firstWhere = (v: ChamberView, f: (r: DemoCongress) => boolean) => rowsOf(v).find(f)?.congress;
const span = (v: ChamberView, c: number) => `${at(v, c).year}–${at(v, c).year + 1}`;

type View = { says: string[]; check: () => void };
const cases: Record<keyof typeof DEMO_TAKEAWAYS, Record<ChamberView, View>> = {
  age: {
    both: {
      says: ["49.0 for Republicans in the 97th Congress (1981–1982)", "49.5 for Democrats in the 98th", "peaked at 62.2 in the 115th (2017–2018)", "older caucus from the 104th through the 118th (1995–2024)"],
      check: () => {
        expect(extreme("both", median("R"), "min")).toEqual({ congress: 97, value: 49.0 });
        expect(extreme("both", median("D"), "min")).toEqual({ congress: 98, value: 49.5 });
        expect(span("both", 97)).toBe("1981–1982");
        expect(extreme("both", median("D"), "max")).toEqual({ congress: 115, value: 62.2 });
        expect(span("both", 115)).toBe("2017–2018");
        for (const r of between("both", 104, 118)) expect(r.age.D.median!, `${r.congress}`).toBeGreaterThan(r.age.R.median!);
        expect(at("both", 103).age.D.median!).toBeLessThanOrEqual(at("both", 103).age.R.median!);
        expect(at("both", 104).year).toBe(1995);
        expect(at("both", 118).year + 1).toBe(2024);
      },
    },
    house: {
      says: ["48.2 for Republicans in the 97th Congress (1981–1982)", "48.3 for Democrats in the 98th", "peaked at 62.2 in the 115th (2017–2018)", "older caucus from the 103rd through the 118th (1993–2024)"],
      check: () => {
        expect(extreme("house", median("R"), "min")).toEqual({ congress: 97, value: 48.2 });
        expect(extreme("house", median("D"), "min")).toEqual({ congress: 98, value: 48.3 });
        expect(extreme("house", median("D"), "max")).toEqual({ congress: 115, value: 62.2 });
        for (const r of between("house", 103, 118)) expect(r.age.D.median!, `${r.congress}`).toBeGreaterThan(r.age.R.median!);
        expect(at("house", 102).age.D.median!).toBeLessThanOrEqual(at("house", 102).age.R.median!);
        expect(span("house", 103).slice(0, 4)).toBe("1993");
      },
    },
    senate: {
      says: ["50.1 for Republicans in the 97th Congress (1981–1982)", "52.4 for Democrats in the 95th (1977–1978)", "Republicans peaked at 65.1 in the 117th (2021–2022)", "over 60 in every Congress from the 108th through the 119th"],
      check: () => {
        expect(extreme("senate", median("R"), "min")).toEqual({ congress: 97, value: 50.1 });
        expect(extreme("senate", median("D"), "min")).toEqual({ congress: 95, value: 52.4 });
        expect(span("senate", 95)).toBe("1977–1978");
        expect(extreme("senate", median("R"), "max")).toEqual({ congress: 117, value: 65.1 });
        expect(span("senate", 117)).toBe("2021–2022");
        for (const r of between("senate", 108, 119)) expect(r.age.D.median!, `${r.congress}`).toBeGreaterThan(60);
        expect(at("senate", 107).age.D.median!).toBeLessThanOrEqual(60);
      },
    },
  },
  women: {
    both: {
      says: ["never had more than 33 women from the 73rd through the 102nd (1933–1992)", "the 103rd (1993–1994) had 54", "the 113th (2013–2014) was the first with over 100", "from the 100th through the 119th"],
      check: () => {
        expect(extreme("both", womenAll, "max", between("both", 73, 102)).value).toBe(33);
        expect(at("both", 102).year + 1).toBe(1992);
        expect(womenAll(at("both", 103))).toBe(54);
        expect(firstWhere("both", (r) => womenAll(r) > 100)).toBe(113);
        expect(span("both", 113)).toBe("2013–2014");
        for (const r of between("both", 100, 119)) expect(r.women.D, `${r.congress}`).toBeGreaterThan(r.women.R);
        expect(at("both", 99).women.D).toBeLessThanOrEqual(at("both", 99).women.R);
      },
    },
    house: {
      says: ["never had more than 29 women from the 73rd through the 102nd Congress (1933–1992)", "the 103rd (1993–1994) had 47", "the 116th (2019–2020) was the first with over 100", "from the 89th through the 119th"],
      check: () => {
        expect(extreme("house", womenAll, "max", between("house", 73, 102)).value).toBe(29);
        expect(womenAll(at("house", 103))).toBe(47);
        expect(firstWhere("house", (r) => womenAll(r) > 100)).toBe(116);
        expect(span("house", 116)).toBe("2019–2020");
        for (const r of between("house", 89, 119)) expect(r.women.D, `${r.congress}`).toBeGreaterThan(r.women.R);
        expect(at("house", 88).women.D).toBeLessThanOrEqual(at("house", 88).women.R);
      },
    },
    senate: {
      says: ["never had more than 3 women from the 73rd through the 101st Congress (1933–1990)", "the 103rd (1993–1994) had 7", "the 113th (2013–2014) was the first with 20", "from the 102nd through the 119th"],
      check: () => {
        expect(extreme("senate", womenAll, "max", between("senate", 73, 101)).value).toBe(3);
        expect(at("senate", 101).year + 1).toBe(1990);
        expect(womenAll(at("senate", 103))).toBe(7);
        expect(firstWhere("senate", (r) => womenAll(r) >= 20)).toBe(113);
        expect(womenAll(at("senate", 113))).toBe(20);
        for (const r of between("senate", 102, 119)) expect(r.women.D, `${r.congress}`).toBeGreaterThan(r.women.R);
        expect(at("senate", 101).women.D).toBeLessThanOrEqual(at("senate", 101).women.R);
      },
    },
  },
  tenure: {
    both: {
      says: ["over 20 years in Congress were 6.2% of the 73rd Congress (1933–1934)", "peaked at 20% in the 115th (2017–2018)", "up to 2 years were 33% of the 73rd", "no more than 23% from the 79th through the 119th"],
      check: () => {
        expect(fmtShare(band(3)(at("both", 73)))).toBe("6.2%");
        expect(span("both", 73)).toBe("1933–1934");
        const peak = extreme("both", band(3), "max");
        expect([peak.congress, fmtShare(peak.value)]).toEqual([115, "20%"]);
        expect(fmtShare(band(0)(at("both", 73)))).toBe("33%");
        expect(fmtShare(extreme("both", band(0), "max", between("both", 79, 119)).value)).toBe("23%");
      },
    },
    house: {
      says: ["over 20 years in Congress were 4% of the 73rd Congress (1933–1934)", "peaked at 17% in the 115th (2017–2018)", "up to 2 years were 36% of the 73rd", "no more than 26% from the 79th through the 119th"],
      check: () => {
        expect(fmtShare(band(3)(at("house", 73)))).toBe("4%");
        const peak = extreme("house", band(3), "max");
        expect([peak.congress, fmtShare(peak.value)]).toEqual([115, "17%"]);
        expect(fmtShare(band(0)(at("house", 73)))).toBe("36%");
        expect(fmtShare(extreme("house", band(0), "max", between("house", 79, 119)).value)).toBe("26%");
      },
    },
    senate: {
      says: ["over 20 years in Congress were 8.6% of the 82nd Congress (1951–1952), the low", "43% of the 110th (2007–2008), the peak", "under 10% in every Congress from the 98th through the 119th but the 111th"],
      check: () => {
        const low = extreme("senate", band(3), "min");
        expect([low.congress, fmtShare(low.value)]).toEqual([82, "8.6%"]);
        expect(span("senate", 82)).toBe("1951–1952");
        const peak = extreme("senate", band(3), "max");
        expect([peak.congress, fmtShare(peak.value)]).toEqual([110, "43%"]);
        expect(span("senate", 110)).toBe("2007–2008");
        expect(between("senate", 98, 119).filter((r) => band(0)(r) >= 0.1).map((r) => r.congress)).toEqual([111]);
      },
    },
  },
};

describe("Congress demographics card takeaways", () => {
  it("cover the 73rd through the 119th Congress by default", () => {
    for (const v of ["both", "house", "senate"] as const) expect([rowsOf(v)[0].congress, rowsOf(v).at(-1)!.congress]).toEqual([73, 119]);
  });

  for (const key of Object.keys(cases) as (keyof typeof DEMO_TAKEAWAYS)[]) {
    for (const view of ["both", "house", "senate"] as const) {
      const text = DEMO_TAKEAWAYS[key].takeaway[view];
      it(`${DEMO_TAKEAWAYS[key].title} (${view}): "${text.slice(0, 48)}…" holds`, () => {
        for (const phrase of cases[key][view].says) expect(text).toContain(phrase);
        cases[key][view].check();
      });
    }
  }

  it("stays short: two sentences, at most 45 words", () => {
    for (const s of Object.values(DEMO_TAKEAWAYS))
      for (const [view, text] of Object.entries(s.takeaway)) {
        expect(text.split(/(?<=[.;])\s/).filter((x) => x.endsWith(".")).length, `${s.title} (${view})`).toBeLessThanOrEqual(2);
        expect(text.split(/\s+/).length, `${s.title} (${view})`).toBeLessThanOrEqual(45);
      }
  });
});

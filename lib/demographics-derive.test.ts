import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { ageOn, ageYearsOn, buildDemographics, buildRoster, caucusGroup, conveningDate, isVotingTerm, presidentForCongress, type DemoLegislator, type DemoTerm, type RosterLegislator } from "./demographics-derive";
import { CONVENING, tenureBand } from "./demographics-entities";
import { legislator, term } from "./entities";
import { administration } from "./executive-orders-entities";
import { HISTORICAL_ADMINISTRATIONS } from "./troops-presidents";

const out = (f: string): unknown[] => JSON.parse(readFileSync(`pipeline/output/${f}`, "utf8"));
const legislators = out("legislators.json").map((r) => legislator.parse(r));
const terms = out("terms.json").map((r) => term.parse(r));
const admins = [...HISTORICAL_ADMINISTRATIONS, ...out("administrations.json").map((r) => administration.parse(r))];
const payload = buildDemographics(legislators, terms, admins);

const L = (id: string, gender: "M" | "F" = "M", birthday?: string): DemoLegislator => ({ bioguide_id: id, gender, ...(birthday ? { birthday } : {}) });
const T = (id: string, c: number, chamber: "house" | "senate" = "house", caucus: string | null = "Democrat", state = "OH"): DemoTerm => ({ bioguide_id: id, congress_number: c, chamber, state, caucus });

describe("convening dates", () => {
  it("match the most common House term start in the first months of each Congress (raw congress-legislators)", () => {
    const R = "pipeline/raw/congress-legislators/";
    const people = [...parse(readFileSync(`${R}legislators-current.yaml`, "utf8")), ...parse(readFileSync(`${R}legislators-historical.yaml`, "utf8"))] as { terms: { type: string; start: string }[] }[];
    for (const [c, day] of Object.entries(CONVENING)) {
      const year = String(1789 + 2 * (Number(c) - 1));
      const n = new Map<string, number>();
      for (const p of people) for (const t of p.terms) if (t.type === "rep" && t.start.startsWith(year) && t.start.slice(5, 7) < "04") n.set(t.start, (n.get(t.start) ?? 0) + 1);
      const top = [...n].sort((a, b) => b[1] - a[1])[0][0];
      expect(day, `${c}th Congress`).toBe(top);
    }
  }, 30_000);
  it("cover 73 through the latest Congress in the data, in order", () => {
    const days = Object.keys(CONVENING).map(Number);
    expect(days[0]).toBe(73);
    expect(days[days.length - 1]).toBe(payload.lastCongress);
    const dates = days.map((c) => conveningDate(c));
    expect([...dates].sort()).toEqual(dates);
  });
});

describe("ageYearsOn", () => {
  it("is exact, so a median can land between whole years", () => {
    expect(ageYearsOn("1950-01-03", "2025-01-03")).toBeCloseTo(75, 1);
    expect(ageYearsOn("1950-07-03", "2025-01-03")).toBeCloseTo(74.5, 1);
  });
});

describe("ageOn", () => {
  it("counts a birthday that falls on the convening day", () => {
    expect(ageOn("1950-01-03", "2025-01-03")).toBe(75);
    expect(ageOn("1950-01-04", "2025-01-03")).toBe(74);
    expect(ageOn("1950-12-31", "2025-01-03")).toBe(74);
  });
});

describe("voting members and caucus", () => {
  it("drops delegates, and Alaska/Hawaii delegates before statehood", () => {
    expect(isVotingTerm({ bioguide_id: "X", congress_number: 100, chamber: "house", state: "PR" })).toBe(false);
    expect(isVotingTerm({ bioguide_id: "X", congress_number: 80, chamber: "house", state: "HI" })).toBe(false);
    expect(isVotingTerm({ bioguide_id: "X", congress_number: 87, chamber: "house", state: "HI" })).toBe(true);
    expect(isVotingTerm({ bioguide_id: "B001127", congress_number: 86, chamber: "house", state: "HI" })).toBe(false);
    expect(isVotingTerm({ bioguide_id: "X", congress_number: 80, chamber: "senate", state: "OH" })).toBe(true);
  });
  it("groups compound caucus names with their party and everything else as other", () => {
    expect([caucusGroup("Democrat"), caucusGroup("Democrat-Liberal"), caucusGroup("Republican"), caucusGroup("Independent"), caucusGroup(null)]).toEqual(["D", "D", "R", "O", "O"]);
  });
});

describe("tenure", () => {
  it("counts back across 1933: first elected in the 63rd, he is in the 11-or-more band in the 73rd", () => {
    const ts = Array.from({ length: 11 }, (_, i) => T("A", 63 + i));
    const p = buildDemographics([L("A")], ts, admins);
    expect(p.views.both[0].tenure).toEqual([0, 0, 0, 1]);
    expect([1, 2, 5, 6, 10, 11].map(tenureBand)).toEqual([0, 1, 1, 2, 2, 3]);
  });
  it("counts gaps and either chamber, once per Congress", () => {
    const ts = [T("A", 70), T("A", 72, "senate"), T("A", 73), T("A", 73, "senate")];
    const p = buildDemographics([L("A")], ts, admins);
    expect(p.views.house[0].tenure).toEqual([0, 1, 0, 0]);
    expect(p.views.senate[0].tenure).toEqual([0, 1, 0, 0]);
    expect(p.views.both[0].seats).toBe(1);
  });
  it("puts a member who is in their first Congress in the first band", () => {
    expect(buildDemographics([L("A")], [T("A", 73)], admins).views.both[0].tenure).toEqual([1, 0, 0, 0]);
  });
});

describe("age, women and the roster", () => {
  const ls = [L("A", "M", "1900-03-09"), L("B", "F", "1890-01-01"), L("C", "F"), L("D", "F", "1900-01-01")];
  const ts = [T("A", 73), T("B", 73, "senate", "Republican"), T("C", 73, "house", "Republican"), T("D", 73, "house", "Independent"), T("A", 73, "house", "Democrat", "PR")];
  const p = buildDemographics(ls, ts, admins).views.both[0];
  it("is every voting member once; delegates are out", () => {
    expect(p.seats).toBe(4);
  });
  it("ages by caucus on the convening day, leaving out members with no birthdate", () => {
    expect(p.age.D).toEqual({ median: 33, average: 33, n: 1 }); // born the day of the convening: 33.0
    expect(p.age.R).toEqual({ median: 43.2, average: 43.2, n: 1 });
    expect(p.ageMissing).toBe(1); // C
  });
  it("counts women by caucus group", () => {
    expect(p.women).toEqual({ D: 0, R: 2, O: 1 });
  });
});

describe("the real data", () => {
  const n = payload.lastCongress - payload.firstCongress + 1;
  it("has one row per Congress in every view", () => {
    for (const v of Object.values(payload.views)) expect(v.map((r) => r.congress)).toEqual(Array.from({ length: n }, (_, i) => 73 + i));
  });
  it("counts Jo Ann Emerson as a Republican in the 105th, so no Congress has an Other woman", () => {
    for (const r of payload.views.both) expect(r.women.O).toBe(0);
  });
  it("never has fewer seat-holders than seats: Senate 96/98/100, House 435", () => {
    for (const r of payload.views.senate) expect(r.seats, `Senate ${r.congress}`).toBeGreaterThanOrEqual(r.congress <= 85 ? 96 : r.congress === 86 ? 98 : 100);
    for (const r of payload.views.house) expect(r.seats, `House ${r.congress}`).toBeGreaterThanOrEqual(435);
  });
  it("stays inside a plausible ceiling (seats plus mid-term replacements)", () => {
    for (const r of payload.views.senate) expect(r.seats).toBeLessThanOrEqual(120);
    for (const r of payload.views.house) expect(r.seats).toBeLessThanOrEqual(470);
  });
  it("Both is Senate plus House, less the few people who held a seat in each chamber in one Congress", () => {
    const both = new Map<number, Set<string>>();
    const by = new Map<string, Set<string>>();
    for (const t of terms) {
      if (t.congress_number < 73 || !isVotingTerm(t)) continue;
      const k = `${t.congress_number}`;
      const s = by.get(`${k}|${t.bioguide_id}`) ?? new Set();
      s.add(t.chamber);
      by.set(`${k}|${t.bioguide_id}`, s);
    }
    for (const [key, ch] of by) if (ch.size === 2) (both.get(Number(key.split("|")[0])) ?? both.set(Number(key.split("|")[0]), new Set()).get(Number(key.split("|")[0]))!).add(key);
    for (let i = 0; i < n; i++) {
      const c = 73 + i;
      const b = payload.views.both[i];
      const s = payload.views.senate[i];
      const h = payload.views.house[i];
      expect(b.seats).toBe(s.seats + h.seats - (both.get(c)?.size ?? 0));
      expect(b.women.D + b.women.R + b.women.O).toBeLessThanOrEqual(s.women.D + s.women.R + s.women.O + h.women.D + h.women.R + h.women.O);
    }
  });
  it("tenure bands add up to the seats, so each tenure bar is 100%", () => {
    for (const v of Object.values(payload.views)) for (const r of v) expect(r.tenure.reduce((a, b) => a + b, 0)).toBe(r.seats);
  });
  it("leaves out few members for want of a birthdate", () => {
    const missing = payload.views.both.reduce((a, r) => a + r.ageMissing, 0);
    const total = payload.views.both.reduce((a, r) => a + r.seats, 0);
    expect(missing / total).toBeLessThan(0.005);
  });
  it("puts the president in office for most of each Congress on it", () => {
    expect(presidentForCongress(admins, 73).president).toBe("Franklin D. Roosevelt");
    expect(presidentForCongress(admins, 79).president).toBe("Harry S. Truman"); // Roosevelt died April 1945
    expect(presidentForCongress(admins, 88).president).toBe("Lyndon B. Johnson"); // Kennedy died Nov 1963
    expect(presidentForCongress(admins, 114).president).toBe("Barack Obama");
    expect(presidentForCongress(admins, 115).president).toBe("Donald Trump"); // convened Jan 3, 2017; inauguration Jan 20
    expect(presidentForCongress(admins, 117).president).toBe("Joe Biden");
    expect(presidentForCongress(admins, 119).term_id).toBe("2025-01-20"); // convened Jan 3, 2025: Trump's second term
    expect(payload.views.both[0].termId).toBe("1933-03-04");
  });
  it("ages run in a plausible range and the latest Congress is older than the 1970s", () => {
    for (const r of payload.views.both) {
      for (const g of ["D", "R"] as const) {
        expect(r.age[g].median).toBeGreaterThan(40);
        expect(r.age[g].median).toBeLessThan(70);
      }
    }
    const row = (c: number) => payload.views.both[c - 73];
    expect(row(118).age.D.average!).toBeGreaterThan(row(95).age.D.average!);
  });
});

describe("roster (the names behind the charts)", () => {
  const rl = (l: (typeof legislators)[number]): RosterLegislator => ({ bioguide_id: l.bioguide_id, birthday: l.birthday, gender: l.gender, name: `${l.name.first} ${l.name.last}`, family: l.name.last, photo: false });
  const roster = buildRoster(legislators.map(rl), terms);
  const medianOf = (v: number[]) => {
    const s = [...v].sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  const inView = (e: (typeof roster.congresses)[number][number], view: "both" | "house" | "senate") => view === "both" || (e[2] & (view === "house" ? 1 : 2)) !== 0;

  it("adds up to every chart figure, Congress by Congress and chamber view (so a list always matches its chart)", () => {
    for (const view of ["both", "house", "senate"] as const) {
      payload.views[view].forEach((r) => {
        const list = roster.congresses[r.congress - roster.firstCongress].filter((e) => inView(e, view));
        const born = (e: (typeof list)[number]) => roster.people[e[0]][2];
        const ages = list.filter((e) => born(e)).map((e) => ageYearsOn(born(e), r.date));
        const label = `${r.congress}th, ${view}`;
        expect(list.length, label).toBe(r.seats);
        expect(list.filter((e) => e[1] === 0).length, label).toBe(r.seatsBy.D);
        expect(list.filter((e) => e[1] === 1).length, label).toBe(r.seatsBy.R);
        expect(list.filter((e) => e[1] === 2).length, label).toBe(r.seatsBy.O);
        expect(list.filter((e) => roster.people[e[0]][3] === 1).length, label).toBe(r.women.D + r.women.R + r.women.O);
        expect(list.reduce((a, e) => a + e[4], 0), label).toBe(r.servedSum);
        expect(list.filter((e) => e[4] === 1).length, label).toBe(r.tenure[0]);
        expect(ages.length, label).toBe(r.ageAll.n);
        if (ages.length) expect(Math.round(medianOf(ages) * 10) / 10, label).toBe(r.ageAll.median);
      });
    }
  });
  it("keeps people A-Z by surname and each Congress's members in that order, every index in range", () => {
    const family = new Map(legislators.map((l) => [l.bioguide_id, l.name.last]));
    const names = roster.people.map((p) => family.get(p[0])!);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    for (const c of roster.congresses) {
      expect(c.map((e) => e[0])).toEqual([...c.map((e) => e[0])].sort((a, b) => a - b));
      for (const e of c) expect(e[0]).toBeLessThan(roster.people.length);
    }
    expect(roster.congresses.length).toBe(payload.lastCongress - roster.firstCongress + 1);
  });
  it("counts tenure and first Congress the way the tenure chart does", () => {
    const pelosi = roster.people.findIndex((p) => p[0] === "P000197");
    const e = roster.congresses[119 - 73].find((x) => x[0] === pelosi)!;
    expect(e[5]).toBe(100); // first sworn in 1987 (the 100th Congress)
    expect(e[4]).toBe(20); // 100th to 119th, counting both
    expect(roster.people[pelosi][5]).toBe(1); // a House profile page
  });
  it("seats someone who held two seats in one Congress once, in both chambers, in the state of the later term", () => {
    const leg = [{ bioguide_id: "A1", gender: "F" as const, name: "Ann Lee", family: "Lee", photo: true, birthday: "1950-01-01" }, { bioguide_id: "B1", gender: "M" as const, name: "Bo Adams", family: "Adams", photo: false }];
    const r = buildRoster(leg, [
      { ...T("A1", 119, "house", "Democrat", "OH"), term_start: "2025-01-03" },
      { ...T("A1", 119, "senate", "Democrat", "KY"), term_start: "2025-03-01" },
      T("A1", 118, "house", "Democrat", "OH"),
      T("B1", 119, "senate", "Republican", "TX"),
    ]);
    expect(r.people.map((p) => p[0])).toEqual(["B1", "A1"]); // Adams before Lee
    const e = r.congresses[119 - 73].find((x) => r.people[x[0]][0] === "A1")!;
    expect(e).toEqual([1, 0, 3, "KY", 2, 118]);
    expect(r.people[1]).toEqual(["A1", "Ann Lee", "1950-01-01", 1, 1, 2]); // Senate profile wins
    expect(r.congresses[118 - 73].map((x) => r.people[x[0]][0])).toEqual(["A1"]);
  });
});

describe("party slices", () => {
  it("add up to the whole in every Congress and chamber view", () => {
    for (const v of Object.values(payload.views)) {
      for (const r of v) {
        for (let b = 0; b < 4; b++) expect(r.tenureBy.D[b] + r.tenureBy.R[b] + r.tenureBy.O[b], `${r.congress}th band ${b}`).toBe(r.tenure[b]);
        expect(r.servedBy.D + r.servedBy.R + r.servedBy.O, `${r.congress}th`).toBe(r.servedSum);
        for (const g of ["D", "R", "O"] as const) expect(r.tenureBy[g].reduce((a, b) => a + b, 0), `${r.congress}th ${g}`).toBe(r.seatsBy[g]);
        expect(r.age.D.n + r.age.R.n + r.age.O.n, `${r.congress}th`).toBe(r.ageAll.n);
      }
    }
  });
});


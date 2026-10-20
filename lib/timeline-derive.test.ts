import { describe, expect, it } from "vitest";
import { buildTimelinePayload, loadTimelineInputs } from "./timeline-build";
import {
  applyVacancyRule,
  buildEras,
  buildSpans,
  chamberYears,
  changePoints,
  eraLabel,
  leanSide,
  matchesQuery,
  placeMarkers,
  powerIndex,
  tileCounts,
  wikiUrl,
  yearsByStatus,
  type CourtMode,
} from "./timeline-derive";
import type { TlJustice } from "./timeline-types";

// The real joined data, pinned to a build date so the right edge doesn't move under the tests.
const data = buildTimelinePayload(loadTimelineInputs(), "2026-10-16");
const idx = powerIndex(data);
const ev = (id: string) => data.events.find((e) => e.id === id)!;
const ALL = new Set(["law", "case"] as const);

describe("timeline data join", () => {
  it("numbers every event in date order and links each to Wikipedia", () => {
    expect(data.events.map((e) => e.no)).toEqual(data.events.map((_, i) => i + 1));
    for (let i = 1; i < data.events.length; i++) expect(data.events[i]!.date >= data.events[i - 1]!.date).toBe(true);
    for (const e of data.events) expect(wikiUrl(e.wiki)).toMatch(/^https:\/\/en\.wikipedia\.org\/wiki\/\S+$/);
  });
  it("takes case votes from SCDB and the six earlier cases from the hand-entered votes", () => {
    const dobbs = ev("dobbs-v-jackson-womens-health");
    expect([dobbs.date, dobbs.vote, dobbs.author, dobbs.majority, dobbs.dissent]).toEqual(["2022-06-24", "6–3", "Alito", { R: 6 }, { D: 3 }]);
    const parrish = ev("west-coast-hotel-v-parrish");
    expect([parrish.vote, parrish.voteHand, parrish.dissent]).toEqual(["5–4", true, { R: 3, D: 1 }]);
    expect(data.events.filter((e) => e.voteHand).length).toBe(6);
    // Bakke: SCDB dates it June 26; it was decided June 28.
    expect(ev("regents-of-the-university-of-california-v-bakke").date).toBe("1978-06-28");
  });
  it("splits recorded law votes by caucus, and laws before 1973 by Voteview party", () => {
    // Before 1973: Voteview roll calls matched by hand. The 1964 House vote is its final one, accepting the Senate's bill on July 2.
    expect(ev("civil-rights-act-of-1964").split).toEqual({ house: { D: [153, 91], R: [136, 35] }, senate: { D: [46, 21], R: [27, 6] } });
    expect(ev("securities-act-of-1933").split).toBeUndefined();
    expect([ev("labor-management-relations-act").override, ev("clean-water-act").override]).toEqual([true, true]);
    const aca = ev("affordable-care-act").split!;
    expect(aca.house!.R[0]).toBe(0);
    // Specter switched to the Democrats in April 2009, so he counts with them on the December vote.
    expect(aca.senate).toEqual({ D: [60, 0], R: [0, 39] });
    // Jeffords left the Republicans on June 6, 2001, after the May 26 Senate vote on the tax cut: he counts as a Republican there.
    expect(ev("economic-growth-and-tax-relief-reconciliation-act").split!.senate).toEqual({ D: [12, 31], R: [46, 2] });
    expect(ev("war-powers-resolution").override).toBe(true);
  });
  it("links laws to the cases that tested them, and cases to each other, both ways", () => {
    expect(ev("affordable-care-act").tested?.id).toBe("nfib-v-sebelius");
    expect(ev("nfib-v-sebelius").ruledOn?.id).toBe("affordable-care-act");
    expect(ev("roe-v-wade").laterCases?.map((l) => l.id)).toEqual(["planned-parenthood-v-casey", "dobbs-v-jackson-womens-health"]);
    expect(ev("dobbs-v-jackson-womens-health").earlierCases?.map((l) => l.id)).toEqual(["roe-v-wade", "planned-parenthood-v-casey"]);
  });
  it("builds Congresses from the 73rd with the 2001 and 2021 Senate changes as segments", () => {
    expect(data.congresses[0]!.n).toBe(73);
    expect(data.congresses.find((c) => c.n === 107)!.senateMaj.map(([, p]) => p)).toEqual(["D", "R", "D", "R"]);
    expect(data.congresses.find((c) => c.n === 117)!.senateMaj).toEqual([["2021-01-03", "R"], ["2021-01-20", "D"]]);
  });
});

describe("who held power on a date", () => {
  it("does not seat Jackson for Dobbs (she took Breyer's seat on June 30, 2022)", () => {
    const names = idx.courtAt("2022-06-24").sitting.map((j) => j.name);
    expect(names).toContain("Breyer");
    expect(names).not.toContain("Jackson");
    expect(idx.courtAt("2022-06-30").sitting.map((j) => j.name)).toContain("Jackson");
  });
  it("puts Dobbs under a Democratic trifecta with the Court not on its side, in both Court modes", () => {
    for (const mode of ["lean", "appt"] as const) {
      const st = idx.stateAt("2022-06-24", mode);
      expect([st.P, st.S, st.H]).toEqual(["D", "D", "D"]);
      expect(st.C).toBe("R");
      expect(st.status).toBe("tri");
    }
  });
  it("counts the 1961-62 Court as Republican under Appointed by (five Republican appointees to four)", () => {
    const c = idx.courtAt("1962-03-26");
    expect([c.R, c.D]).toEqual([5, 4]);
    const st = idx.stateAt("1962-03-26", "appt");
    expect(st.C).toBe("R");
    // Kennedy and a Democratic Congress, so Baker v. Carr came from a trifecta whose Court was the other party's.
    expect(st.status).toBe("tri");
  });
  it("shows the 2016 vacancy as a 4-4 tie under Appointed by, not a Republican Court", () => {
    const c = idx.courtAt("2016-06-01");
    expect([c.D, c.R, c.seats]).toEqual([4, 4, 8]);
    expect(idx.stateAt("2016-06-01", "appt").C).toBe("T");
  });
  it("has no lean score before the October 1937 term", () => {
    expect(idx.stateAt("1937-06-01", "lean").C).toBe("N");
    expect(idx.leanAt("1937-10-04")?.[0]).toBe(1937);
  });
  it("counts the Senate's 2021 tie by the vice president's vote", () => {
    expect(idx.senMajAt("2021-01-10")).toBe("R");
    expect(idx.senMajAt("2021-01-20")).toBe("D");
  });
});

describe("lean centre band", () => {
  it("puts a median within 0.15 of zero at the centre, and the sign decides otherwise", () => {
    expect(leanSide([2000, 0.149, "x"])).toBe("T");
    expect(leanSide([2000, -0.149, "x"])).toBe("T");
    expect(leanSide([2000, 0.15, "x"])).toBe("R");
    expect(leanSide([2000, -0.15, "x"])).toBe("D");
    expect(leanSide(null)).toBe("N");
  });
  it("finds real centre terms in the data", () => {
    const centre = data.lean.filter((l) => leanSide(l) === "T").map((l) => l[0]);
    expect(centre.length).toBeGreaterThan(0);
    for (const t of centre) expect(Math.abs(data.lean.find((l) => l[0] === t)![1])).toBeLessThan(0.15);
  });
});

describe("vacancy rule", () => {
  const j = (id: number, party: "D" | "R", start: string, end: string | null): TlJustice => ({ id, name: `J${id}`, full: `J${id}`, party, by: "", start, end });
  it("counts a seat empty under six months with the departing justice, and leaves a longer one empty", () => {
    const short = applyVacancyRule([j(1, "R", "1990-01-01", "2000-06-30"), j(2, "D", "2000-10-01", null)]);
    expect(short[0]!.end).toBe("2000-09-30");
    const long = applyVacancyRule([j(1, "R", "1990-01-01", "2000-06-30"), j(2, "D", "2001-06-01", null)]);
    expect(long[0]!.end).toBe("2000-06-30");
  });
  it("pairs a successor who starts a day before the predecessor leaves (Scalia and Burger)", () => {
    const out = applyVacancyRule([j(1, "R", "1969-06-23", "1986-09-26"), j(2, "R", "1986-09-26", "2016-02-13"), j(3, "R", "2017-04-10", null)]);
    expect(out.map((x) => x.end)).toEqual(["1986-09-26", "2016-02-13", null]);
  });
});

describe("tiles, eras and lede", () => {
  const statusIn = (mode: CourtMode) => (e: { date: string }) => idx.stateAt(e.date, mode).status;
  it("counts the events by status in both Court modes (counts by status)", () => {
    const lean = tileCounts(data.events, statusIn("lean"), ALL, 1933, 2026);
    const appt = tileCounts(data.events, statusIn("appt"), ALL, 1933, 2026);
    expect(lean.map((t) => t.n)).toEqual([23, 49, 45]);
    expect(appt.map((t) => t.n)).toEqual([26, 46, 45]);
    for (const tiles of [lean, appt]) {
      expect(tiles.reduce((s, t) => s + t.n, 0)).toBe(data.events.length);
      expect(tiles.reduce((s, t) => s + t.share, 0)).toBeCloseTo(1);
    }
  });
  it("recounts for the Events filter and the year window, keeping a 0 tile", () => {
    const cases = tileCounts(data.events, statusIn("lean"), new Set(["case"] as const), 1933, 2026);
    expect(cases.every((t) => t.laws === 0)).toBe(true);
    expect(cases.reduce((s, t) => s + t.n, 0)).toBe(data.events.filter((e) => e.kind === "case").length);
    const narrow = tileCounts(data.events, statusIn("lean"), ALL, 2021, 2022);
    expect(narrow.map((t) => t.status)).toEqual(["all4", "tri", "split"]);
    expect(narrow.find((t) => t.status === "all4")!.n).toBe(0);
  });
  it("merges spans into eras and splits the years among the statuses", () => {
    const cuts = changePoints(data);
    const spans = buildSpans(idx, cuts, "lean");
    expect(spans.length).toBe(202);
    expect(buildEras(spans).length).toBe(40);
    expect(buildEras(buildSpans(idx, cuts, "appt")).length).toBe(37);
    const yrs = yearsByStatus(spans, 1933, 2026);
    expect(yrs.all4 + yrs.tri + yrs.split).toBeCloseTo(2026 + 1 - 1933 - (31 + 28 + 3) / 365, 0);
  });
  it("words an era by the Court measure", () => {
    expect(eraLabel({ P: "D", S: "D", H: "D", C: "R", status: "tri" }, "lean")).toBe("Democrats held the White House and Congress; a Court leaning conservative");
    expect(eraLabel({ P: "R", S: "D", H: "D", C: "T", status: "split" }, "appt")).toBe("Republican president, Democratic Congress; a Court split evenly between the parties' appointees");
  });
});

describe("chamberYears", () => {
  const spans = buildSpans(idx, changePoints(data), "appt");
  it("splits a window into years with both chambers, one, or neither, and sums to the window", () => {
    const y = chamberYears(spans, "1945-04-12", "2026-10-16");
    expect(y.both + y.one + y.neither).toBeCloseTo(y.total, 6);
    expect(y.total).toBeCloseTo(81.5, 0);
    // Carter, 1977-81: Democrats held both chambers throughout.
    const carter = chamberYears(spans, "1977-01-20", "1981-01-20");
    expect(carter.both).toBeCloseTo(4, 1);
    // Reagan's second term: Republicans held the Senate only until 1987, then neither chamber.
    const reagan2 = chamberYears(spans, "1985-01-20", "1989-01-20");
    expect(reagan2.one).toBeCloseTo(2, 0);
    expect(reagan2.neither).toBeCloseTo(2, 0);
  });
});

describe("search and markers", () => {
  it("matches every word against name, line, Wikipedia title or year, ignoring accents and dash style", () => {
    const glass = ev("banking-act-of-1933");
    expect(matchesQuery(glass, "glass-steagall 1933")).toBe(true);
    expect(matchesQuery(ev("dobbs-v-jackson-womens-health"), "roe overturned")).toBe(true);
    expect(matchesQuery(ev("dobbs-v-jackson-womens-health"), "roe 1973")).toBe(false);
  });
  it("bins close events into one numbered marker on alternating lanes and never overlaps within a lane", () => {
    const items = [1, 2, 3, 4, 5].map((no) => ({ item: { no }, x: 100 + no * 3 }));
    const placed = placeMarkers(items, 100, 400);
    expect(placed.map((p) => p.label)).toEqual(["1+4"]);
    const spread = placeMarkers([0, 1, 2, 3, 4, 5].map((k) => ({ item: { no: k + 1 }, x: 100 + k * 22 + 5 })), 100, 400);
    expect(spread.map((p) => p.lane)).toEqual([0, 1, 0, 1, 0, 1]);
    // Markers jammed against the right edge push their lane neighbours left.
    const edge = placeMarkers([{ item: { no: 1 }, x: 486 }, { item: { no: 2 }, x: 499 }, { item: { no: 3 }, x: 499.5 }], 100, 400);
    for (const lane of [0, 1]) {
      const ms = edge.filter((p) => p.lane === lane).sort((a, b) => a.cx - b.cx);
      for (let i = 1; i < ms.length; i++) expect(ms[i]!.cx - ms[i]!.w / 2).toBeGreaterThanOrEqual(ms[i - 1]!.cx + ms[i - 1]!.w / 2);
      for (const m of ms) expect(m.cx + m.w / 2).toBeLessThanOrEqual(500);
    }
  });
});

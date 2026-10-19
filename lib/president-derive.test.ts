import { describe, expect, it } from "vitest";
import type { Administration } from "./executive-orders-entities";
import {
  buildPresidents,
  congressSummary,
  countByTermYear,
  coverageNote,
  daysInOffice,
  fiscalYearBounds,
  fiscalYearsInTerm,
  justicesAppointed,
  longestLeader,
  ordinalWord,
  pointsInTerm,
  termOfPeriod,
  termYearBuckets,
  termYearSegments,
  termYears,
  type CongressInput,
  type JusticeInput,
} from "./president-derive";
import type { PresidentTerm } from "./president-types";

const admin = (term_id: string, president: string, slug: string, party: "Democratic" | "Republican", end: string | null): Administration => ({
  term_id,
  president,
  president_slug: slug,
  party,
  start: term_id,
  end,
});

const ADMINS: Administration[] = [
  admin("1933-03-04", "Franklin D. Roosevelt", "franklin-d-roosevelt", "Democratic", "1945-04-11"),
  admin("1945-04-12", "Harry S. Truman", "harry-s-truman", "Democratic", "1953-01-19"),
  admin("2009-01-20", "Barack Obama", "barack-obama", "Democratic", "2017-01-19"),
  admin("2017-01-20", "Donald Trump", "donald-trump", "Republican", "2021-01-19"),
  admin("2021-01-20", "Joe Biden", "joe-biden", "Democratic", "2025-01-19"),
  admin("2025-01-20", "Donald Trump", "donald-trump", "Republican", null),
];

const term = (termId: string, end: string | null, ordinal = 44): PresidentTerm => ({ termId, start: termId, end, ordinal });
const OBAMA = term("2009-01-20", "2017-01-19");
const TRUMP1 = term("2017-01-20", "2021-01-19", 45);
const TODAY = "2026-10-19";

describe("buildPresidents", () => {
  const list = buildPresidents(ADMINS, new Map([["barack-obama", "/images/presidents/barack-obama.jpg"]]));

  it("starts at Truman and gives a returning president one page with both terms", () => {
    expect(list.map((p) => p.slug)).toEqual(["harry-s-truman", "barack-obama", "donald-trump", "joe-biden"]);
    expect(list.find((p) => p.slug === "donald-trump")!.terms.map((t) => t.termId)).toEqual(["2017-01-20", "2025-01-20"]);
  });

  it("numbers rows from Roosevelt's 32nd, so a non-consecutive return gets its own ordinal", () => {
    // Only the rows given count here; the real table numbers Trump 45 and 47.
    expect(list[0].terms[0].ordinal).toBe(33);
    expect(list.find((p) => p.slug === "donald-trump")!.terms.map((t) => t.ordinal)).toEqual([35, 37]);
  });

  it("carries party, last name and photo", () => {
    const obama = list.find((p) => p.slug === "barack-obama")!;
    expect(obama).toMatchObject({ last: "Obama", party: "D", photo: "/images/presidents/barack-obama.jpg" });
    expect(list[0].photo).toBeNull();
  });

  it("refuses a table that does not start with Roosevelt", () => {
    expect(() => buildPresidents(ADMINS.slice(1), new Map())).toThrow(/Roosevelt/);
  });
});

describe("dates and labels", () => {
  it("counts days in office inclusively, to today while serving", () => {
    expect(daysInOffice([OBAMA], TODAY)).toBe(2922);
    expect(daysInOffice([term("2025-01-20", null)], "2025-01-20")).toBe(1);
  });

  it("prints term years by the year the successor took office", () => {
    expect(termYears(OBAMA)).toBe("2009–2017");
    expect(termYears(term("2025-01-20", null))).toBe("2025–");
  });

  it("writes ordinals", () => {
    expect([33, 41, 42, 43, 44, 111, 112].map(ordinalWord)).toEqual(["33rd", "41st", "42nd", "43rd", "44th", "111th", "112th"]);
  });

  it("uses July–June fiscal years through FY1976 and October–September after", () => {
    expect(fiscalYearBounds(1953)).toEqual(["1952-07-01", "1953-06-30"]);
    expect(fiscalYearBounds(1977)).toEqual(["1976-10-01", "1977-09-30"]);
  });

  it("names a coverage gap only when the data starts after the inauguration", () => {
    expect(coverageNote("1973-01-19", [term("1969-01-20", "1974-08-08")])).toBe("Data starts January 1973");
    expect(coverageNote("1973-01-19", [OBAMA])).toBeUndefined();
  });
});

describe("termOfPeriod", () => {
  const terms = [OBAMA, TRUMP1];
  it("gives a fiscal year to the term holding most of its days", () => {
    expect(termOfPeriod("2016-10-01", "2017-09-30", terms, TODAY)).toBe(TRUMP1.termId);
    expect(termOfPeriod("2015-10-01", "2016-09-30", terms, TODAY)).toBe(OBAMA.termId);
  });

  it("gives a pre-1977 July–June year to the outgoing president when they held most of it", () => {
    const truman = term("1945-04-12", "1953-01-19", 33);
    const ike = term("1953-01-20", "1961-01-19", 34);
    expect(termOfPeriod(...fiscalYearBounds(1953), [truman, ike], TODAY)).toBe(truman.termId);
  });

  it("returns null when no term holds a majority", () => {
    expect(termOfPeriod("2016-10-01", "2017-09-30", [OBAMA], TODAY)).toBeNull();
  });
});

describe("pointsInTerm", () => {
  const months = ["2008-12-01", "2009-01-01", "2009-02-01", "2016-12-01", "2017-01-01", "2017-02-01"].map((date, i) => ({ date, value: i }));

  it("keeps the month of the inauguration and the month of departure", () => {
    const seg = pointsInTerm(months, OBAMA, "month", TODAY);
    expect(seg.points.map((p) => p.label)).toEqual(["Jan 2009", "Feb 2009", "Dec 2016", "Jan 2017"]);
  });

  it("clamps points inside the term's edges", () => {
    const seg = pointsInTerm(months, OBAMA, "month", TODAY);
    for (const p of seg.points) expect(p.x >= seg.x0 && p.x <= seg.x1).toBe(true);
  });

  it("skips gaps and keeps a passed-in label", () => {
    const seg = pointsInTerm([{ date: "2009-03-01", value: null }, { date: "2009-03-08", value: 1, label: "Mar 14, 2009" }], OBAMA, "week", TODAY);
    expect(seg.points.map((p) => p.label)).toEqual(["Mar 14, 2009"]);
  });
});

describe("fiscalYearsInTerm", () => {
  const rows = [2016, 2017, 2018].map((fy) => ({ fy, value: fy }));
  it("uses the day-majority rule unless the source assigned a term", () => {
    expect(fiscalYearsInTerm(rows, OBAMA, [OBAMA, TRUMP1], TODAY).points.map((p) => p.label)).toEqual(["FY2016"]);
    expect(fiscalYearsInTerm([{ fy: 2017, value: 1, termId: OBAMA.termId }], OBAMA, [OBAMA, TRUMP1], TODAY).points).toHaveLength(1);
  });

  it("keeps the preliminary flag", () => {
    expect(fiscalYearsInTerm([{ fy: 2010, value: 1, preliminary: true }], OBAMA, [OBAMA], TODAY).points[0].preliminary).toBe(true);
  });
});

describe("years in office", () => {
  it("runs from inauguration to the day before the anniversary and cuts the last year short", () => {
    const ford = term("1974-08-09", "1977-01-19", 38);
    expect(termYearBuckets(ford, TODAY).map((b) => [b.label, b.from, b.to, b.partial])).toEqual([
      ["1974–75", "1974-08-09", "1975-08-08", false],
      ["1975–76", "1975-08-09", "1976-08-08", false],
      ["1976–77", "1976-08-09", "1977-01-19", true],
    ]);
  });

  it("counts dates into the years of every term", () => {
    const counts = countByTermYear(["2009-01-20", "2010-01-19", "2010-01-20", "2017-01-20", "2017-01-19"], [OBAMA, TRUMP1], TODAY);
    expect(counts[0].n).toBe(2);
    expect(counts[1].n).toBe(1);
    expect(counts[7].n).toBe(1); // Jan 19, 2017 is Obama's last day
    expect(counts[8]).toMatchObject({ termId: TRUMP1.termId, year: 1, n: 1 });
  });
});

describe("termYearSegments", () => {
  it("centres each year in office and hatches only the year still in progress", () => {
    const serving = term("2025-01-20", null, 47);
    const counts = countByTermYear(["2025-02-01", "2026-03-01"], [serving], TODAY);
    const [seg] = termYearSegments(counts, [serving], TODAY);
    expect(seg.points.map((p) => [p.label, p.value, p.preliminary ?? false])).toEqual([
      ["2025–26", 1, false],
      ["2026", 1, true],
    ]);
    expect(seg.points[0].x).toBeCloseTo(2025.55, 1);
  });

  it("leaves a last year cut short by leaving office unhatched", () => {
    const ford = term("1974-08-09", "1977-01-19", 38);
    const [seg] = termYearSegments(countByTermYear([], [ford], TODAY), [ford], TODAY);
    expect(seg.points.every((p) => !p.preliminary)).toBe(true);
  });
});

describe("congressSummary", () => {
  const C = (n: number, start: string, end: string, houseMaj: "D" | "R", senateMaj: [string, "D" | "R"][]): CongressInput => ({
    n,
    start,
    end,
    house: [0, 0, 0],
    senate: [0, 0, 0],
    houseMaj,
    senateMaj,
  });
  const congresses = [
    C(107, "2001-01-03", "2003-01-03", "R", [["2001-01-03", "R"], ["2001-06-06", "D"]]),
    C(108, "2003-01-03", "2005-01-03", "R", [["2003-01-03", "R"]]),
  ];
  const bush = [term("2001-01-20", "2009-01-19", 43)];

  it("clips each Congress to the term and gives the Senate to whoever held it longest", () => {
    const s = congressSummary(congresses, bush, "R", "2004-12-31");
    expect(s.rows[0]).toMatchObject({ n: 107, start: "2001-01-20", end: "2003-01-02", house: "R", senate: "D", senateChanged: true });
    expect(s.rows[1]).toMatchObject({ n: 108, senate: "R", senateChanged: false });
  });

  it("splits the days in office by how many chambers the president's party held", () => {
    const s = congressSummary(congresses, bush, "R", "2004-12-31");
    // Jan 20 – Jun 5, 2001 both; Jun 6, 2001 – Jan 2, 2003 one; the whole 108th (Jan 3, 2003 – Jan 2, 2005) both.
    expect(s.days.both).toBe(137 + 731);
    expect(s.days.one).toBe(576);
    expect(s.days.neither).toBe(0);
  });
});

describe("justicesAppointed", () => {
  const J = (id: number, name: string, nom: string, start: string, chief: JusticeInput["chief_justice_appointment"] = null): JusticeInput => ({
    id,
    name,
    nomination_date: nom,
    confirmation_date: nom,
    appointment_start: start,
    service_start: start,
    senate_vote: { ayes: 50, nays: 48 },
    chief_justice_appointment: chief,
  });
  const nixon = [term("1969-01-20", "1974-08-08", 37)];
  const reagan = [term("1981-01-20", "1989-01-19", 40)];
  const rehnquist = J(102, "William Rehnquist", "1971-10-22", "1972-01-07", { nomination_date: "1986-06-20", confirmation_date: "1986-09-17", start_date: "1986-09-26" });
  const burger = J(101, "Warren Burger", "1969-05-21", "1969-06-23", { nomination_date: "1969-05-21", confirmation_date: "1969-06-09", start_date: "1969-06-23" });

  it("counts a chief appointed from outside the Court once, as chief", () => {
    expect(justicesAppointed([burger], nixon, TODAY)).toMatchObject([{ id: 101, role: "Chief justice", elevated: false }]);
  });

  it("splits an associate later made chief between the two presidents", () => {
    expect(justicesAppointed([rehnquist], nixon, TODAY)).toMatchObject([{ role: "Associate justice", elevated: false }]);
    expect(justicesAppointed([rehnquist], reagan, TODAY)).toMatchObject([{ role: "Chief justice", elevated: true, vote: null }]);
  });

  it("dates a recess appointment from the day it began and lists newest first", () => {
    const ike = [term("1953-01-20", "1961-01-19", 34)];
    const warren = { ...J(90, "Earl Warren", "1954-01-11", "1953-10-05"), chief_justice_appointment: { nomination_date: "1954-01-11", confirmation_date: "1954-03-01", start_date: "1953-10-05" } };
    const harlan = J(91, "John Harlan", "1955-01-10", "1955-03-28");
    expect(justicesAppointed([warren, harlan], ike, TODAY).map((a) => [a.name, a.nominated])).toEqual([
      ["John Harlan", "1955-01-10"],
      ["Earl Warren", "1953-10-05"],
    ]);
  });
});

describe("longestLeader", () => {
  it("picks the name at No. 1 for the most years, earlier on a tie", () => {
    expect(longestLeader([{ name: "Israel" }, { name: "Egypt" }, { name: "Egypt" }])).toEqual({ name: "Egypt", years: 2 });
    expect(longestLeader([{ name: "Israel" }, { name: "Egypt" }])).toEqual({ name: "Israel", years: 1 });
    expect(longestLeader([])).toBeNull();
  });
});

describe("directory helpers", () => {
  const laws = [
    { date: "2010-03-23", t: "ACA" },
    { date: "2009-02-17", t: "Recovery Act" },
    { date: "2010-07-21", t: "DODD" },
  ];
  it("ranks single-law capitals entries first, then shared ones, then the earliest signed", async () => {
    const { biggestMajorLaw } = await import("./president-derive");
    expect(biggestMajorLaw(laws, (l) => (l.t === "ACA" || l.t === "DODD" ? 2 : 0))?.t).toBe("ACA");
    expect(biggestMajorLaw(laws, (l) => (l.t === "Recovery Act" ? 1 : l.t === "DODD" ? 2 : 0))?.t).toBe("DODD");
    expect(biggestMajorLaw(laws, () => 0)?.t).toBe("Recovery Act");
    expect(biggestMajorLaw([], () => 2)).toBeNull();
  });
  it("words the congress-control label", async () => {
    const { controlLabel } = await import("./president-derive");
    expect(controlLabel({ both: 730.5, one: 1461, neither: 730.5 })).toBe("2 of 8 yrs both");
    expect(controlLabel({ both: 0, one: 365.25, neither: 365.25 })).toBe("1 of 2 yrs one chamber");
    expect(controlLabel({ both: 0, one: 0, neither: 730.5 })).toBe("Neither chamber, 2 yrs");
    expect(controlLabel({ both: 0, one: 0, neither: 0 })).toBe("");
  });
  it("scales sparkline points into the box", async () => {
    const { sparkPaths } = await import("./president-derive");
    const [path] = sparkPaths([{ x0: 2000, x1: 2002, points: [[2000, 1], [2002, 3]] }], 100, 20, 2);
    expect(path).toBe("2.0,18.0 98.0,2.0");
    expect(sparkPaths([], 10, 10, 1)).toEqual([]);
  });
});

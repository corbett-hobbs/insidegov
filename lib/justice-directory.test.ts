import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Justice, JusticeBio } from "./court-entities";
import { justiceVotesFile } from "./decisions-entities";
import { loadRealCourt } from "./court-test-data";
import {
  MIN_WINDOW,
  benchOrder,
  buildDirectory,
  clampWindow,
  decimalYear,
  filterRows,
  fmtRate,
  fmtYears,
  isFullWindow,
  leanBand,
  panWindow,
  rowsInWindow,
  sortRows,
  tenureSegments,
  tenureYears,
  confirmedCell,
  courtTakeaway,
  timelineTakeaway,
  tableTakeaway,
  MIN_VOTES_FOR_RATE,
  timelineDomain,
  voteTotals,
  votingLean,
  yearTicks,
  zoomWindow,
  type DirectoryRow,
} from "./justice-directory";

const read = <T>(n: string) => JSON.parse(readFileSync(join(process.cwd(), "pipeline", "output", "court", n), "utf8")) as T;
const ASOF = new Date("2026-10-19T00:00:00Z");

const justices = read<Justice[]>("justices.json");
const votes = justiceVotesFile.parse(read("justice_votes.json"));
const photos = new Map(read<JusticeBio[]>("justice_bios.json").flatMap((b) => (b.photo ? [[b.justice_id, b.photo.path] as const] : [])));
const court = loadRealCourt().justices;
const rows = buildDirectory({ justices, court, votes, photos, asOf: ASOF });
const row = (last: string) => {
  const r = rows.find((x) => x.name.endsWith(last));
  if (!r) throw new Error(`no row for ${last}`);
  return r;
};

describe("voteTotals", () => {
  it("counts sides taken, dissents and majority opinions; ties and absences take no side", () => {
    const t = voteTotals([
      ["a", 1, 0], // joined the majority
      ["b", 1, 1], // wrote the majority opinion
      ["c", 2, 3], // dissented, wrote the dissent
      ["d", 2, 0], // dissented
      ["e", 3, 0], // equally divided Court
      ["f", 0, 0], // did not take part
      ["g", 1, 2], // majority, wrote a concurrence (not a majority opinion)
    ]);
    expect(t).toEqual({ took: 5, dissents: 2, majorityOpinions: 1 });
  });
});

describe("tenureSegments", () => {
  const base = { service_start: "1991-10-18", appointment_start: "1991-10-18", service_end: null as string | null };
  it("runs a sitting justice to the as-of date", () => {
    const [[a, b]] = tenureSegments({ ...base, justice_id: 108 }, ASOF);
    expect(Math.round((b - a) * 10) / 10).toBe(35);
    expect(decimalYear("2000-01-01")).toBeCloseTo(2000, 1);
  });
  it("splits Hughes's two stints at his 1916 resignation", () => {
    const hughes = justices.find((j) => j.justice_id === 75)!;
    const segs = tenureSegments(hughes, ASOF);
    expect(segs).toHaveLength(2);
    expect(Math.floor(segs[0][1])).toBe(1916);
    expect(Math.floor(segs[1][0])).toBe(1930);
    const years = segs.reduce((n, [a, b]) => n + (b - a), 0);
    expect(years).toBeGreaterThan(17);
    expect(years).toBeLessThan(18);
  });
});

describe("the real directory", () => {
  it("has a row for every justice with a profile page, oldest first", () => {
    expect(rows).toHaveLength(49);
    expect(new Set(rows.map((r) => r.id)).size).toBe(49);
    expect(rows.map((r) => r.start)).toEqual([...rows.map((r) => r.start)].sort());
    expect(rows[0].name).toBe("Charles Hughes"); // first sat in 1910
  });

  it("carries a portrait, a score and a party for everyone", () => {
    for (const r of rows) {
      expect(r.photoSrc, r.name).toMatch(/^\/images\/justices\/\d+\.jpg$/);
      expect(Number.isFinite(r.latestScore) && Number.isFinite(r.careerScore), r.name).toBe(true);
      expect(["D", "R"]).toContain(r.party);
      expect(r.yearsServed, r.name).toBeGreaterThan(1);
    }
  });

  it("the nine justices with no argued-case record have no opinion counts or dissent rate", () => {
    const none = rows.filter((r) => r.majorityOpinions === null);
    expect(none).toHaveLength(9);
    for (const r of none) {
      expect(r.dissentRate).toBeNull();
      expect(r.votesTaken).toBe(0);
      expect(r.partialRecord).toBe(false);
    }
  });

  it("flags only the justices who sat before the record begins as partial", () => {
    const partial = rows.filter((r) => r.partialRecord).map((r) => r.name);
    expect(partial).toContain("Hugo Black");
    expect(partial).toContain("Harold Burton");
    expect(partial).not.toContain("Fred Vinson");
    expect(partial).not.toContain("Clarence Thomas");
    for (const r of rows.filter((x) => x.partialRecord)) expect(r.start < "1946-06-01").toBe(true);
  });

  it("rates are percentages of votes with a side taken", () => {
    for (const r of rows.filter((x) => x.dissentRate !== null)) {
      expect(r.dissentRate!).toBeGreaterThanOrEqual(0);
      expect(r.dissentRate!).toBeLessThan(100);
      expect(r.votesTaken).toBeGreaterThan(0);
    }
    const stevens = voteTotals(votes["103"]);
    expect(row("Stevens").dissentRate).toBeCloseTo((stevens.dissents / stevens.took) * 100, 6);
  });

  it("matches the profile's own tenure facts", () => {
    const thomas = row("Thomas");
    expect(thomas.sitting).toBe(true);
    expect(thomas.end).toBeNull();
    expect(thomas.latestTerm).toBe(loadRealCourt().lastTerm);
    expect(thomas.yearsServed).toBeGreaterThan(34);
    expect(row("John Roberts").chiefNow).toBe(true);
    expect(row("Rehnquist").chief).toBe(true);
    expect(row("Rehnquist").chiefNow).toBe(false);
  });
});

describe("benchOrder", () => {
  it("seats the sitting Court with the Chief in the middle and seniority alternating outward", () => {
    const seats = benchOrder(rows);
    expect(seats.map((r) => r.name.split(" ").pop())).toEqual([
      "Barrett",
      "Gorsuch",
      "Sotomayor",
      "Thomas",
      "Roberts",
      "Alito",
      "Kagan",
      "Kavanaugh",
      "Jackson",
    ]);
  });

  it("handles a Court of any size, the Chief still in the middle", () => {
    const mk = (id: number, on: string, chiefNow = false) => ({ id, sitting: true, chiefNow, appointedOn: on }) as DirectoryRow;
    const seats = benchOrder([mk(1, "2000-01-01"), mk(2, "1990-01-01"), mk(3, "1980-01-01", true), mk(4, "2010-01-01")]);
    // associates by seniority: 2, 1, 4. 1st senior (2) right of the Chief, 2nd (1) left, 3rd (4) right again.
    expect(seats.map((r) => r.id)).toEqual([4, 2, 3, 1]);
  });
});

describe("timeline window", () => {
  const domain: [number, number] = [1910, 2027];

  it("starts at the decade of the first justice and ends with the current year", () => {
    expect(timelineDomain(rows, ASOF)).toEqual([1910, 2027]);
  });

  it("clamps into the domain and to the minimum span", () => {
    expect(clampWindow([1900, 1950], domain)).toEqual([1910, 1960]);
    expect(clampWindow([2000, 2100], domain)).toEqual([1927, 2027]);
    const w = clampWindow([1990, 1991], domain);
    expect(w[1] - w[0]).toBe(MIN_WINDOW);
    expect(clampWindow([1800, 2100], domain)).toEqual(domain);
  });

  it("zooms about a fixed point and never past the domain or the minimum", () => {
    const z = zoomWindow(domain, domain, 0.5, 1);
    expect(z[1]).toBe(2027);
    expect(z[1] - z[0]).toBeCloseTo(58.5, 6);
    const mid = zoomWindow([1950, 2000], domain, 0.5, 0.5);
    expect(mid[0]).toBeCloseTo(1962.5, 6);
    expect(mid[1]).toBeCloseTo(1987.5, 6);
    expect(zoomWindow([1950, 1960], domain, 0.01, 0.5)[1] - zoomWindow([1950, 1960], domain, 0.01, 0.5)[0]).toBe(MIN_WINDOW);
    expect(zoomWindow(domain, domain, 3, 0.5)).toEqual(domain);
  });

  it("pans and stops at the edges", () => {
    expect(panWindow([1950, 1980], domain, 10)).toEqual([1960, 1990]);
    expect(panWindow([1950, 1980], domain, -100)).toEqual([1910, 1940]);
    expect(panWindow([1950, 1980], domain, 500)).toEqual([1997, 2027]);
    expect(isFullWindow(domain, domain)).toBe(true);
    expect(isFullWindow([1950, 1980], domain)).toBe(false);
  });

  it("keeps the justices who sat at any point in the window", () => {
    const w: [number, number] = [1990, 1992];
    const names = rowsInWindow(rows, w).map((r) => r.name.split(" ").pop());
    expect(names).toContain("Thomas"); // joined October 1991
    expect(names).toContain("Souter");
    expect(names).not.toContain("Burger"); // left in 1986
    expect(names).not.toContain("McReynolds");
    // Hughes sat 1910–16 and 1930–41: a window in the gap holds neither stint.
    expect(rowsInWindow(rows, [1920, 1925]).some((r) => r.id === 75)).toBe(false);
    expect(rowsInWindow(rows, [1912, 1914]).some((r) => r.id === 75)).toBe(true);
  });

  it("picks a tick step that leaves room for the labels", () => {
    expect(yearTicks([1910, 2027], 1000)[0]).toBe(1910);
    const wide = yearTicks([1910, 2027], 1000);
    expect(wide[1] - wide[0]).toBe(10);
    const narrow = yearTicks([1910, 2027], 300);
    expect(narrow[1] - narrow[0]).toBe(20);
    const zoomed = yearTicks([1990, 2000], 1000);
    expect(zoomed[1] - zoomed[0]).toBe(1);
  });
});

describe("table", () => {
  it("sorts a column both ways with justices that have no value last, whichever the direction", () => {
    const desc = sortRows(rows, "dissent", "desc");
    const asc = sortRows(rows, "dissent", "asc");
    for (const list of [desc, asc]) {
      expect(list.slice(-9).every((r) => r.dissentRate === null)).toBe(true);
    }
    const rates = (l: DirectoryRow[]) => l.filter((r) => r.dissentRate !== null).map((r) => r.dissentRate!);
    expect(rates(desc)).toEqual([...rates(desc)].sort((a, b) => b - a));
    expect(rates(asc)).toEqual([...rates(asc)].sort((a, b) => a - b));
  });

  it("shows the Senate vote, or Voice, and sorts by the share in favour with voice votes as the most consensual", () => {
    const voice = rows.filter((r) => r.senateVote === null);
    expect(voice).toHaveLength(17);
    expect(voice.every((r) => confirmedCell(r) === "Voice")).toBe(true);
    expect(confirmedCell(row("Thomas"))).toBe("52–48");
    const desc = sortRows(rows, "confirmed", "desc");
    expect(desc.slice(0, 17).every((r) => r.senateVote === null)).toBe(true);
    const share = (r: DirectoryRow) => r.senateVote!.ayes / (r.senateVote!.ayes + r.senateVote!.nays);
    const voted = desc.slice(17);
    expect(voted.map(share)).toEqual([...voted.map(share)].sort((a, b) => b - a));
    expect(sortRows(rows, "confirmed", "asc")[0].name).toBe("Brett Kavanaugh");
  });

  it("sorts by surname, ignoring the initial that tells two justices with one name apart", () => {
    const names = sortRows(rows, "name", "asc").map((r) => r.short.replace(/^[A-Z]\. /, ""));
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("opens each column in a sensible direction and sorts the first day on the Court newest first", () => {
    expect(sortRows(rows, "start", "desc")[0].name).toBe("Ketanji Jackson");
  });

  it("filters by every typed word starting a word in the name, president or party", () => {
    expect(filterRows(rows, "").length).toBe(49);
    expect(filterRows(rows, "thom").map((r) => r.name)).toContain("Clarence Thomas");
    const reagan = filterRows(rows, "reagan").map((r) => r.name.split(" ").pop());
    expect(reagan.sort()).toEqual(["Kennedy", "O'Connor", "Scalia"].sort());
    expect(filterRows(rows, "bush democratic")).toEqual([]);
    expect(filterRows(rows, "clinton democratic").map((r) => r.name.split(" ").pop()).sort()).toEqual(["Breyer", "Ginsburg"]);
  });
});

describe("formatting", () => {
  it("prints years with a decimal only under ten, completed years above", () => {
    expect(fmtYears(1.3)).toBe("1.3");
    expect(fmtYears(9.96)).toBe("10.0");
    expect(fmtYears(35.4)).toBe("35");
    expect(fmtYears(36.58)).toBe("36");
  });
  it("prints rates to one decimal and spans as calendar years", () => {
    expect(fmtRate(12.345)).toBe("12.3%");
    expect(tenureYears({ start: "1991-10-18", end: null })).toBe("1991–present");
    expect(tenureYears({ start: "1941-06-25", end: "1942-10-03" })).toBe("1941–1942");
    expect(tenureYears({ start: "1942-01-01", end: "1942-12-31" })).toBe("1942");
  });
});

describe("takeaways", () => {
  it("are read off the rows", () => {
    expect(courtTakeaway(rows)).toBe(
      "6 of the 9 sitting justices were appointed by Republican presidents and 3 by Democrats. Thomas has sat longest, since 1991; Jackson joined most recently, in 2022.",
    );
    expect(timelineTakeaway(rows)).toMatch(/^Of the 40 justices who have left the Court, Douglas, 36 years \(1939–1975\), served longest and Byrnes, 1\.3 years \(1941–1942\), shortest\.$/);
    expect(tableTakeaway(rows)).toBe(
      "Kavanaugh was confirmed by the narrowest Senate vote, 50–48; in argued cases since the 1946 term, Douglas dissented most often, in 30.8% of the cases they voted in.",
    );
  });

  it("does not rank a short record's dissent rate", () => {
    const short = { ...row("Thomas"), name: "Test Short", votesTaken: MIN_VOTES_FOR_RATE - 1, dissentRate: 99 };
    expect(tableTakeaway([...rows, short])).toBe(tableTakeaway(rows));
    expect(tableTakeaway([...rows, { ...short, votesTaken: MIN_VOTES_FOR_RATE }])).toMatch(/Short dissented most often, in 99\.0%/);
  });
});

describe("votingLean", () => {
  const lean = (firstScore: number, latestScore: number, scoredTerms = 10, sitting = false) => votingLean({ firstScore, latestScore, scoredTerms, sitting });

  it("puts a score in a fixed band, the same in every era", () => {
    expect([-4.2, -1.8, 0, 1.1, 3.1].map(leanBand)).toEqual(["liberal", "left of center", "center", "right of center", "conservative"]);
    expect(leanBand(-2)).toBe("liberal");
    expect(leanBand(0.5)).toBe("center");
    expect(leanBand(2)).toBe("conservative");
  });

  it("says where a justice started and ended when they moved", () => {
    expect(lean(-1.6, -4.2)).toBe("From left of center to liberal");
    expect(lean(1.4, 0.3)).toBe("From right of center to center");
  });

  it("reads a small change, or one inside a band, as throughout", () => {
    expect(lean(1.0, 1.4)).toBe("Right of center throughout");
    expect(lean(0.7, 1.9)).toBe("Right of center throughout");
    expect(lean(-1.4, -1.8)).toBe("Left of center throughout");
  });

  it("gives only a position with fewer than four scored terms, 'so far' while sitting", () => {
    expect(lean(-2.4, -2.8, 3, true)).toBe("Liberal so far");
    expect(lean(1.6, 1.6, 1, false)).toBe("Right of center");
  });

  it("describes every real justice", () => {
    for (const r of rows) expect(votingLean(r), r.name).toMatch(/^(From .+ to .+|\w[\w ]+( throughout| so far)?)$/);
    expect(votingLean(row("Thomas"))).toBe("Conservative throughout");
    expect(votingLean(row("Sotomayor"))).toBe("From left of center to liberal");
    expect(votingLean(row("Ketanji Jackson"))).toBe("Liberal so far");
  });

  it("sorts by the latest score", () => {
    const desc = sortRows(rows, "lean", "desc");
    expect(desc[0].latestScore).toBe(Math.max(...rows.map((r) => r.latestScore)));
    expect(sortRows(rows, "lean", "asc")[0].latestScore).toBe(Math.min(...rows.map((r) => r.latestScore)));
  });
});

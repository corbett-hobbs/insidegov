/**
 * Pure shaping for the Justices directory (`/supreme-court/justices`): one row per justice with the stats the page prints, the
 * bench seating order of the sitting Court, and the small window / sort maths the tenure timeline and the table use. No file
 * I/O (`lib/justice-directory-data.ts` reads the outputs), so it runs in the browser and in tests.
 */
import type { Justice } from "./court-entities";
import { ROLE_MAJORITY, VOTE_DISSENT, VOTE_MAJORITY, type JusticeVotesFile } from "./decisions-entities";
import type { CourtJustice, CourtParty } from "./court-types";
import { presidentDisplay } from "./justice-derive";

/** The argued-case record (`justice_votes.json`) starts with the 1946 term. A justice seated before this date has only part of a career in it. */
export const VOTES_FROM = "1946-06-01";

/**
 * Justices whose service has a break in it: the date the first stint ended. The data's `service_start` is the first day on the
 * Court across all appointments, so without this Hughes (Associate Justice 1910, resigned 10 June 1916 to run for president,
 * Chief Justice from 1930) would read as 31 unbroken years. The second stint starts at `appointment_start`.
 */
export const FIRST_STINT_END: Readonly<Record<number, string>> = { 75: "1916-06-10" };

const MS_PER_YEAR = 365.2425 * 86_400_000;

/** An ISO date (or a Date) as a decimal year: 1991-10-18 → 1991.79. */
export function decimalYear(d: string | Date): number {
  const ms = typeof d === "string" ? Date.parse(`${d}T00:00:00Z`) : d.getTime();
  return 1970 + ms / MS_PER_YEAR;
}

/** Decimal-year spans a justice sat, one per stint (a justice with a break has two). `asOf` closes a stint that is still running. */
export function tenureSegments(
  j: Pick<Justice, "justice_id" | "service_start" | "appointment_start" | "service_end">,
  asOf: Date,
): [number, number][] {
  const end = decimalYear(j.service_end ?? asOf);
  const firstEnd = FIRST_STINT_END[j.justice_id];
  if (!firstEnd) return [[decimalYear(j.service_start), end]];
  return [
    [decimalYear(j.service_start), decimalYear(firstEnd)],
    [decimalYear(j.appointment_start), end],
  ];
}

export interface VoteTotals {
  /** Cases where the justice took a side (majority or dissent). */
  took: number;
  dissents: number;
  /** Cases where the justice wrote the majority opinion. */
  majorityOpinions: number;
}

/** Tallies one justice's `[case_id, vote, role]` rows. Equally divided Courts and non-participation take no side, so they are not in `took`. */
export function voteTotals(rows: readonly (readonly [string, number, number])[]): VoteTotals {
  const t: VoteTotals = { took: 0, dissents: 0, majorityOpinions: 0 };
  for (const [, vote, role] of rows) {
    if (vote === VOTE_MAJORITY || vote === VOTE_DISSENT) t.took += 1;
    if (vote === VOTE_DISSENT) t.dissents += 1;
    if (role === ROLE_MAJORITY) t.majorityOpinions += 1;
  }
  return t;
}

export interface DirectoryRow {
  id: number;
  /** "John Stevens", as the profile URL uses it. */
  name: string;
  /** Chart label: last name, with a first initial only where two justices share one. */
  short: string;
  party: CourtParty;
  /** "Ronald Reagan" */
  president: string;
  /** "Reagan"-style key from the Court payload ("G.H.W. Bush"), for tight spaces. */
  presidentShort: string;
  /** ISO dates: first day on the Court, and the last day (null = still serving). */
  start: string;
  end: string | null;
  /** Commission date of the appointment that made them an associate or chief; orders the bench. */
  appointedOn: string;
  sitting: boolean;
  /** Ever Chief Justice. */
  chief: boolean;
  /** Chief Justice now. */
  chiefNow: boolean;
  /** Decimal-year spans on the Court (two for a justice with a break). */
  segments: [number, number][];
  yearsServed: number;
  /** Majority opinions written in argued cases since the 1946 term; null for a justice with no argued-case record. */
  majorityOpinions: number | null;
  /** Dissenting votes ÷ votes with a side taken, as a percentage; null with no record. */
  dissentRate: number | null;
  votesTaken: number;
  /** The justice sat before the record begins, so the counts above cover only part of the career. */
  partialRecord: boolean;
  /** Martin–Quinn score in the justice's latest term in the data, and that term. */
  latestScore: number;
  latestTerm: number;
  /** Mean of the justice's term scores. */
  careerScore: number;
  /** Public-domain portrait path under `public/`, or null. */
  photoSrc: string | null;
}

export interface DirectoryInputs {
  justices: readonly Justice[];
  court: readonly CourtJustice[];
  votes: JusticeVotesFile;
  /** justice_id → portrait path. */
  photos: ReadonlyMap<number, string>;
  asOf: Date;
}

/** One row per justice, oldest first by first day on the Court. */
export function buildDirectory({ justices, court, votes, photos, asOf }: DirectoryInputs): DirectoryRow[] {
  const byId = new Map(court.map((c) => [c.id, c] as const));
  const rows: DirectoryRow[] = [];
  for (const j of justices) {
    const c = byId.get(j.justice_id);
    if (!c) continue; // no scores, no profile page: not in the directory
    const segments = tenureSegments(j, asOf);
    const own = votes[String(j.justice_id)];
    const totals = own ? voteTotals(own) : null;
    rows.push({
      id: j.justice_id,
      name: c.name,
      short: c.short,
      party: c.party,
      president: presidentDisplay(j.appointing_president),
      presidentShort: c.pres,
      start: j.service_start,
      end: j.service_end,
      appointedOn: j.appointment_start,
      sitting: j.service_end === null,
      chief: j.chief_justice_appointment !== null,
      chiefNow: j.service_end === null && j.chief_justice_appointment !== null,
      segments,
      yearsServed: segments.reduce((n, [a, b]) => n + (b - a), 0),
      majorityOpinions: totals ? totals.majorityOpinions : null,
      dissentRate: totals && totals.took > 0 ? (totals.dissents / totals.took) * 100 : null,
      votesTaken: totals?.took ?? 0,
      partialRecord: totals !== null && j.service_start < VOTES_FROM,
      latestScore: c.s[c.s.length - 1],
      latestTerm: c.t1,
      careerScore: c.career,
      photoSrc: photos.get(j.justice_id) ?? null,
    });
  }
  return rows.sort((a, b) => a.start.localeCompare(b.start) || a.id - b.id);
}

/**
 * The sitting Court in bench order, left to right as the audience sees it: the Chief Justice in the middle, then the associate
 * justices alternating outward by seniority, the most senior to the Chief's right (the audience's left), the next to the
 * left, and so on. With nine: 7th, 5th, 3rd, 1st senior, Chief, 2nd, 4th, 6th, 8th.
 */
export function benchOrder(rows: readonly DirectoryRow[]): DirectoryRow[] {
  const sitting = rows.filter((r) => r.sitting);
  const chief = sitting.find((r) => r.chiefNow) ?? null;
  const associates = sitting
    .filter((r) => r !== chief)
    .sort((a, b) => a.appointedOn.localeCompare(b.appointedOn) || a.id - b.id);
  const right: DirectoryRow[] = [];
  const left: DirectoryRow[] = [];
  associates.forEach((a, i) => (i % 2 === 0 ? right : left).push(a));
  return [...right.reverse(), ...(chief ? [chief] : []), ...left];
}

// ---------------------------------------------------------------------------------------------------------------------
// Timeline window

/** Smallest window the timeline can zoom to, in years. */
export const MIN_WINDOW = 6;

export type Win = readonly [number, number];

/** The domain the timeline starts on: from the decade the first justice sat to the end of the current year. */
export function timelineDomain(rows: readonly DirectoryRow[], asOf: Date): [number, number] {
  const first = Math.min(...rows.map((r) => r.segments[0][0]));
  return [Math.floor(first / 10) * 10, Math.ceil(decimalYear(asOf))];
}

/** Keep a window of the same span inside the domain; a span beyond the domain or under `MIN_WINDOW` is clamped. */
export function clampWindow(win: Win, domain: Win, minSpan = MIN_WINDOW): [number, number] {
  const full = domain[1] - domain[0];
  const span = Math.min(full, Math.max(minSpan, win[1] - win[0]));
  const lo = Math.min(domain[1] - span, Math.max(domain[0], win[0]));
  return [lo, lo + span];
}

/** Scale the span by `factor` (< 1 zooms in) keeping the year at fraction `f` of the plot fixed (and moving it to `fNew` for a pinch that drifts). */
export function zoomWindow(win: Win, domain: Win, factor: number, f: number, fNew = f): [number, number] {
  const span = win[1] - win[0];
  const next = Math.min(domain[1] - domain[0], Math.max(MIN_WINDOW, span * factor));
  const lo = win[0] + f * span - fNew * next;
  return clampWindow([lo, lo + next], domain);
}

/** Slide the window by `years`, stopping at the domain's edges. */
export function panWindow(win: Win, domain: Win, years: number): [number, number] {
  return clampWindow([win[0] + years, win[1] + years], domain);
}

export const isFullWindow = (win: Win, domain: Win) => win[0] <= domain[0] && win[1] >= domain[1];

/** Rows with any stint overlapping the window, in the order given (rule 4: a window filters, it never just dims). */
export function rowsInWindow(rows: readonly DirectoryRow[], win: Win): DirectoryRow[] {
  return rows.filter((r) => r.segments.some(([a, b]) => b > win[0] && a < win[1]));
}

/** Ticks every `step` years across the window, the step picked so labels sit roughly `minGap` px apart. */
export function yearTicks(win: Win, plotW: number, minGap = 46): number[] {
  const span = win[1] - win[0];
  const step = [1, 2, 5, 10, 20, 50].find((s) => (s / span) * plotW >= minGap) ?? 50;
  const out: number[] = [];
  for (let y = Math.ceil(win[0] / step) * step; y <= win[1]; y += step) out.push(y);
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// Table

export type SortKey = "name" | "start" | "years" | "opinions" | "dissent" | "latest" | "career";
export type SortDir = "asc" | "desc";

const VALUE: Record<SortKey, (r: DirectoryRow) => number | string | null> = {
  name: (r) => r.short.replace(/^[A-Z]\. /, ""),
  start: (r) => r.start,
  years: (r) => r.yearsServed,
  opinions: (r) => r.majorityOpinions,
  dissent: (r) => r.dissentRate,
  latest: (r) => r.latestScore,
  career: (r) => r.careerScore,
};

/** The direction a column opens in: names read A→Z, everything else biggest or newest first. */
export const FIRST_DIR: Record<SortKey, SortDir> = {
  name: "asc",
  start: "desc",
  years: "desc",
  opinions: "desc",
  dissent: "desc",
  latest: "desc",
  career: "desc",
};

/** A new sorted copy. A justice with no value for the column (no argued-case record) goes last either way; ties fall back to the first day on the Court, newest first. */
export function sortRows(rows: readonly DirectoryRow[], key: SortKey, dir: SortDir): DirectoryRow[] {
  const get = VALUE[key];
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = get(a);
    const y = get(b);
    if (x === null && y === null) return b.start.localeCompare(a.start);
    if (x === null) return 1;
    if (y === null) return -1;
    const c = typeof x === "string" ? x.localeCompare(y as string) : x - (y as number);
    return c !== 0 ? sign * c : b.start.localeCompare(a.start);
  });
}

/** Every word typed must start a word of the name, the appointing president, or the party. */
export function filterRows(rows: readonly DirectoryRow[], query: string): DirectoryRow[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...rows];
  return rows.filter((r) => {
    const hay = `${r.name} ${r.president} ${r.party === "D" ? "democratic democrat" : "republican"}`.toLowerCase().split(/[\s.]+/);
    return words.every((w) => hay.some((h) => h.startsWith(w)));
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// Formatting

/** Years served: one decimal under ten ("1.3"), completed years above (Douglas, 36 years and 7 months, is 36). */
export const fmtYears = (y: number): string => (y < 10 ? y.toFixed(1) : String(Math.floor(y)));

/** "12.3%" */
export const fmtRate = (r: number): string => `${r.toFixed(1)}%`;

/** First and last calendar year on the Court: "1991–present", "1925–1946". */
export function tenureYears(r: Pick<DirectoryRow, "start" | "end">): string {
  const a = r.start.slice(0, 4);
  const b = r.end ? r.end.slice(0, 4) : "present";
  return a === b ? a : `${a}–${b}`;
}

// ---------------------------------------------------------------------------------------------------------------------
// Takeaways (rule 7c): built from the rows, so a data refresh rewrites them instead of leaving a stale sentence

const surname = (r: Pick<DirectoryRow, "name">) => r.name.split(" ").slice(1).join(" ");

/** The sitting Court card: who appointed the nine and who has sat longest and shortest. */
export function courtTakeaway(rows: readonly DirectoryRow[]): string {
  const sitting = rows.filter((r) => r.sitting);
  const rep = sitting.filter((r) => r.party === "R").length;
  const byStart = [...sitting].sort((a, b) => a.start.localeCompare(b.start));
  const longest = byStart[0];
  const newest = byStart[byStart.length - 1];
  return `${rep} of the ${sitting.length} sitting justices were appointed by Republican presidents and ${sitting.length - rep} by Democrats. ${surname(longest)} has sat longest, since ${longest.start.slice(0, 4)}; ${surname(newest)} joined most recently, in ${newest.start.slice(0, 4)}.`;
}

/** The tenure timeline card: the longest and shortest tenures among justices who have finished serving, plus the longest running one. */
export function timelineTakeaway(rows: readonly DirectoryRow[]): string {
  const done = rows.filter((r) => !r.sitting);
  const long = [...done].sort((a, b) => b.yearsServed - a.yearsServed)[0];
  const short = [...done].sort((a, b) => a.yearsServed - b.yearsServed)[0];
  const line = (r: DirectoryRow) => `${surname(r)}, ${fmtYears(r.yearsServed)} years (${tenureYears(r)})`;
  return `Of the ${done.length} justices who have left the Court, ${line(long)}, served longest and ${line(short)}, shortest.`;
}

/** A dissent rate is only compared across justices with at least this many votes on a side, so a short career does not top the list. */
export const MIN_VOTES_FOR_RATE = 500;

/** The table card: who wrote the most majority opinions and who dissented most often, from the 1946 term on. */
export function tableTakeaway(rows: readonly DirectoryRow[]): string {
  const withOpinions = rows.filter((r) => r.majorityOpinions !== null);
  const most = [...withOpinions].sort((a, b) => b.majorityOpinions! - a.majorityOpinions!)[0];
  const rated = rows.filter((r) => r.dissentRate !== null && r.votesTaken >= MIN_VOTES_FOR_RATE);
  const dissenter = [...rated].sort((a, b) => b.dissentRate! - a.dissentRate!)[0];
  return `In argued cases since the 1946 term, ${surname(most)} wrote the most majority opinions (${most.majorityOpinions}${most.partialRecord ? " in the record" : ""}) and ${surname(dissenter)} dissented most often, in ${fmtRate(dissenter.dissentRate!)} of the cases they voted in.`;
}

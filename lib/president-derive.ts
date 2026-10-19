import type { Administration } from "./executive-orders-entities";
import type {
  CongressRow,
  CongressSummary,
  NamedLeader,
  Party,
  PresidentRef,
  PresidentTerm,
  SeriesPoint,
  SeriesSegment,
  TermYearCount,
} from "./president-types";

/**
 * Pure shaping for the president pages: who gets a page, where each term sits on a card's axis, which months, quarters
 * and fiscal years belong to a term, counts per year in office, and party control of Congress during the term. No file
 * reads (those are `lib/president-data.ts`), so all of it is unit-tested (`lib/president-derive.test.ts`).
 */

/** The first president with a page: Truman. The economy series start in 1947-48, so earlier terms would be mostly empty cards. */
export const FIRST_PAGE_START = "1945-04-12";

/** Franklin D. Roosevelt, the first entry in the combined administrations table, was the 32nd president. */
const FIRST_ORDINAL = 32;
const FIRST_START = "1933-03-04";

const DAY = 86_400_000;
const ms = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
export const isoOfMs = (t: number) => new Date(t).toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) => isoOfMs(ms(iso) + n * DAY);
/** Inclusive day count from `a` to `b`. */
export const daysBetween = (a: string, b: string) => Math.round((ms(b) - ms(a)) / DAY) + 1;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
export const monthLabel = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
export const dateLabel = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}, ${iso.slice(0, 4)}`;

/** A date as a fractional year: 2009-01-20 → 2009.05. */
export function fracYear(iso: string): number {
  const y = Number(iso.slice(0, 4));
  const start = Date.UTC(y, 0, 1);
  const len = Date.UTC(y + 1, 0, 1) - start;
  return y + (ms(iso) - start) / len;
}

/** Last day in office, or `today` while serving. */
export const termLast = (t: Pick<PresidentTerm, "end">, today: string) => t.end ?? today;

/**
 * One page per person, oldest first, from Truman on. Administrations are one row per tenure (Kennedy and Johnson, Nixon and
 * Ford are separate rows from the day the successor took office), so only a non-consecutive return (Trump) gives a person
 * two terms. Ordinals count rows from Roosevelt's 32nd, which numbers Trump 45 and 47.
 */
export function buildPresidents(admins: readonly Administration[], photos: ReadonlyMap<string, string>): PresidentRef[] {
  const sorted = [...admins].sort((a, b) => a.start.localeCompare(b.start));
  if (sorted[0]?.start !== FIRST_START) throw new Error(`presidents: expected the table to start with Roosevelt (${FIRST_START}), got ${sorted[0]?.start}`);
  const bySlug = new Map<string, PresidentRef>();
  sorted.forEach((a, i) => {
    if (a.start < FIRST_PAGE_START) return;
    const term: PresidentTerm = { termId: a.term_id, start: a.start, end: a.end, ordinal: FIRST_ORDINAL + i };
    const have = bySlug.get(a.president_slug);
    if (have) {
      have.terms.push(term);
      return;
    }
    bySlug.set(a.president_slug, {
      slug: a.president_slug,
      name: a.president,
      last: a.president.split(" ").pop() ?? a.president,
      party: a.party === "Democratic" ? "D" : "R",
      terms: [term],
      photo: photos.get(a.president_slug) ?? null,
    });
  });
  return [...bySlug.values()];
}

/** Days in office across every term, counting the inauguration day and the last full day. */
export const daysInOffice = (terms: readonly Pick<PresidentTerm, "start" | "end">[], today: string) =>
  terms.reduce((n, t) => n + daysBetween(t.start, termLast(t, today)), 0);

/** "1993–2001"; "2025–" while serving; a term in one year prints that year once. */
export function termYears(t: Pick<PresidentTerm, "start" | "end">): string {
  const a = t.start.slice(0, 4);
  if (t.end === null) return `${a}–`;
  // A term ends the day before the successor's inauguration, so the year it ends is that day's year.
  const b = addDays(t.end, 1).slice(0, 4);
  return a === b ? a : `${a}–${b}`;
}

/** "33rd" */
export function ordinalWord(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${s}`;
}

/** Federal fiscal year bounds: July–June through FY1976, October–September from FY1977 (the 1976 transition quarter is its own period). */
export function fiscalYearBounds(fy: number): [string, string] {
  return fy <= 1976 ? [`${fy - 1}-07-01`, `${fy}-06-30`] : [`${fy - 1}-10-01`, `${fy}-09-30`];
}

/** Days `[a0, a1]` and `[b0, b1]` share (inclusive ISO dates), 0 when they don't meet. */
export function overlapDays(a0: string, a1: string, b0: string, b1: string): number {
  const lo = a0 > b0 ? a0 : b0;
  const hi = a1 < b1 ? a1 : b1;
  return hi < lo ? 0 : daysBetween(lo, hi);
}

/**
 * The term a period belongs to: the one holding most of its days, and only if that is more than half of them (the same
 * day-majority rule the immigration series use for fiscal years). A period still in progress counts only its days so far.
 */
export function termOfPeriod(from: string, to: string, terms: readonly PresidentTerm[], today: string): string | null {
  const last = to < today ? to : today;
  if (last < from) return null;
  const len = daysBetween(from, last);
  for (const t of terms) if (overlapDays(from, last, t.start, termLast(t, today)) * 2 > len) return t.termId;
  return null;
}

export type Granularity = "week" | "month" | "quarter" | "year";

/** The last day of the period that starts on `iso`. */
export function periodEnd(iso: string, g: Granularity): string {
  if (g === "week") return addDays(iso, 6);
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7)) - 1;
  const months = g === "month" ? 1 : g === "quarter" ? 3 : 12;
  return isoOfMs(Date.UTC(y, m + months, 1) - DAY);
}

const periodLabel = (iso: string, g: Granularity) =>
  g === "week" ? dateLabel(iso) : g === "month" ? monthLabel(iso) : g === "quarter" ? `Q${Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1} ${iso.slice(0, 4)}` : iso.slice(0, 4);

/** A term's edges on a card's axis: inauguration to the day after the last day in office (or `today`). */
export function termEdges(t: Pick<PresidentTerm, "start" | "end">, today: string): { x0: number; x1: number } {
  return { x0: fracYear(t.start), x1: fracYear(addDays(termLast(t, today), 1)) };
}

/**
 * The points of a dated series (each dated by the first day of its week, month, quarter or year) whose period overlaps the
 * term, so the month a president took office is the first reading and the month they left is the last. Each point sits at
 * the middle of its period, clamped inside the term's edges.
 */
export function pointsInTerm(
  points: readonly { date: string; value: number | null; label?: string }[],
  term: PresidentTerm,
  g: Granularity,
  today: string,
): SeriesSegment {
  const last = termLast(term, today);
  const { x0, x1 } = termEdges(term, today);
  const out: SeriesPoint[] = [];
  for (const p of points) {
    if (p.value === null) continue;
    const end = periodEnd(p.date, g);
    if (end < term.start || p.date > last) continue;
    const mid = (fracYear(p.date) + fracYear(addDays(end, 1))) / 2;
    out.push({ x: Math.min(x1, Math.max(x0, mid)), value: p.value, label: p.label ?? periodLabel(p.date, g) });
  }
  return { termId: term.termId, x0, x1, points: out };
}

/**
 * Fiscal-year values that belong to the term by the day-majority rule. `owner` overrides the rule with the term a source
 * already assigned (the immigration series carry their own). Each bar sits at the middle of its fiscal year.
 */
export function fiscalYearsInTerm(
  rows: readonly { fy: number; value: number; preliminary?: boolean; termId?: string }[],
  term: PresidentTerm,
  all: readonly PresidentTerm[],
  today: string,
): SeriesSegment {
  const { x0, x1 } = termEdges(term, today);
  const out: SeriesPoint[] = [];
  for (const r of rows) {
    const [a, b] = fiscalYearBounds(r.fy);
    const owner = r.termId ?? termOfPeriod(a, b, all, today);
    if (owner !== term.termId) continue;
    out.push({ x: (fracYear(a) + fracYear(addDays(b, 1))) / 2, value: r.value, label: `FY${r.fy}`, ...(r.preliminary ? { preliminary: true } : {}) });
  }
  return { termId: term.termId, x0, x1, points: out };
}

/**
 * Years in office: year 1 runs from the inauguration to the day before its first anniversary, and the last is cut at the
 * last day in office (or today). Ford's year 1 is August 9, 1974 to August 8, 1975.
 */
export function termYearBuckets(term: PresidentTerm, today: string): Omit<TermYearCount, "n">[] {
  const last = termLast(term, today);
  const out: Omit<TermYearCount, "n">[] = [];
  const [y, m, d] = term.start.split("-").map(Number);
  for (let k = 0; ; k++) {
    const from = isoOfMs(Date.UTC(y + k, m - 1, d));
    if (from > last) break;
    const full = addDays(isoOfMs(Date.UTC(y + k + 1, m - 1, d)), -1);
    const to = full < last ? full : last;
    const yb = String(Number(to.slice(0, 4)) % 100).padStart(2, "0");
    out.push({ termId: term.termId, year: k + 1, label: from.slice(0, 4) === to.slice(0, 4) ? from.slice(0, 4) : `${from.slice(0, 4)}–${yb}`, from, to, partial: to < full });
  }
  return out;
}

/** How many of `dates` fall in each year in office, across every term, oldest first. */
export function countByTermYear(dates: readonly string[], terms: readonly PresidentTerm[], today: string): TermYearCount[] {
  const buckets = terms.flatMap((t) => termYearBuckets(t, today)).map((b) => ({ ...b, n: 0 }));
  for (const date of dates) {
    const b = buckets.find((x) => date >= x.from && date <= x.to);
    if (b) b.n++;
  }
  return buckets;
}

/**
 * Counts per year in office as a bar panel: each bar centred in its year in office, labelled "2009–10". Only the year still
 * in progress is preliminary (hatched); a last year cut short by leaving office is complete, just shorter.
 */
export function termYearSegments(counts: readonly TermYearCount[], terms: readonly PresidentTerm[], today: string): SeriesSegment[] {
  return terms.map((t) => {
    const { x0, x1 } = termEdges(t, today);
    const points = counts
      .filter((c) => c.termId === t.termId)
      .map((c) => ({
        x: (fracYear(c.from) + fracYear(addDays(c.to, 1))) / 2,
        value: c.n,
        label: c.label,
        ...(t.end === null && c.to === today ? { preliminary: true } : {}),
      }));
    return { termId: t.termId, x0, x1, points };
  });
}

/** Is `date` inside any of the terms? */
export const inTerms = (date: string, terms: readonly PresidentTerm[], today: string) => terms.some((t) => date >= t.start && date <= termLast(t, today));

export interface CongressInput {
  n: number;
  start: string;
  /** First day of the next Congress (exclusive). */
  end: string;
  house: [number, number, number];
  senate: [number, number, number];
  senateMaj: [string, Party][];
  houseMaj: Party;
}

/**
 * The Congresses that sat during the terms, each clipped to the time in office, with who held each chamber (the Senate by
 * most days, since it changed hands mid-Congress in 2001 and 2021), plus how many days in office the president's party held
 * both chambers, one, or neither.
 */
export function congressSummary(congresses: readonly CongressInput[], terms: readonly PresidentTerm[], party: Party, today: string): CongressSummary {
  const rows: CongressRow[] = [];
  const days = { both: 0, one: 0, neither: 0 };
  for (const t of terms) {
    const tLast = termLast(t, today);
    for (const c of congresses) {
      const cLast = addDays(c.end, -1);
      const from = c.start > t.start ? c.start : t.start;
      const to = cLast < tLast ? cLast : tLast;
      if (to < from) continue;
      // Senate control in pieces: each majority holds from its date to the next one's.
      const senateDays: Record<Party, number> = { D: 0, R: 0 };
      c.senateMaj.forEach(([since, side], i) => {
        const next = c.senateMaj[i + 1]?.[0];
        const pieceLast = next ? addDays(next, -1) : cLast;
        const n = overlapDays(since > c.start ? since : c.start, pieceLast, from, to);
        if (n === 0) return;
        senateDays[side] += n;
        const held = (c.houseMaj === party ? 1 : 0) + (side === party ? 1 : 0);
        if (held === 2) days.both += n;
        else if (held === 1) days.one += n;
        else days.neither += n;
      });
      const prev = rows.find((r) => r.n === c.n);
      if (prev) {
        // A Congress split across two terms of one president is one row.
        if (to > prev.end) prev.end = to;
        if (from < prev.start) prev.start = from;
        continue;
      }
      rows.push({
        n: c.n,
        start: from,
        end: to,
        house: c.houseMaj,
        senate: senateDays.R > senateDays.D ? "R" : "D",
        houseSeats: c.house,
        senateSeats: c.senate,
        senateChanged: new Set(c.senateMaj.map((s) => s[1])).size > 1,
      });
    }
  }
  return { rows, days };
}

export interface JusticeInput {
  id: number;
  name: string;
  nomination_date: string | null;
  confirmation_date: string | null;
  appointment_start: string;
  service_start: string;
  senate_vote: { ayes: number; nays: number } | null;
  chief_justice_appointment: { nomination_date: string | null; confirmation_date: string | null; start_date: string } | null;
}

export interface Appointment {
  id: number;
  name: string;
  role: "Chief justice" | "Associate justice";
  elevated: boolean;
  nominated: string;
  confirmed: string | null;
  vote: { ayes: number; nays: number } | null;
}

/**
 * The justices a president put on the Court, by nomination date (a recess appointment counts from the day it began, if
 * earlier). A justice first appointed chief (Warren, Burger, Roberts) is one chief appointment; an associate later made
 * chief by another president (Rehnquist) is an associate appointment for the first and an elevation for the second.
 * Newest first.
 */
export function justicesAppointed(justices: readonly JusticeInput[], terms: readonly PresidentTerm[], today: string): Appointment[] {
  const out: Appointment[] = [];
  const firstDate = (nom: string | null, start: string) => (nom && nom < start ? nom : start);
  for (const j of justices) {
    const chief = j.chief_justice_appointment;
    const chiefFromStart = chief !== null && chief.start_date <= j.service_start;
    const first = firstDate(j.nomination_date, j.appointment_start);
    if (inTerms(first, terms, today)) {
      out.push({ id: j.id, name: j.name, role: chiefFromStart ? "Chief justice" : "Associate justice", elevated: false, nominated: first, confirmed: j.confirmation_date, vote: j.senate_vote });
    }
    if (chief && !chiefFromStart) {
      const when = firstDate(chief.nomination_date, chief.start_date);
      if (inTerms(when, terms, today)) out.push({ id: j.id, name: j.name, role: "Chief justice", elevated: true, nominated: when, confirmed: chief.confirmation_date, vote: null });
    }
  }
  return out.sort((a, b) => b.nominated.localeCompare(a.nominated));
}

/** The name at No. 1 for the most years (ties: the earlier one), or null for no years. */
export function longestLeader(years: readonly { name: string }[]): NamedLeader | null {
  const n = new Map<string, number>();
  for (const y of years) n.set(y.name, (n.get(y.name) ?? 0) + 1);
  let best: NamedLeader | null = null;
  for (const [name, c] of n) if (!best || c > best.years) best = { name, years: c };
  return best;
}

/** "Data starts January 1973", when a series' first value falls after the president took office; undefined otherwise. */
export function coverageNote(firstDate: string, terms: readonly PresidentTerm[]): string | undefined {
  return firstDate > terms[0].start ? `Data starts ${monthLabel(firstDate).replace(/^(\w+)/, (m) => FULL_MONTH[m] ?? m)}` : undefined;
}
const FULL_MONTH: Record<string, string> = { Jan: "January", Feb: "February", Mar: "March", Apr: "April", May: "May", Jun: "June", Jul: "July", Aug: "August", Sep: "September", Oct: "October", Nov: "November", Dec: "December" };

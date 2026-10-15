import type { Chamber, ChamberView } from "./chamber";
import { CAUCUS_OVERRIDE, CONVENING, FIRST_DEMO_CONGRESS, LAST_TERRITORY_CONGRESS, NON_VOTING_MEMBER_CONGRESS, NON_VOTING_STATES, tenureBand } from "./demographics-entities";
import { ROSTER_SHAPE, type AgeStat, type CaucusGroup, type DemoCongress, type DemoPresident, type DemoRoster, type DemographicsPayload, type RosterEntry, type RosterPerson } from "./demographics-types";
import type { Administration } from "./executive-orders-entities";

/** The fields of `legislators.json` / `terms.json` this page reads. */
export interface DemoLegislator {
  bioguide_id: string;
  birthday?: string;
  gender: "M" | "F";
}
export interface DemoTerm {
  bioguide_id: string;
  congress_number: number;
  chamber: Chamber;
  state: string;
  caucus: string | null;
  /** Start of the term record; picks the state shown for someone who held two seats in one Congress. */
  term_start?: string;
}

/** The day a Congress convened (ISO). */
export function conveningDate(congress: number): string {
  const d = CONVENING[congress];
  if (!d) throw new Error(`demographics: no convening date for the ${congress}th Congress`);
  return d;
}

/** Whole years of age on `onIso` for someone born `birthdayIso` (a birthday on the day counts). */
export function ageOn(birthdayIso: string, onIso: string): number {
  const [by, bm, bd] = birthdayIso.split("-").map(Number);
  const [y, m, d] = onIso.split("-").map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

/** Exact age in years on `onIso` (days lived / 365.25), so a median or average can fall between whole years. */
export function ageYearsOn(birthdayIso: string, onIso: string): number {
  const day = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 86_400_000;
  return (day(onIso) - day(birthdayIso)) / 365.25;
}

/** A voting seat: not a delegate or resident commissioner, and not a territory's delegate before statehood. */
export function isVotingTerm(t: Pick<DemoTerm, "bioguide_id" | "congress_number" | "chamber" | "state">): boolean {
  if (NON_VOTING_STATES.has(t.state)) return false;
  const last = LAST_TERRITORY_CONGRESS[t.state];
  if (last !== undefined && t.chamber === "house" && t.congress_number <= last) return false;
  return !NON_VOTING_MEMBER_CONGRESS.has(`${t.bioguide_id}@${t.congress_number}`);
}

/** Democrats and Republicans (compound caucus names follow their party); everything else is "O". */
export function caucusGroup(caucus: string | null): CaucusGroup {
  if (caucus?.startsWith("Democrat")) return "D";
  if (caucus?.startsWith("Republican")) return "R";
  return "O";
}

function median(sorted: readonly number[]): number {
  const m = sorted.length >> 1;
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}
const round1 = (v: number) => Math.round(v * 10) / 10;

function ageStat(ages: number[]): AgeStat {
  if (ages.length === 0) return { median: null, average: null, n: 0 };
  const s = [...ages].sort((a, b) => a - b);
  return { median: round1(median(s)), average: round1(s.reduce((a, b) => a + b, 0) / s.length), n: s.length };
}

/** Presidents for the band: the shared list, sorted, as slim rows. */
export function toPresidents(admins: readonly Administration[]): DemoPresident[] {
  return [...admins]
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((a) => ({ id: a.term_id, president: a.president, last: a.president.split(" ").pop() ?? a.president, party: a.party === "Democratic" ? "D" : "R" }));
}

/**
 * The president in office for most of the Congress: the most days between its convening day and the next Congress's (two
 * years on when that isn't known yet). A Congress that convenes on Jan 3 of an inauguration year goes to the incoming
 * president, who takes office on Jan 20.
 */
export function presidentForCongress(admins: readonly Administration[], congress: number): Administration {
  const day = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 86_400_000;
  const from = day(conveningDate(congress));
  const next = CONVENING[congress + 1];
  const to = next ? day(next) : from + 730;
  let best: Administration | undefined;
  let bestDays = 0;
  for (const a of admins) {
    const days = Math.min(to, a.end ? day(a.end) + 1 : Infinity) - Math.max(from, day(a.start));
    if (days > bestDays) [best, bestDays] = [a, days];
  }
  if (!best) throw new Error(`demographics: no president during the ${congress}th Congress`);
  return best;
}

/** One member's seat in one Congress: the caucus of their first voting term in it, the chambers they sat in, and the state of the latest term. */
export interface RosterSeat {
  caucus: string | null;
  chambers: Set<Chamber>;
  state: string;
  start: string;
}

/** Congresses served up to and including a given one: any `terms` row counts, in either chamber and delegate service included, back to the 1st Congress. */
export function servedThroughFn(terms: readonly DemoTerm[]): (id: string, congress: number) => number {
  const served = new Map<string, Set<number>>();
  for (const t of terms) {
    const s = served.get(t.bioguide_id) ?? new Set<number>();
    s.add(t.congress_number);
    served.set(t.bioguide_id, s);
  }
  const sorted = new Map([...served].map(([id, s]) => [id, [...s].sort((a, b) => a - b)]));
  return (id, congress) => {
    const l = sorted.get(id) ?? [];
    let n = 0;
    while (n < l.length && l[n] <= congress) n++;
    return n;
  };
}

/** Voting members who held a seat at any time in each Congress from the 73rd (each person once, both chambers merged). */
export function rostersByCongress(terms: readonly DemoTerm[]): Map<number, Map<string, RosterSeat>> {
  const byCongress = new Map<number, Map<string, RosterSeat>>();
  for (const t of terms) {
    if (t.congress_number < FIRST_DEMO_CONGRESS || !isVotingTerm(t)) continue;
    const m = byCongress.get(t.congress_number) ?? new Map<string, RosterSeat>();
    const start = t.term_start ?? "";
    const e = m.get(t.bioguide_id) ?? { caucus: t.caucus, chambers: new Set<Chamber>(), state: t.state, start };
    e.chambers.add(t.chamber);
    if (start > e.start) [e.state, e.start] = [t.state, start];
    m.set(t.bioguide_id, e);
    byCongress.set(t.congress_number, m);
  }
  return byCongress;
}

/** What the roster file needs to know about a person beyond `DemoLegislator`. */
export interface RosterLegislator extends DemoLegislator {
  /** "French Hill". */
  name: string;
  /** Surname, for the A-Z order the roster's `people` are kept in. */
  family: string;
  /** Has a committed photo. */
  photo: boolean;
}

const CAUCUS_CODE: Record<CaucusGroup, 0 | 1 | 2> = { D: 0, R: 1, O: 2 };

/**
 * The names behind the charts: for each Congress from the 73rd, every voting member the counts in `buildDemographics`
 * cover, with the caucus (overrides applied), chambers, state, Congresses served and first Congress served. Built from
 * the same rosters, so a list always adds up to its chart. `people` is sorted by surname, so a person's index is also
 * their A-Z rank. Members of the latest Congress carry the chamber of their profile page.
 */
export function buildRoster(legislators: readonly RosterLegislator[], terms: readonly DemoTerm[]): DemoRoster {
  const byId = new Map(legislators.map((l) => [l.bioguide_id, l]));
  const servedThrough = servedThroughFn(terms);
  const lastCongress = Math.max(...terms.map((t) => t.congress_number));
  const byCongress = rostersByCongress(terms);
  const firstServed = new Map<string, number>();
  for (const t of terms) firstServed.set(t.bioguide_id, Math.min(firstServed.get(t.bioguide_id) ?? Infinity, t.congress_number));

  const onRoster = new Set<string>();
  for (const m of byCongress.values()) for (const id of m.keys()) onRoster.add(id);
  const order = [...onRoster].map((id) => {
    const l = byId.get(id);
    if (!l) throw new Error(`demographics: ${id} is in terms.json but not legislators.json`);
    return l;
  });
  order.sort((a, b) => a.family.localeCompare(b.family) || a.name.localeCompare(b.name) || a.bioguide_id.localeCompare(b.bioguide_id));
  const index = new Map(order.map((l, i) => [l.bioguide_id, i]));

  // The latest Congress's seat decides the profile page (a Senate seat wins for someone who held both).
  const profile = new Map<string, 1 | 2>();
  for (const [id, e] of byCongress.get(lastCongress) ?? []) profile.set(id, e.chambers.has("senate") ? 2 : 1);

  const people = order.map((l): RosterPerson => [l.bioguide_id, l.name, l.birthday ?? "", l.gender === "F" ? 1 : 0, l.photo ? 1 : 0, profile.get(l.bioguide_id) ?? 0]);
  const congresses: RosterEntry[][] = [];
  for (let c = FIRST_DEMO_CONGRESS; c <= lastCongress; c++) {
    const entries: RosterEntry[] = [];
    for (const [id, e] of byCongress.get(c) ?? []) {
      const g = (CAUCUS_OVERRIDE[`${id}@${c}`] as CaucusGroup | undefined) ?? caucusGroup(e.caucus);
      entries.push([index.get(id)!, CAUCUS_CODE[g], (e.chambers.has("house") ? 1 : 0) + (e.chambers.has("senate") ? 2 : 0) as 1 | 2 | 3, e.state, servedThrough(id, c), firstServed.get(id)!]);
    }
    congresses.push(entries.sort((a, b) => a[0] - b[0]));
  }
  return { shape: ROSTER_SHAPE, firstCongress: FIRST_DEMO_CONGRESS, people, congresses };
}

/**
 * Per Congress (73rd to the latest in `terms`) and chamber view: seats, age by caucus, women by caucus and tenure bands.
 * The roster is every voting member who held a seat at any time in the Congress (see DEMOGRAPHICS_METHODOLOGY.md); the
 * "both" view counts each person once. Tenure counts every Congress up to and including this one that has any `terms`
 * row for the person, in either chamber and including delegate service, back to the 1st Congress.
 */
export function buildDemographics(legislators: readonly DemoLegislator[], terms: readonly DemoTerm[], admins: readonly Administration[]): DemographicsPayload {
  const person = new Map(legislators.map((l) => [l.bioguide_id, l]));
  const servedThrough = servedThroughFn(terms);
  const lastCongress = Math.max(...terms.map((t) => t.congress_number));
  const byCongress = rostersByCongress(terms);

  const views: Record<ChamberView, DemoCongress[]> = { both: [], senate: [], house: [] };
  for (let c = FIRST_DEMO_CONGRESS; c <= lastCongress; c++) {
    const date = conveningDate(c);
    const roster = byCongress.get(c) ?? new Map<string, RosterSeat>();
    const termId = presidentForCongress(admins, c).term_id;
    for (const view of ["both", "senate", "house"] as const) {
      const ages: Record<CaucusGroup, number[]> = { D: [], R: [], O: [] };
      const all: number[] = [];
      let servedSum = 0;
      const women: Record<CaucusGroup, number> = { D: 0, R: 0, O: 0 };
      const tenure: [number, number, number, number] = [0, 0, 0, 0];
      const tenureBy: Record<CaucusGroup, [number, number, number, number]> = { D: [0, 0, 0, 0], R: [0, 0, 0, 0], O: [0, 0, 0, 0] };
      const servedBy: Record<CaucusGroup, number> = { D: 0, R: 0, O: 0 };
      const seatsBy: Record<CaucusGroup, number> = { D: 0, R: 0, O: 0 };
      let seats = 0;
      let ageMissing = 0;
      for (const [id, e] of roster) {
        if (view !== "both" && !e.chambers.has(view)) continue;
        const p = person.get(id);
        if (!p) throw new Error(`demographics: ${id} is in terms.json but not legislators.json`);
        const g = (CAUCUS_OVERRIDE[`${id}@${c}`] as CaucusGroup | undefined) ?? caucusGroup(e.caucus);
        seats++;
        seatsBy[g]++;
        const n = servedThrough(id, c);
        tenure[tenureBand(n)]++;
        tenureBy[g][tenureBand(n)]++;
        servedSum += n;
        servedBy[g] += n;
        if (p.birthday) all.push(ageYearsOn(p.birthday, date));
        if (p.gender === "F") women[g]++;
        if (p.birthday) ages[g].push(ageYearsOn(p.birthday, date));
        else ageMissing++;
      }
      views[view].push({
        congress: c,
        date,
        year: Number(date.slice(0, 4)),
        termId,
        seats,
        seatsBy,
        age: { D: ageStat(ages.D), R: ageStat(ages.R), O: ageStat(ages.O) },
        ageAll: ageStat(all),
        ageMissing,
        women,
        tenure,
        servedSum,
        tenureBy,
        servedBy,
      });
    }
  }
  return { firstCongress: FIRST_DEMO_CONGRESS, lastCongress, presidents: toPresidents(admins), views };
}

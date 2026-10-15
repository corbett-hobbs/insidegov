import type { ChamberView } from "./chamber";

/** Client-safe shapes for /congress/demographics. Built at build time by `lib/demographics-derive.ts`. */

export type CaucusGroup = "D" | "R" | "O";

/** Exact age in years (to a tenth) on the Congress's convening day, for members with a full birthdate. */
export interface AgeStat {
  /** One decimal; null when nobody in the group has a birthdate. */
  median: number | null;
  average: number | null;
  /** Members the figures cover. */
  n: number;
}

/** One Congress, one chamber view. */
export interface DemoCongress {
  congress: number;
  /** Convening day, ISO; the date ages are counted on. */
  date: string;
  /** Calendar year the Congress convened. */
  year: number;
  /** `term_id` of the president in office for most of the Congress. */
  termId: string;
  /** Voting members who held a seat at any time in the Congress (each person once). */
  seats: number;
  age: Record<CaucusGroup, AgeStat>;
  /** Everyone with a birthdate, any caucus (the stat strip's headline median). */
  ageAll: AgeStat;
  /** Members left out of the age figures for want of a birthdate. */
  ageMissing: number;
  /** Seats by caucus (sums to `seats`), so men by caucus is this minus `women`. */
  seatsBy: Record<CaucusGroup, number>;
  /** Women by caucus. */
  women: Record<CaucusGroup, number>;
  /** Members by Congresses served, counting this one: 1 / 2-5 / 6-10 / 11 or more. */
  tenure: [number, number, number, number];
  /** Sum of Congresses served over the roster, so the average is `servedSum / seats`. */
  servedSum: number;
  /** The tenure bands and the Congresses-served sum by caucus (each adds up to `tenure` / `servedSum`), for the party filter. */
  tenureBy: Record<CaucusGroup, [number, number, number, number]>;
  servedBy: Record<CaucusGroup, number>;
}

export interface DemoPresident {
  id: string;
  president: string;
  last: string;
  party: "D" | "R";
}

export interface DemographicsPayload {
  firstCongress: number;
  lastCongress: number;
  presidents: DemoPresident[];
  views: Record<ChamberView, DemoCongress[]>;
}

/** Congresses served (1, 2-5, 6-10, 11+) as years in office at two years a Congress: up to 2, 3-10, 11-20, over 20. */
export const TENURE_LABELS = ["Up to 2 years", "3–10 years", "11–20 years", "Over 20 years"] as const;

/** Bump when the roster file's shape changes, so a stale cached copy is refetched. */
export const ROSTER_SHAPE = 1;

/**
 * A person on the roster file (`/data/demographics/members`), as `[id, name, born, female, photo, profile]`. `born` is ""
 * without a birthdate; `profile` is 1 (House page) or 2 (Senate page) for members of the latest Congress, else 0.
 */
export type RosterPerson = [id: string, name: string, born: string, female: 0 | 1, photo: 0 | 1, profile: 0 | 1 | 2];

/**
 * One member's seat in one Congress, as `[person, caucus, chambers, state, served, first]`: the index into `people`;
 * 0 Democratic, 1 Republican, 2 other; 1 House, 2 Senate, 3 both; the state; Congresses served counting this one; the
 * first Congress served (any chamber, gaps and pre-1933 service included).
 */
export type RosterEntry = [person: number, caucus: 0 | 1 | 2, chambers: 1 | 2 | 3, state: string, served: number, first: number];

/** The names behind the charts. `people` is sorted by surname; `congresses[i]` lists the members of Congress `firstCongress + i`. */
export interface DemoRoster {
  shape: number;
  firstCongress: number;
  people: RosterPerson[];
  congresses: RosterEntry[][];
}

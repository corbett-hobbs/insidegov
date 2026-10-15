import type { Chamber, ChamberView } from "./chamber";
import { ageOn, ageYearsOn } from "./demographics-derive";
import type { CaucusGroup, DemoCongress, DemoRoster } from "./demographics-types";

/** One row of a member list: a member's seat in the Congress being listed. */
export interface ListMember {
  id: string;
  name: string;
  caucus: CaucusGroup;
  state: string;
  /** The chamber shown: the view's own, else the Senate for someone who sat in both. */
  chamber: Chamber;
  female: boolean;
  /** Exact age on the Congress's convening day; null without a birthdate. */
  age: number | null;
  /** Birth year; null without a birthdate. */
  born: number | null;
  /** Whole years of that age, as printed. */
  ageWhole: number | null;
  /** Congresses served counting this one (two years each). */
  served: number;
  /** Calendar year the first Congress served convened. */
  since: number;
  photo: boolean;
  /** Which profile page exists: the chamber's, or null for anyone outside the latest Congress. */
  profile: Chamber | null;
  /** The person's place in the roster's A-Z order, which breaks every tie. */
  az: number;
}

const CAUCUS: readonly CaucusGroup[] = ["D", "R", "O"];

/** The year a Congress convened (the 1st met in 1789). */
export const congressYear = (congress: number) => 1789 + 2 * (congress - 1);

/** Who held a seat in `row`'s Congress in the chamber view, A-Z by surname. Counts match `row.seats` exactly. */
export function listMembers(roster: DemoRoster, row: DemoCongress, view: ChamberView): ListMember[] {
  const entries = roster.congresses[row.congress - roster.firstCongress] ?? [];
  const out: ListMember[] = [];
  for (const [person, caucus, chambers, state, served, first] of entries) {
    if (view !== "both" && (chambers & (view === "house" ? 1 : 2)) === 0) continue;
    const [id, name, born, female, photo, profile] = roster.people[person];
    out.push({
      id,
      name,
      caucus: CAUCUS[caucus],
      state,
      chamber: view === "both" ? (chambers & 2 ? "senate" : "house") : view,
      female: female === 1,
      age: born ? ageYearsOn(born, row.date) : null,
      born: born ? Number(born.slice(0, 4)) : null,
      ageWhole: born ? ageOn(born, row.date) : null,
      served,
      since: congressYear(first),
      photo: photo === 1,
      profile: profile === 0 ? null : profile === 1 ? "house" : "senate",
      az: person,
    });
  }
  return out;
}

/**
 * How a list is ordered. `age` runs oldest first (no birthdate last, whichever way it runs); `tenure` runs longest first,
 * ties going to whoever started earlier. Anything still tied is A-Z by surname.
 */
export type ListOrder = "age" | "tenure";

export function sortMembers(members: readonly ListMember[], by: ListOrder, reverse: boolean): ListMember[] {
  const dir = reverse ? -1 : 1;
  return [...members].sort((a, b) => {
    if (by === "age") {
      if (a.age === null || b.age === null) return a.age === b.age ? a.az - b.az : a.age === null ? 1 : -1;
      return dir * (b.age - a.age) || a.az - b.az;
    }
    return dir * (b.served - a.served || a.since - b.since) || a.az - b.az;
  });
}

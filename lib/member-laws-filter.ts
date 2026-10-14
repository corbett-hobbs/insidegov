import type { MemberLaws } from "./laws-types";

/**
 * Filtering for the member page's laws card (`components/profile/MemberLawsCard.tsx`): the part the member played
 * (all, sponsored, cosponsored), the "major laws" flag, and the search words. Pure and tested; the card's three tiles
 * are these filters and show how many laws each would leave.
 */

export type RoleFilter = "all" | "sponsored" | "cosponsored";

export interface LawFilter {
  role: RoleFilter;
  major: boolean;
  /** Lower-case search words; every one must appear. */
  terms: readonly string[];
}

export const NO_LAW_FILTER: LawFilter = { role: "all", major: false, terms: [] };

export const isFiltered = (f: LawFilter): boolean => f.role !== "all" || f.major || f.terms.length > 0;

/** Whether row `i` of the member's laws passes the filter. Row layout is `LawsList.rows` (see `lib/laws-types.ts`). */
export function lawMatches(laws: MemberLaws, i: number, f: LawFilter): boolean {
  const r = laws.rows[i]!;
  const sponsor = laws.roles[i] === 1;
  if ((f.role === "sponsored" && !sponsor) || (f.role === "cosponsored" && sponsor) || (f.major && r[9] !== 1)) return false;
  if (f.terms.length === 0) return true;
  const hay = `${r[3]} ${r[12]} ${laws.areas[r[4]]?.name ?? "Not classified"} ${r[11]} ${r[0]}-${r[1]} pub. l. ${r[0]}–${r[1]}`.toLowerCase();
  return f.terms.every((t) => hay.includes(t));
}

/** Indices of the rows that pass, in list order (newest first). */
export function filterLaws(laws: MemberLaws, f: LawFilter): number[] {
  const out: number[] = [];
  for (let i = 0; i < laws.rows.length; i++) if (lawMatches(laws, i, f)) out.push(i);
  return out;
}

export interface TileCounts {
  sponsored: number;
  cosponsored: number;
  major: number;
}

/**
 * What each tile would show: the laws that pass every active filter *except that tile's own dimension*, then that
 * tile's choice applied. So the two role tiles split the current (major + search) selection by role, and the major tile
 * counts the major laws in the current (role + search) selection. With nothing active they are the member's totals.
 */
export function tileCounts(laws: MemberLaws, f: LawFilter): TileCounts {
  return {
    sponsored: filterLaws(laws, { ...f, role: "sponsored" }).length,
    cosponsored: filterLaws(laws, { ...f, role: "cosponsored" }).length,
    major: filterLaws(laws, { ...f, major: true }).length,
  };
}

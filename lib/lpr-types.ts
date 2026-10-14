/**
 * Client-safe shapes for the legal-immigration (green cards and naturalizations) payload: built by the
 * pure `lib/lpr-derive.ts` from `pipeline/output/lpr_*.json`, read by `lib/lpr-data.ts`. No I/O and
 * no Zod here, so client components can import it. No UI uses it yet (session F builds the cards).
 */

/** Major classes of admission, bottom to top of a stack (OHSS Table 6 order). */
export const LPR_CLASS_STACK = ["immediate_relatives", "family_preference", "employment_preference", "diversity", "refugees", "asylees", "other"] as const;
export type LprClassKey = (typeof LPR_CLASS_STACK)[number];

export const LPR_CLASS_NAME: Record<LprClassKey, { name: string; short: string }> = {
  immediate_relatives: { name: "Immediate relatives of U.S. citizens", short: "Immediate relatives" },
  family_preference: { name: "Family-sponsored preferences", short: "Family" },
  employment_preference: { name: "Employment-based preferences", short: "Employment" },
  diversity: { name: "Diversity (visa lottery)", short: "Diversity" },
  refugees: { name: "Refugees (adjusting to permanent residence)", short: "Refugees" },
  asylees: { name: "Asylees (adjusting to permanent residence)", short: "Asylees" },
  other: { name: "Other classes", short: "Other" },
};

export interface LprTerm {
  termId: string;
  president: string;
  last: string;
  party: "D" | "R";
}

export interface LprNoteOut {
  id: string;
  kind: "definition" | "era" | "caveat" | "context" | "coverage" | "restatement";
  /** null = applies to green cards and naturalizations. */
  metric: "lpr" | "naturalizations" | null;
  fyStart: number;
  fyEnd: number | null;
  title: string;
  text: string;
}

export interface LprYear {
  /** Fiscal year, named by the calendar year it ends in. */
  fy: number;
  /** From the quarterly report (only the newest year); the Yearbook will revise it. */
  preliminary: boolean;
  /** People who became lawful permanent residents. */
  lpr: number;
  /** By major class; null before FY1999 (totals only). Adds up to `lpr` within OHSS's rounding. */
  classes: Record<LprClassKey, number> | null;
  /** Arrived from abroad as permanent residents / adjusted status inside the U.S.; null before FY1999. */
  newArrivals: number | null;
  adjustments: number | null;
  /** People 18 and over who naturalized. A different count from `lpr`: never add or stack the two. */
  naturalizations: number | null;
  /** OHSS rounded this year's cells to the nearest ten. */
  rounded: boolean;
  termId: string;
  party: "D" | "R";
  blended: boolean;
  days: { termId: string; last: string; days: number }[];
  noteIds: string[];
}

export interface LprCountryRef {
  key: string;
  name: string;
  kind: "country" | "other" | "unknown" | "withheld";
}

export interface LprCountryYear {
  fy: number;
  metric: "lpr" | "naturalizations";
  /** Yearbook years are by country of birth; the newest (quarterly-only) year by country of nationality. */
  basis: "birth" | "nationality";
  preliminary: boolean;
  total: number;
  /** [country index, value], largest first; buckets (other, unknown, withheld) included. */
  rows: [number, number][];
}

export interface LprPayload {
  years: LprYear[];
  terms: LprTerm[];
  notes: LprNoteOut[];
  countries: LprCountryRef[];
  countryYears: LprCountryYear[];
  firstFy: number;
  lastFy: number;
  /** First year with classes, new arrivals vs. adjustments and countries. */
  firstDetailFy: number;
  asOf: string;
}

export interface RankedLprCountry {
  ci: number;
  key: string;
  name: string;
  value: number;
  rank: number;
  /** Change from the year before on the same basis; null when there is no comparable prior year. */
  change: number | null;
}

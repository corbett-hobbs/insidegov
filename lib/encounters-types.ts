/**
 * Client-safe shapes for the CBP border-encounters card on /presidency/immigration: the dense payload the server hands
 * the page. Built by the pure `lib/encounters-derive.ts` from `pipeline/output/encounters_*.json`; read by
 * `lib/encounters-data.ts`. No I/O and no Zod here, so client components can import it.
 */

export type EncounterScopeKey = "nationwide" | "southwest";

/** How much of the split a year has (the same nationwide and southwest). */
export type EncounterDetailLevel = "usbp_only" | "components" | "full";

/** One scope of one year. Null means not published for that year, never zero. */
export interface EncounterParts {
  /** Border Patrol apprehensions between ports of entry (Title 8). */
  usbp: number;
  /** Port-of-entry inadmissibles (OFO, Title 8); null before FY2004. */
  ofo: number | null;
  /** Title 42 expulsions by both components; null outside FY2020–FY2023. */
  title42: number | null;
  /** Title 42 by component, when `title42` is set. */
  title42ByComponent: { usbp: number; ofo: number } | null;
  /** Sum of the published parts. */
  total: number;
}

export interface EncountersYear {
  /** Fiscal year, named by the calendar year it ends in. */
  fy: number;
  detail: EncounterDetailLevel;
  /** The year is still in progress in CBP's newest file. */
  preliminary: boolean;
  /** Months included (12 unless preliminary). */
  months: number;
  nationwide: EncounterParts;
  southwest: EncounterParts;
  /** OFO figures for the year are OHSS's, rounded to the nearest ten (FY2004–FY2014). */
  ofoRounded: boolean;
  termId: string;
  party: "D" | "R";
  blended: boolean;
  /** Calendar days under each administration; more than one entry only for blended years. */
  days: { termId: string; last: string; days: number }[];
  /** Notes that apply to the year (ids into `notes`). */
  noteIds: string[];
}

export interface EncountersTerm {
  termId: string;
  president: string;
  last: string;
  party: "D" | "R";
  startYear: number;
  endYear: number | null;
}

/** A numbered definition change on the axis. */
export interface EncountersMarker {
  n: number;
  id: string;
  /** ISO date the marker sits at. */
  date: string;
  /** `month`: the source gives the month only. */
  precision: "day" | "month";
  label: string;
  title: string;
  text: string;
}

export interface EncountersNoteText {
  id: string;
  kind: "definition" | "change" | "caveat" | "coverage";
  title: string;
  text: string;
}

export interface EncountersPayload {
  /** FY1980 on, one per year. */
  years: EncountersYear[];
  terms: EncountersTerm[];
  markers: EncountersMarker[];
  notes: EncountersNoteText[];
  firstFy: number;
  lastFy: number;
  /** First year with port-of-entry (OFO) figures. */
  firstOfoFy: number;
  /** ISO date the data was assembled. */
  asOf: string;
}

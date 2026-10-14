/**
 * Client-safe shapes for the refugee section of /presidency/immigration (`components/immigration/Refugee*`): the dense payload the
 * server hands the page. Built by the pure `lib/refugee-derive.ts` from `pipeline/output/refugee_*.json`; read by `lib/refugee-data.ts`.
 * No I/O and no Zod here, so client components can import it.
 */

/** The five geographic groups an admission belongs to. */
export type GeoGroup = "africa" | "east_asia" | "europe" | "latin_america_caribbean" | "near_east_south_asia";

/** Stack order, bottom to top (oldest big wave first: East Asia, then Europe, Africa, the Near East, Latin America). */
export const GEO_STACK: readonly GeoGroup[] = ["east_asia", "europe", "africa", "near_east_south_asia", "latin_america_caribbean"];

export const GEO_NAME: Record<GeoGroup | "unallocated", { name: string; short: string }> = {
  africa: { name: "Africa", short: "Africa" },
  east_asia: { name: "East Asia", short: "East Asia" },
  europe: { name: "Europe & Central Asia", short: "Europe" },
  latin_america_caribbean: { name: "Latin America / Caribbean", short: "Latin America" },
  near_east_south_asia: { name: "Near East / South Asia", short: "Near East / S. Asia" },
  unallocated: { name: "Unallocated reserve", short: "Unallocated" },
};

export interface RefugeeTerm {
  termId: string;
  president: string;
  last: string;
  party: "D" | "R";
  startYear: number;
  endYear: number | null;
}

export interface RefugeeCardNote {
  id: string;
  title: string;
  text: string;
}

export interface RefugeeYear {
  /** Fiscal year, named by the calendar year it ends in. */
  fy: number;
  /** Ceiling in force at the end of the year (the last determination). */
  ceiling: number | null;
  /** The first ceiling of the year; differs from `ceiling` when a determination revised it mid-year. */
  ceilingInitial: number | null;
  revised: boolean;
  admissions: number;
  /** The year's State Department report is the first year-end one and may be revised. */
  preliminary: boolean;
  /** admissions / ceiling, 0 to 1+. */
  share: number | null;
  termId: string;
  party: "D" | "R";
  blended: boolean;
  /** Calendar days under each administration; more than one entry only for blended years. */
  days: { termId: string; last: string; days: number }[];
  /** Admissions by region; the five add up to `admissions`. */
  regions: Record<GeoGroup, number>;
  cardNotes: RefugeeCardNote[];
}

/** A numbered rule on the chart: an executive order or proclamation that changed who could be admitted. */
export interface RefugeeMarker {
  n: number;
  id: string;
  /** ISO date the rule took effect (where the marker sits). */
  date: string;
  instrument: string;
  citation: string | null;
  signed: string;
  ended: string | null;
  title: string;
  summary: string;
  effect: string;
  status: "in_effect" | "superseded" | "expired" | "revoked";
  statusAsOf: string;
}

export interface RegionRow {
  group: GeoGroup | "unallocated";
  /** Null for the unallocated reserve (a cap with no arrivals). */
  admissions: number | null;
  /** The State Department's year-end regional ceiling, else the last determination's allocation, else the first; null when the year has none. */
  cap: [number, number] | null;
  /** The region's admissions the year before, for the change column and table. */
  prev: number | null;
}

export interface RefugeeRegionYear {
  fy: number;
  rows: RegionRow[];
  /** Why no region has a cap this year, or null when at least one does. */
  noCaps: "group" | "category" | null;
}

export interface RefugeeCountryRef {
  /** ISO 3166-1 alpha-3, the key the world map's outlines carry. */
  key: string;
  name: string;
}

export interface RefugeeCountryYear {
  fy: number;
  total: number;
  /** [country index, admissions, region], largest first. */
  rows: [number, number, GeoGroup][];
}

export interface RefugeePayload {
  /** FY2001 on; the page shows FY2003 on and uses the earlier years for the change column. */
  years: RefugeeYear[];
  terms: RefugeeTerm[];
  markers: RefugeeMarker[];
  regionYears: RefugeeRegionYear[];
  countries: RefugeeCountryRef[];
  countryYears: RefugeeCountryYear[];
  firstFy: number;
  lastFy: number;
  /** ISO date the data was assembled. */
  asOf: string;
}

/** One country's line in the ranked list. */
export interface RankedCountry {
  ci: number;
  key: string;
  name: string;
  value: number;
  group: GeoGroup;
  rank: number;
  /** Change from the prior fiscal year (a country that did not appear then counts from zero); null when there is no prior year. */
  change: number | null;
}

/** The largest source country in a year, with the runners-up. */
export interface TopYear {
  fy: number;
  /** Up to three, largest first. */
  ranked: { ci: number; value: number; group: GeoGroup }[];
  total: number;
  preliminary: boolean;
}

import type { ChamberTally } from "./laws-types";
import type { TimelinePayload } from "./timeline-types";

/**
 * Client-safe shapes for the Presidents directory (`/presidency/presidents`) and the president pages
 * (`/presidency/presidents/[slug]`). Built at build time by `lib/president-data.ts` from the existing page loaders and
 * shaped by the pure, tested `lib/president-derive.ts`.
 */
export type Party = "D" | "R";

/** One stretch in office. `end` is the last day in office (inclusive), or null while serving. */
export interface PresidentTerm {
  termId: string;
  start: string;
  end: string | null;
  /** 33 for Truman; Trump's two terms are 45 and 47. */
  ordinal: number;
}

export interface PresidentRef {
  slug: string;
  /** "Barack Obama", as the administrations tables print it. */
  name: string;
  last: string;
  party: Party;
  terms: PresidentTerm[];
  /** `/images/presidents/<slug>.jpg`, or null (initials are drawn instead). */
  photo: string | null;
}

/** A justice shown as a face in the directory row. */
export interface DirectoryJustice {
  id: number;
  name: string;
  photo: string | null;
  path: string | null;
  nominated: string;
  /** Still on the Court (no end of service). */
  serving: boolean;
}

/** One row of the directory. */
export interface PresidentSummary extends PresidentRef {
  days: number;
  /** Major laws signed (David Mayhew's lists, from 1947); null before them or when no Congress in the term is assessed yet. */
  major: number | null;
  /** The one the president is best known for (`majorTopFor`), with the link to its page (null before 1973, when the site has no law pages). */
  majorTop: { title: string; path: string | null } | null;
  /** Why the count is partial or missing ("from 1947", "later term not yet assessed"), or null when it covers the whole time in office. */
  majorNote: string | null;
  /** Days in office with the president's party holding both chambers, one, or neither. */
  control: { both: number; one: number; neither: number };
  /** Justices appointed (elevations left out), newest first. */
  justices: DirectoryJustice[];
  /** Misery index across the time in office; null where the series has no value in the term. */
  misery: { segments: { x0: number; x1: number; points: [number, number][] }[]; first: number; last: number; firstLabel: string; lastLabel: string } | null;
}

/** One value on a series card: a month, quarter, week or fiscal year. */
export interface SeriesPoint {
  /** Fractional year on the card's x axis (2009.04 = mid-January 2009). For a fiscal-year bar, its end. */
  x: number;
  value: number;
  /** "Jan 2009", "FY2010", "Q2 2009", "Mar 6, 2009". */
  label: string;
  preliminary?: boolean;
  /** A stacked bar's split, bottom to top, aligned with the panel's `stack`; sums to `value`. */
  stack?: number[];
}

/** A card panel's values for one term (Trump has two). */
export interface SeriesSegment {
  termId: string;
  /** The term's edges on the x axis (fractional years). */
  x0: number;
  x1: number;
  points: SeriesPoint[];
}

export type SeriesFormat = "num" | "pct" | "pctSigned" | "count" | "usdB" | "mbbl";

export interface SeriesPanel {
  id: string;
  /** Short caption above the plot ("Unemployment rate"). */
  title: string;
  kind: "line" | "bars";
  format: SeriesFormat;
  /** A CSS colour for the line or bars. */
  color: string;
  segments: SeriesSegment[];
  /** Bars stacked by group, bottom to top (the card's breakdown colours); each point's `stack` follows this order. */
  stack?: { id: string; label: string; color: string }[];
  /** The main line's own name when the panel also draws `parts` ("Unemployment rate"). */
  lineTitle?: string;
  /** Extra lines drawn thinner under the main one (the misery index's two parts). */
  parts?: { id: string; title: string; color: string; segments: SeriesSegment[] }[];
  /** "Data starts 1980", when the series begins after the president took office. */
  coverage?: string;
}

/** First and last reading of a panel within one term. */
export interface StartEnd {
  termId: string;
  first: SeriesPoint;
  last: SeriesPoint;
}

export interface CongressRow {
  /** Congress number. */
  n: number;
  /** The part of the Congress inside the term. */
  start: string;
  end: string;
  /** Who held each chamber for most of those days. */
  house: Party;
  senate: Party;
  /** Seats at the Congress's start: [Democrats, Republicans, other]. */
  houseSeats: [number, number, number];
  senateSeats: [number, number, number];
  /** The Senate majority changed hands during the Congress (2001, 2021). */
  senateChanged: boolean;
}

export interface CongressSummary {
  rows: CongressRow[];
  /** Days in office with each arrangement: both chambers the president's party, one, or neither. */
  days: { both: number; one: number; neither: number };
}

export interface AppointedJustice {
  id: number;
  name: string;
  /** Profile page, when the justice has one. */
  path: string | null;
  photo: string | null;
  role: "Chief justice" | "Associate justice";
  /** Elevated from associate to chief (Rehnquist, by Reagan). */
  elevated: boolean;
  nominated: string;
  confirmed: string | null;
  vote: { ayes: number; nays: number } | null;
  /** Still on the Court. */
  serving: boolean;
}

export interface CountBreakdown {
  id: string;
  label: string;
  n: number;
  color: string;
}

/** Counts per year in office: year 1 runs from the inauguration to the day before its anniversary. */
export interface TermYearCount {
  termId: string;
  /** 1-based year of the term. */
  year: number;
  /** "2009–10". */
  label: string;
  from: string;
  to: string;
  n: number;
  /** The year is cut short (a president left office or is still serving). */
  partial: boolean;
}

/** A major law from Mayhew's 1947-72 lists: no law page; his title, year and one-line description, and each chamber's passage vote from Voteview. */
export interface EarlyMajorLaw {
  title: string;
  year: number | null;
  /** The Congress the law was enacted in. */
  congress: number | null;
  summary: string;
  /** Mayhew printed the entry in capitals, his mark for the most important. */
  capitals: boolean;
  /** Each chamber's last recorded passage vote, from Voteview (`[0, yea, nay]`); null where it passed without a roll call. */
  house: ChamberTally | null;
  senate: ChamberTally | null;
}

export interface PresidentTimeline {
  payload: TimelinePayload;
  /** The chart's window: the first day in office (or the Timeline's start) to the last day. */
  from: string;
  to: string;
  /** `TlEvent.no` of every landmark law and case inside a term, in date order. */
  eventNos: number[];
}

export interface LawsSummary {
  signed: number;
  /** Laws enacted over the president's veto. */
  overridden: number;
  /** Signed laws Mayhew lists as important; null when none of the term is assessed yet. */
  major: number | null;
  /** Last Congress Mayhew has assessed, and whether the time in office runs past it. */
  majorThrough: number;
  majorPartial: boolean;
  /** Newest first, with the first sentence of the CRS summary ("" when none) and the passage votes as the Laws page prints them. */
  majorList: { title: string; date: string; path: string; summary: string; votes: string; house: ChamberTally; senate: ChamberTally; area: { label: string; color: string } }[];
  byYear: TermYearCount[];
  /** `byYear` as the card's bar panel. */
  panel: SeriesPanel;
  groups: CountBreakdown[];
  /** Laws data begins mid-term (Nixon): "Data starts January 1973". */
  coverage?: string;
  dataThrough: string;
}

export interface EosSummary {
  total: number;
  byYear: TermYearCount[];
  panel: SeriesPanel;
  topics: CountBreakdown[];
  coverage?: string;
  throughDate: string;
}

export interface NamedLeader {
  name: string;
  /** Years at No. 1 within the term. */
  years: number;
}

export interface PresidentPageData {
  president: PresidentRef;
  bio: { extract: string; url: string; photoSource: string | null; photoLicense: string | null } | null;
  prev: Pick<PresidentRef, "slug" | "name" | "last" | "party" | "photo"> | null;
  next: Pick<PresidentRef, "slug" | "name" | "last" | "party" | "photo"> | null;
  days: number;
  /** ISO date of the newest data the page was built from (for a serving president's "through" line). */
  asOf: string;
  congress: CongressSummary;
  justices: AppointedJustice[];
  laws: LawsSummary | null;
  /** Mayhew's important enactments signed before the laws data begins (1973), newest first. */
  earlyMajor: EarlyMajorLaw[];
  /** The Timeline page's chart and hand-picked landmark laws and cases for this president's years in office; null before the Timeline begins (4 March 1933). */
  timeline: PresidentTimeline | null;
  eos: EosSummary | null;
  /** Panels by card id; a card is absent when none of its panels has data for the term. */
  cards: Partial<Record<SeriesCardId, SeriesPanel[]>>;
  /** Top recipient / top host over the term, for the aid and troops cards. */
  aidTop: NamedLeader | null;
  troopsTop: NamedLeader | null;
}

export type SeriesCardId = "misery" | "fiscal" | "arrivals" | "removals" | "trade" | "aid" | "troops" | "spr";

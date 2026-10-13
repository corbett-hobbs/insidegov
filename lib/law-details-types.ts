import type { TimelineAction, PartyLetter } from "./law-details-derive";
import type { LawChamberVotesView } from "./law-votes-types";
import type { ChamberTally } from "./laws-types";

/** Client-safe shape of one law page, joined at build time by `lib/law-details-data.ts`. */

export interface LawPerson {
  name: string;
  /** "D-NY-12" style label. */
  label: string;
  party: PartyLetter;
  /** Profile path, only for a member of the current Congress. */
  path: string | null;
  /** Cosponsors only (Phase 2 data): the date they joined, whether they were an original cosponsor, the date they withdrew. */
  joined?: string | null;
  original?: boolean;
  withdrawn?: string | null;
}

export interface LawAmendmentEntry {
  chamber: "House" | "Senate";
  /** "S.Amdt. 6622". */
  label: string;
  /** The sponsor as a member (party dot, name) when the source gives a member id we know; else the name as printed (a committee), else null. */
  sponsor: LawPerson | null;
  sponsorText: string | null;
  submitted: string | null;
  purpose: string | null;
  latest: { date: string | null; text: string } | null;
}

export interface LawRelatedEntry {
  /** "H.R. 2851" (with the Congress when it is not this law's). */
  label: string;
  title: string;
  /** Relationship names, as the source gives them. */
  rel: string[];
  /** Our page for the related bill when it is itself a public law in the data. */
  lawPath: string | null;
  lawLabel: string | null;
  /** Congress.gov page otherwise (null for a type we cannot map). */
  url: string | null;
}

export interface LawCommitteeEntry {
  name: string;
  chamber: "House" | "Senate" | "Joint" | null;
  /** Committee page path where the committee is in the current-Congress data. */
  path: string | null;
  subcommittees: string[];
  /** What happened there, lower-case ("referred to", "reported by", ...). */
  steps: string[];
}

export interface LawPageData {
  lawId: string;
  congress: number;
  number: number;
  title: string;
  /** "Public Law 118-90". */
  publicLaw: string;
  /** Signing date, or the date a veto was overridden. */
  date: string;
  billLabel: string;
  originChamber: "House" | "Senate" | null;
  /** The administration in office on `date`. */
  president: { name: string; party: "D" | "R" };
  veto: boolean;
  area: string | null;
  major: boolean | null;
  summary: string[] | null;
  summaryCut: boolean;
  actions: TimelineAction[];
  /** True when the Phase 2 record (amendments, related bills, cosponsor dates, the full summary and action list) exists for this law's Congress. */
  full: boolean;
  amendments: LawAmendmentEntry[];
  related: LawRelatedEntry[];
  /** Cosponsors who withdrew (Phase 2 data). */
  withdrawn: LawPerson[];
  sponsor: LawPerson | null;
  cosponsors: LawPerson[];
  /** Cosponsor ids with no member record (never expected; reported so the list is not silently short). */
  cosponsorsUnresolved: number;
  passage: { house: ChamberTally; senate: ChamberTally; override: [number | null, number | null, number | null, number | null] | null };
  /** Who voted on final passage, per chamber with a recorded and checked member vote (Phase 2c); empty otherwise. */
  votes: LawChamberVotesView[];
  committees: LawCommitteeEntry[];
  congressGovUrl: string | null;
  /** The Laws page's data-through date. */
  dataThrough: string;
}

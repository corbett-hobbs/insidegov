/**
 * Client-safe shapes for /timeline. Built at build time by `lib/timeline-build.ts` (read through the server-only
 * `lib/timeline-data.ts`) and handed to the page whole; the page derives who held power on any date from them with
 * the pure functions in `lib/timeline-derive.ts`.
 */
export type Side = "D" | "R";

export interface TlPresident {
  name: string;
  party: Side;
  start: string;
  /** The day the next president took office (exclusive end); null while in office. */
  end: string | null;
}

export interface TlCongress {
  /** Congress number (73 = 1933). */
  n: number;
  start: string;
  /** The next Congress's first day (exclusive end). */
  end: string;
  /** Seats at the start: [Democrats, Republicans, other]; Senate independents count with the party they caucused with. */
  house: [number, number, number];
  senate: [number, number, number];
  /** Who held the Senate majority from each date in this Congress (one entry unless it changed mid-Congress, 2001 and 2021). */
  senateMaj: [string, Side][];
  houseMaj: Side;
}

export interface TlJustice {
  id: number;
  /** Last name. */
  name: string;
  full: string;
  /** Party of the president who first appointed them. */
  party: Side;
  by: string;
  start: string;
  /** Last day counted on the Court: the recorded end, or, when the seat stayed empty for under six months, the day before the successor's start. */
  end: string | null;
}

/** One Court term's median justice: [term (October start year), Martin-Quinn score, median justice's last name]. */
export type TlLean = [number, number, string | null];

/** Yes and no votes by party in one chamber. */
export interface TlTally {
  D: [number, number];
  R: [number, number];
}

export interface TlLink {
  /** The other event's id. */
  id: string;
  /** What the Court did ("struck down its processing tax", "overruled it"). */
  text: string;
}

export interface TlEvent {
  id: string;
  /** 1-based, in date order. */
  no: number;
  kind: "law" | "case";
  name: string;
  what: string;
  date: string;
  /** English Wikipedia article title. */
  wiki: string;
  // Cases
  /** The case's decision page on this site (1946 term on; earlier cases link to Wikipedia). */
  casePath?: string;
  /** "6–3". */
  vote?: string;
  /** Last name of the justice who wrote the majority opinion. */
  author?: string;
  /** Justices in the majority and in dissent, by appointing party. */
  majority?: Partial<Record<Side, number>>;
  dissent?: Partial<Record<Side, number>>;
  /** The vote was entered by hand (before the SCDB data starts in 1946). */
  voteHand?: boolean;
  /** The Supreme Court Database's coding of who prevailed: 1 conservative, 2 liberal. Absent before 1946 and where uncoded. */
  direction?: 1 | 2;
  /** The case's issue area id, for the direction pill's note. */
  areaId?: string;
  // Laws
  /** The law's page on this site, when it has one (93rd Congress on). */
  lawPath?: string;
  /** Final-passage yes and no votes by party, per chamber, where recorded. */
  split?: { house?: TlTally; senate?: TlTally };
  /** Each chamber's final-passage vote, all members (`[yea, nay]`), where it was a recorded roll call. */
  tally?: { house?: [number, number]; senate?: [number, number] };
  /** Passed over a veto. */
  override?: boolean;
  // Links between events on the list
  /** Law → the case on the list that ruled on it. */
  tested?: TlLink;
  /** Case → the law on the list it ruled on. */
  ruledOn?: TlLink;
  earlierCases?: TlLink[];
  laterCases?: TlLink[];
}

export interface TimelinePayload {
  /** Build date (YYYY-MM-DD): the right edge of the timeline. */
  today: string;
  /** When the hand-picked list was last reviewed. */
  reviewed: string;
  presidents: TlPresident[];
  congresses: TlCongress[];
  justices: TlJustice[];
  lean: TlLean[];
  events: TlEvent[];
}

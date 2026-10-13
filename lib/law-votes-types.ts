/** Client-safe shape of the "who voted" section on a law page, joined at build time by `lib/law-votes-data.ts`. */

export type VoteCast = "yea" | "nay" | "present" | "absent" | "none";

export interface LawVoter {
  id: string;
  name: string;
  /** "D-NY-12" style label. */
  label: string;
  /** The party the lists split on: Democrats and Republicans; everyone else is "O". */
  side: "D" | "R" | "O";
  /** Voteview party code (drives the dot colour); null when unknown. */
  partyCode: number | null;
  /** Per-Congress DW-NOMINATE position the compass plots (Nokken-Poole); null when the member is unscored. */
  dim1: number | null;
  dim2: number | null;
  cast: VoteCast;
  /** Profile path, only for a member of the current Congress. */
  path: string | null;
}

export interface LawChamberVotesView {
  chamber: "House" | "Senate";
  /** Voteview roll number (the clerk's number is not stored). */
  roll: number;
  /** Everyone who sat in the chamber that Congress and has a position or a recorded vote. */
  voters: LawVoter[];
}

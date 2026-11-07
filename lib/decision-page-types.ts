import type { CourtParty } from "./court-types";
import type { DecisionCase, DecisionDirection } from "./decisions-types";

/** Client-safe shape of one decision page, joined at build time by `lib/decision-page-data.ts`. */

/** How a justice voted, as `court/justice_votes.json` codes it: 0 did not take part, 1 majority, 2 dissent, 3 equally divided Court. */
export type BenchVote = 0 | 1 | 2 | 3;
/** What a justice wrote: 0 nothing, 1 the majority opinion, 2 a concurrence, 3 a dissent, 4 joined the majority without writing. */
export type BenchRole = 0 | 1 | 2 | 3 | 4;

export interface BenchJustice {
  id: number;
  name: string;
  /** Last name for the strip ("Roberts"; a first initial where two share one). */
  short: string;
  /** Appointing president's party. */
  party: CourtParty;
  appointedBy: string;
  path: string;
  photoSrc: string | null;
  /** Martin-Quinn score for the case's term; null when the justice has none that term. */
  score: number | null;
  vote: BenchVote;
  role: BenchRole;
}

export interface TimelineStep {
  /** ISO date, or null for a step the record does not date (the courts below). */
  date: string | null;
  kind: string;
  text: string;
}

/** One row of "Other decisions on the same issue" and "Other decisions from the same term": the Decisions list's own tuple, so the row matches "Every case". */
export interface RelatedDecision {
  c: DecisionCase;
  /** The case's topic label. */
  area: string;
  /** Its SCDB issue-area id (the outcome tag's note), null = none coded. */
  areaId: string | null;
}

export interface DecisionParty {
  /** Who, from the case name ("Wooden"); null when the name does not split on " v.". */
  name: string | null;
  /** SCDB's category for the party ("Person convicted of crime"), with a state where it names one. */
  kind: string | null;
}

export interface DecisionPageData {
  caseId: string;
  /** The full caption SCDB records ("Michael J. Astrue, Commissioner of Social Security, Petitioner v. ..."). */
  name: string;
  /** The name the case is known by ("Astrue v. Capato"), from `lib/case-name.ts`. */
  shortName: string;
  cite: string;
  docket: string | null;
  term: number;
  decided: string;
  argued: string | null;
  reargued: string | null;
  /** "Roberts Court". */
  court: string;
  /** SCDB's own issue area. */
  area: { id: string; label: string } | null;
  /** The Decisions page's topic (`pipeline/reference/decision-groups.json`); null when SCDB codes no issue area. */
  topic: { id: string; label: string } | null;
  /** SCDB's issue, sentence-cased ("Search and seizure, vehicles"). */
  issue: string | null;
  direction: DecisionDirection | null;
  landmark: { title: string; topics: string } | null;
  vote: { maj: number; min: number; band: number };
  /** "Reversed and remanded"; null when SCDB codes none. */
  disposition: string | null;
  /** What the disposition means for this case, in plain words ("The Court overturned the ... and sent the case back ..."). */
  dispositionNote: string | null;
  /** Whether the party that brought the case won; null = unclear. */
  petitionerWon: boolean | null;
  precedentAltered: boolean;
  /** "Act of Congress", "State law", "Local ordinance" when the Court struck one down. */
  struckDown: string | null;
  writer: { id: number; name: string; path: string } | null;
  petitioner: DecisionParty;
  respondent: DecisionParty;
  /** How the case reached the Court: "Certiorari", "Appeal", ... */
  jurisdiction: string | null;
  certReason: string | null;
  /** The legal provision at issue and how the Court decided it. */
  law: { type: string | null; provision: string | null; authority: string[] };
  bench: BenchJustice[];
  /** The Court's median Martin-Quinn score that term and the fixed score domain every Court chart uses. */
  median: number | null;
  domain: [number, number];
  /** Set when the term is past the official Martin-Quinn release and the scores come from a provisional report. */
  scoresProvisional: { source: string; url: string; published: string } | null;
  summary: { paragraphs: string[]; title: string } | null;
  /** The one-sentence ruling summary the case list shows, used when there is no article opening. */
  sentence: { text: string; claude: boolean } | null;
  timeline: TimelineStep[];
  /** Every other case SCDB files under the same issue ("Abortion: including contraceptives"), newest first. */
  related: { issue: string; cases: RelatedDecision[] } | null;
  /** Every other argued case decided in the same term, newest first. */
  sameTerm: { term: number; cases: RelatedDecision[] } | null;
  links: { wikipedia: string | null; oyez: string | null; justia: string | null };
  /** "Version 2026 Release 01". */
  scdbVersion: string;
  dataThroughTerm: number;
}

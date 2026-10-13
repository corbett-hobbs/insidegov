import { z } from "zod";
import { LAWS_FIRST_CONGRESS } from "./laws-entities";

/**
 * Who voted, for the individual law pages (Phase 2c of `docs/LAW_PAGES_PLAN.md`).
 *
 * Raw: `pipeline/raw/voteview/law_votes/<congress>.json`, Voteview's member-by-member votes (`H###_votes.csv`, `S###_votes.csv`) reduced
 * to the roll calls the Laws track joins to a law's final passage. A roll call is one string with one character per roster member
 * (Voteview's `cast_code`: 1-3 yea, 4-6 nay, 7-8 present, 9 not voting, 0 not a member at the time). Members are Voteview ICPSR numbers.
 *
 * Output: `pipeline/output/law_votes/<congress>.json`, keyed by law, with the roster mapped to `bioguide_id` and the casts folded to one
 * character each: `1` yea, `2` nay, `3` present, `4` did not vote, `0` not a member then.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const int = z.number().int();

export const rawVoteString = z.string().regex(/^[0-9]*$/);

export const rawLawVotesFile = z.object({
  congress: int.min(LAWS_FIRST_CONGRESS),
  fetched: isoDate,
  /** ICPSR numbers, ascending; a roll call string has one character per entry. */
  rosters: z.object({ H: z.array(int), S: z.array(int) }),
  /** `[chamber, Voteview rollnumber, one cast code per roster member]`, sorted. */
  rolls: z.array(z.tuple([z.enum(["H", "S"]), int, rawVoteString])),
});
export type RawLawVotesFile = z.infer<typeof rawLawVotesFile>;

export const lawVotesManifest = z.object({
  base_url: z.string(),
  files: z.array(z.object({ congress: int, chamber: z.enum(["H", "S"]), bytes: int, last_modified: z.string() })),
});
export type LawVotesManifest = z.infer<typeof lawVotesManifest>;

export const VOTE_CHARS = { yea: "1", nay: "2", present: "3", absent: "4", notMember: "0" } as const;

/** One chamber's recorded passage vote: `[Voteview rollnumber, one character per roster member]`. */
export const lawChamberVotes = z.tuple([int, z.string().regex(/^[0-4]*$/)]);
export type LawChamberVotes = z.infer<typeof lawChamberVotes>;

export const lawVotesShard = z.object({
  congress: int.min(LAWS_FIRST_CONGRESS),
  /** `bioguide_id` per roster slot; "" for a member the crosswalk does not map (kept so positions line up). */
  rosters: z.object({ H: z.array(z.string()), S: z.array(z.string()) }),
  laws: z.record(z.string().regex(/^\d+-pub-\d+$/), z.object({ H: lawChamberVotes.optional(), S: lawChamberVotes.optional() })),
});
export type LawVotesShard = z.infer<typeof lawVotesShard>;

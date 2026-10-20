import { z } from "zod";

/**
 * Passage votes for laws before the site's public-law data begins (1973): the Timeline page's 1933-72 laws and David Mayhew's
 * 1947-72 entries. Voteview's roll calls have no link to a public law before then, so which roll call passed which law is a
 * hand-checked reference file; the votes themselves are Voteview's.
 *
 * Reference: `pipeline/reference/early-law-votes.json`, one entry per law, keyed by its Timeline event id and/or Mayhew entry id.
 * Raw: `pipeline/raw/voteview/early_law_votes.json`, the picked roll calls' rows and member votes (`pnpm fetch:voteview-early-votes`).
 * Output: `pipeline/output/early_law_votes.json`, each chamber's tally overall and by party.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const int = z.number().int();
const roll = int.positive();
/** The Congresses before the Laws track's first (93rd). */
const congress = int.min(73).max(92);

export const earlyLawRef = z
  .strictObject({
    /** `timeline-events.json` event id. */
    timeline: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).optional(),
    /** `mayhew-1947-1972.json` entry id. */
    mayhew: z.string().regex(/^\d+-\d{2}$/).optional(),
    congress,
    /** The bill numbers the votes are filed under, in Voteview's spelling ("HR7260"). */
    bills: z.array(z.string().min(2)).min(1),
    /** Voteview rollnumbers: each chamber's last recorded roll call approving the bill; absent = no recorded vote. */
    house: roll.optional(),
    senate: roll.optional(),
    house_override: roll.optional(),
    senate_override: roll.optional(),
    /** Why a pick looks odd (a roll call filed under another bill's number, a special rule). */
    note: z.string().min(1).optional(),
  })
  .refine((e) => e.timeline !== undefined || e.mayhew !== undefined, "an entry needs a timeline or a mayhew id");
export type EarlyLawRef = z.infer<typeof earlyLawRef>;

export const earlyLawVotesRef = z
  .strictObject({ _note: z.string(), last_reviewed: isoDate, laws: z.array(earlyLawRef).min(1) })
  .superRefine((f, ctx) => {
    const seen = new Set<string>();
    for (const e of f.laws)
      for (const id of [e.timeline && `timeline:${e.timeline}`, e.mayhew && `mayhew:${e.mayhew}`])
        if (id) {
          if (seen.has(id)) ctx.addIssue({ code: "custom", message: `duplicate ${id}` });
          seen.add(id);
        }
  });
export type EarlyLawVotesRef = z.infer<typeof earlyLawVotesRef>;

/** One Voteview roll call as fetched: `[chamber, rollnumber, date, yea_count, nay_count, bill_number, description, one cast code per roster member]`. */
export const rawEarlyRoll = z.tuple([z.enum(["H", "S"]), roll, isoDate, int.nonnegative(), int.nonnegative(), z.string(), z.string(), z.string().regex(/^[0-9]*$/)]);
export type RawEarlyRoll = z.infer<typeof rawEarlyRoll>;

export const rawEarlyLawVotesFile = z.strictObject({
  fetched: isoDate,
  /** Per Congress: ICPSR rosters per chamber (ascending) and the picked roll calls. */
  congresses: z.record(
    z.string().regex(/^\d+$/),
    z.strictObject({ rosters: z.strictObject({ H: z.array(int), S: z.array(int) }), rolls: z.array(rawEarlyRoll) }),
  ),
});
export type RawEarlyLawVotesFile = z.infer<typeof rawEarlyLawVotesFile>;

const yesNo = z.tuple([int.nonnegative(), int.nonnegative()]);

/** One chamber's recorded vote: Voteview's own yea and nay counts, and yes / no by party from the member votes. */
export const earlyChamberVote = z.strictObject({ roll, date: isoDate, yea: int.nonnegative(), nay: int.nonnegative(), D: yesNo, R: yesNo });
export type EarlyChamberVote = z.infer<typeof earlyChamberVote>;

export const earlyLawVotes = z.strictObject({
  timeline: z.string().optional(),
  mayhew: z.string().optional(),
  congress,
  house: earlyChamberVote.nullable(),
  senate: earlyChamberVote.nullable(),
  house_override: earlyChamberVote.optional(),
  senate_override: earlyChamberVote.optional(),
});
export type EarlyLawVotes = z.infer<typeof earlyLawVotes>;

export const earlyLawVotesFile = z.strictObject({ laws: z.array(earlyLawVotes) });
export type EarlyLawVotesFile = z.infer<typeof earlyLawVotesFile>;

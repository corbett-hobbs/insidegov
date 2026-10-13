import { z } from "zod";
import { LAWS_FIRST_CONGRESS } from "./laws-entities";

/**
 * The per-law detail shards behind the individual law pages (`/congress/laws/[law_id]/[name_slug]`):
 * `pipeline/output/law_details/<congress>.json`, one file per Congress, keyed by `law_id`. A shard carries only what
 * `laws.json`, `laws_cosponsors.json` and `laws_committees.json` do not already hold: the CRS summary and the action
 * list. The sponsor, cosponsors, committees, passage votes and the signing president are joined from those files (and
 * the signer derived from the date) when the page is built. Methodology: `docs/LAWS_METHODOLOGY.md`; conventions:
 * `docs/DATA_CONVENTIONS.md` section 15.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const int = z.number().int();

/**
 * Action types in the order their code is stored: `LAW_ACTION_TYPES[code]`. The first six are the source's own types; `Committee`
 * (a dated committee or subcommittee step) and `Introduced` are built from the bill's committee list and introduction date, so
 * the timeline runs from introduction to signing. `IntroReferral`, `Calendars` and `Discharge` are the source's own types for the steps before the floor (Phase 2). New codes are only ever appended.
 */
export const LAW_ACTION_TYPES = ["Floor", "ResolvingDifferences", "President", "BecameLaw", "Veto", "NotUsed", "Committee", "Introduced", "IntroReferral", "Calendars", "Discharge"] as const;
export type LawActionType = (typeof LAW_ACTION_TYPES)[number];

/** A roll call attached to an action: `[chamber (0 House, 1 Senate), roll number, session or null]`. */
export const lawActionVote = z.tuple([z.union([z.literal(0), z.literal(1)]), int, int.nullable()]);
export type LawActionVote = z.infer<typeof lawActionVote>;

/** `[date, type code, text, roll calls?]`, oldest first. */
export const lawAction = z.union([
  z.tuple([isoDate, int.min(0).max(LAW_ACTION_TYPES.length - 1), z.string().min(1)]),
  z.tuple([isoDate, int.min(0).max(LAW_ACTION_TYPES.length - 1), z.string().min(1), z.array(lawActionVote).min(1)]),
]);
export type LawAction = z.infer<typeof lawAction>;

const chamberCode = z.union([z.literal(0), z.literal(1)]);

/** An amendment to the bill: `[chamber (0 House, 1 Senate), type, number, sponsor bioguide id, sponsor name, submitted, purpose, last step's date, last step's text]`. */
export const lawAmendment = z.tuple([chamberCode, z.string().min(1), z.string().regex(/^\d+$/), z.string().nullable(), z.string().nullable(), isoDate.nullable(), z.string().nullable(), isoDate.nullable(), z.string().nullable()]);
export type LawAmendment = z.infer<typeof lawAmendment>;

/** A bill the source relates to this one: `[Congress, type (HR, S, HRES, ...), number, title, relationship names]`. */
export const lawRelatedBill = z.tuple([int.min(1), z.string().min(1), z.string().regex(/^\d+$/), z.string(), z.array(z.string())]);
export type LawRelatedBill = z.infer<typeof lawRelatedBill>;

/** A cosponsor: `[bioguide id, date joined, original cosponsor (1) or not (0), date withdrawn]`, in the source's order. */
export const lawCosponsor = z.tuple([z.string().regex(/^[A-Z]\d{6}$/), isoDate.nullable(), z.union([z.literal(0), z.literal(1)]), isoDate.nullable()]);
export type LawCosponsor = z.infer<typeof lawCosponsor>;

export const lawDetail = z.object({
  /** The CRS summary as plain paragraphs (HTML stripped); null when the law has none. */
  summary: z.array(z.string().min(1)).nullable(),
  /** True when the raw summary hit the fetchers' length cap, so the paragraphs stop short of the full text. */
  cut: z.literal(true).optional(),
  actions: z.array(lawAction),
  /** The fields below come from the Phase 2 fetch (`pipeline/raw/law-extras/`) and are all present or all absent for a law: absent = not captured, `[]` = none. */
  amendments: z.array(lawAmendment).optional(),
  related: z.array(lawRelatedBill).optional(),
  cosponsors: z.array(lawCosponsor).optional(),
});
export type LawDetail = z.infer<typeof lawDetail>;

export const lawDetailsShard = z.object({
  congress: int.min(LAWS_FIRST_CONGRESS),
  laws: z.record(z.string().regex(/^\d+-pub-\d+$/), lawDetail),
});
export type LawDetailsShard = z.infer<typeof lawDetailsShard>;

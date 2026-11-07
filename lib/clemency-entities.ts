import { z } from "zod";

/** Clemency, Clinton onward (`pipeline/transform/clemency-run.ts`; rules in docs/CLEMENCY_METHODOLOGY.md). */
export const CLEMENCY_TERMS = [
  { id: "clinton", termId: "1993-01-20", president: "Bill Clinton", label: "Clinton", party: "D", start: "1993-01-20", end: "2001-01-20" },
  { id: "bush43", termId: "2001-01-20", president: "George W. Bush", label: "Bush 43", party: "R", start: "2001-01-20", end: "2009-01-20" },
  { id: "obama", termId: "2009-01-20", president: "Barack Obama", label: "Obama", party: "D", start: "2009-01-20", end: "2017-01-20" },
  { id: "trump1", termId: "2017-01-20", president: "Donald Trump", label: "Trump (1st)", party: "R", start: "2017-01-20", end: "2021-01-20" },
  { id: "biden", termId: "2021-01-20", president: "Joe Biden", label: "Biden", party: "D", start: "2021-01-20", end: "2025-01-20" },
  { id: "trump2", termId: "2025-01-20", president: "Donald Trump", label: "Trump (2nd)", party: "R", start: "2025-01-20", end: null },
] as const;
export const clemencyTermId = z.enum(["clinton", "bush43", "obama", "trump1", "biden", "trump2"]);
export type ClemencyTermId = z.infer<typeof clemencyTermId>;

export const OFFENSE_CATEGORIES = ["drugs", "fraud", "corruption", "violent", "firearms", "property", "immigration", "regulatory", "other"] as const;
export const offenseCategory = z.enum(OFFENSE_CATEGORIES);
export type OffenseCategory = z.infer<typeof offenseCategory>;
export const OFFENSE_LABELS: Record<OffenseCategory, string> = {
  drugs: "Drugs",
  fraud: "Fraud & financial",
  corruption: "Public corruption",
  violent: "Violent crime",
  firearms: "Firearms",
  property: "Theft & property",
  immigration: "Immigration",
  regulatory: "Regulatory & environmental",
  other: "Other",
};

export const clemencyGrant = z.object({
  id: z.string(),
  name: z.string().min(2),
  /** p pardon, c commutation; g a person named on a Biden group warrant or a proclamation row. */
  type: z.enum(["p", "c", "g"]),
  term: clemencyTermId,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fy: z.number().int(),
  district: z.string(),
  sentence: z.string(),
  offense: z.string(),
  sentenceYear: z.number().int().nullable(),
  category: offenseCategory.nullable(),
  /** A re-issued warrant: listed, never counted again. */
  amended: z.boolean().optional(),
  /** Listed from a group warrant's table: already inside that warrant's `people`, never counted again. */
  inGroup: z.boolean().optional(),
  /** The row stands for many people (a proclamation or a whole warrant). */
  people: z.number().int().nullable().optional(),
  warrant: z.string().optional(),
});
export type ClemencyGrant = z.infer<typeof clemencyGrant>;

export const clemencyYear = z.object({
  fy: z.number().int(),
  term: clemencyTermId,
  pardons: z.number().int(),
  commutations: z.number().int(),
  group: z.number().int(),
  respites: z.number().int(),
  received: z.number().int().nullable(),
  denied: z.number().int().nullable(),
  closed: z.number().int().nullable(),
  pendingStart: z.number().int().nullable(),
  source: z.enum(["doj-statistics", "doj-list"]),
});
export type ClemencyYear = z.infer<typeof clemencyYear>;

export const clemencyProclamation = z.object({
  number: z.number().int(),
  term: clemencyTermId,
  date: z.string(),
  title: z.string(),
  people: z.number().int().nullable(),
  /** Whether `people` is an official count ("named") or a reported figure. */
  countBasis: z.enum(["named", "reported", "none"]),
  body: z.string(),
  url: z.string().url(),
});
export type ClemencyProclamation = z.infer<typeof clemencyProclamation>;

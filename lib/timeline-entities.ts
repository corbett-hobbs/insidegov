import { z } from "zod";

/**
 * The hand-curated half of /timeline ("Who Held Power When It Happened?"): `pipeline/reference/timeline-events.json`.
 * Everything else on the page (presidents, Congress majorities and seats, the Court, case and law votes) is read from
 * the pipeline and joined at build time by `lib/timeline-build.ts`; this file only says which events, in what words,
 * and how they link. Methodology: `docs/TIMELINE_METHODOLOGY.md`.
 */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "ISO date");
const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "kebab-case id");

const common = {
  id: slug,
  name: z.string().min(1),
  /** One line on what it did, verb first: "Created the TVA to build dams…". */
  what: z.string().min(1),
  /** English Wikipedia article title (checked to exist through the MediaWiki API). */
  wiki: z.string().min(1),
};

export const timelineLawEvent = z.strictObject({
  ...common,
  kind: z.literal("law"),
  /** `laws.json` id (93rd Congress on): date, veto override and the party split come from the pipeline. */
  law_id: z.string().regex(/^\d+-pub-\d+$/).optional(),
  /** Signing date: required without a `law_id`; with one it is a check that must equal laws.json's. */
  date: isoDate.optional(),
});

export const timelineCaseEvent = z.strictObject({
  ...common,
  kind: z.literal("case"),
  /** SCDB `case_id` (1946 term on): the vote and each justice's vote come from the pipeline. */
  case_id: z.string().regex(/^\d{4}-\d{3}$/).optional(),
  /** Decision date: required without a `case_id`; with one it overrides SCDB's date (Bakke). */
  date: isoDate.optional(),
  /** Hand-entered vote for a case before 1946: "6–3" and the dissenters' last names as they appear on the bench that day. */
  hand_vote: z.strictObject({ vote: z.string().regex(/^\d–\d$/), dissenters: z.array(z.string().min(1)) }).optional(),
});

export const timelineEvent = z.discriminatedUnion("kind", [timelineLawEvent, timelineCaseEvent]);
export type TimelineEventRef = z.infer<typeof timelineEvent>;

/** A justice who sat in the page's years but is not in `court/justices.json` (which starts with the Martin-Quinn data, October 1937). */
export const extraJustice = z.strictObject({
  last: z.string().min(1),
  full: z.string().min(1),
  appointing_president: z.string().min(1),
  appointing_party: z.enum(["Democratic", "Republican"]),
  service_start: isoDate,
  service_end: isoDate,
  why: z.string().min(1),
});

export const timelineEventsFile = z
  .strictObject({
    _note: z.string(),
    last_reviewed: isoDate,
    extra_justices: z.array(extraJustice),
    events: z.array(timelineEvent).min(1),
    /** A law on the list that a case on the list ruled on, and what the Court did to it. */
    tested: z.array(z.strictObject({ law: slug, case: slug, outcome: z.string().min(1) })),
    /** A later case on the list that overruled, narrowed or built on an earlier one, and what it did. */
    case_links: z.array(z.strictObject({ later: slug, earlier: slug, did: z.string().min(1) })),
  })
  .superRefine((f, ctx) => {
    const kinds = new Map<string, string>();
    for (const e of f.events) {
      if (kinds.has(e.id)) ctx.addIssue({ code: "custom", message: `duplicate event id ${e.id}` });
      kinds.set(e.id, e.kind);
      if (e.kind === "law" && !e.law_id && !e.date) ctx.addIssue({ code: "custom", message: `${e.id}: a law needs a law_id or a date` });
      if (e.kind === "case" && !e.case_id && !(e.date && e.hand_vote)) ctx.addIssue({ code: "custom", message: `${e.id}: a case needs a case_id, or a date and a hand_vote` });
    }
    const want = (id: string, kind: string, where: string) => {
      if (kinds.get(id) !== kind) ctx.addIssue({ code: "custom", message: `${where}: ${id} is not a ${kind} on the list` });
    };
    for (const t of f.tested) {
      want(t.law, "law", "tested");
      want(t.case, "case", "tested");
    }
    for (const l of f.case_links) {
      want(l.later, "case", "case_links");
      want(l.earlier, "case", "case_links");
    }
  });
export type TimelineEventsFile = z.infer<typeof timelineEventsFile>;

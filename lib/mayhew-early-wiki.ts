import { z } from "zod";

/**
 * `pipeline/reference/mayhew-early-wiki.json`: the English Wikipedia article for each of Mayhew's 1947-72 signed laws
 * (`mayhew-1947-1972.json`, kind law) that has one, so the Laws signed card on president pages links it. A law that is also a
 * Timeline landmark takes its link from `timeline-events.json` instead and is in neither list. Every other signed law is either
 * `linked` (the article's title as Wikipedia resolves it, redirects followed) or `unlinked` with the reason, so a new entry
 * cannot go unreviewed (`pnpm validate` checks coverage, and that each title still exists on Wikipedia).
 */
export const mayhewEarlyWikiFile = z
  .strictObject({
    _note: z.string(),
    last_reviewed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    /** Mayhew entry id -> article. `note` records a judgment call (Mayhew's title is the agency or programme, a renamed act, ...). */
    linked: z.record(z.string().regex(/^\d+-\d{2}$/), z.strictObject({ wiki: z.string().min(1), note: z.string().min(1).optional() })),
    /** Mayhew entry id -> why no article fits (generic entry, only a section, no article). */
    unlinked: z.record(z.string().regex(/^\d+-\d{2}$/), z.string().min(1)),
  })
  .superRefine((f, ctx) => {
    for (const id of Object.keys(f.linked)) if (id in f.unlinked) ctx.addIssue({ code: "custom", message: `${id} is both linked and unlinked` });
    for (const [id, e] of Object.entries(f.linked)) if (e.wiki.includes("#") || e.wiki.includes("_")) ctx.addIssue({ code: "custom", message: `${id}: wiki must be a plain article title` });
  });
export type MayhewEarlyWikiFile = z.infer<typeof mayhewEarlyWikiFile>;

/** The article title for a Mayhew entry, or undefined where none is linked. */
export function mayhewWikiFor(file: MayhewEarlyWikiFile, entryId: string): string | undefined {
  return file.linked[entryId]?.wiki;
}

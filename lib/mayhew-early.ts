import { z } from "zod";

/**
 * `pipeline/reference/mayhew-1947-1972.json`: Mayhew's lists of important enactments for the 80th-92nd Congress, before the
 * site's public-law data begins (1973). Entries are not matched to law pages, so they carry a title, a year and his one-line
 * description, with no passage votes.
 */
export const mayhewEarlyEntry = z.object({
  entry_id: z.string().regex(/^\d+-\d{2}$/),
  congress: z.number().int().min(80).max(92),
  marks: z.string(),
  capitals: z.boolean(),
  title: z.string().min(2),
  summary: z.string(),
  year: z.number().int().nullable(),
  president: z.string(),
  /** law = signed (counted); overridden = enacted over a veto; treaty / amendment = not a law the president signed. */
  kind: z.enum(["law", "overridden", "treaty", "amendment"]),
});
export type MayhewEarlyEntry = z.infer<typeof mayhewEarlyEntry>;
export const mayhewEarlyFile = z.object({ _comment: z.string(), entries: z.array(mayhewEarlyEntry).min(1) });

/** The entries a president signed, newest first (entry order within a year is Mayhew's, so the later entry sorts first). */
export function earlyMajorFor(entries: readonly MayhewEarlyEntry[], name: string): MayhewEarlyEntry[] {
  return entries
    .filter((e) => e.kind === "law" && e.president === name)
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || (a.entry_id < b.entry_id ? 1 : -1));
}

const SMALL = new Set(["of", "for", "the", "and", "to", "in", "on"]);
const ACRONYMS = new Set(["ESEA"]);

/** Mayhew prints his most important entries in capitals; show them in title case (the capitals mark is kept as `capitals`). */
export function displayTitle(title: string): string {
  if (title !== title.toUpperCase()) return title;
  return title
    .split(" ")
    .map((w, i) => {
      const bare = w.replace(/[^A-Za-z]/g, "");
      if (ACRONYMS.has(bare)) return w;
      const lower = w.toLowerCase();
      return i > 0 && SMALL.has(lower) ? lower : lower.replace(/[a-z]/, (c) => c.toUpperCase());
    })
    .join(" ");
}

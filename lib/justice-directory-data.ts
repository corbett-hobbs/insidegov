import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Justice, JusticeBio } from "./court-entities";
import { justiceVotesFile } from "./decisions-entities";
import { getCourtPayload } from "./justice-data";
import { buildDirectory, type DirectoryRow } from "./justice-directory";

/**
 * Build-time reader for the Justices directory: the justice list, the Court payload's scores, `justice_votes.json` and the
 * committed portraits, joined by `buildDirectory` (pure, `lib/justice-directory.ts`). Tenures that are still running end at the
 * build date, so the years served of a sitting justice are as of the last deploy.
 */
const read = (name: string): unknown => JSON.parse(readFileSync(join(process.cwd(), "pipeline", "output", "court", name), "utf8"));

let cached: { rows: DirectoryRow[]; asOf: string } | null = null;

export function getJusticeDirectory(): { rows: DirectoryRow[]; asOf: string } {
  if (!cached) {
    const asOf = new Date();
    const photos = new Map<number, string>();
    try {
      for (const b of read("justice_bios.json") as JusticeBio[]) if (b.photo) photos.set(b.justice_id, b.photo.path);
    } catch {
      // before `pnpm fetch:justice-bios` has run there are no portraits; the page draws initials
    }
    const rows = buildDirectory({
      justices: read("justices.json") as Justice[],
      court: getCourtPayload().justices,
      votes: justiceVotesFile.parse(read("justice_votes.json")),
      photos,
      asOf,
    });
    cached = { rows, asOf: asOf.toISOString().slice(0, 10) };
  }
  return cached;
}

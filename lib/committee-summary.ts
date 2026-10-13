import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CommitteeAbout } from "./wikipedia-types";

let cache: Map<string, CommitteeAbout> | null = null; // read once per server start

/**
 * A committee's About text, from the build-time file
 * `pipeline/fetch/wikipedia-committees.ts` writes: the Wikipedia lead's sentences,
 * or (`url: null`) a line written for this site where the article doesn't say what
 * the committee does. `null` for a committee with no record and when the file is absent: the header then omits the About block, no placeholder.
 */
export function getCommitteeWikipediaSummary(committeeId: string): CommitteeAbout | null {
  if (!cache) {
    cache = new Map();
    try {
      const path = join(process.cwd(), "pipeline", "output", "committee_summaries.json");
      const rows = JSON.parse(readFileSync(path, "utf8")) as (CommitteeAbout & { committee_id: string })[];
      for (const r of rows) cache.set(r.committee_id, { extract: r.extract, url: r.url });
    } catch {
      // graceful before the step has been run
    }
  }
  return cache.get(committeeId) ?? null;
}

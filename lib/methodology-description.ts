import { METHODOLOGY } from "./methodology-content";
import { topicEntryIds } from "./structured-data";

/** A topic page's Dataset description: the Methodology entries' own descriptions, so the two cannot disagree. */
export function methodDescription(path: string): string {
  const ids = topicEntryIds(path);
  return METHODOLOGY.flatMap((g) => g.entries)
    .filter((e) => ids.includes(e.id))
    .map((e) => e.description)
    .join(" ");
}

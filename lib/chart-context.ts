import type { SourceId } from "./source-links";

/**
 * A card's context line (ARCHITECTURE_MAP rule 7d): one or two sentences saying what a cited source says happened behind the
 * chart's highlight, with the sources named. Drawn by `charts/ContextLine` (`useTakeawayContext`) behind a closed "Context" toggle.
 */
export interface ContextEntry {
  text: string;
  sources: readonly { id: SourceId; label: string }[];
}

import { GEO_STACK, type GeoGroup } from "@/lib/refugee-types";

/**
 * Shared look for the refugee cards. Regions reuse five existing `--sector-*` tokens (validated pairwise in `validate_palette.js`,
 * the way the oil card reuses them), so the ceiling chart, the map and the "Who's sent the most" bars read as one system.
 */
export const REGION_COLOR: Record<GeoGroup, string> = {
  africa: "var(--sector-health)",
  east_asia: "var(--sector-hum)",
  europe: "var(--sector-econ)",
  latin_america_caribbean: "var(--sector-ps)",
  near_east_south_asia: "var(--sector-prog)",
};
export { GEO_STACK };

/** The pale bar the ceiling is drawn as behind the arrivals. */
export const CEILING_TINT = "color-mix(in oklab, var(--ink) 9%, var(--surface))";
/** Land with no refugees on the map: distinct from the card, so every outline shows. */
export const LAND = "color-mix(in oklab, var(--ink) 7%, var(--surface))";

export const n = (v: number) => v.toLocaleString("en-US");

/** "30,000" or "30,000–50,000". */
export const capText = (cap: readonly [number, number]) => (cap[0] === cap[1] ? n(cap[1]) : `${n(cap[0])}–${n(cap[1])}`);

/** "Jan 27, 2017". */
export const dateLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

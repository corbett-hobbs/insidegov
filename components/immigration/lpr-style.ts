import type { LprGroupKey } from "@/lib/lpr-chart";
import type { LprRegionKey } from "@/lib/lpr-types";

/** The six class groups reuse the validated `--sector-*` tokens, so the stack reads as one system with the other immigration cards. */
export const GROUP_COLOR: Record<LprGroupKey, string> = {
  immediate_relatives: "var(--sector-econ)",
  family_preference: "var(--sector-ps)",
  employment_preference: "var(--sector-health)",
  diversity: "var(--sector-hum)",
  humanitarian: "var(--sector-prog)",
  other: "var(--sector-other)",
};
/** Naturalizations are one series, in the accent colour (the site's single-measure colour). */
export const NAT_COLOR = "var(--accent)";

/** OHSS's continents reuse the same validated sector tokens; "Unknown" is a pale neutral so it never reads as a continent. */
export const REGION_COLOR: Record<LprRegionKey, string> = {
  north_america: "var(--sector-ps)",
  asia: "var(--sector-hum)",
  europe: "var(--sector-econ)",
  south_america: "var(--sector-prog)",
  africa: "var(--sector-health)",
  oceania: "var(--sector-other)",
  unknown: "color-mix(in oklab, var(--ink) 22%, var(--surface))",
};

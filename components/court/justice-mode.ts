import type { JusticeProfile } from "@/lib/justice-types";

/** The toggle on a justice page: which set of justices is highlighted, on both the chart and the swarm/roster. */
export type JusticeMode = "alongside" | "neighbors" | "appointer";

/**
 * The toggle's options. "Same president" is the justices the same president appointed; it is greyed when the subject was that
 * president's only appointee. The phone labels are shorter so all three fit one line.
 */
export function modeOptions(profile: JusticeProfile): readonly { value: JusticeMode; label: string; short?: string; disabled?: boolean; title?: string }[] {
  const none = profile.roster.appointer.length === 0;
  return [
    { value: "alongside", label: "Served alongside", short: "Served with" },
    { value: "neighbors", label: "Nearest neighbors", short: "Neighbors" },
    {
      value: "appointer",
      label: "Same president",
      disabled: none,
      title: none ? `${profile.identity.appointedBy.president} appointed no other justice in the data` : `Justices ${profile.identity.appointedBy.president} also appointed`,
    },
  ];
}

export const partyVar = (p: "D" | "R") => (p === "D" ? "var(--dem)" : "var(--rep)");

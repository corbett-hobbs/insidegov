import type { CourtSide, PowerStatus } from "@/lib/timeline-derive";
import type { Side, TlEvent } from "@/lib/timeline-types";

/** Party colour token: Democratic, Republican, else the neutral "other" grey (the Court's centre, an even split). */
export const partyColor = (p: CourtSide | "O") => (p === "D" ? "var(--dem)" : p === "R" ? "var(--rep)" : "var(--oth)");

/** A light tint of the party colour, the same mix as every presidential-term band (rule 10b). */
export const partyTint = (p: Side, pct = 20) => `color-mix(in oklab, ${partyColor(p)} ${pct}%, var(--surface))`;

/** The top edge of each status tile and badge. */
export const STATUS_COLOR: Record<PowerStatus, string> = { all4: "var(--status-all4)", tri: "var(--ink-muted)", split: "var(--line-strong)" };

export const PARTY_ADJ = { D: "Democratic", R: "Republican" } as const;
export const PARTY_PLURAL = { D: "Democrats", R: "Republicans" } as const;

export const KIND_LABEL: Record<TlEvent["kind"], string> = { law: "Laws", case: "Court cases" };

export const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/** The small numbered badge: a rounded square for a law, a circle for a case (the same shapes as the chart's markers). */
export const numberBadge = (kind: TlEvent["kind"]) =>
  `mr-1.5 inline-grid h-[18px] min-w-[18px] flex-none place-items-center bg-ink px-1 align-[1px] font-mono text-[0.66rem] font-semibold text-surface ${kind === "law" ? "rounded" : "rounded-full"}`;

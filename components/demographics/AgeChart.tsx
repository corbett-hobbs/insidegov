"use client";

import { fmtAge, type AgeMeasure } from "@/lib/demographics-chart";
import type { DemoCongress, DemoPresident } from "@/lib/demographics-types";
import { CaucusLines, type CaucusLine } from "./CaucusLines";

const LINES: CaucusLine[] = [
  { k: "D", label: "Democrats", color: "var(--dem)" },
  { k: "R", label: "Republicans", color: "var(--rep)" },
];

/** Age by caucus, one point per Congress. */
export function AgeChart({ rows, presidents, measure, pin, onPin }: { rows: readonly DemoCongress[]; presidents: readonly DemoPresident[]; measure: AgeMeasure; pin: number | null; onPin: (c: number | null) => void }) {
  return (
    <CaucusLines
      rows={rows}
      presidents={presidents}
      pin={pin}
      onPin={onPin}
      lines={LINES}
      value={(r, k) => r.age[k as "D" | "R"][measure]}
      fmt={fmtAge}
      fmtAxis={(v) => String(v)}
      domain={(lo, hi) => [Math.floor(lo) - 1, Math.ceil(hi) + 1]}
      detail={(r, k) => `· ${r.age[k as "D" | "R"].n} members`}
      ariaLabel={`Line chart of ${measure} age by caucus, one point per Congress`}
    />
  );
}

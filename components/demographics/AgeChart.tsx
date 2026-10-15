"use client";

import { fmtAge } from "@/lib/demographics-chart";
import type { CaucusGroup, DemoCongress, DemoPresident } from "@/lib/demographics-types";
import { CaucusLines, type CaucusLine } from "./CaucusLines";

const LINES: CaucusLine[] = [
  { k: "D", label: "Democrats", color: "var(--dem)" },
  { k: "R", label: "Republicans", color: "var(--rep)" },
];
// "Other" has a line only while it is the party picked (it is a handful of members, and absent from most Congresses).
const LINES_WITH_OTHER: CaucusLine[] = [...LINES, { k: "O", label: "Other parties", color: "var(--oth)" }];

/** Age by caucus, one point per Congress. */
export function AgeChart({ rows, presidents, pin, onPin, only, onOnly }: { rows: readonly DemoCongress[]; presidents: readonly DemoPresident[]; pin: number | null; onPin: (c: number | null) => void; only: string | null; onOnly: (k: string | null) => void }) {
  return (
    <CaucusLines
      rows={rows}
      presidents={presidents}
      pin={pin}
      onPin={onPin}
      lines={only === "O" ? LINES_WITH_OTHER : LINES}
      value={(r, k) => r.age[k as CaucusGroup].median}
      fmt={fmtAge}
      fmtAxis={(v) => String(v)}
      domain={(lo, hi) => [Math.floor(lo) - 1, Math.ceil(hi) + 1]}
      detail={(r, k) => `· avg ${fmtAge(r.age[k as CaucusGroup].average)}`}
      only={only}
      onOnly={onOnly}
      ariaLabel={`Line chart of median age by caucus, one point per Congress`}
    />
  );
}

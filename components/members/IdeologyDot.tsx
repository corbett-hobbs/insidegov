import type { PartyGroup } from "@/lib/congress-types";

const W = 64;
const H = 12;
const PAD = 4;

const FILL: Record<PartyGroup, string> = { dem: "var(--dem)", rep: "var(--rep)", other: "var(--oth)" };

/** "−0.38" with a true minus sign. */
export function formatScore(v: number): string {
  return `${v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}`;
}

/**
 * A member's left-right score as one dot on a tiny version of the compass's
 * horizontal axis (−1 liberal to +1 conservative, a tick at 0), in the
 * member's party colour. An unscored member gets the bare track.
 */
export function IdeologyDot({ score, group }: { score: number | null; group: PartyGroup }) {
  const x = (v: number) => PAD + ((v + 1) / 2) * (W - 2 * PAD);
  const label =
    score === null
      ? "No ideology score yet"
      : `Ideology ${formatScore(score)}, ${Math.abs(score) < 0.05 ? "at the center" : score < 0 ? "left of center" : "right of center"}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={label} className="block h-auto w-[52px] flex-none overflow-visible sm:w-16">
      <title>{label}</title>
      <line x1={PAD} x2={W - PAD} y1={H / 2} y2={H / 2} stroke="var(--line-strong)" strokeWidth={1} />
      <line x1={x(0)} x2={x(0)} y1={2} y2={H - 2} stroke="var(--line-strong)" strokeWidth={1} />
      {score !== null && <circle cx={x(Math.max(-1, Math.min(1, score)))} cy={H / 2} r={3.5} fill={FILL[group]} stroke="var(--surface)" strokeWidth={1} />}
    </svg>
  );
}

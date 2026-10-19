import { leanSteps, votingLean, type DirectoryRow } from "@/lib/justice-directory";

type LeanRow = Pick<DirectoryRow, "firstScore" | "latestScore" | "scoredTerms" | "sitting">;

const X = (i: number) => 8.5 + i * 17;

/**
 * The voting lean as a picture: five notches, liberal to conservative. Hollow dot = where the justice started, filled dot = now, an
 * arrow between them when they moved; a tinted notch for "throughout"; a dashed ring for "so far". Decorative: the words beside it
 * (`votingLean`) carry the meaning, and the label here repeats them for screen readers only.
 */
export function LeanGlyph({ row, className = "" }: { row: LeanRow; className?: string }) {
  const { kind, from, to } = leanSteps(row);
  const ink = "var(--ink)";
  const d = to > from ? 1 : -1;
  return (
    <svg viewBox="0 0 84 14" role="img" aria-label={votingLean(row)} className={`block h-3.5 w-full overflow-visible ${className}`}>
      <rect x="0" y="5" width="84" height="4" rx="2" className="fill-line" />
      {[1, 2, 3, 4].map((i) => (
        <line key={i} x1={i * 17} y1="3" x2={i * 17} y2="11" stroke="var(--surface)" strokeWidth="1" />
      ))}
      {kind === "still" && <rect x={to * 17 + 1} y="3" width="15" height="8" rx="4" fill={ink} opacity=".18" />}
      {kind === "moved" && (
        <>
          <line x1={X(from) + d * 5} y1="7" x2={X(to) - d * 5} y2="7" stroke={ink} strokeWidth="1.5" />
          <path d={`M${X(to) - d * 9} 3.5L${X(to) - d * 5} 7L${X(to) - d * 9} 10.5`} fill="none" stroke={ink} strokeWidth="1.5" />
          <circle cx={X(from)} cy="7" r="3.5" fill="var(--surface)" stroke={ink} strokeWidth="1.5" />
        </>
      )}
      {kind === "sofar" && <circle cx={X(to)} cy="7" r="6" fill="none" stroke={ink} strokeWidth="1" strokeDasharray="2 2" />}
      <circle cx={X(to)} cy="7" r="3.5" fill={ink} />
    </svg>
  );
}

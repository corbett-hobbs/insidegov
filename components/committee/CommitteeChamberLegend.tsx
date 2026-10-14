import { LEGEND_ITEM, LEGEND_ROW } from "@/components/charts/legend";
import { CHAMBER_COLOR_META, chamberCssVar } from "@/lib/committee-palette";
import type { CommitteeChamber } from "@/lib/committee-types";

const ORDER: readonly CommitteeChamber[] = ["house", "senate", "joint"];

/**
 * Chamber-colour legend for the committee compass — required only in the
 * "Both" view, where House, Senate, and (if present) joint dots all coexist
 * on one chart. Senate-only / House-only filtered views need no legend
 * (every visible dot is already known to be that chamber), but the mapping
 * itself never changes — see lib/committee-palette.ts.
 */
export function CommitteeChamberLegend({
  chambers,
}: {
  /** Chambers actually present in the plotted set, so a chamber with zero
   *  committees (e.g. no joint committees this Congress) isn't shown. */
  chambers: readonly CommitteeChamber[];
}) {
  const present = ORDER.filter((c) => chambers.includes(c));
  if (present.length === 0) return null;

  return (
    <div className={`${LEGEND_ROW} border-t border-line pt-3`}>
      {present.map((chamber) => (
        <span
          key={chamber}
          className={LEGEND_ITEM}
        >
          <span
            className="size-2.5 flex-none rounded-full"
            style={{ background: chamberCssVar(chamber) }}
          />
          {CHAMBER_COLOR_META[chamber].label}
        </span>
      ))}
    </div>
  );
}

import { LEGEND_ITEM, LEGEND_ROW } from "@/components/charts/legend";
import type { ChamberMember } from "@/lib/congress-types";
import { PARTY_META, partyCssVar, presentParties } from "@/lib/party-palette";

/**
 * Party key + count for every party actually present in the shown members —
 * so the legend tracks the Congress as the slider moves, not a fixed list.
 * Ordered economically left-to-right (see PARTY_COLOR_ORDER), so the party on
 * the left of the compass is named first; "Other" last.
 */
export function Legend({ members }: { members: ChamberMember[] }) {
  const present = presentParties(members);

  return (
    <div className={`${LEGEND_ROW} border-t border-line pt-3`}>
      {present.map(({ key, count }) => (
        <span
          key={key}
          className={LEGEND_ITEM}
        >
          <span
            className="size-2.5 flex-none rounded-full"
            style={{ background: partyCssVar(key) }}
          />
          {PARTY_META[key].label} —{" "}
          <span className="font-mono font-medium text-ink">{count}</span>
        </span>
      ))}
    </div>
  );
}

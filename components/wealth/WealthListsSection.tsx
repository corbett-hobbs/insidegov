import type { WealthParty } from "@/lib/wealth-copy";
import type { WealthMember } from "@/lib/wealth-derive";
import type { ChamberView } from "@/lib/chamber";
import { WealthList } from "./WealthList";
import { WEALTH_TAKEAWAYS } from "./takeaways";

/**
 * The two side-by-side highest/lowest lists, each with its own takeaway and
 * Data notes. `members` is the already chamber+state+party-filtered pool
 * (unlike the scatter, which never filters, only dims — a ranked "top N" list
 * showing another state's or party's members wouldn't make sense).
 */
export function WealthListsSection({
  members,
  view,
  stateFilter,
  party,
}: {
  members: readonly WealthMember[];
  view: ChamberView;
  stateFilter: string | null;
  party: WealthParty | null;
}) {
  return (
    <div className="grid gap-5 md:grid-cols-2 md:grid-rows-[repeat(4,auto)] md:gap-y-0">
      {(["highest", "lowest"] as const).map((direction) => (
        <WealthList
          key={direction}
          title={WEALTH_TAKEAWAYS[direction].title}
          takeaway={WEALTH_TAKEAWAYS[direction].takeaway}
          direction={direction}
          members={members}
          view={view}
          stateFilter={stateFilter}
          party={party}
        />
      ))}
    </div>
  );
}

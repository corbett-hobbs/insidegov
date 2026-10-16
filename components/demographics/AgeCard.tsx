"use client";

import { ChartCard } from "@/components/charts/ChartCard";
import { MethodologyNote } from "@/components/MethodologyNote";
import { ChartNotesRow } from "@/components/charts/ChartNotesRow";
import type { ChamberView } from "@/lib/chamber";
import { PARTY_NAME, congressSpan, fmtAge, presidentById, readoutRow, type PartyPick } from "@/lib/demographics-chart";
import type { DemoCongress, DemoPresident } from "@/lib/demographics-types";
import { AgeChart } from "./AgeChart";
import { MemberList, type RosterState } from "./MemberList";
import { CongressReadout, TableView } from "./shared";
import { DEMO_TAKEAWAYS } from "./takeaways";

export function AgeCard({ rows, presidents, pin, onPin, view, roster, party, onParty }: { rows: readonly DemoCongress[]; presidents: readonly DemoPresident[]; pin: number | null; onPin: (c: number | null) => void; view: ChamberView; roster: RosterState; party: PartyPick; onParty: (p: PartyPick) => void }) {
  const by = presidentById(presidents);
  const cur = readoutRow(rows, pin);
  const line = cur && {
    values: party ? [`${PARTY_NAME[party]} ${fmtAge(cur.age[party].median)}`] : [`Democrats ${fmtAge(cur.age.D.median)}`, `Republicans ${fmtAge(cur.age.R.median)}`],
    date: congressSpan(cur),
    term: by.get(cur.termId)?.president,
  };
  return (
    <ChartCard
      title={DEMO_TAKEAWAYS.age.title}
      takeaway={DEMO_TAKEAWAYS.age.takeaway[view]}
    >
      <CongressReadout line={line} pinned={pin !== null && !!cur && cur.congress === pin} onClear={() => onPin(null)} />
      <AgeChart rows={rows} presidents={presidents} pin={pin} onPin={onPin} only={party} onOnly={(k) => onParty(k as PartyPick)} />
      <MemberList {...roster} row={cur} rows={rows} view={view} order="age" party={party} onPin={onPin} />
      <ChartNotesRow>
        <MethodologyNote>
          <p>
            Each line is a caucus&rsquo;s median age on the day the Congress convened, exact to the day. The average is within about a year of it in most Congresses (it is in the tooltip and in View as table, with the number of members behind each figure). Members with no recorded birthdate are left out, and independents who caucus with a party are grouped with it.
          </p>
        </MethodologyNote>
        <TableView
          head={["Congress", "Years", "President", "Dem. median", "Dem. average", "Rep. median", "Rep. average", "Members with a birthdate (Dem. / Rep.)"]}
          rows={[...rows].reverse().map((r) => [`${r.congress}th`, `${r.year}–${r.year + 1}`, by.get(r.termId)?.president ?? "", fmtAge(r.age.D.median), fmtAge(r.age.D.average), fmtAge(r.age.R.median), fmtAge(r.age.R.average), `${r.age.D.n} / ${r.age.R.n}`])}
        />
      </ChartNotesRow>
    </ChartCard>
  );
}

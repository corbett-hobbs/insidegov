"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ChartCard } from "../charts/ChartCard";
import { LEGEND_ITEM, LEGEND_ROW } from "../charts/legend";
import { MethodologyNote } from "../MethodologyNote";
import { SourceLink } from "../SourceLink";
import { PowerChart } from "../timeline/PowerChart";
import { FOCUS_RING, PARTY_ADJ, partyColor } from "../timeline/shared";
import { buildSpans, chamberYears, changePoints, fmtDate, lastName, powerIndex } from "@/lib/timeline-derive";
import { presidentPathByName } from "@/lib/president-url";
import type { TimelinePayload, TlPresident } from "@/lib/timeline-types";

/** The directory lists presidents from Truman, so the window opens on his inauguration. */
const START = "1945-04-12";

const yrs = (n: number) => `${Math.round(n * 10) / 10}`;

/**
 * "Who held power" above the Presidents table: the one-party strip and the president, Senate, House and Court rows of
 * /timeline (the same `PowerChart`, in its compact mode), the Court read by appointing president, over Truman to today.
 * No filters, zoom or pan; a tap on a president opens a card that links to their page.
 */
export function PresidentsPowerChart({ data }: { data: TimelinePayload }) {
  const idx = useMemo(() => powerIndex(data), [data]);
  const spans = useMemo(() => buildSpans(idx, changePoints(data), "appt"), [idx, data]);
  const maxYear = Number(data.today.slice(0, 4));
  const whole = useMemo(() => chamberYears(spans, START, data.today), [spans, data.today]);

  const card = (p: TlPresident) => {
    const to = p.end && p.end < data.today ? p.end : data.today;
    const y = chamberYears(spans, p.start, to);
    const path = presidentPathByName(p.name);
    const justices = data.justices.filter((j) => j.start >= p.start && (p.end === null || j.start < p.end) && presidentPathByName(j.by) === path).length;
    return (
      <>
        <p className="m-0 pr-6 font-serif text-[0.95rem] font-medium leading-tight text-ink">{p.name}</p>
        <p className="m-0 mt-0.5 flex items-center gap-1.5 text-ink-muted">
          <span aria-hidden className="inline-block size-2 rounded-full" style={{ background: partyColor(p.party) }} />
          {PARTY_ADJ[p.party]} · {fmtDate(p.start)} – {p.end && p.end < data.today ? fmtDate(p.end) : "today"}
        </p>
        <p className="m-0 mt-1.5 text-ink">
          {lastName(p.name)}&rsquo;s party held both chambers for <b className="font-semibold">{yrs(y.both)}</b> years, one for <b className="font-semibold">{yrs(y.one)}</b>, neither for{" "}
          <b className="font-semibold">{yrs(y.neither)}</b>.
        </p>
        <p className="m-0 mt-1 text-ink">
          Justices appointed: <b className="font-semibold">{justices}</b>
        </p>
        {path && (
          <Link href={path} className={`mt-1.5 inline-block font-medium text-accent underline decoration-line-strong underline-offset-2 hover:decoration-accent ${FOCUS_RING}`}>
            Open president page →
          </Link>
        )}
      </>
    );
  };

  return (
    <ChartCard
      title="Who held power"
      takeaway={
        <>
          Since 1945, one party held the White House and both chambers of Congress for <b className="font-semibold">{Math.round(whole.both)}</b> of {Math.round(whole.total)} years.
        </>
      }
    >
      <PowerChart data={data} idx={idx} spans={spans} mode="appt" range={[1945, maxYear]} minYear={1945} maxYear={maxYear} onRange={() => {}} compact startIso={START} presCard={card} />
      <div className={`${LEGEND_ROW} mt-1.5`}>
        <span className={LEGEND_ITEM}>
          <i aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: partyColor("D") }} />
          Democratic
        </span>
        <span className={LEGEND_ITEM}>
          <i aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: partyColor("R") }} />
          Republican
        </span>
        <span className={LEGEND_ITEM}>
          <i aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: partyColor("T") }} />
          Court split evenly
        </span>
      </div>
      <p className="m-0 mt-2 text-[0.8rem]">
        <Link href="/timeline" className={`font-medium text-accent underline decoration-line-strong underline-offset-2 hover:decoration-accent ${FOCUS_RING}`}>
          See the laws and cases on the full timeline →
        </Link>
      </p>
      <MethodologyNote>
        <p>
          The strip fills while one party held the White House, both chambers and the Court, and is lightly tinted while it held the White House and Congress but not the Court. Seats are each party&rsquo;s count at the start of each Congress, from the{" "}
          <SourceLink id="house-party-division">House historian</SourceLink> and the <SourceLink id="senate-party-division">Senate Historical Office</SourceLink>. The Court row shows the party of the presidents who appointed its sitting majority (a justice counts with the party of the president who first appointed them, from the{" "}
          <SourceLink id="fjc">Federal Judicial Center</SourceLink>), labelled 7&ndash;2, 5&ndash;4 and so on. Who held power describes the setting of a presidency, not its cause. Full method on the{" "}
          <Link href="/timeline" className="underline underline-offset-2 hover:text-ink">timeline</Link>.
        </p>
      </MethodologyNote>
    </ChartCard>
  );
}

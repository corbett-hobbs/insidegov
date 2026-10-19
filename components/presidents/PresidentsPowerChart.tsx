"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ChartCard } from "../charts/ChartCard";
import { LEGEND_ITEM, LEGEND_ROW } from "../charts/legend";
import { MethodologyNote } from "../MethodologyNote";
import { SourceLink } from "../SourceLink";
import { PowerChart } from "../timeline/PowerChart";
import { FOCUS_RING, PARTY_ADJ, partyColor, partyTint } from "../timeline/shared";
import { buildSpans, chamberYears, changePoints, fmtDate, powerIndex } from "@/lib/timeline-derive";
import { presidentPathByName } from "@/lib/president-url";
import type { TimelinePayload, TlPresident } from "@/lib/timeline-types";

/** The directory lists presidents from Truman, so the window opens on his inauguration. */
const START = "1945-04-12";

const yrs = (n: number) => `${Math.round(n * 10) / 10}`;

/**
 * "Was Congress on their side?" above the Presidents table, collapsed by default: the one-party strip and the president,
 * Senate and House rows of /timeline (the same `PowerChart`, in its compact mode), over Truman to today. The Court is left
 * out because the table below has no Court measure. No filters, zoom or pan; a tap on a president opens a card that links to their page.
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
    return (
      <>
        <p className="m-0 pr-6 font-serif text-[0.95rem] font-medium leading-tight text-ink">{p.name}</p>
        <p className="m-0 mt-0.5 flex items-center gap-1.5 text-ink-muted">
          <span aria-hidden className="inline-block size-2 rounded-full" style={{ background: partyColor(p.party) }} />
          {PARTY_ADJ[p.party]} · {fmtDate(p.start)} – {p.end && p.end < data.today ? fmtDate(p.end) : "today"}
        </p>
        <p className="m-0 mt-1.5 text-ink-muted">Congress on their side</p>
        <ul className="m-0 list-none p-0 text-ink">
          {([["Both chambers", y.both], ["One chamber", y.one], ["Neither chamber", y.neither]] as const).map(([label, n]) => (
            <li key={label}>
              {label}, <b className="font-semibold">{yrs(n)}</b> of {yrs(y.total)} years
            </li>
          ))}
        </ul>
        {path && (
          <Link href={path} className={`mt-1.5 inline-block font-medium text-accent underline decoration-line-strong underline-offset-2 hover:decoration-accent ${FOCUS_RING}`}>
            Open president page →
          </Link>
        )}
      </>
    );
  };

  return (
    <details className="group text-[0.92rem]">
      <summary className="cursor-pointer font-medium text-ink">Was Congress on their side?</summary>
      <ChartCard
      className="mt-2"
      title="Congress and the White House, 1945 to today"
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
          <i aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: partyTint("D", 40) }} />
          One chamber
        </span>
      </div>
      <MethodologyNote>
        <p>
          The strip fills while one party held the White House and both chambers of Congress, is lightly tinted while it held one chamber, and is empty when it held neither, the same measure as the &ldquo;Congress on their side&rdquo; column below. Seats are each party&rsquo;s count at the start of each Congress, from the{" "}
          <SourceLink id="house-party-division">House historian</SourceLink> and the <SourceLink id="senate-party-division">Senate Historical Office</SourceLink>; senators who caucused with a party count with it. Who held Congress describes the setting of a presidency, not its cause.
        </p>
      </MethodologyNote>
    </ChartCard>
    </details>
  );
}

"use client";

import { MemberPhoto } from "@/components/MemberPhoto";
import { chamberLabel } from "@/lib/chamber";
import { memberPath } from "@/lib/member-url";
import { isListEligible, type WealthMember, type WealthYearPoint } from "@/lib/wealth-derive";
import { wealthPartyNoun, type WealthParty } from "@/lib/wealth-copy";
import { formatCompactUSD, formatOpenEndedUSD } from "@/lib/format-money";
import { stateName } from "@/lib/states";
import { Sparkline } from "./Sparkline";
import type { ChamberView } from "@/lib/chamber";
import { ChartNotesRow } from "@/components/charts/ChartNotesRow";
import { MethodologyNote } from "@/components/MethodologyNote";
import { SourceLink } from "@/components/SourceLink";

function lastNameOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1];
}

interface WealthListProps {
  title: string;
  /** One or two sentences on what the list shows (rule 7c), from `WEALTH_TAKEAWAYS`. */
  takeaway: string;
  direction: "highest" | "lowest";
  members: readonly WealthMember[];
  view: ChamberView;
  stateFilter: string | null;
  party: WealthParty | null;
}

/**
 * One of the two side-by-side ranked lists on /congress/wealth. From `md` the
 * card is a subgrid over four row tracks (title, takeaway, table, notes row)
 * that the pair shares, so both tables start at the same pixel whatever the
 * takeaway lengths (rule 10r).
 */
export function WealthList({ title, takeaway, direction, members, view, stateFilter, party }: WealthListProps) {
  const eligible = members.filter(isListEligible);
  const ranked = [...eligible].sort((a, b) => {
    const av = a.points[a.points.length - 1].midpoint;
    const bv = b.points[b.points.length - 1].midpoint;
    if (av !== bv) return direction === "highest" ? bv - av : av - bv;
    return lastNameOf(a.name).localeCompare(lastNameOf(b.name));
  });

  const noun = wealthPartyNoun(view, party);
  const noUsable = members.filter((m) => m.points.length === 0).length;
  const beforeCutoff = members.length - noUsable - eligible.length;
  const excluded = noUsable + beforeCutoff;

  return (
    <section className="@container flex min-w-0 flex-col rounded-xl border border-line-strong bg-surface p-3 sm:p-6 md:row-span-4 md:grid md:grid-rows-subgrid md:gap-y-0">
      <h2 className="font-serif text-lg font-medium text-ink sm:text-xl">{title}</h2>
      <p className="m-0 mt-1.5 text-[0.875rem] leading-[1.5] text-ink">{takeaway}</p>

      {/* A plain wrapper is the grid item: a scroll box as the item itself gets a
          zero automatic minimum height and collapses its subgrid track. */}
      <div className="mt-3 min-w-0">
        <div
          role="region"
          tabIndex={0}
          aria-label={`${title} table, ${ranked.length} rows`}
          className="max-h-[26rem] overflow-y-auto overflow-x-hidden rounded-md border border-line"
        >
          <table className="w-full border-collapse text-[0.82rem]">
            <thead className="sticky top-0 z-10 bg-surface-raised">
              <tr>
                <th className="w-8 border-b border-line px-2 py-2 text-left font-mono text-[0.62rem] uppercase tracking-[0.05em] text-ink-faint">
                  #
                </th>
                <th className="w-full border-b border-line px-2 py-2 text-left font-mono text-[0.62rem] uppercase tracking-[0.05em] text-ink-faint">
                  Member
                </th>
                <th className="whitespace-nowrap border-b border-line px-2 py-2 text-right font-mono text-[0.62rem] uppercase tracking-[0.05em] text-ink-faint">
                  Est. net worth
                </th>
                <th className="border-b border-line pl-1 pr-2 py-2 text-left font-mono text-[0.62rem] uppercase tracking-[0.05em] text-ink-faint">
                  Trend
                </th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((m, i) => (
                <WealthListRow key={m.bioguideId} rank={i + 1} member={m} />
              ))}
            </tbody>
          </table>
          {ranked.length === 0 && (
            <p className="p-4 text-center text-[0.82rem] text-ink-faint">
              No members match these filters.
            </p>
          )}
        </div>
      </div>
      <ChartNotesRow className="mt-auto pt-1 md:self-end">
        <MethodologyNote>
          <p>
            Ranked from the {direction === "highest" ? "top" : "bottom"}: the {ranked.length} {noun}
            {stateFilter && ` in ${stateName(stateFilter)}`} with net worth data from 2023 or later, by estimated
            net worth (the midpoint of the reported value bands, with the range beneath it). High-confidence parses
            only
            {excluded > 0
              ? `: ${excluded} current ${excluded === 1 ? "member is" : "members are"} left out, ${noUsable} with no usable filing${
                  beforeCutoff > 0 ? ` and ${beforeCutoff} whose latest usable filing is before 2023` : ""
                }.`
              : "."}{" "}
            Years are the year each report covers. Sparklines share one 2013–2025 axis, each scaled to that
            member&rsquo;s own range, so compare members by the midpoint; dashed segments bridge years with no usable
            filing. Sources: <SourceLink id="house-clerk-disclosures">House Clerk</SourceLink>,{" "}
            <SourceLink id="senate-efd">Senate eFD</SourceLink>.
          </p>
        </MethodologyNote>
      </ChartNotesRow>
    </section>
  );
}

function WealthListRow({ rank, member }: { rank: number; member: WealthMember }) {
  const latest = member.points[member.points.length - 1];
  const district = member.chamber === "house" && member.district ? `-${member.district}` : "";

  return (
    <tr className="h-14 border-b border-line last:border-0 hover:bg-surface-raised">
      <td className="pl-2 pr-0 py-1 font-mono text-[0.7rem] tabular-nums text-ink-faint">{rank}</td>
      <td className="max-w-0 px-1.5 py-1">
        <a href={memberPath(member)} className="flex items-center gap-1.5">
          <MemberPhoto
            bioguideId={member.bioguideId}
            hasPhoto={member.hasPhoto}
            size="small"
            className="h-8 w-6 flex-none @md:h-9 @md:w-7 rounded-sm object-cover object-top"
          />
          <span className="min-w-0">
            <span className="block line-clamp-2 break-words font-medium leading-tight text-ink @md:truncate">{member.name}</span>
            <span className="mt-0.5 flex items-center gap-1 whitespace-nowrap text-[0.68rem] text-ink-faint @md:text-[0.72rem]">
              <span
                aria-hidden
                className={`size-1.5 flex-none rounded-full ${member.caucus === "Democrat" ? "bg-dem" : "bg-rep"}`}
              />
              {member.caucus === "Democrat" ? "D" : "R"} · {chamberLabel(member.chamber)} ·{" "}
              {member.state}
              {district}
            </span>
          </span>
        </a>
      </td>
      <td className="whitespace-nowrap px-1 py-1 text-right">
        <NetWorthCell point={latest} />
      </td>
      <td className="py-1 pl-0.5 pr-2">
        <div className="w-8 @md:w-24 [&>svg]:h-auto [&>svg]:w-full">
          <Sparkline series={member.series} />
        </div>
      </td>
    </tr>
  );
}

function NetWorthCell({ point }: { point: WealthYearPoint }) {
  const { midpoint, range } = point;
  const midpointText = range.openEnded ? formatOpenEndedUSD(midpoint) : formatCompactUSD(midpoint);

  let rangeText: string;
  if (range.unavailable) rangeText = "Open-ended band";
  else if (range.openEnded) rangeText = `${formatCompactUSD(range.lo!)} or more`;
  else rangeText = `${formatCompactUSD(range.lo!)} – ${formatCompactUSD(range.hi!)}`;

  return (
    <div>
      <div className="font-mono font-semibold tabular-nums text-ink">{midpointText}</div>
      <div className="font-mono text-[0.6rem] tabular-nums text-ink-faint @md:text-[0.68rem]">{rangeText}</div>
    </div>
  );
}

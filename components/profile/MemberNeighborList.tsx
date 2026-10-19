"use client";

import { useState } from "react";
import Link from "next/link";
import type { Neighbor } from "@/lib/neighbors";
import { memberPath } from "@/lib/member-url";
import { memberTitleAbbr } from "@/lib/chamber";
import { MemberFace } from "@/components/MemberPhoto";
import { ListSearch } from "@/components/ListSearch";
import {
  GROUP_VAR,
  fmt2,
  partyAbbr,
  seatLabel,
} from "@/components/senate/format";

/**
 * Ranked list under the member compass: the closest members in ideological
 * space, closest first. Same row layout as committee/CommitteeNeighborList
 * (rank, name, fixed-width columns). Capped height, scrolls.
 */
export function MemberNeighborList({
  rows,
  ranked,
  hasViews,
}: {
  rows: Neighbor[];
  /** Rows are ordered by distance, so number them; otherwise most looked up (or A–Z by last name with no view data). */
  ranked: boolean;
  hasViews: boolean;
}) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const shown = needle
    ? rows.filter(({ member }) => member.name.toLowerCase().includes(needle))
    : rows;
  return (
    <div className="mt-3 flex min-h-0 flex-1 flex-col border-t border-line">
      <div className="flex items-center justify-between gap-2 py-1.5">
        <p className="text-[0.68rem] text-ink-faint">
          {ranked ? "Closest first" : hasViews ? "Most looked up (Wikipedia)" : "A–Z by last name"} · {shown.length}{" "}
          {shown.length === 1 ? "member" : "members"}
        </p>
        <ListSearch value={q} onChange={setQ} label="Search members by name" />
      </div>
      {/* Phones: fixed-height box. Desktop: the box takes whatever height the row gives the card, so the card never makes white space beside it. */}
      <div className="relative h-[11rem] lg:h-auto lg:min-h-[7.5rem] lg:flex-1">
        <div
          tabIndex={0}
          aria-label="Nearest members"
          className="absolute inset-0 overflow-y-auto overscroll-contain touch-scroll"
        >
          {shown.map(({ member }, i) => (
            <Link
              key={member.bioguideId}
              href={memberPath(member)}
              className="-mx-1 flex items-center gap-2.5 rounded px-1 py-[0.3rem] text-[0.8rem] hover:bg-surface-raised"
            >
              {ranked && (
                <span className="w-5 flex-none text-right font-mono text-[0.7rem] tabular-nums text-ink-faint">
                  {i + 1}
                </span>
              )}
              <span
                className="size-[0.45rem] flex-none rounded-full"
                style={{ background: GROUP_VAR[member.group] }}
              />
              <MemberFace bioguideId={member.bioguideId} hasPhoto={member.hasPhoto ?? false} current />
              <span className="min-w-0 flex-1 truncate" title={member.name}>
                <span className="text-ink">
                  {memberTitleAbbr(member.chamber)} {member.name}
                </span>
                <span className="hidden text-ink-faint sm:inline">
                  {" "}
                  {partyAbbr(member.party)}-{seatLabel(member)}
                  {member.isFormer && " · former"}
                </span>
              </span>
              {/* Wide cards only: where the score falls on the −1…+1 left–right axis, so the gap beside the name carries data. */}
              <span
                aria-hidden
                className="relative hidden h-[0.9rem] w-24 flex-none sm:block lg:w-20 xl:w-32"
              >
                <span className="absolute inset-x-0 top-1/2 h-px bg-line-strong" />
                <span className="absolute inset-y-[0.2rem] left-1/2 w-px bg-line-strong" />
                {member.dim1 != null && (
                  <span
                    className="absolute top-1/2 size-[0.5rem] -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{
                      left: `${(Math.max(-1, Math.min(1, member.dim1)) + 1) * 50}%`,
                      background: GROUP_VAR[member.group],
                    }}
                  />
                )}
              </span>
              {/* Phones: party and seat, right-aligned, in place of the score (the name would otherwise cut the seat off). */}
              <span className="flex-none whitespace-nowrap text-right text-[0.72rem] text-ink-faint sm:hidden">
                {partyAbbr(member.party)}-{seatLabel(member)}
                {member.isFormer && " (fmr)"}
              </span>
              <span className="hidden w-10 flex-none text-right font-mono text-[0.7rem] tabular-nums text-ink-muted sm:block">
                {fmt2(member.dim1)}
              </span>
            </Link>
          ))}
          {shown.length === 0 && (
            <p className="py-2 text-[0.75rem] text-ink-faint">No match.</p>
          )}
        </div>
      </div>
    </div>
  );
}

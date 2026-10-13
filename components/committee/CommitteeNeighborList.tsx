"use client";

import { useState } from "react";
import Link from "next/link";
import { CommitteeSeal } from "./CommitteeSeal";
import type { CommitteeSummary } from "@/lib/committee-types";
import { committeePath } from "@/lib/committee-url";
import { ListSearch } from "@/components/ListSearch";
import { partyAbbr } from "@/components/senate/format";

function lead(c: CommitteeSummary, role: "chair" | "ranking_member") {
  const m = c.roster.find((r) => r.role === role);
  return m ? `${m.lastName} (${partyAbbr(m.party)})` : "—";
}

const CHAMBER = { house: "House", senate: "Senate", joint: "Joint" } as const;

/**
 * Scrollable list under the committee compass. It follows the All / Nearest-neighbors toggle: every committee
 * in the field or just the five ringed ones. Capped
 * height, so the card stays about as tall as the roster card beside it.
 */
export function CommitteeNeighborList({
  rows,
  ranked,
}: {
  rows: { member: CommitteeSummary; distance: number | null }[];
  /** Rows are ordered by distance, so show it. */
  ranked: boolean;
}) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const shown = needle
    ? rows.filter(({ member }) =>
        `${member.shortName} ${member.name ?? ""}`.toLowerCase().includes(needle),
      )
    : rows;
  return (
    <div className="mt-3 border-t border-line">
      <div className="flex items-center justify-between gap-2 py-1.5">
        <p className="text-[0.68rem] text-ink-faint">
          {ranked ? "Closest first" : "A–Z"} · {shown.length} committees
        </p>
        <ListSearch value={q} onChange={setQ} label="Search committees by name" />
      </div>
      <div
        tabIndex={0}
        aria-label="Committees"
        className="max-h-[11rem] overflow-y-auto overscroll-contain touch-scroll"
      >
        {shown.map(({ member }, i) => (
          <Link
            key={member.committeeId}
            href={committeePath(member)}
            className="-mx-1 flex items-center gap-2.5 rounded px-1 py-[0.3rem] text-[0.8rem] hover:bg-surface-raised"
          >
            {ranked && (
              <span className="w-5 flex-none text-right font-mono text-[0.7rem] tabular-nums text-ink-faint">
                {i + 1}
              </span>
            )}
            <CommitteeSeal chamber={member.chamber} size={20} className="size-5" />
            <span className="min-w-0 flex-1 truncate text-ink" title={member.shortName}>
              {member.shortName}
            </span>
            <span className="w-[8.5rem] flex-none text-[0.68rem] leading-[1.3] text-ink-muted">
              <span className="block truncate">
                <span className="text-ink-faint">Chair </span>
                {lead(member, "chair")}
              </span>
              <span className="block truncate">
                <span className="text-ink-faint">RM </span>
                {lead(member, "ranking_member")}
              </span>
            </span>
            <span className="w-10 flex-none text-right text-[0.7rem] text-ink-faint">{CHAMBER[member.chamber]}</span>
          </Link>
        ))}
        {shown.length === 0 && (
          <p className="py-2 text-[0.75rem] text-ink-faint">No match.</p>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { MemberPhoto } from "@/components/MemberPhoto";
import { MethodologyNote } from "@/components/MethodologyNote";
import { SourceLink } from "@/components/SourceLink";
import { FILTER_SELECT, FilterCaption } from "@/components/charts/FilterBarParts";
import { chamberLabel } from "@/lib/chamber";
import { formatCompactUSD, formatOpenEndedUSD } from "@/lib/format-money";
import { memberPath } from "@/lib/member-url";
import {
  SORTS,
  isRanking,
  leaderTitle,
  partyLetter,
  seatLabel,
  sortValue,
  type DirectoryMember,
  type DirectorySort,
} from "@/lib/members-directory";
import type { PageviewsWindow } from "@/lib/members-directory-data";
import { IdeologyDot, formatScore } from "./IdeologyDot";

const DESCENDING: ReadonlySet<DirectorySort> = new Set(["interest", "net-worth", "ideology-right", "age"]);

const TH = "border-b border-line px-1.5 py-2 font-mono text-[0.62rem] font-normal uppercase tracking-[0.05em]";

/** "Oct 17, 2026" from an ISO date. */
function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function fmtViews(v: number, compact: boolean): string {
  if (compact && v >= 1000) return `${(v / 1000).toFixed(v >= 10_000 ? 0 : 1)}K`;
  return v.toLocaleString("en-US");
}

function fmtNetWorth(m: DirectoryMember): string | null {
  if (m.netWorth === null) return null;
  return m.netWorthOpenEnded ? formatOpenEndedUSD(m.netWorth) : formatCompactUSD(m.netWorth);
}

/** The phone's one value column: whatever the list is sorted by (Wikipedia interest for the A–Z and state orders). */
function phoneMetric(m: DirectoryMember, sort: DirectorySort): string {
  switch (sort) {
    case "ideology-left":
    case "ideology-right":
      return m.ideology === null ? "–" : formatScore(m.ideology);
    case "seniority":
      return m.since ? `since ${m.since.slice(0, 4)}` : "–";
    case "age":
      return m.age === null ? "–" : `${m.age}`;
    case "net-worth":
      return fmtNetWorth(m) ?? "–";
    default:
      return m.views === null ? "–" : fmtViews(m.views, true);
  }
}

function phoneMetricLabel(sort: DirectorySort): string {
  if (sort === "seniority") return "Since";
  if (sort === "age") return "Age";
  if (sort === "net-worth") return "Net worth";
  if (sort === "ideology-left" || sort === "ideology-right") return "Score";
  return "Views/day";
}

/**
 * The directory list: a pinned Leadership group (the Speaker and the floor
 * leaders who pass the filters; hidden while searching by name, when the
 * search itself finds them), then every matching member in the chosen order.
 * Ranked orders number the rows; members with no value for the measure trail
 * the list unnumbered. Desktop shows every column (the sorted one in ink, its
 * header a button like the others); phones keep the name, the ideology dot and
 * the sorted value.
 */
export function MembersList({
  members,
  leaders,
  sort,
  onSortChange,
  pageviews,
}: {
  members: DirectoryMember[];
  leaders: DirectoryMember[];
  sort: DirectorySort;
  onSortChange: (s: DirectorySort) => void;
  pageviews: PageviewsWindow | null;
}) {
  const ranking = isRanking(sort);
  // A new sort or filter starts the box back at the top, like the Laws and Cases lists.
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (box.current) box.current.scrollTop = 0;
  }, [members, sort]);
  // Longest bar in the Views column: sqrt-scaled so a few viral pages don't flatten everyone else.
  const maxViews = Math.max(1, ...members.map((m) => m.views ?? 0), ...leaders.map((m) => m.views ?? 0));
  const ideologySort = sort === "ideology-left" || sort === "ideology-right";
  const header = (label: ReactNode, target: DirectorySort, active: boolean, className: string, title?: string) => (
    <th scope="col" aria-sort={active ? (DESCENDING.has(sort) ? "descending" : "ascending") : undefined} className={`${TH} ${className}`}>
      <button
        type="button"
        title={title}
        onClick={() => onSortChange(target)}
        className={`uppercase tracking-[0.05em] hover:text-ink ${active ? "text-ink" : "text-ink-faint"}`}
      >
        {label}
      </button>
    </th>
  );

  return (
    <section className="flex min-w-0 flex-col rounded-xl border border-line-strong bg-surface p-3 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 className="font-serif text-lg font-medium text-ink sm:text-xl" aria-live="polite">
          {members.length.toLocaleString("en-US")} {members.length === 1 ? "member" : "members"}
        </h2>
        <label className="flex items-center gap-2">
          <FilterCaption phone>Sort</FilterCaption>
          <select value={sort} onChange={(e) => onSortChange(e.target.value as DirectorySort)} className={FILTER_SELECT}>
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        ref={box}
        tabIndex={0}
        aria-label="Members, scrollable"
        className="touch-scroll relative mt-3 max-h-[calc(100svh-9rem)] overflow-y-auto sm:max-h-[calc(100svh-6rem)] overflow-x-hidden overscroll-contain rounded-md border border-line"
      >
        <table className="w-full border-collapse text-[0.84rem]">
          <thead className="sticky top-0 z-10 bg-surface shadow-[inset_0_-1px_0_var(--line)]">
            <tr>
              <th scope="col" className={`${TH} w-6 pl-1 pr-0 text-left text-ink-faint sm:w-7`}>
                <span className="sr-only">Rank</span>
              </th>
              {header("Member", "name", sort === "name", "w-full text-left lg:w-auto")}
              {header("Age", "age", sort === "age", "w-14 text-left max-sm:hidden", "Age today; click to list the oldest first")}
              {header("Since", "seniority", sort === "seniority", "w-16 text-left max-sm:hidden lg:w-24", "Year first sworn into this chamber")}
              {header(
                <span className="flex items-center gap-1">
                  <span aria-hidden>L</span>Ideology<span aria-hidden>R</span>
                </span>,
                sort === "ideology-left" ? "ideology-right" : "ideology-left",
                ideologySort,
                "w-[5.5rem] text-left max-sm:hidden lg:w-48",
                "Left-right score in the current Congress; click again to reverse",
              )}
              {header("Views/day", "interest", sort === "interest", "w-24 text-left max-sm:hidden lg:w-52", "Median daily views of the member's Wikipedia article")}
              {header("Net worth", "net-worth", sort === "net-worth", "w-24 text-right max-sm:hidden", "Estimated from the latest financial disclosure")}
              <th scope="col" className={`${TH} w-[3.75rem] px-0.5 text-center text-ink-faint sm:hidden`}>
                <span className="flex items-center justify-center gap-1">
                  <span aria-hidden>L</span>Ideol.<span aria-hidden>R</span>
                </span>
              </th>
              <th scope="col" className={`${TH} whitespace-nowrap text-right text-ink sm:hidden`}>
                {phoneMetricLabel(sort)}
              </th>
            </tr>
          </thead>

          {leaders.length > 0 && (
            <tbody>
              <GroupRow>Leadership</GroupRow>
              {leaders.map((m) => (
                <Row key={m.bioguideId} member={m} rank={null} sort={sort} maxViews={maxViews} role={leaderTitle(m.chamber, m.leaderRole!)} />
              ))}
              <GroupRow>All members</GroupRow>
            </tbody>
          )}
          <tbody>
            {members.map((m, i) => (
              <Row key={m.bioguideId} member={m} rank={ranking && sortValue(m, sort) !== null ? i + 1 : null} sort={sort} maxViews={maxViews} />
            ))}
          </tbody>
        </table>
        {members.length === 0 && <p className="p-4 text-center text-[0.84rem] text-ink-faint">No members match these filters.</p>}
      </div>

      <MethodologyNote className="mt-3">
        <p>
          Members in office today, from{" "}
          <SourceLink id="congress-legislators">congress-legislators</SourceLink>. <strong>Views/day</strong> is the median
          number of daily views of the member&rsquo;s English Wikipedia article
          {pageviews ? ` over the ${pageviews.days} days from ${fmtDate(pageviews.start)} to ${fmtDate(pageviews.end)}` : ""}, counting
          readers only (not crawlers) and visits through redirects, from the{" "}
          <SourceLink id="wikimedia-pageviews">Wikimedia Pageviews API</SourceLink>; the median keeps one day&rsquo;s spike from
          setting the order. It shows how often people look a member up, for any reason, not approval or popularity.{" "}
          <strong>Ideology</strong> is the member&rsquo;s <SourceLink id="voteview">Voteview</SourceLink> score in the current
          Congress (none with fewer than 10 votes). <strong>Since</strong> is the year first sworn into this chamber.{" "}
          <strong>Net worth</strong> is the midpoint estimate from the latest disclosure, 2023 or later.
        </p>
      </MethodologyNote>
    </section>
  );
}

function GroupRow({ children }: { children: ReactNode }) {
  return (
    <tr>
      <th colSpan={8} scope="colgroup" className="border-b border-line px-1.5 pb-1 pt-3 text-left font-mono text-[0.62rem] font-normal uppercase tracking-[0.08em] text-accent">
        {children}
      </th>
    </tr>
  );
}

function Row({ member: m, rank, sort, role, maxViews }: { member: DirectoryMember; rank: number | null; sort: DirectorySort; role?: string; maxViews: number }) {
  const cell = (active: boolean, align = "text-right") => `px-1.5 py-1.5 ${align} font-mono text-[0.78rem] tabular-nums ${active ? "font-semibold text-ink" : "text-ink-muted"}`;
  const nw = fmtNetWorth(m);
  return (
    <tr className="border-b border-line last:border-0 hover:bg-surface-raised">
      <td className="pl-1 pr-0 py-1.5 font-mono text-[0.68rem] tabular-nums text-ink-faint">{rank ?? ""}</td>
      <td className="max-w-0 px-1.5 py-1.5">
        <a href={memberPath(m)} className="group flex items-center gap-2 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
          <MemberPhoto bioguideId={m.bioguideId} hasPhoto={m.hasPhoto} size="small" className="h-9 w-7 flex-none rounded-sm bg-surface-raised object-cover object-top" />
          <span className="min-w-0">
            <span className="line-clamp-2 break-words font-medium leading-tight text-ink group-hover:underline group-hover:underline-offset-2 sm:block sm:truncate">{m.name}</span>
            <span className="mt-0.5 block text-[0.7rem] leading-snug text-ink-faint sm:truncate">
              {role && (
                <span className="font-medium text-accent max-sm:block">
                  {role}
                  <span className="max-sm:hidden"> · </span>
                </span>
              )}
              {partyLetter(m.party)} · {chamberLabel(m.chamber)} · {seatLabel(m)}
            </span>
          </span>
        </a>
      </td>
      <td className={`${cell(sort === "age", "text-left")} max-sm:hidden`}>{m.age ?? "–"}</td>
      <td className={`${cell(sort === "seniority", "text-left")} max-sm:hidden`}>{m.since ? m.since.slice(0, 4) : "–"}</td>
      <td className="px-0.5 py-1.5 sm:px-1.5">
        <div className="flex justify-center sm:justify-start">
          <span className="lg:hidden">
            <IdeologyDot score={m.ideology} group={m.group} />
          </span>
          {/* Wide screens: a longer track, so the column fills the space beside the name. */}
          <span aria-hidden className="relative hidden h-3 w-36 lg:block">
            <span className="absolute inset-x-0 top-1/2 h-px bg-line-strong" />
            <span className="absolute inset-y-0.5 left-1/2 w-px bg-line-strong" />
            {m.ideology !== null && (
              <span
                className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ left: `${(Math.max(-1, Math.min(1, m.ideology)) + 1) * 50}%`, background: `var(--${m.group === "dem" ? "dem" : m.group === "rep" ? "rep" : "oth"})` }}
              />
            )}
          </span>
        </div>
      </td>
      <td className={`${cell(sort === "interest", "text-left")} max-sm:hidden`}>
        <div className="flex items-center justify-start gap-3">
          <span className="lg:w-24">{m.views === null ? "–" : `${fmtViews(m.views, false)}/day`}</span>
          {/* Wide screens: bar length shows how a member's Wikipedia interest compares with the most looked-up member. */}
          {m.views !== null && (
            <span aria-hidden className="hidden h-1.5 w-24 lg:block">
              <span className="block h-full rounded-sm bg-line-strong" style={{ width: `${Math.max(2, Math.sqrt(m.views / maxViews) * 100)}%` }} />
            </span>
          )}
          {m.views === null && <span className="hidden w-24 lg:block" />}
        </div>
      </td>
      <td className={`${cell(sort === "net-worth")} max-sm:hidden`}>{nw ?? "–"}</td>
      <td className={`${cell(true)} whitespace-nowrap pl-0 text-[0.74rem] sm:hidden`}>{phoneMetric(m, sort)}</td>
    </tr>
  );
}

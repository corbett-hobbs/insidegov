"use client";

import { useMemo, type ReactNode } from "react";
import { RangeReset } from "@/components/charts/RangeReset";
import { RangeSelector } from "@/components/charts/RangeSelector";
import { TermBand, type BandTerm } from "@/components/charts/TermBand";

/**
 * The pinned filter bar for /presidency/immigration, directly under the site navigation: one two-handle fiscal-year
 * slider with the presidential-term band under its track (tap a term to add or drop it; there is no President
 * dropdown). The slider sets the window the timeline shows (a time series filters; it never dims). The one selected
 * year the country list shows is chosen on a timeline bar or in the country card's year menu, not here.
 * The slider spans every year the page has data for (the longest series, FY1980 on), so the terms come from the green-card
 * payload (which has a term for every year), not from ICE's shorter series.
 */

/** A president's term as the band needs it; `termId` is the inauguration date. */
export interface BandSourceTerm {
  termId: string;
  president: string;
  last: string;
  party: "D" | "R";
}
export function ImmigrationFilterBar({
  terms,
  years,
  bounds,
  range,
  onRange,
  children,
}: {
  terms: readonly BandSourceTerm[];
  /** Each fiscal year on the slider and the term it belongs to (the administration in office on September 30). */
  years: readonly { fy: number; termId: string }[];
  /** First and last fiscal year in the data. */
  bounds: readonly [number, number];
  range: readonly [number, number];
  onRange: (r: [number, number]) => void;
  /** Pinned under the slider: the section strip, once the page has scrolled past the header pills. */
  children?: ReactNode;
}) {
  // A term's fiscal years are the ones assigned to it (the administration in office for most of the year), so
  // consecutive terms never share a year.
  const bandTerms = useMemo<BandTerm[]>(() => {
    const sorted = [...terms].sort((a, b) => a.termId.localeCompare(b.termId));
    return sorted.flatMap((t, i) => {
      const fys = years.filter((y) => y.termId === t.termId).map((y) => y.fy);
      if (fys.length === 0) return [];
      const next = sorted[i + 1];
      const label = `${t.president} (${t.termId.slice(0, 4)}–${next ? next.termId.slice(0, 4) : ""})`;
      return [{ id: t.termId, label, last: t.last, initials: t.president.split(" ").map((w) => w[0]).join(""), party: t.party, from: Math.min(...fys), to: Math.max(...fys) }];
    });
  }, [terms, years]);
  const full = range[0] === bounds[0] && range[1] === bounds[1];
  return (
    <div className="sticky top-0 z-40 border-b border-line-strong bg-surface/95 shadow-[0_2px_6px_rgba(26,34,51,0.08)] backdrop-blur sm:shadow-none">
      <div className="mx-auto w-full max-w-[1180px] px-4 pb-2 pt-2 sm:px-6 sm:py-2.5">
        <RangeSelector
          min={bounds[0]}
          max={bounds[1]}
          value={range}
          onChange={(r) => onRange(r)}
          format={(v) => `FY${String(v).slice(2)}`}
          ariaLabel="Fiscal years shown"
          below={<TermBand terms={bandTerms} min={bounds[0]} max={bounds[1]} value={range} onChange={(r) => onRange(r)} />}
          action={<RangeReset show={!full} onReset={() => onRange([bounds[0], bounds[1]])} className="mt-0.5 font-sans leading-none" />}
          className="min-w-0"
        />
        {children}
      </div>
    </div>
  );
}

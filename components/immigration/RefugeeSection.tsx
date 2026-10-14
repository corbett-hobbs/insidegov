"use client";

import { useState } from "react";
import type { RefugeePayload } from "@/lib/refugee-types";
import { RefugeeCeilingCard } from "./RefugeeCeilingCard";
import { RefugeeCountryCard } from "./RefugeeCountryCard";
import { RefugeeTopCard } from "./RefugeeTopCard";
import type { MapFeature } from "./RemovalsMap";

const asOfLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

/**
 * The refugee cards under the ICE ones, on the page's pinned year window (the same slider and president band). When the window
 * reaches ICE's newest year the section also shows the one year beyond it (FY2026, preliminary), as ICE shows its own unlocked
 * slot. The section has its own selected year, which the ceiling chart's bars, the year menu in the map card and the "Who's sent
 * the most" chart all set: ICE's country list covers only FY2014 to FY2024, so the two don't share one. The selection falls back to
 * the window's last year whenever the window moves. A country picked on the map also dims the years it did not lead below.
 */
export function RefugeeSection({
  payload,
  worldMap,
  range,
  iceLastFy,
}: {
  payload: RefugeePayload;
  worldMap: { width: number; height: number; features: MapFeature[] };
  range: readonly [number, number];
  /** The newest fiscal year ICE has locked, where the page's slider ends. */
  iceLastFy: number;
}) {
  const [picked, setPicked] = useState<{ fy: number; window: string } | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const lastShown = range[1] >= iceLastFy ? payload.lastFy : range[1];
  const years = payload.years.filter((y) => y.fy >= range[0] && y.fy <= lastShown);
  const windowKey = `${range[0]}-${range[1]}`;
  const fallback = Math.min(range[1], iceLastFy);
  const fy = picked && picked.window === windowKey ? Math.min(lastShown, Math.max(range[0], picked.fy)) : fallback;
  const setFy = (v: number) => setPicked({ fy: v, window: windowKey });

  return (
    <>
      <RefugeeCeilingCard payload={payload} years={years} fy={fy} onFy={setFy} />
      <RefugeeCountryCard payload={payload} worldMap={worldMap} fy={fy} yearRange={[range[0], lastShown]} onFy={setFy} country={country} onCountry={setCountry} />
      <RefugeeTopCard payload={payload} fromFy={range[0]} toFy={lastShown} fy={fy} onFy={setFy} country={country} />
      <p className="m-0 text-[0.8rem] leading-[1.6] text-ink-muted">
        Source: Presidential Determinations on Refugee Admissions (Federal Register) for the ceilings; State Department Refugee Processing Center, Refugee Admissions Report as of September 30, 2026, for arrivals. The numbered rules are the executive orders and proclamations cited in each note; dates and statuses are as of {asOfLabel(payload.asOf)}, and court status is not tracked. Each fiscal year is assigned to the administration in office on September 30. One program, one definition: refugees only, never combined with ICE or other immigration counts.
      </p>
    </>
  );
}

"use client";

import { useState } from "react";
import type { RefugeePayload } from "@/lib/refugee-types";
import { RefugeeCeilingCard } from "./RefugeeCeilingCard";
import { RefugeeCountryCard } from "./RefugeeCountryCard";
import { RefugeeTopCard } from "./RefugeeTopCard";
import type { MapFeature } from "./RemovalsMap";

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
  // Admissions run from FY1980 but the country detail only from FY2001: the selected year and the two country cards stay inside it.
  const detailFirst = Math.max(range[0], Math.min(...payload.countryYears.map((c) => c.fy)));
  const hasDetail = detailFirst <= lastShown;
  const windowKey = `${detailFirst}-${range[1]}`;
  const fallback = Math.min(range[1], iceLastFy);
  const fy = hasDetail && picked && picked.window === windowKey ? Math.min(lastShown, Math.max(detailFirst, picked.fy)) : hasDetail ? Math.max(detailFirst, fallback) : fallback;
  const setFy = (v: number) => setPicked({ fy: v, window: windowKey });

  return (
    <>
      {/* MOCKUP: a card for the news and questions chips to scroll to. */}
      <div id="chart-refugees" className="scroll-mt-32 rounded-[10px]">
        <RefugeeCeilingCard payload={payload} years={years} fy={fy} onFy={setFy} />
      </div>
      {hasDetail && <RefugeeCountryCard payload={payload} worldMap={worldMap} fy={fy} yearRange={[detailFirst, lastShown]} onFy={setFy} country={country} onCountry={setCountry} />}
      {hasDetail && <RefugeeTopCard payload={payload} fromFy={detailFirst} toFy={lastShown} fy={fy} onFy={setFy} country={country} />}
    </>
  );
}

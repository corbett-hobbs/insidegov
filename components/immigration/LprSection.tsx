"use client";

import { useState } from "react";
import type { LprMetric } from "@/lib/lpr-chart";
import type { LprPayload } from "@/lib/lpr-types";
import { LprCountryCard } from "./LprCountryCard";
import { LprGreenCardCard } from "./LprGreenCardCard";
import type { MapFeature } from "./RemovalsMap";

/**
 * The green-card cards, on the page's pinned year window. The section has its own selected year (a bar click on the chart, or the
 * year menu in the country card) that falls back to the window's last year whenever the window moves, and its own Green cards /
 * Naturalizations choice, kept in step between the two cards. The window is clamped to the years OHSS has reported: the chart runs from
 * FY1977 (totals only, in grey, before FY1999, when the class and country detail begins), and the country card and the selected year
 * stay within the detail years.
 */
export function LprSection({ payload, worldMap, range }: { payload: LprPayload; worldMap: { width: number; height: number; features: MapFeature[] }; range: readonly [number, number] }) {
  const [picked, setPicked] = useState<{ fy: number; window: string } | null>(null);
  const [metric, setMetric] = useState<LprMetric>("lpr");
  const [country, setCountry] = useState<string | null>(null);
  const first = Math.max(range[0], payload.firstFy);
  const last = Math.min(range[1], payload.lastFy);
  const years = payload.years.filter((y) => y.fy >= first && y.fy <= last);
  // The class and country detail starts later (FY1999): the selected year and the country card live inside that part of the window.
  const detailFirst = Math.max(range[0], payload.firstDetailFy);
  const hasDetail = detailFirst <= last;
  const windowKey = `${detailFirst}-${last}`;
  const fy = hasDetail && picked && picked.window === windowKey ? Math.min(last, Math.max(detailFirst, picked.fy)) : last;
  const setFy = (v: number) => setPicked({ fy: v, window: windowKey });
  if (years.length === 0) return null;
  return (
    <>
      {/* MOCKUP: a card for the news and questions chips to scroll to. */}
      <div id="chart-green-cards" className="scroll-mt-32 rounded-[10px]">
        <LprGreenCardCard payload={payload} years={years} fy={fy} onFy={setFy} metric={metric} onMetric={setMetric} />
      </div>
      {hasDetail && <LprCountryCard payload={payload} worldMap={worldMap} fy={fy} yearRange={[detailFirst, last]} onFy={setFy} metric={metric} onMetric={setMetric} country={country} onCountry={setCountry} />}
    </>
  );
}

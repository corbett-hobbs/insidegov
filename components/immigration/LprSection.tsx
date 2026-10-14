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
 * Naturalizations choice, kept in step between the two cards. The window is clamped to the years OHSS has reported.
 */
export function LprSection({ payload, worldMap, range }: { payload: LprPayload; worldMap: { width: number; height: number; features: MapFeature[] }; range: readonly [number, number] }) {
  const [picked, setPicked] = useState<{ fy: number; window: string } | null>(null);
  const [metric, setMetric] = useState<LprMetric>("lpr");
  const [country, setCountry] = useState<string | null>(null);
  const first = Math.max(range[0], payload.firstDetailFy);
  const last = Math.min(range[1], payload.lastFy);
  const years = payload.years.filter((y) => y.fy >= first && y.fy <= last);
  const windowKey = `${first}-${last}`;
  const fy = picked && picked.window === windowKey ? Math.min(last, Math.max(first, picked.fy)) : last;
  const setFy = (v: number) => setPicked({ fy: v, window: windowKey });
  if (years.length === 0) return null;
  return (
    <>
      <LprGreenCardCard payload={payload} years={years} fy={fy} onFy={setFy} metric={metric} onMetric={setMetric} />
      <LprCountryCard payload={payload} worldMap={worldMap} fy={fy} yearRange={[first, last]} onFy={setFy} metric={metric} onMetric={setMetric} country={country} onCountry={setCountry} />
    </>
  );
}

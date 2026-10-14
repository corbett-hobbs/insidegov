"use client";

import { useState } from "react";
import type { LprMetric } from "@/lib/lpr-chart";
import type { LprPayload } from "@/lib/lpr-types";
import { LprCountryCard } from "./LprCountryCard";
import { LprGreenCardCard } from "./LprGreenCardCard";
import type { MapFeature } from "./RemovalsMap";

const asOfLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

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
      <p className="m-0 text-[0.8rem] leading-[1.6] text-ink-muted">
        Source: Department of Homeland Security, Office of Homeland Security Statistics: the Yearbook of Immigration Statistics through FY{payload.years.filter((y) => !y.preliminary).at(-1)?.fy}, and the quarterly Legal Immigration and Adjustment of Status Report for the newest year (preliminary). Data as of {asOfLabel(payload.asOf)}. Each fiscal year is assigned to the administration in office on September 30. One agency, one definition per chart: green cards and naturalizations are separate counts of different people, and neither is combined with visas, entries, refugee admissions or ICE removals.
      </p>
    </>
  );
}

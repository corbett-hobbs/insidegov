"use client";

import { createContext, useContext, useMemo } from "react";
import type { TermBandSelect } from "@/components/charts/TermBandSvg";
import type { DemoCongress } from "@/lib/demographics-types";
import type { TermWindow } from "@/lib/term-window";

const Ctx = createContext<TermWindow | null>(null);

/** The page's year window, so the president band under each chart can edit it like the slider's band does. */
export const DemographicsWindowProvider = Ctx.Provider;

/** `select` for a chart with one slot per Congress in `rows`: a term spans from its first Congress's year to its last one's second year. */
export function useCongressTermSelect(rows: readonly DemoCongress[]): TermBandSelect | undefined {
  const w = useContext(Ctx);
  return useMemo(() => (w ? { ...w, axis: (i, edge) => rows[i].year + (edge === "to" ? 1 : 0) } : undefined), [w, rows]);
}

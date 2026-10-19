"use client";

import { createContext, useContext } from "react";
import type { TermBandSelect } from "@/components/charts/TermBandSvg";
import type { TermWindow } from "@/lib/term-window";

const Ctx = createContext<TermWindow | null>(null);

/** The page's fiscal-year window, so the president band under each chart can edit it like the slider's band does. */
export const ImmigrationWindowProvider = Ctx.Provider;

/** `select` for a chart with one slot per fiscal year (`fyAt` says which); `undefined` outside the page. */
export function useFyTermSelect(fyAt: (slot: number) => number): TermBandSelect | undefined {
  const w = useContext(Ctx);
  return w ? { ...w, axis: (i) => fyAt(i) } : undefined;
}

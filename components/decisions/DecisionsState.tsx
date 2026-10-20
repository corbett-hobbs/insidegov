"use client";

import { sameRange, type YearRange } from "@/lib/year-range";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { viewOf } from "@/lib/decisions-derive";
import type { DecisionDirection, DecisionsPayload } from "@/lib/decisions-types";
import type { TermBandSelect } from "@/components/charts/TermBandSvg";
import type { Picked } from "@/lib/multi-select";

/**
 * The Decisions page's one source of truth: the years-shown window, the issue areas (null = all, or the set of ticked areas; set by the pinned bar's
 * checkbox dropdown, or a click on a row or legend entry, which ticks just that one), and the hovered and pinned term, so one crosshair runs through
 * cards 1 and 2. Two contexts, so components that only need the stable actions don't re-render on every hover frame
 * (same shape as `EnergyState`). Hover is rAF-throttled.
 */
export interface DecisionsValues {
  data: DecisionsPayload;
  range: YearRange;
  /** Ticked indexes into `data.areas`; null = every area. */
  areas: Picked<number>;
  /** Only Wikipedia's landmark cases (the pinned bar's checkbox): every chart, the heatmap and the list narrow to them. */
  landmark: boolean;
  /** Ticked dissent bands 0-4 (the bar's Vote dropdown, card 2's legend, the list's pills); null = any vote. Narrows card 1, card 2 and the case list. */
  band: Picked<number>;
  /** SCDB's coding of who prevailed (the bar's Outcome dropdown): 2 liberal, 1 conservative, null = any. Narrows every chart, the heatmap and the case list. */
  direction: DecisionDirection | null;
  hover: number | null;
  pin: number | null;
}

export interface DecisionsActions {
  setRange: (r: YearRange) => void;
  setAreas: (a: Picked<number>) => void;
  setBand: (b: Picked<number>) => void;
  setDirection: (d: DecisionDirection | null) => void;
  setLandmark: (on: boolean) => void;
  moveHover: (term: number) => void;
  leaveHover: () => void;
  /** Pin `term`, or clear the pin when it is already pinned. */
  togglePin: (term: number) => void;
  /** Pin `term` (keyboard stepping); never clears. */
  pinTerm: (term: number) => void;
  clearPin: () => void;
}

const ValuesCtx = createContext<DecisionsValues | null>(null);
const ActionsCtx = createContext<DecisionsActions | null>(null);

export function DecisionsStateProvider({ data, children }: { data: DecisionsPayload; children: ReactNode }) {
  const full = useMemo<YearRange>(() => [data.terms[0], data.terms[data.terms.length - 1]], [data.terms]);
  const [range, setRangeState] = useState<YearRange>(full);
  const [areas, setAreasState] = useState<Picked<number>>(null);
  const [landmark, setLandmarkState] = useState(false);
  const [band, setBandState] = useState<Picked<number>>(null);
  const [direction, setDirectionState] = useState<DecisionDirection | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [pin, setPin] = useState<number | null>(null);
  const pending = useRef<number | null>(null);
  const raf = useRef(0);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const actions = useMemo<DecisionsActions>(
    () => ({
      setRange: (r) => setRangeState((cur) => (sameRange(cur, r) ? cur : r)),
      setAreas: (a) => setAreasState(a),
      setBand: (b) => setBandState(b),
      setDirection: (d) => setDirectionState(d),
      setLandmark: (on) => setLandmarkState(on),
      moveHover: (term) => {
        pending.current = term;
        if (!raf.current)
          raf.current = requestAnimationFrame(() => {
            raf.current = 0;
            if (pending.current !== null) setHover(pending.current);
          });
      },
      leaveHover: () => {
        pending.current = null;
        setHover(null);
      },
      togglePin: (term) => setPin((cur) => (cur === term ? null : term)),
      pinTerm: (term) => setPin(term),
      clearPin: () => setPin(null),
    }),
    [],
  );

  // A pin or hover that has left the window is simply not shown (and comes back if the window widens).
  const values = useMemo<DecisionsValues>(() => {
    const inWin = (t: number | null) => (t !== null && t >= range[0] && t <= range[1] ? t : null);
    return { data: viewOf(data, landmark, direction), range, areas, landmark, band, direction, hover: inWin(hover), pin: inWin(pin) };
  }, [data, range, areas, landmark, band, direction, hover, pin]);

  return (
    <ActionsCtx.Provider value={actions}>
      <ValuesCtx.Provider value={values}>{children}</ValuesCtx.Provider>
    </ActionsCtx.Provider>
  );
}

export function useDecisionsValues(): DecisionsValues {
  const v = useContext(ValuesCtx);
  if (!v) throw new Error("useDecisionsValues outside DecisionsStateProvider");
  return v;
}

export function useDecisionsActions(): DecisionsActions {
  const a = useContext(ActionsCtx);
  if (!a) throw new Error("useDecisionsActions outside DecisionsStateProvider");
  return a;
}

/** `select` for the president band under a decisions chart (one slot per term in `terms`): it edits the year window the filter bar's band does. */
export function useDecisionsTermSelect(terms: readonly number[]): TermBandSelect {
  const { data, range } = useDecisionsValues();
  const { setRange } = useDecisionsActions();
  return useMemo(
    () => ({ min: data.terms[0], max: data.terms[data.terms.length - 1], value: range, onChange: setRange, axis: (slot: number) => terms[slot] }),
    [data.terms, range, setRange, terms],
  );
}

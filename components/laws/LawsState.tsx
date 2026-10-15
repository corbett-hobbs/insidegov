"use client";

import { sameRange, type YearRange } from "@/lib/year-range";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { lawsForParty, windowIndexes, yearSpan } from "@/lib/laws-derive";
import type { Picked } from "@/lib/multi-select";
import type { LawsPayload, SponsorParty } from "@/lib/laws-types";

/**
 * The Laws page's one source of truth: the years-shown window, the policy-area filter (null = all, or the set of ticked topic group ids), "major laws only", the support bands (null = any vote, or the set of ticked bands; card 2's legend and the list's pills set one), the party-control rows
 * toggle, the sponsor party, and the hovered and pinned Congress, so one crosshair runs through both charts. Two contexts, so components that
 * only need the stable actions don't re-render on every hover frame (same shape as `DecisionsState`). Hover is rAF-throttled.
 */
export interface LawsValues {
  /** The page's data already narrowed to the sponsor party, so every card reads the counts it should draw. */
  data: LawsPayload;
  /** Only laws a Democrat or a Republican sponsored; null = every law. */
  party: SponsorParty | null;
  range: YearRange;
  /** Ticked topic group ids; null = every group. */
  groups: Picked<string>;
  /** Only laws on Mayhew's lists of important enactments (assessed through `data.majorThrough`). */
  major: boolean;
  /** Ticked support bands 0-4 (data order); null = any vote. Narrows card 1, card 2's vis and the list. */
  bands: Picked<number>;
  /** Show which party held the House and Senate under each chart. */
  control: boolean;
  /** Index range `[first, last]` into `data.congresses` the window shows; `first > last` = none. */
  window: [number, number];
  /** Congress numbers. */
  hover: number | null;
  pin: number | null;
}

export interface LawsActions {
  setRange: (r: YearRange) => void;
  setGroups: (g: Picked<string>) => void;
  setMajor: (on: boolean) => void;
  setBands: (b: Picked<number>) => void;
  setParty: (p: SponsorParty | null) => void;
  setControl: (on: boolean) => void;
  moveHover: (congress: number) => void;
  leaveHover: () => void;
  togglePin: (congress: number) => void;
  pinCongress: (congress: number) => void;
  clearPin: () => void;
}

const ValuesCtx = createContext<LawsValues | null>(null);
const ActionsCtx = createContext<LawsActions | null>(null);

export function LawsStateProvider({ data: allLaws, children }: { data: LawsPayload; children: ReactNode }) {
  const full = useMemo(() => yearSpan(allLaws), [allLaws]);
  const [party, setParty] = useState<SponsorParty | null>(null);
  const data = useMemo(() => lawsForParty(allLaws, party), [allLaws, party]);
  const [range, setRangeState] = useState<YearRange>(full);
  const [groups, setGroups] = useState<Picked<string>>(null);
  const [major, setMajor] = useState(false);
  const [bands, setBands] = useState<Picked<number>>(null);
  const [control, setControl] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const [pin, setPin] = useState<number | null>(null);
  const pending = useRef<number | null>(null);
  const raf = useRef(0);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const actions = useMemo<LawsActions>(
    () => ({
      setRange: (r) => setRangeState((cur) => (sameRange(cur, r) ? cur : r)),
      setGroups,
      setMajor,
      setBands,
      setParty,
      setControl,
      moveHover: (c) => {
        pending.current = c;
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
      togglePin: (c) => setPin((cur) => (cur === c ? null : c)),
      pinCongress: (c) => setPin(c),
      clearPin: () => setPin(null),
    }),
    [],
  );

  // A pin or hover that has left the window is simply not shown (and comes back if the window widens).
  // The window is its own memo: a hover or pin must not hand the cards a new array, or they rebuild their columns (and a second tap on the open bar no longer matches it).
  const window = useMemo(() => windowIndexes(data, range, major), [data, range, major]);
  const values = useMemo<LawsValues>(() => {
    const inWin = (c: number | null) => {
      const i = c === null ? -1 : data.congresses.indexOf(c);
      return i >= window[0] && i <= window[1] ? c : null;
    };
    return { data, party, range, groups, major, bands, control, window, hover: inWin(hover), pin: inWin(pin) };
  }, [data, party, range, groups, major, bands, control, window, hover, pin]);

  return (
    <ActionsCtx.Provider value={actions}>
      <ValuesCtx.Provider value={values}>{children}</ValuesCtx.Provider>
    </ActionsCtx.Provider>
  );
}

export function useLawsValues(): LawsValues {
  const v = useContext(ValuesCtx);
  if (!v) throw new Error("useLawsValues outside LawsStateProvider");
  return v;
}

export function useLawsActions(): LawsActions {
  const a = useContext(ActionsCtx);
  if (!a) throw new Error("useLawsActions outside LawsStateProvider");
  return a;
}

"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useMediaQuery } from "@/lib/use-media-query";

interface TooltipState<T> {
  data: T;
  x: number;
  y: number;
}

interface PointerLike {
  clientX: number;
  clientY: number;
}

/**
 * Pointer-following tooltip state. `show` on enter, `move` on move, `hide` on
 * leave. Chart-agnostic — the content is supplied by <Tooltip>.
 */
export function useTooltip<T>() {
  const [state, setState] = useState<TooltipState<T> | null>(null);

  const show = useCallback((data: T, e: PointerLike) => {
    setState({ data, x: e.clientX, y: e.clientY });
  }, []);
  const move = useCallback((e: PointerLike) => {
    setState((s) => (s ? { ...s, x: e.clientX, y: e.clientY } : s));
  }, []);
  const hide = useCallback(() => setState(null), []);

  return { state, show, move, hide };
}

/**
 * `useTooltip` for per-year bar charts that must work with a finger. A mouse behaves as before: the tooltip follows the
 * pointer and `leave` hides it. A touch or pen **tap keeps the tooltip open** after the finger lifts (a browser fires
 * pointerleave right after pointerup, which used to hide it at once) until a tap outside any `[data-sticky-tip]` chart,
 * Esc, or a page scroll; tapping the same bar again closes it (`down` / `moved` / `up`). Dragging across bars still moves
 * it. This is the standard bar-tap pattern (ARCHITECTURE_MAP rule 6a); the immigration chart implements the same thing.
 */
export function useStickyTooltip<T>() {
  const tip = useTooltip<T>();
  const touch = useRef(false);
  const arm = useRef(false);
  const { hide } = tip;
  const open = tip.state != null;

  useEffect(() => {
    if (!open || !touch.current) return;
    const away = (e: PointerEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest("[data-sticky-tip]")) hide();
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && hide();
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", hide, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("scroll", hide);
    };
  }, [open, hide]);

  const show = useCallback(
    (data: T, e: PointerLike & { pointerType?: string }) => {
      touch.current = (e.pointerType ?? "mouse") !== "mouse";
      tip.show(data, e);
    },
    [tip],
  );
  /** Pointer left the chart: a mouse closes the tooltip; a finger leaving after a tap leaves it open. */
  const leave = useCallback((e: { pointerType?: string }) => {
    if ((e.pointerType ?? "mouse") === "mouse") hide();
  }, [hide]);
  /** Touch press: `sameAsOpen` is whether this bar already shows the tooltip (a tap on it will close it). */
  const down = useCallback((e: { pointerType?: string }, sameAsOpen: boolean) => {
    arm.current = (e.pointerType ?? "mouse") !== "mouse" && sameAsOpen;
  }, []);
  /** The finger moved to a different bar: it is a scrub, not a tap. */
  const moved = useCallback(() => {
    arm.current = false;
  }, []);
  /** Touch release: closes the tooltip if this was a tap on the bar that was already open. */
  const up = useCallback(() => {
    if (arm.current) hide();
    arm.current = false;
  }, [hide]);

  return { state: tip.state, show, move: tip.move, hide, leave, down, moved, up };
}

/**
 * The pinned card of a scatter dot: `show` pins it at the click, `hide` unpins. It dismisses itself on a press anywhere
 * that is not the card or a dot (`.dot`), and on Esc. Pair it with `<Tooltip onActivate>`; the scatter rule is that a
 * click on a dot pins its card and the card is the link or action, never the dot.
 */
export function usePinnedTooltip<T>() {
  const pin = useTooltip<T>();
  const pinned = pin.state != null;
  const { hide } = pin;
  useEffect(() => {
    if (!pinned) return;
    const away = (e: PointerEvent) => {
      const el = e.target as Element | null;
      if (el?.closest("[data-pinned-tooltip]") || el?.closest(".dot") || el?.closest("[data-pin-target]")) return;
      hide();
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && hide();
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [pinned, hide]);
  return pin;
}

/**
 * The standard behaviour for any mark that is one named individual (a justice, a member, a bench seat): ARCHITECTURE_MAP
 * rule 10t. A mouse previews the follow-the-pointer tooltip on hover; a click or tap **pins** the card open until the
 * reader clicks elsewhere, presses Esc, or taps the mark again; the card (never the mark) carries the profile link.
 * Phones skip the hover preview (a tap goes straight to the pinned card). Spread `bind(d)` on the hit target and render
 * `<DotCardTooltips card={card}>` once. Pass `same` when the datum object is rebuilt between renders.
 */
export function useDotCard<T>(same: (a: T, b: T) => boolean = Object.is) {
  const tip = useTooltip<T>();
  const pin = usePinnedTooltip<T>();
  const hover = useMediaQuery("(hover: hover)");
  const { show: tipShow, move: tipMove, hide: tipHide } = tip;
  const { show: pinShow, hide: pinHide } = pin;
  const pinned = pin.state;

  const enter = useCallback((d: T, e: PointerLike) => hover && tipShow(d, e), [hover, tipShow]);
  const leave = useCallback(() => tipHide(), [tipHide]);
  const move = useCallback((e: PointerLike) => hover && tipMove(e), [hover, tipMove]);
  /** Click, tap or Enter on a mark: pin its card, or close it if it is already the pinned one. */
  const toggle = useCallback(
    (d: T, e: PointerLike) => {
      tipHide();
      if (pinned && same(pinned.data, d)) pinHide();
      else pinShow(d, e);
    },
    [pinned, same, tipHide, pinHide, pinShow],
  );
  const bind = useCallback(
    (d: T) => ({
      "data-pin-target": "",
      onPointerEnter: (e: React.PointerEvent) => enter(d, e),
      onPointerMove: move,
      onPointerLeave: leave,
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        toggle(d, e);
      },
    }),
    [enter, move, leave, toggle],
  );
  /** Keyboard: Enter or Space on a focused mark pins its card beside the mark. */
  const onKey = useCallback(
    (d: T) => (e: React.KeyboardEvent<Element>) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      const r = e.currentTarget.getBoundingClientRect();
      toggle(d, { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
    },
    [toggle],
  );

  return { tip, pin, pinned, bind, onKey, enter, move, leave, toggle, hide: pinHide };
}

/** The two cards of `useDotCard`: the hover preview and the pinned one, whose click or Enter calls `onActivate`. */
export function DotCardTooltips<T>({
  card,
  children,
  onActivate,
  canActivate,
  activateHint = "Open profile →",
}: {
  card: Pick<ReturnType<typeof useDotCard<T>>, "tip" | "pin" | "hide">;
  children: (data: T) => ReactNode;
  onActivate?: (data: T) => void;
  /** Gate the link per datum (a former member has no profile page). Default: every datum. */
  canActivate?: (data: T) => boolean;
  activateHint?: string;
}) {
  const open = card.pin.state;
  const linked = onActivate != null && open != null && (canActivate ? canActivate(open.data) : true);
  return (
    <>
      <Tooltip state={open ? null : card.tip.state}>{children}</Tooltip>
      <Tooltip
        state={open}
        onActivate={
          linked
            ? (d) => {
                card.hide();
                onActivate(d);
              }
            : undefined
        }
        activateHint={linked ? activateHint : undefined}
      >
        {children}
      </Tooltip>
    </>
  );
}

interface TooltipProps<T> {
  state: TooltipState<T> | null;
  children: (data: T) => ReactNode;
  /** Makes the card a pinned, clickable link-like target: it takes pointer events, and a click or Enter calls this
   *  (the scatters use it to open a member's profile from the card, not from the dot). */
  onActivate?: (data: T) => void;
  /** Small line under the content when `onActivate` is set, e.g. "Open profile →". */
  activateHint?: string;
}

const OFFSET = 14;
// Rough tooltip footprint, for the flip-at-edge heuristic. The member tooltip
// adds a ~40px photo, so the box runs a little wider and taller than the text.
const EST_W = 240;
const EST_H = 120;

const EDGE = 8;

export function Tooltip<T>({ state, children, onActivate, activateHint }: TooltipProps<T>) {
  // `state` starts null, so server and first client render both produce
  // nothing; the portal only appears after a client-side pointer interaction.
  if (!state || typeof document === "undefined") return null;
  return createPortal(
    <TooltipBox x={state.x} y={state.y} onActivate={onActivate ? () => onActivate(state.data) : undefined} hint={activateHint}>
      {children(state.data)}
    </TooltipBox>,
    document.body,
  );
}

/** Positions itself from the pointer using the estimate, then measures its real
 *  size and clamps fully inside the viewport (narrow phones, tall cards). */
function TooltipBox({ x, y, children, onActivate, hint }: { x: number; y: number; children: ReactNode; onActivate?: () => void; hint?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  let left = x + OFFSET;
  let top = y + OFFSET;
  if (left + EST_W > window.innerWidth) left = x - OFFSET - EST_W;
  if (top + EST_H > window.innerHeight) top = y - OFFSET - EST_H;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    let l = x + OFFSET;
    let t = y + OFFSET;
    if (l + width > vw - EDGE) l = x - OFFSET - width;
    if (t + height > vh - EDGE) t = y - OFFSET - height;
    el.style.left = `${Math.max(EDGE, Math.min(l, vw - width - EDGE))}px`;
    el.style.top = `${Math.max(EDGE, Math.min(t, vh - height - EDGE))}px`;
  });

  return (
    <div
      ref={ref}
      className={`chart-tooltip${onActivate ? " is-pinned" : ""}`}
      style={{ left, top }}
      data-pinned-tooltip={onActivate ? "" : undefined}
      role={onActivate ? "link" : undefined}
      tabIndex={onActivate ? 0 : undefined}
      onClick={onActivate}
      onKeyDown={onActivate ? (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onActivate()) : undefined}
    >
      {children}
      {onActivate && hint && <div className="tt-hint">{hint}</div>}
    </div>
  );
}

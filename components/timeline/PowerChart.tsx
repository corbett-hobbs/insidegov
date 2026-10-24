"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { dateOfDay, dayOf, dayOfIso } from "@/lib/indicator-time";
import { isPicked, type Picked } from "@/lib/multi-select";
import { fitTermLabel, initialsOf } from "@/lib/term-label";
import { timeAxisTicks } from "@/lib/time-axis-ticks";
import {
  TIMELINE_START,
  clipName,
  fmtMonth,
  lastName,
  leanSide,
  matchesQuery,
  placeMarkers,
  seatsLabel,
  statusNames,
  termYears,
  type CourtMode,
  type Kind,
  type PowerIndex,
  type PowerState,
  type Span,
} from "@/lib/timeline-derive";
import type { TimelinePayload, TlEvent, TlPresident } from "@/lib/timeline-types";
import { useElementWidth } from "@/lib/use-element-width";
import { TipCard } from "../charts/TipCard";
import { Tooltip, useStickyTooltip } from "../charts/Tooltip";
import { EventNotes } from "./EventNote";
import { FOCUS_RING, partyColor, partyTint } from "./shared";

export interface OpenNote {
  /** An event in the marker whose note is open; the note lists every event that marker holds. */
  no: number;
  /** Tapped or clicked (stays until a tap elsewhere, Esc or a scroll) rather than a mouse hover preview. */
  pinned: boolean;
  /** The event to highlight when a marker holds several (a jump from the era list or a link). */
  focus: number | null;
}

interface TipData {
  iso: string;
  px: number;
  onPres: boolean;
}

const NO_EVENTS: readonly TlEvent[] = [];
const NO_KINDS: Picked<Kind> = null;
const NO_NOTES: ReadonlyMap<string, TlEvent> = new Map();
const noop = () => {};

const ROWS = [
  ["one", 9, 6],
  ["P", 24, 4],
  ["S", 30, 4],
  ["H", 30, 4],
  ["C", 38, 12],
  ["law", 40, 4],
  ["case", 40, 4],
] as const;
type RowKey = (typeof ROWS)[number][0];
const LABELS: Record<RowKey, [string, string]> = {
  one: ["One party", "1 party"],
  P: ["President", "Pres."],
  S: ["Senate", "Senate"],
  H: ["House", "House"],
  C: ["Court", "Court"],
  law: ["Laws", "Laws"],
  case: ["Court cases", "Cases"],
};
/** Px a character of the 10.5px mono labels takes. */
const CHAR_W = 6.2;
const CELL_CHAR_W = 6;

const pres41 = (p: TlPresident) => (p.name === "George H. W. Bush" ? ["Bush 41"] : p.name === "George W. Bush" ? ["Bush 43"] : []);

/**
 * "Who held each branch": four rows for the four institutions on one time axis (the White House; each chamber's share of
 * seats by Congress; the Court's median lean or its appointees), a strip above them that fills while one party held them
 * all, and two rows of numbered event markers under them. Hover (or tap) the rows for who held power that month; tap a
 * president to zoom to their years; tap a marker to pin its note (rule 6). Every label shortens rather than vanishes.
 *
 * `compact` is the cut-down copy on the Presidents directory: the strip and the President, Senate and House rows only (no Court, no marker rows; the strip fills while one party held the White House and both chambers, and is tinted while it held one chamber), over a fixed
 * window that starts at `startIso`, with no zoom or pan. A tap on a president opens `presCard` (pinned, rule 10t) instead of zooming.
 */
export function PowerChart({
  data,
  idx,
  spans,
  mode,
  range,
  minYear,
  maxYear,
  onRange,
  events = NO_EVENTS,
  kinds = NO_KINDS,
  query = "",
  open = null,
  setOpen = noop,
  stateOf,
  byId = NO_NOTES,
  onJump = noop,
  compact = false,
  startIso = TIMELINE_START,
  endIso,
  presCard,
}: {
  data: TimelinePayload;
  idx: PowerIndex;
  spans: readonly Span[];
  mode: CourtMode;
  range: [number, number];
  minYear: number;
  maxYear: number;
  onRange: (r: [number, number]) => void;
  /** The events the Events filter and the status tiles let through (the year window is applied here). */
  events?: readonly TlEvent[];
  kinds?: Picked<Kind>;
  query?: string;
  open?: OpenNote | null;
  setOpen?: (o: OpenNote | null) => void;
  stateOf?: (e: TlEvent) => PowerState;
  byId?: ReadonlyMap<string, TlEvent>;
  onJump?: (no: number) => void;
  /** The directory's version: no marker rows, a tap on a president opens `presCard`. */
  compact?: boolean;
  /** The first day of the window (default: the timeline's start). */
  startIso?: string;
  /** The last day of the window (default: the end of the last year in `range`, or today). A president's snapshot ends on their last day in office. */
  endIso?: string;
  /** The card a tapped president opens (compact mode); it is the only thing that links on. */
  presCard?: (p: TlPresident) => ReactNode;
}) {
  const [wrapRef, W] = useElementWidth<HTMLDivElement>();
  const uid = useId().replace(/:/g, "");
  const tip = useStickyTooltip<TipData>();
  const phone = W > 0 && W < 600;
  const LG = phone ? 52 : 82;
  const pw = Math.max(0, W - LG - 8);
  const today = data.today;
  const v0 = range[0] === minYear ? dayOfIso(startIso) : dayOf(range[0], 0, 1);
  const v1 = Math.min(endIso ? dayOfIso(endIso) + 1 : dayOf(range[1] + 1, 0, 1), dayOfIso(today) + 1);
  const X = (day: number) => LG + ((day - v0) / (v1 - v0)) * pw;
  const XI = (iso: string) => X(dayOfIso(iso));
  const clipX = (iso: string) => Math.max(LG, Math.min(LG + pw, XI(iso)));
  const inWin = (a: string, b: string) => dayOfIso(b) > v0 && dayOfIso(a) < v1;
  const end = (iso: string | null) => (iso === null || iso > today ? today : iso);

  const rows = useMemo(() => {
    const r = {} as Record<RowKey, { y: number; h: number }>;
    let y = 0;
    for (const [k, h, gap] of ROWS) {
      if (compact && (k === "law" || k === "case" || k === "C")) continue;
      r[k] = { y, h };
      y += h + gap;
    }
    // Without the marker rows the axis sits straight under the Court row.
    if (compact) y = r.H.y + r.H.h + 6;
    return { r, axis: y, H: y + 18, last: compact ? r.H : r.C };
  }, [compact]);
  const R = rows.r;

  // Markers, per row, laid out for this width and window.
  const markers = useMemo(() => {
    if (pw <= 0 || compact) return { law: [], case: [] };
    const q = query.trim();
    const lay = (kind: Kind) =>
      placeMarkers(
        events.filter((e) => e.kind === kind && dayOfIso(e.date) >= v0 && dayOfIso(e.date) < v1).map((e) => ({ item: e, x: LG + ((dayOfIso(e.date) - v0) / (v1 - v0)) * pw })),
        LG,
        pw,
      ).map((m) => ({ ...m, hit: q ? m.items.some((e) => matchesQuery(e, q)) : null }));
    return { law: lay("law"), case: lay("case") };
  }, [events, v0, v1, LG, pw, query, compact]);
  const openMarker = open ? [...markers.law, ...markers.case].find((m) => m.items.some((e) => e.no === open.no)) : undefined;
  const openKind = openMarker?.items[0]?.kind;

  // Close a pinned note on a tap elsewhere, Esc or a scroll (rule 6). A note opened by a jump survives the jump's own scroll.
  const jumpedAt = useRef(0);
  useEffect(() => {
    if (open?.focus != null) jumpedAt.current = Date.now();
  }, [open?.focus, open?.no]);
  useEffect(() => {
    if (!open?.pinned) return;
    const away = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (t?.closest("[data-tl-note]") || t?.closest("[data-tl-marker]")) return;
      setOpen(null);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    const scroll = () => Date.now() - jumpedAt.current > 400 && setOpen(null);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", scroll, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("scroll", scroll);
    };
  }, [open?.pinned, setOpen]);

  // Compact mode: a tapped president pins a card that stays until a tap elsewhere, Esc or a scroll (rule 10t).
  const [presOpen, setPresOpen] = useState<TlPresident | null>(null);
  useEffect(() => {
    if (!presOpen) return;
    const away = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (t?.closest("[data-tl-prescard]") || t?.closest("[data-tl-pres]")) return;
      setPresOpen(null);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setPresOpen(null);
    const scroll = () => setPresOpen(null);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", scroll, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("scroll", scroll);
    };
  }, [presOpen]);

  // A note in a multi-event marker scrolls to the event it was opened for.
  const noteRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = noteRef.current;
    if (!box || open?.focus == null) return;
    const el = box.querySelector<HTMLElement>(`[data-no="${open.focus}"]`);
    if (el) box.scrollTop = el.offsetTop - 8;
  }, [open?.focus, open?.no, openMarker]);

  // The month under the pointer, on the four institution rows.
  const pointAt = (e: { clientX: number; clientY: number }, svg: SVGSVGElement): TipData | null => {
    const box = svg.getBoundingClientRect();
    const px = e.clientX - box.left;
    const py = e.clientY - box.top;
    if (px < LG || px > LG + pw || py > rows.last.y + rows.last.h + 2) return null;
    const day = v0 + ((px - LG) / pw) * (v1 - v0);
    const d = dateOfDay(Math.floor(day));
    let iso = `${d.year}-${String(d.month + 1).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
    if (iso > today) iso = today;
    if (iso < startIso) iso = startIso;
    return { iso, px, onPres: py >= R.P.y && py <= R.P.y + R.P.h };
  };
  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerType !== "mouse") return void onPan(e);
    if (open?.pinned) return;
    const p = pointAt(e, e.currentTarget);
    if (!p) return tip.hide();
    if (open) setOpen(null);
    tip.show(p, e);
  };
  // Zoomed to a window of years, a finger dragging sideways slides the window along (whole years, kept inside the data).
  const drag = useRef<{ x: number; r: [number, number]; moved: boolean } | null>(null);
  const zoomed = range[0] !== minYear || range[1] !== maxYear;
  const onDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    drag.current = e.pointerType !== "mouse" && zoomed ? { x: e.clientX, r: [range[0], range[1]], moved: false } : null;
  };
  const onPan = (e: ReactPointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d || pw <= 0) return false;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) < 8) return true;
    if (!d.moved) {
      d.moved = true;
      tip.hide();
      setOpen(null);
    }
    const span = d.r[1] - d.r[0];
    const from = Math.max(minYear, Math.min(maxYear - span, d.r[0] - Math.round((dx / pw) * (span + 1))));
    if (from !== range[0]) onRange([from, from + span]);
    return true;
  };
  const onUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerType === "mouse") return;
    if (drag.current?.moved) return;
    if ((e.target as Element).closest("[data-tl-marker],[data-tl-pres]")) return;
    const p = pointAt(e, e.currentTarget);
    if (!p) return;
    if (tip.state && tip.state.data.iso.slice(0, 7) === p.iso.slice(0, 7)) return tip.hide();
    setOpen(null);
    setPresOpen(null);
    tip.show(p, e);
  };

  const zoomTo = (p: TlPresident) => {
    const r = termYears(p, minYear, maxYear);
    if (compact) return void (tip.hide(), setPresOpen(presOpen === p ? null : p));
    tip.hide();
    setOpen(null);
    onRange(range[0] === r[0] && range[1] === r[1] ? [minYear, maxYear] : r);
  };

  const ticks = pw > 0 ? timeAxisTicks(v0, v1, pw) : [];
  const toggleNote = (no: number) => setOpen(open?.pinned && openMarker?.items.some((e) => e.no === no) ? null : { no, pinned: true, focus: null });
  const notesFor = openMarker ? openMarker.items : [];
  const noteW = Math.min(360, W - 12);
  const noteLeft = openMarker ? Math.max(6, Math.min(W - noteW - 6, openMarker.cx - noteW / 2)) : 0;
  const noteTop = openMarker && openKind ? R[openKind].y + 10 + openMarker.lane * 20 + 14 : 0;
  const names = statusNames(mode);

  return (
    <div ref={wrapRef} className="relative -mx-3 sm:mx-0" data-sticky-tip>
      {W > 0 && (
        <svg
          className="block w-full touch-pan-y overflow-visible"
          viewBox={`0 0 ${W} ${rows.H}`}
          height={rows.H}
          role="img"
          aria-label={compact ? "Who held the presidency, Senate and House over time" : "Who held the presidency, Senate, House and Supreme Court over time, with numbered laws and court cases"}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onClickCapture={(e) => drag.current?.moved && (e.stopPropagation(), (drag.current = null))}
          onPointerLeave={(e) => tip.leave(e)}
          onPointerUp={onUp}
        >
          <defs>
            <clipPath id={`tl-plot-${uid}`}>
              <rect x={LG} y={-2} width={pw} height={rows.H + 4} />
            </clipPath>
          </defs>
          {/* Row labels sit in the gutter (rule 10a). */}
          {ROWS.filter(([k]) => R[k]).map(([k]) => (
            <text key={k} x={LG - 6} y={R[k].y + R[k].h / 2 + 3.5} textAnchor="end" className="fill-ink-muted font-mono text-[10.5px]">
              {LABELS[k][phone ? 1 : 0]}
            </text>
          ))}
          <g clipPath={`url(#tl-plot-${uid})`}>
            {ticks.map((t) => (
              <g key={t.day}>
                <line x1={X(t.day)} x2={X(t.day)} y1={compact ? R.H.y + R.H.h + 2 : R.law.y - 4} y2={rows.axis} stroke="var(--line)" />
                <text x={X(t.day)} y={rows.axis + 13} textAnchor="middle" className={`font-mono text-[10.5px] ${t.major ? "fill-ink-muted" : "fill-ink-faint"}`}>
                  {t.label}
                </text>
              </g>
            ))}

            {/* One-party strip: solid while one party held all four, a tint while it held the White House and Congress only. */}
            {spans.map((sp) =>
              inWin(sp.from, sp.to) && (compact ? sp.st.P === sp.st.S || sp.st.P === sp.st.H : sp.st.status !== "split") ? (
                <rect key={sp.from} x={clipX(sp.from)} y={R.one.y} width={Math.max(0, clipX(sp.to) - clipX(sp.from))} height={R.one.h} fill={(compact ? sp.st.S === sp.st.P && sp.st.H === sp.st.P : sp.st.status === "all4") ? partyColor(sp.st.P) : partyTint(sp.st.P, compact ? 40 : 30)} />
              ) : null,
            )}

            {/* Presidents, in the term-band style (rule 10b); tap one to zoom to their years. */}
            {data.presidents.map((p) => {
              const e = end(p.end);
              if (!inWin(p.start, e)) return null;
              const a = clipX(p.start);
              const w = clipX(e) - a;
              const label = fitTermLabel(w, lastName(p.name), initialsOf(p.name), pres41(p), CHAR_W);
              return (
                <g
                  key={p.start}
                  data-tl-pres
                  className={compact ? "cursor-pointer focus-visible:outline-none" : "cursor-zoom-in"}
                  onClick={() => zoomTo(p)}
                  {...(compact
                    ? {
                        role: "button",
                        tabIndex: 0,
                        "aria-label": `${p.name}, ${p.start.slice(0, 4)}–${p.end ? p.end.slice(0, 4) : "now"}`,
                        "aria-expanded": presOpen === p,
                        onKeyDown: (ev: ReactKeyboardEvent) => (ev.key === "Enter" || ev.key === " ") && (ev.preventDefault(), zoomTo(p)),
                      }
                    : {})}
                >
                  <rect x={a + 0.5} y={R.P.y} width={Math.max(0, w - 1)} height={R.P.h} rx={2} fill={partyTint(p.party)} />
                  <rect x={a + 0.5} y={R.P.y} width={Math.max(0, w - 1)} height={2.5} fill={partyColor(p.party)} />
                  {presOpen === p && <rect x={a + 0.5} y={R.P.y} width={Math.max(0, w - 1)} height={R.P.h} rx={2} fill="none" stroke="var(--ink)" strokeWidth={1.5} />}
                  {label && (
                    <text x={a + w / 2} y={R.P.y + 16} textAnchor="middle" className="fill-ink font-sans text-[10.5px]">
                      {label}
                    </text>
                  )}
                </g>
              );
            })}

            <ShareRow
              r={R.S}
              cells={data.congresses.flatMap((c) =>
                c.senateMaj.map(([from], i) => ({ key: `${c.n}-${i}`, from, to: c.senateMaj[i + 1]?.[0] ?? end(c.end), seats: c.senate })),
              )}
              clipX={clipX}
              inWin={inWin}
            />
            <ShareRow r={R.H} cells={data.congresses.map((c) => ({ key: String(c.n), from: c.start, to: end(c.end), seats: c.house }))} clipX={clipX} inWin={inWin} />

            {compact ? null : mode === "appt" ? (
              <ApptRow r={R.C} spans={spans} clipX={clipX} inWin={inWin} />
            ) : (
              <LeanRow r={R.C} data={data} X={X} LG={LG} pw={pw} v0={v0} v1={v1} />
            )}
          </g>
          {/* Half-way lines and frames sit over the clipped rows. */}
          <rect x={LG} y={R.one.y} width={pw} height={R.one.h} fill="none" stroke="var(--line)" />
          {(["S", "H", ...(mode === "appt" && !compact ? (["C"] as const) : [])] as const).map((k) => (
            <line key={k} x1={LG} x2={LG + pw} y1={R[k].y + R[k].h / 2} y2={R[k].y + R[k].h / 2} stroke="var(--surface)" strokeDasharray="3 3" opacity={0.8} />
          ))}
          {mode === "lean" && !compact && <line x1={LG} x2={LG + pw} y1={R.C.y + R.C.h / 2} y2={R.C.y + R.C.h / 2} stroke="var(--ink-faint)" />}

          {/* Event markers, merged where they would touch: "22+4" is event 22 and four more. */}
          <g clipPath={`url(#tl-plot-${uid})`}>
            {(compact ? [] : (["law", "case"] as const)).map((kind) =>
              !isPicked(kinds, kind) ? (
                <text key={kind} x={LG + 4} y={R[kind].y + R[kind].h / 2 + 3.5} className="fill-ink-faint text-[10px]">
                  hidden by the Events filter
                </text>
              ) : (
                markers[kind].map((m) => {
                  const cy = R[kind].y + 10 + m.lane * 20;
                  const one = m.items.length === 1;
                  const on = openMarker === m;
                  const ring = on || m.hit === true;
                  const label = m.items.map((e) => e.name).join("; ");
                  return (
                    <g
                      key={m.items[0]!.no}
                      data-tl-marker
                      role="button"
                      tabIndex={0}
                      aria-label={`${m.label}: ${label}`}
                      aria-expanded={on}
                      className={`cursor-pointer focus-visible:outline-none ${m.hit === false ? "opacity-[0.22]" : ""}`}
                      onClick={(ev) => (ev.stopPropagation(), tip.hide(), toggleNote(m.items[0]!.no))}
                      onKeyDown={(ev) => (ev.key === "Enter" || ev.key === " ") && (ev.preventDefault(), toggleNote(m.items[0]!.no))}
                      onPointerEnter={(ev) => ev.pointerType === "mouse" && !open?.pinned && (tip.hide(), setOpen({ no: m.items[0]!.no, pinned: false, focus: null }))}
                      onPointerLeave={(ev) => ev.pointerType === "mouse" && open && !open.pinned && setOpen(null)}
                    >
                      {kind === "case" && one ? (
                        <circle cx={m.cx} cy={cy} r={9} fill="var(--ink)" stroke={ring ? "var(--accent)" : undefined} strokeWidth={2.5} />
                      ) : (
                        <rect x={m.cx - m.w / 2} y={cy - 9} width={m.w} height={18} rx={kind === "case" ? 9 : 3} fill="var(--ink)" stroke={ring ? "var(--accent)" : undefined} strokeWidth={2.5} />
                      )}
                      <text x={m.cx} y={cy + 3.3} textAnchor="middle" className="pointer-events-none fill-surface font-mono text-[9.5px] font-semibold">
                        {m.label}
                      </text>
                      {one && m.room >= 48 && (
                        <text x={m.cx + 13} y={cy + 3.6} className="pointer-events-none fill-ink-muted font-sans text-[10.5px]">
                          {clipName(m.items[0]!.name, Math.floor((m.room - 4) / 5.6))}
                        </text>
                      )}
                    </g>
                  );
                })
              ),
            )}
          </g>
          {tip.state && !open && <line x1={tip.state.data.px} x2={tip.state.data.px} y1={0} y2={rows.last.y + rows.last.h} stroke="var(--ink)" strokeDasharray="2 2" className="pointer-events-none" />}
        </svg>
      )}
      {openMarker && (
        <div
          ref={noteRef}
          data-tl-note
          role="dialog"
          aria-label={openMarker.items.length === 1 ? openMarker.items[0]!.name : `${openMarker.items.length} events`}
          className="absolute z-30 max-h-[340px] overflow-auto overscroll-contain rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-[0.8rem] leading-[1.45] shadow-[0_8px_24px_rgba(26,34,51,0.22)]"
          style={{ left: noteLeft, top: noteTop, width: noteW }}
          onPointerLeave={(ev) => ev.pointerType === "mouse" && open && !open.pinned && setOpen(null)}
        >
          <EventNotes items={notesFor} focus={open?.focus ?? null} byId={byId} onJump={onJump} stateOf={stateOf} mode={mode} />
          <button type="button" aria-label="Close" onClick={() => setOpen(null)} className={`absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded text-[1rem] leading-none text-ink-muted hover:text-ink ${FOCUS_RING}`}>
  ×
</button>
        </div>
      )}
      {compact && presOpen && presCard && (
        <PresCard p={presOpen} W={W} clipX={clipX} end={end} top={R.P.y + R.P.h + 6} onClose={() => setPresOpen(null)}>
          {presCard(presOpen)}
        </PresCard>
      )}
      {/* A tooltip and a note card are never on screen together (rule 6c). */}
      <Tooltip state={open || presOpen ? null : tip.state}>{(d) => <StateTip st={idx.stateAt(d.iso, mode)} mode={mode} onPres={d.onPres && !compact} compact={compact} status={names} events={events} zoomed={(p) => {
        const r = termYears(p, minYear, maxYear);
        return range[0] === r[0] && range[1] === r[1];
      }} />}</Tooltip>
    </div>
  );
}

/** The card a tapped president opens in compact mode: under their segment, kept inside the chart's width, closed by × (rule 10t). */
function PresCard({
  p,
  W,
  clipX,
  end,
  top,
  onClose,
  children,
}: {
  p: TlPresident;
  W: number;
  clipX: (iso: string) => number;
  end: (iso: string | null) => string;
  top: number;
  onClose: () => void;
  children: ReactNode;
}) {
  const width = Math.min(300, W - 12);
  const mid = (clipX(p.start) + clipX(end(p.end))) / 2;
  const left = Math.max(6, Math.min(W - width - 6, mid - width / 2));
  return (
    <div
      data-tl-prescard
      role="dialog"
      aria-label={p.name}
      className="absolute z-30 rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-[0.8rem] leading-[1.45] shadow-[0_8px_24px_rgba(26,34,51,0.22)]"
      style={{ left, top, width }}
    >
      {children}
      <button type="button" aria-label="Close" onClick={onClose} className={`absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded text-[1rem] leading-none text-ink-muted hover:text-ink ${FOCUS_RING}`}>
        ×
      </button>
    </div>
  );
}

function ShareRow({
  r,
  cells,
  clipX,
  inWin,
}: {
  r: { y: number; h: number };
  cells: { key: string; from: string; to: string; seats: [number, number, number] }[];
  clipX: (iso: string) => number;
  inWin: (a: string, b: string) => boolean;
}) {
  return (
    <>
      {cells.map(({ key, from, to, seats }) => {
        if (!inWin(from, to)) return null;
        const a = clipX(from);
        const w = Math.max(0, clipX(to) - a - 1);
        const [d, rr, o] = seats;
        const tot = d + rr + o;
        const hd = (r.h * d) / tot;
        const hr = (r.h * rr) / tot;
        const label = seatsLabel(seats);
        return (
          <g key={key}>
            <rect x={a + 0.5} y={r.y} width={w} height={r.h} fill="var(--oth)" />
            <rect x={a + 0.5} y={r.y + r.h - hd} width={w} height={hd} fill="var(--dem)" />
            <rect x={a + 0.5} y={r.y} width={w} height={hr} fill="var(--rep)" />
            {w >= label.length * CELL_CHAR_W + 6 && (
              <text x={a + 0.5 + w / 2} y={r.y + r.h / 2 + 3.5} textAnchor="middle" className="pointer-events-none fill-white font-mono text-[9.5px] font-medium">
                {label}
              </text>
            )}
          </g>
        );
      })}
    </>
  );
}

/** The Court by appointing party: the Democratic appointees' share of the sitting justices, with runs of the same split labelled where they fit. */
function ApptRow({ r, spans, clipX, inWin }: { r: { y: number; h: number }; spans: readonly Span[]; clipX: (iso: string) => number; inWin: (a: string, b: string) => boolean }) {
  const runs: { from: string; to: string; lab: string }[] = [];
  for (const sp of spans) {
    const c = sp.st.court;
    const lab = c.D >= c.R ? `${c.D}–${c.R}` : `${c.R}–${c.D}`;
    const last = runs[runs.length - 1];
    if (last && last.lab === lab) last.to = sp.to;
    else runs.push({ from: sp.from, to: sp.to, lab });
  }
  return (
    <>
      {spans.map((sp) => {
        if (!inWin(sp.from, sp.to)) return null;
        const a = clipX(sp.from);
        const w = Math.max(0, clipX(sp.to) - a);
        const c = sp.st.court;
        const hd = (r.h * c.D) / Math.max(1, c.D + c.R);
        return (
          <g key={sp.from}>
            <rect x={a} y={r.y} width={w + 0.4} height={r.h} fill="var(--rep)" />
            <rect x={a} y={r.y + r.h - hd} width={w + 0.4} height={hd} fill="var(--dem)" />
          </g>
        );
      })}
      {runs.map((run) => {
        const a = clipX(run.from);
        const w = clipX(run.to) - a;
        return w >= run.lab.length * CELL_CHAR_W + 8 ? (
          <text key={run.from} x={a + w / 2} y={r.y + r.h / 2 + 3.5} textAnchor="middle" className="pointer-events-none fill-white font-mono text-[9.5px] font-medium">
            {run.lab}
          </text>
        ) : null;
      })}
    </>
  );
}

/** The Court by its median justice's Martin-Quinn score, one bar a term: down for liberal, up for conservative, grey near the centre. */
function LeanRow({ r, data, X, LG, pw, v0, v1 }: { r: { y: number; h: number }; data: TimelinePayload; X: (day: number) => number; LG: number; pw: number; v0: number; v1: number }) {
  const mid = r.y + r.h / 2;
  // Median scores run about -1.1 to +1.1, so the bar's full height is +-1.15 (the old +-1.6 left every bar short in a tall, empty strip).
  const sc = (v: number) => mid - (Math.max(-1.15, Math.min(1.15, v)) / 1.15) * (r.h / 2);
  const cx = (day: number) => Math.max(LG, Math.min(LG + pw, X(day)));
  const firstTerm = dayOf(data.lean[0]![0], 9, 1);
  const noScoreW = cx(firstTerm) - LG;
  return (
    <>
      <rect x={LG} y={r.y} width={pw} height={r.h} fill="var(--surface-raised)" />
      {v0 < firstTerm && noScoreW > 0 && (
        <text x={LG + noScoreW / 2} y={mid + 3.5} textAnchor="middle" className="fill-ink-faint font-mono text-[9.5px]">
          {noScoreW > 60 ? "no score" : noScoreW > 22 ? "n/a" : ""}
        </text>
      )}
      {data.lean.map((l) => {
        const a = dayOf(l[0], 9, 1);
        const b = dayOf(l[0] + 1, 9, 1);
        if (b <= v0 || a >= v1) return null;
        const xa = cx(a);
        return <rect key={l[0]} x={xa} y={Math.min(mid, sc(l[1]))} width={Math.max(0, cx(b) - xa - 0.5)} height={Math.abs(sc(l[1]) - mid)} fill={partyColor(leanSide(l))} />;
      })}
    </>
  );
}

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;

/** The tooltip on the four rows: who held each institution that month (rule 6b), plus the term's counts on the president row. */
function StateTip({
  st,
  mode,
  onPres,
  status,
  events,
  zoomed,
  compact,
}: {
  compact: boolean;
  st: PowerState;
  mode: CourtMode;
  onPres: boolean;
  status: ReturnType<typeof statusNames>;
  events: readonly TlEvent[];
  zoomed: (p: TlPresident) => boolean;
}) {
  const { cong, court } = st;
  const tied = cong.senate[0] === cong.senate[1];
  const appt = court.D >= court.R ? `${court.D}–${court.R} Dem. appointees` : `${court.R}–${court.D} Rep. appointees`;
  const crt = mode === "lean" ? (st.lean ? `${{ D: "Liberal", R: "Conservative", T: "Centre", N: "" }[st.C]} median (${st.lean[2]})` : "No lean score before 1937") : appt;
  const p = st.pres;
  const evs = onPres ? events.filter((e) => e.date >= p.start && (p.end === null || e.date < p.end)) : [];
  const nl = evs.filter((e) => e.kind === "law").length;
  const nc = evs.length - nl;
  return (
    <TipCard
      title={fmtMonth(st.iso)}
      sub={compact ? `${ordinal(cong.n)} Congress` : `${ordinal(cong.n)} Congress · ${status[st.status].name}`}
      rows={[
        { key: "P", label: "President", value: p.name, color: partyColor(st.P) },
        { key: "S", label: "Senate", value: `${st.S} ${seatsLabel(cong.senate)}${tied ? " (tied)" : ""}`, color: partyColor(st.S) },
        { key: "H", label: "House", value: `${st.H} ${seatsLabel(cong.house)}`, color: partyColor(st.H) },
        { key: "C", label: "Court", value: crt, color: partyColor(st.C) },
      ].filter((r) => !compact || r.key !== "C")}
      extra={
        onPres
          ? [{ key: "t", label: `${lastName(p.name)}, ${p.start.slice(0, 4)}–${p.end ? p.end.slice(0, 4) : "now"}`, value: `${nl} law${nl === 1 ? "" : "s"}, ${nc} case${nc === 1 ? "" : "s"} · ${zoomed(p) ? "tap to show all years" : "tap to zoom in"}` }]
          : []
      }
    />
  );
}

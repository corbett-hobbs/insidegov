"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { isPicked, type Picked } from "@/lib/multi-select";
import { CLEMENCY_TERMS, OFFENSE_LABELS, type ClemencyGrant, type OffenseCategory } from "@/lib/clemency-types";
import { useClemencyGrants } from "./useClemencyGrants";
import { TYPE_COLOR, TYPE_ROW_LABEL, offenseColor, type ClemencyType, type OffensePick } from "./style";

const LABEL = new Map<string, string>(CLEMENCY_TERMS.map((t) => [t.id, t.label]));
const fmtDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const PAGE = 120;

function Row({ g }: { g: ClemencyGrant }) {
  const c = TYPE_COLOR[g.type];
  return (
    <li className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 border-b border-line px-5 py-2.5 last:border-0 sm:grid-cols-[6rem_minmax(0,1fr)_6rem_11.5rem]">
      <div className="text-[0.74rem] text-ink-muted sm:pt-0.5">{fmtDate(g.date)}</div>
      <div className="col-span-2 row-start-2 min-w-0 sm:col-span-1 sm:row-start-auto">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          {g.warrant ? (
            <a href={g.warrant} target="_blank" rel="noreferrer" className="text-[0.88rem] font-medium leading-snug text-ink hover:text-accent hover:underline">{g.name}</a>
          ) : (
            <span className="text-[0.88rem] font-medium leading-snug">{g.name}</span>
          )}
          <span className="rounded-full px-1.5 py-px text-[0.66rem] font-medium" style={{ background: `color-mix(in oklab, ${c} 24%, var(--surface))`, color: `color-mix(in oklab, ${c} 45%, var(--ink))` }}>
            {TYPE_ROW_LABEL[g.type]}
          </span>
          {g.district && <span className="text-[0.72rem] text-ink-faint">{g.district}</span>}
        </div>
        {g.offense && <p className="m-0 mt-0.5 text-[0.78rem] leading-[1.45] text-ink-muted">{g.offense}</p>}
        {g.sentence && <p className="m-0 mt-0.5 text-[0.72rem] leading-[1.4] text-ink-faint">{g.sentence}</p>}
        {g.amended && <p className="m-0 mt-0.5 text-[0.72rem] text-ink-faint">Amended warrant, not counted again.</p>}
      </div>
      <div className="col-span-2 row-start-3 text-[0.74rem] text-ink-muted sm:col-span-1 sm:row-start-auto sm:pt-0.5">{LABEL.get(g.term)}</div>
      <div className="col-start-2 row-start-1 flex items-start justify-end gap-1.5 text-right text-[0.74rem] text-ink-muted sm:col-start-auto sm:row-start-auto sm:pt-0.5">
        {g.category && (
          <>
            <span aria-hidden className="mt-1 inline-block size-2.5 flex-none rounded-[2px]" style={{ background: offenseColor(g.category) }} />
            {OFFENSE_LABELS[g.category]}
          </>
        )}
      </div>
    </li>
  );
}

export function GrantList({ query, range, fy, types, offenses, onClearFy }: { query: string; range: readonly [number, number]; fy: number | null; types: Picked<ClemencyType>; offenses: Picked<OffensePick>; onClearFy: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && setNear(true), { rootMargin: "800px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const { rows, failed } = useClemencyGrants(near);
  const words = useMemo(() => query.trim().toLowerCase().split(/\s+/).filter(Boolean), [query]);
  const searchable = useMemo(() => rows?.map((g) => `${g.name} ${g.offense} ${g.district}`.toLowerCase()) ?? [], [rows]);
  const shown = useMemo(() => {
    if (!rows) return [];
    return rows.filter((g, i) => {
      if (g.fy < range[0] || g.fy > range[1] || (fy != null && g.fy !== fy) || !isPicked(types, g.type)) return false;
      if (offenses && !isPicked(offenses, (g.category ?? "none") as OffenseCategory | "none")) return false;
      return words.every((w) => searchable[i]!.includes(w));
    });
  }, [rows, searchable, range, fy, types, offenses, words]);
  const [limit, setLimit] = useState(PAGE);
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new filter starts the rows over
    setLimit(PAGE);
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [shown]);
  const groupOnly = types != null && types.size === 1 && types.has("g");
  return (
    <div ref={hostRef} className="mt-2 overflow-hidden rounded-lg border border-line">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line px-5 py-3">
        <h3 className="m-0 font-serif text-[1.05rem] font-medium">
          {rows ? (groupOnly ? "Group grants" : `${shown.length.toLocaleString("en-US")} ${shown.length === 1 ? "row" : "rows"}${fy != null ? `, fiscal ${fy}` : ""}`) : "Loading the list…"}
        </h3>
        {fy != null && <button type="button" onClick={onClearFy} className="text-[0.78rem] font-medium text-accent hover:underline">Show all years</button>}
      </div>
      <div className="border-b border-line bg-surface-raised px-5 py-2 text-[0.78rem] text-ink-muted">
        Newest first. A group row stands for everyone on that warrant or proclamation. Most names on Biden’s two group grants aren’t listed here, because DOJ publishes them only as scanned warrants; those rows link to the warrants, and the people still count in the totals.
      </div>
      {failed ? (
        <p className="m-0 px-5 py-4 text-[0.85rem] text-ink-muted">The list didn’t load. Refresh the page to try again.</p>
      ) : (
        <ol
          ref={listRef}
          tabIndex={0}
          aria-label="Clemency grants, scrollable"
          onScroll={(e) => {
            const o = e.currentTarget;
            if (o.scrollTop + o.clientHeight > o.scrollHeight - 400) setLimit((n) => n + PAGE);
          }}
          className="touch-scroll relative m-0 max-h-[32rem] list-none overflow-y-auto overflow-x-hidden overscroll-contain p-0"
        >
          {shown.slice(0, limit).map((g) => <Row key={g.id} g={g} />)}
          {rows && shown.length === 0 && <li className="px-5 py-4 text-[0.85rem] text-ink-muted">No grants match. Try a surname or a single word.</li>}
        </ol>
      )}
    </div>
  );
}

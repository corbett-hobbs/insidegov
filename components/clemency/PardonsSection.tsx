"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChartCard } from "@/components/charts/ChartCard";
import { ChartNotesRow } from "@/components/charts/ChartNotesRow";
import { useTakeawayContext } from "@/components/charts/ContextLine";
import { FilterCaption } from "@/components/charts/FilterBarParts";
import { LegendToggle } from "@/components/charts/LegendToggle";
import { LEGEND_ITEM, LEGEND_ROW } from "@/components/charts/legend";
import { MultiSelectFilter, type MultiOption } from "@/components/charts/MultiSelectFilter";
import { PillGroup } from "@/components/charts/PillGroup";
import { SectionFilterRow } from "@/components/charts/SectionFilterRow";
import { StackedBars, type StackBand, type StackColumn, type StackSeries } from "@/components/charts/StackedBars";
import { TABLE_TOGGLE } from "@/components/charts/table-toggle";
import { TipCard } from "@/components/charts/TipCard";
import { Tooltip, useStickyTooltip, useTooltip } from "@/components/charts/Tooltip";
import { useElementWidth } from "@/lib/use-element-width";
import { termSegments, TermBandSvg, TERM_BAND_H } from "@/components/charts/TermBandSvg";
import { ListSearch } from "@/components/ListSearch";
import { MethodologyNote } from "@/components/MethodologyNote";
import { SourceLink } from "@/components/SourceLink";
import { isOnly, isPicked, toggleOnly, type Picked } from "@/lib/multi-select";
import { toggleTermWindow } from "@/lib/term-window";
import { OFFENSE_CATEGORIES, OFFENSE_LABELS, TIMING_BUCKETS, type ClemencyPayload, type ClemencyPresident, type ClemencyProclamation, type TimingBucket } from "@/lib/clemency-types";
import { GrantList } from "./GrantList";
import { TYPES, TYPE_COLOR, TYPE_LABEL, offenseColor, type ClemencyType, type OffensePick } from "./style";
import { CLEMENCY_TAKEAWAYS as T, HERO_CONTEXT } from "./takeaways";

const n0 = (n: number) => Math.round(n).toLocaleString("en-US");
const pct = (a: number, b: number) => `${Math.round((a / (b || 1)) * 100)}%`;
const TIMING_LABEL: Record<TimingBucket, string> = { first: "First year", middle: "Middle of term", finalYear: "Final year, before the last 90 days", last90: "Last 90 days" };
const TIMING_COLOR: Record<TimingBucket, string> = { first: "var(--offense-immigration)", middle: "var(--clem-closed)", finalYear: "var(--clem-denied)", last90: "var(--offense-violent)" };
const yearsOf = (p: ClemencyPresident) => p.months / 12;

function Key({ items }: { items: readonly (readonly [string, string])[] }) {
  return (
    <div className={`${LEGEND_ROW} mb-2`}>
      {items.map(([label, color]) => (
        <span key={label} className={LEGEND_ITEM}>
          <span aria-hidden className="inline-block size-2.5 rounded-[2px]" style={{ background: color }} />
          {label}
        </span>
      ))}
    </div>
  );
}

type Tip = { title: string; value: string; sub: string; rows: { label: string; value: string; color: string }[] };

/** One president per row, newest first. A tap on a row edits the window, as the term band does; hover or tap opens the row's card. */
function PresidentRows({ data, inWindow, onTerm, bar, figure, tip }: { data: readonly ClemencyPresident[]; inWindow: (p: ClemencyPresident) => boolean; onTerm: (p: ClemencyPresident) => void; bar: (p: ClemencyPresident) => ReactNode; figure?: (p: ClemencyPresident) => string; tip: (p: ClemencyPresident) => Tip | null }) {
  const t = useStickyTooltip<Tip>();
  return (
    <div data-sticky-tip className="flex flex-col">
      {[...data].reverse().map((p) => {
        const card = tip(p);
        return (
          <button
            key={p.term}
            type="button"
            onClick={() => onTerm(p)}
            onPointerEnter={card ? (e) => t.show(card, e) : undefined}
            onPointerMove={card ? (e) => t.move(e) : undefined}
            onPointerLeave={card ? () => t.hide() : undefined}
            aria-label={`${p.label}${figure ? `: ${figure(p)}` : ""}. Show these years.`}
            className={`grid h-[26px] w-full cursor-pointer grid-cols-[5.6rem_minmax(0,1fr)_3.2rem] items-center gap-2 border-0 bg-transparent p-0 text-left text-[0.76rem] text-ink ${inWindow(p) ? "" : "opacity-35"}`}
          >
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              <span aria-hidden className="inline-block size-2 rounded-full" style={{ background: p.party === "D" ? "var(--dem)" : "var(--rep)" }} />
              {p.label}
            </span>
            <span className="relative block h-4 min-w-0">{bar(p)}</span>
            <span className="text-right font-mono text-[0.7rem] tabular-nums text-ink-muted">{figure?.(p) ?? ""}</span>
          </button>
        );
      })}
      <Tooltip state={t.state}>{(d: Tip) => <TipCard title={d.title} value={d.value} sub={d.sub} rows={d.rows.map((r) => ({ key: r.label, label: r.label, value: r.value, color: r.color }))} />}</Tooltip>
    </div>
  );
}

function Stack({ segs }: { segs: readonly { w: number; color: string; dim?: boolean }[] }) {
  return (
    <span className="flex h-full w-full overflow-hidden rounded-[2px]">
      {segs.map((s, i) => (s.w > 0 ? <span key={i} style={{ width: `${s.w * 100}%`, background: s.color, opacity: s.dim ? 0.18 : 1 }} /> : null))}
    </span>
  );
}

function PetitionsChart({ data, from, to, terms, onTerm, min, max }: { data: ClemencyPayload["pending"]; from: number; to: number; terms: readonly ClemencyPresident[]; onTerm: (r: [number, number]) => void; min: number; max: number }) {
  const [ref, measured] = useElementWidth<HTMLDivElement>();
  const W = measured || 500;
  const tip = useTooltip<{ fy: number; value: number }>();
  const pts = data.filter((d) => d.fy >= from && d.fy <= to);
  const L = 44, R = 8, T = 10, AX = 16, H = 132;
  const slots = to - from + 1;
  const step = (W - L - R) / slots;
  const X = (fy: number) => L + (fy - from + 0.5) * step;
  if (pts.length < 2) return <p className="m-0 text-[0.85rem] text-ink-muted">No petition figures for these years.</p>;
  const mx = Math.ceil(Math.max(...pts.map((p) => p.value)) / 5000) * 5000;
  const Y = (v: number) => T + H - (v / mx) * H;
  const peak = pts.reduce((m, p) => (p.value > m.value ? p : m), pts[0]!);
  const low = pts.reduce((m, p) => (p.value < m.value ? p : m), pts[0]!);
  const termAt = (slot: number) => {
    const fy = from + slot;
    const p = [...terms].reverse().find((t) => fy >= t.firstFy && fy <= t.lastFy);
    return p ? { id: p.term, last: p.label.replace(/ \(.*/, ""), president: p.president, party: p.party } : null;
  };
  const every = slots > 16 ? 5 : slots > 8 ? 2 : 1;
  return (
    <div ref={ref} className="-mx-3 sm:mx-0" data-sticky-tip>
      <svg width={W} height={T + H + AX + TERM_BAND_H + 4} role="img" aria-label="Line of pending clemency petitions by fiscal year" className="chart-svg block">
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={L} x2={W - R} y1={Y(mx * f)} y2={Y(mx * f)} stroke="var(--line)" strokeDasharray={f ? "2 3" : undefined} />
            <text x={L - 6} y={Y(mx * f) + 3.5} textAnchor="end" fontSize={10.5} className="fill-ink-muted font-mono">{mx * f >= 1000 ? `${(mx * f) / 1000}k` : mx * f}</text>
          </g>
        ))}
        {pts.filter((p) => p.fy % every === 0).map((p) => (
          <text key={p.fy} x={X(p.fy)} y={T + H + 12} textAnchor="middle" fontSize={10.5} className="fill-ink-muted font-mono">{p.fy}</text>
        ))}
        <path d={`M${pts.map((p) => `${X(p.fy)} ${Y(p.value)}`).join("L")}`} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />
        {[peak, low].map((p, i) => (
          <g key={i} pointerEvents="none">
            <circle cx={X(p.fy)} cy={Y(p.value)} r={3.5} fill="var(--accent)" />
            <text x={X(p.fy) + (X(p.fy) > W / 2 ? -6 : 6)} y={Y(p.value) + (i ? -6 : 3)} textAnchor={X(p.fy) > W / 2 ? "end" : "start"} fontSize={11} className="fill-ink">{`${p.value.toLocaleString("en-US")} in ${p.fy}`}</text>
          </g>
        ))}
        {pts.map((p) => (
          <rect key={p.fy} x={X(p.fy) - step / 2} y={T} width={step} height={H} fill="transparent" onPointerEnter={(e) => tip.show(p, e)} onPointerMove={(e) => tip.move(e)} onPointerLeave={() => tip.hide()} />
        ))}
        <TermBandSvg segments={termSegments(slots, termAt)} x0={L} step={step} y={T + H + AX} select={{ min, max, value: [from, to], onChange: onTerm, axis: (slot) => from + slot, extent: (id) => { const t = terms.find((x) => x.term === id); return t ? [t.firstFy, Math.min(t.lastFy, max)] : undefined; } }} />
      </svg>
      <Tooltip state={tip.state}>{(d: { fy: number; value: number }) => <TipCard title={`FY${d.fy}`} value={d.value.toLocaleString("en-US")} sub="petitions pending at the start of the year" />}</Tooltip>
    </div>
  );
}

export function PardonsSection({ data, range, onRange, heading }: { data: ClemencyPayload; range: [number, number]; onRange: (r: [number, number]) => void; heading: ReactNode }) {
  const [types, setTypes] = useState<Picked<ClemencyType>>(null);
  const [offenses, setOffenses] = useState<Picked<OffensePick>>(null);
  const [fy, setFy] = useState<number | null>(null);
  const [perYear, setPerYear] = useState<"total" | "rate">("total");
  const [query, setQuery] = useState("");
  const [note, setNote] = useState<{ x: number; y: number; data: ClemencyProclamation & { n: number } } | null>(null);
  // A marker's note stays open until a tap elsewhere, Esc or a scroll (rule 6).
  const noteOpen = note != null;
  useEffect(() => {
    if (!noteOpen) return;
    const close = () => setNote(null);
    const away = (e: PointerEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest("[data-note-hit], .chart-tooltip")) close();
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", close, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("scroll", close);
    };
  }, [noteOpen]);
  const [from, to] = range;
  const min = data.firstFy, max = data.lastFy;
  const pres = data.presidents;
  const extents = useMemo(() => pres.map((p) => ({ from: p.firstFy, to: Math.min(p.lastFy, max) })), [pres, max]);
  const onTerm = (p: ClemencyPresident) => onRange(toggleTermWindow(extents, pres.indexOf(p), min, max, range) as [number, number]);
  const inWindow = (p: ClemencyPresident) => p.lastFy >= from && p.firstFy <= to;
  const hero = useTakeawayContext(T.hero.takeaway, HERO_CONTEXT);

  const series = useMemo<StackSeries[]>(() => TYPES.filter((t) => isPicked(types, t)).map((t) => ({ id: t, label: TYPE_LABEL[t], fill: TYPE_COLOR[t] })), [types]);
  const columns = useMemo<StackColumn[]>(() => {
    const out: StackColumn[] = [];
    for (let y = from; y <= to; y++) {
      const here = data.years.filter((r) => r.fy === y);
      const values: Record<ClemencyType, number> = { p: here.reduce((n, r) => n + r.pardons, 0), c: here.reduce((n, r) => n + r.commutations, 0), g: here.reduce((n, r) => n + r.group, 0) };
      out.push({ key: String(y), label: String(y), total: TYPES.reduce((n, t) => n + (isPicked(types, t) ? values[t] : 0), 0), values });
    }
    return out;
  }, [data.years, from, to, types]);
  const bands = useMemo<StackBand[]>(() => {
    const dateAt = (iso: string) => {
      const [yy, mm, dd] = iso.split("-").map(Number) as [number, number, number];
      return yy - from + (mm - 1 + (dd - 1) / 30 + 3) / 12;
    };
    return pres.flatMap((p, i) => {
      const a = Math.max(0, dateAt(TERM_START[p.term]!));
      const next = pres[i + 1];
      const b = next ? Math.min(columns.length, dateAt(TERM_START[next.term]!)) : columns.length;
      return b > a ? [{ id: p.term, label: p.label.replace(/ \(.*/, ""), president: p.president, from: a, to: b, fill: p.party === "D" ? "var(--dem)" : "var(--rep)" }] : [];
    });
  }, [pres, from, columns.length]);
  const markers = data.proclamations.map((p, i) => ({ ...p, n: i + 1, fy: Number(p.date.slice(0, 4)) + (Number(p.date.slice(5, 7)) >= 10 ? 1 : 0) }));

  const typeOptions = useMemo<MultiOption<ClemencyType>[]>(() => TYPES.map((t) => ({ id: t, label: TYPE_LABEL[t], swatch: TYPE_COLOR[t], count: t === "g" ? undefined : n0(pres.reduce((n, p) => n + (t === "p" ? p.pardons : p.commutations), 0)) })), [pres]);
  const offenseOptions = useMemo<MultiOption<OffensePick>[]>(() => [...OFFENSE_CATEGORIES.map((c) => ({ id: c as OffensePick, label: OFFENSE_LABELS[c], swatch: offenseColor(c), count: n0(pres.reduce((n, p) => n + p.offense.counts[c], 0)) })), { id: "none" as OffensePick, label: "None listed", swatch: "var(--line-strong)" }], [pres]);
  const maxPres = Math.max(...pres.map((p) => (perYear === "rate" ? p.total / yearsOf(p) : p.total)));
  const ageMax = 35;

  return (
    <div className="flex flex-col gap-3">
      {heading}
      <SectionFilterRow>
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
          <FilterCaption>Type</FilterCaption>
          <MultiSelectFilter label="Type" noun="types" options={typeOptions} value={types} onChange={setTypes} className="min-w-0 flex-1 sm:w-[11rem] sm:flex-none" />
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
          <FilterCaption>Offense</FilterCaption>
          <MultiSelectFilter label="Offense" noun="offenses" options={offenseOptions} value={offenses} onChange={setOffenses} className="min-w-0 flex-1 sm:w-[13rem] sm:flex-none" />
        </div>
      </SectionFilterRow>
      <div className="flex flex-col gap-6">
        <ChartCard id="clemency-grants-per-fiscal-year" title={T.hero.title} takeaway={hero.takeaway}>
          {hero.panel}
          <div role="group" aria-label="Show only a type" className={`${LEGEND_ROW} mb-3`}>
            {TYPES.map((t) => (
              <LegendToggle key={t} active={isOnly(types, t)} dimmed={!isPicked(types, t)} onClick={() => setTypes(toggleOnly(types, t))} title={isOnly(types, t) ? "Click to show every type again" : "Click to show only this type"}>
                <span aria-hidden className="inline-block size-2.5 rounded-[2px]" style={{ background: TYPE_COLOR[t] }} />
                {TYPE_LABEL[t]}
              </LegendToggle>
            ))}
          </div>
          <StackedBars
            columns={columns}
            series={series}
            mode="count"
            highlight={null}
            selectedKey={fy == null ? null : String(fy)}
            onSelect={(k) => setFy(k == null ? null : Number(k))}
            bands={bands}
            bandSelect={{ min, max, value: range, onChange: onRange, extent: (id) => { const p = pres.find((x) => x.term === id); return p ? [p.firstFy, Math.min(p.lastFy, max)] : undefined; } }}
            marginTop={44}
            yAxisLabel="CLEMENCY GRANTS"
            unit="grants"
            ariaLabel={`Stacked columns of clemency grants per fiscal year, ${from} to ${to}. Select a column to narrow the list below.`}
            renderTooltip={(c) => (
              <TipCard title={`FY${c.label}`} value={n0(c.total)} sub={pres.filter((p) => Number(c.label) >= p.firstFy && Number(c.label) <= p.lastFy && data.years.some((y) => y.term === p.term && y.fy === Number(c.label))).map((p) => p.label).join(", ")} rows={[...series].reverse().filter((s) => c.values[s.id]).map((s) => ({ key: s.id, label: s.label, value: n0(c.values[s.id] ?? 0), color: s.fill }))} />
            )}
            overlay={({ xOf, step, y }) => {
              let lastX = -99, row = 0;
              return markers.filter((m) => m.fy >= from && m.fy <= to).map((m) => {
                const col = columns[m.fy - from]!;
                const cx = xOf(m.fy - from) + step / 2;
                row = cx - lastX < 18 ? row + 1 : 0;
                lastX = cx;
                const base = y(col.total);
                // The tallest column carries its peak label, so its marker sits above that.
                const tallest = col.total === Math.max(...columns.map((c) => c.total));
                const cy = Math.max(base - (tallest ? 28 : 12) - row * 18, -22);
                const open = (e: { currentTarget: Element }) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  setNote(note?.data.n === m.n ? null : { x: r.left + r.width / 2, y: r.top, data: m });
                };
                return (
                  <g key={m.n} data-note-hit role="button" tabIndex={0} aria-label={`Note ${m.n}: ${m.title}`} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); open(e); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(e); } if (e.key === "Escape") setNote(null); }} onPointerDown={(e) => e.stopPropagation()}>
                    <line x1={cx} x2={cx} y1={cy + 8} y2={base} stroke="var(--ink-muted)" />
                    <circle cx={cx} cy={cy} r={8} fill="var(--surface)" stroke="var(--ink)" />
                    <text x={cx} y={cy + 3.5} textAnchor="middle" fontSize={10} className="fill-ink font-mono">{m.n}</text>
                  </g>
                );
              });
            }}
          />
          <Tooltip state={note}>
            {(d: ClemencyProclamation & { n: number }) => (
              <div className="max-w-[17rem]">
                <TipCard title={d.title} sub={`Proclamation ${d.number}, ${new Date(`${d.date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`} />
                <p className="m-0 mt-1 text-[0.76rem] leading-snug">{d.body}</p>
                <a href={d.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[0.76rem] underline underline-offset-2">Read the source</a>
              </div>
            )}
          </Tooltip>
          <ChartNotesRow className="mt-auto">
            <MethodologyNote>
              <p>
                Grants counted from warrants by the Justice Department’s <SourceLink id="doj-clemency-statistics">Office of the Pardon Attorney</SourceLink>, fiscal 1993 to January 2025, then counted from its <SourceLink id="doj-clemency-trump-2025">list of Trump’s grants</SourceLink>. Group means Biden’s warrants (DOJ’s count), the January 6 proclamation (about 1,500, a reported figure with no official count) and the 2020 election proclamation (77 named). Biden’s marijuana proclamations have no count, so they are markers, not bars. Fiscal 1993 counts from Clinton’s first day, leaving out George H.W. Bush’s 38 grants that year. Clinton’s first grants came in fiscal 1995.
              </p>
            </MethodologyNote>
            <details className="mt-2">
              <summary className={TABLE_TOGGLE}>View as table</summary>
              <div className="mt-2 max-h-80 overflow-auto rounded-md border border-line">
                <table className="w-full border-collapse text-[0.78rem]">
                  <thead className="sticky top-0 bg-surface-raised"><tr>{["FY", "President", "Pardons", "Commutations", "Group"].map((h) => <th key={h} scope="col" className="border-b border-line px-2 py-1.5 text-left font-mono text-[0.65rem] uppercase tracking-[0.05em] text-ink-faint">{h}</th>)}</tr></thead>
                  <tbody>{[...data.years].reverse().map((y) => <tr key={`${y.fy}-${y.term}`} className="border-b border-line last:border-0"><th scope="row" className="px-2 py-1 text-left font-medium">{y.fy}</th><td className="px-2 py-1">{pres.find((p) => p.term === y.term)?.label}</td><td className="px-2 py-1 tabular-nums">{n0(y.pardons)}</td><td className="px-2 py-1 tabular-nums">{n0(y.commutations)}</td><td className="px-2 py-1 tabular-nums">{n0(y.group)}</td></tr>)}</tbody>
                </table>
              </div>
            </details>
          </ChartNotesRow>
        </ChartCard>

        <Pair label="President by president">
          <ChartCard id="grants-by-president" title={T.presidents.title} takeaway={T.presidents.takeaway} action={<PillGroup ariaLabel="Measure" options={[{ value: "total", label: "Total" }, { value: "rate", label: "Per year" }] as const} value={perYear} onChange={setPerYear} />}>
            <Key items={TYPES.map((t) => [TYPE_LABEL[t], TYPE_COLOR[t]] as const)} />
            <PresidentRows
              data={pres}
              inWindow={inWindow}
              onTerm={onTerm}
              figure={(p) => (perYear === "rate" ? n0(p.total / yearsOf(p)) : n0(p.total))}
              bar={(p) => {
                const s = (perYear === "rate" ? 1 / yearsOf(p) : 1) / maxPres;
                return <Stack segs={[{ w: p.pardons * s, color: TYPE_COLOR.p, dim: !isPicked(types, "p") }, { w: p.commutations * s, color: TYPE_COLOR.c, dim: !isPicked(types, "c") }, { w: p.group * s, color: TYPE_COLOR.g, dim: !isPicked(types, "g") }]} />;
              }}
              tip={(p) => ({ title: p.label, value: n0(p.total), sub: `${Math.round(p.months)} months in office`, rows: [{ label: "Group grants", value: n0(p.group), color: TYPE_COLOR.g }, { label: "Commutations", value: n0(p.commutations), color: TYPE_COLOR.c }, { label: "Pardons", value: n0(p.pardons), color: TYPE_COLOR.p }] })}
            />
            <ChartNotesRow className="mt-auto">
              <MethodologyNote><p>Same counts as the chart above, by the president who signed. Per year divides by months in office, and Trump’s second term is still under way. <SourceLink id="doj-clemency-statistics">DOJ’s figures</SourceLink> back to 1900 show no larger total; Franklin Roosevelt’s 3,307 comes closest.</p></MethodologyNote>
            </ChartNotesRow>
          </ChartCard>
          <ChartCard id="what-happened-to-petitions" title={T.outcomes.title} takeaway={T.outcomes.takeaway}>
            <Key items={[["Granted", TYPE_COLOR.p], ["Denied", "var(--clem-denied)"], ["Closed without action", "var(--clem-closed)"]]} />
            <PresidentRows
              data={pres}
              inWindow={inWindow}
              onTerm={onTerm}
              figure={(p) => (p.outcome ? `${Math.round(p.outcome.share * 100)}%` : "–")}
              bar={(p) => {
                if (!p.outcome) return <span className="text-[0.72rem] text-ink-faint">DOJ hasn’t published these yet</span>;
                const all = p.outcome.granted + p.outcome.denied + p.outcome.closed;
                return <Stack segs={[{ w: p.outcome.granted / all, color: TYPE_COLOR.p }, { w: p.outcome.denied / all, color: "var(--clem-denied)" }, { w: p.outcome.closed / all, color: "var(--clem-closed)" }]} />;
              }}
              tip={(p) => (p.outcome ? { title: p.label, value: `${Math.round(p.outcome.share * 100)}% granted`, sub: `${n0(p.outcome.granted + p.outcome.denied + p.outcome.closed)} petitions decided`, rows: [{ label: "Granted", value: n0(p.outcome.granted), color: TYPE_COLOR.p }, { label: "Denied", value: n0(p.outcome.denied), color: "var(--clem-denied)" }, { label: "Closed without action", value: n0(p.outcome.closed), color: "var(--clem-closed)" }] } : null)}
            />
            <ChartNotesRow className="mt-auto">
              <MethodologyNote><p>Grants as a share of grants, denials and petitions closed without presidential action (a death, a release, or another administrative reason). A grant to someone who never petitioned still counts as granted, so this runs high for presidents who went around the office: of Trump’s 238 first-term grants, 129 applied through it, per <SourceLink id="doj-clemency-past">DOJ</SourceLink>. DOJ hasn’t published these figures for the current term.</p></MethodologyNote>
            </ChartNotesRow>
          </ChartCard>
        </Pair>

        <Pair label="What for, and when">
          <ChartCard id="what-the-offenses-were" title={T.offenses.title} takeaway={T.offenses.takeaway}>
            <Key items={OFFENSE_CATEGORIES.map((c) => [OFFENSE_LABELS[c], offenseColor(c)] as const)} />
            <PresidentRows
              data={pres}
              inWindow={inWindow}
              onTerm={onTerm}
              figure={(p) => n0(p.offense.n)}
              bar={(p) => <Stack segs={OFFENSE_CATEGORIES.map((c) => ({ w: p.offense.counts[c] / (p.offense.n || 1), color: offenseColor(c), dim: !isPicked(offenses, c) }))} />}
              tip={(p) => ({ title: p.label, value: n0(p.offense.n), sub: "grants with an offense listed", rows: [...OFFENSE_CATEGORIES].filter((c) => p.offense.counts[c]).sort((a, b) => p.offense.counts[b] - p.offense.counts[a]).map((c) => ({ label: OFFENSE_LABELS[c], value: pct(p.offense.counts[c], p.offense.n), color: offenseColor(c) })) })}
            />
            <ChartNotesRow className="mt-auto">
              <MethodologyNote><p>Each grant takes the category of the first offense listed. Categories are classifier-assigned: a language model read each offense on <SourceLink id="doj-clemency-recipients">DOJ’s lists</SourceLink> and had to quote the words it relied on. Biden’s row covers his individual grants and 561 people on one group warrant; the other 3,428 on his group warrants, and the proclamations, have no listed offense. Other includes military, draft and clinic-access convictions.</p></MethodologyNote>
            </ChartNotesRow>
          </ChartCard>
          <ChartCard id="when-in-the-term" title={T.timing.title} takeaway={T.timing.takeaway}>
            <Key items={TIMING_BUCKETS.map((b) => [TIMING_LABEL[b], TIMING_COLOR[b]] as const)} />
            <PresidentRows
              data={pres}
              inWindow={inWindow}
              onTerm={onTerm}
              figure={(p) => (p.term === "trump2" ? "–" : pct(p.timing.counts.last90, p.timing.n))}
              bar={(p) => <Stack segs={TIMING_BUCKETS.map((b) => ({ w: p.timing.counts[b] / (p.timing.n || 1), color: TIMING_COLOR[b] }))} />}
              tip={(p) => ({ title: p.label, value: n0(p.timing.n), sub: "grants by when they were made", rows: [...TIMING_BUCKETS].reverse().filter((b) => p.timing.counts[b]).map((b) => ({ label: TIMING_LABEL[b], value: pct(p.timing.counts[b], p.timing.n), color: TIMING_COLOR[b] })) })}
            />
            <ChartNotesRow className="mt-auto">
              <MethodologyNote><p>Share of each president’s grants by date, including group warrants and the January 6 and 2020 election proclamations; the figure at the right is the last 90 days. Trump’s second term is unfinished. Dates come from <SourceLink id="doj-clemency-recipients">DOJ’s recipient lists</SourceLink>, which date 18 of George W. Bush’s pardons January 1, 2009; they fall in his last 90 days whatever the true date.</p></MethodologyNote>
            </ChartNotesRow>
          </ChartCard>
        </Pair>

        <Pair label="The convictions and the queue">
          <ChartCard id="years-from-sentence-to-pardon" title={T.age.title} takeaway={T.age.takeaway}>
            <div className={`${LEGEND_ROW} mb-2`}>
              <span className={LEGEND_ITEM}><span aria-hidden className="inline-block h-2.5 w-4 rounded-[2px] opacity-35" style={{ background: TYPE_COLOR.p }} />Middle half of pardons</span>
              <span className={LEGEND_ITEM}><span aria-hidden className="inline-block size-2.5 rounded-full" style={{ background: TYPE_COLOR.p }} />Median</span>
            </div>
            <PresidentRows
              data={pres}
              inWindow={inWindow}
              onTerm={onTerm}
              figure={(p) => (p.age ? `${Math.round(p.age.median)} yrs` : "–")}
              bar={(p) => {
                if (!p.age) return null;
                const x = (v: number) => (Math.min(v, ageMax) / ageMax) * 100;
                return (
                  <>
                    <span className="absolute inset-x-0 top-2 h-px bg-line" />
                    <span className="absolute top-[3px] h-[11px] rounded-[2px] opacity-35" style={{ left: `${x(p.age.q1)}%`, width: `${x(p.age.q3) - x(p.age.q1)}%`, background: TYPE_COLOR.p }} />
                    <span className="absolute top-[3px] size-[11px] -translate-x-1/2 rounded-full" style={{ left: `${x(p.age.median)}%`, background: TYPE_COLOR.p }} />
                  </>
                );
              }}
              tip={(p) => (p.age ? { title: p.label, value: `${Math.round(p.age.median)} yrs`, sub: `median, ${p.age.n} of ${p.age.of} pardons. Middle half: ${Math.round(p.age.q1)} to ${Math.round(p.age.q3)} years`, rows: [{ label: "Within 5 years of sentence", value: `${Math.round(p.age.within5 * 100)}%`, color: TYPE_COLOR.p }] } : null)}
            />
            <div className="grid grid-cols-[5.6rem_minmax(0,1fr)_3.2rem] gap-2 font-mono text-[0.66rem] text-ink-muted"><span /><span className="flex justify-between"><span>0</span><span>10</span><span>20</span><span>30 yrs</span></span><span /></div>
            <ChartNotesRow className="mt-auto">
              <MethodologyNote><p>Pardons only, since a commutation by definition follows a recent sentence. Years between the most recent sentence <SourceLink id="doj-clemency-recipients">DOJ lists</SourceLink> and the grant, in whole years; a few grants list no sentence date and are left out. Proclamation grants aren’t here because they have no listed sentence.</p></MethodologyNote>
            </ChartNotesRow>
          </ChartCard>
          <ChartCard id="petitions-waiting" title={T.pending.title} takeaway={T.pending.takeaway}>
            <Key items={[["Pending petitions", "var(--accent)"]]} />
            <PetitionsChart data={data.pending} from={from} to={to} terms={pres} onTerm={onRange} min={min} max={max} />
            <ChartNotesRow className="mt-auto">
              <MethodologyNote><p>Pardon and commutation petitions pending at the start of each fiscal year, from the <SourceLink id="doj-clemency-statistics">Office of the Pardon Attorney</SourceLink>, plus the 10,418 pending at the end of Biden’s term in the takeaway. DOJ notes that later corrections mean a year’s figure may not match the previous year’s arithmetic.</p></MethodologyNote>
            </ChartNotesRow>
          </ChartCard>
        </Pair>

        <ChartCard id="every-grant-since-clinton" title={T.list.title} takeaway={`Search all ${n0(data.listed)} rows by name, offense or district: every warrant DOJ lists by name, plus the group warrants and proclamations.`} action={<ListSearch value={query} onChange={setQuery} label="Search grants" />}>
          <GrantList query={query} range={range} fy={fy} types={types} offenses={offenses} onClearFy={() => setFy(null)} />
          <ChartNotesRow share={false} className="mt-auto">
            <MethodologyNote><p>From the Office of the Pardon Attorney’s <SourceLink id="doj-clemency-recipients">recipient lists</SourceLink>, Clinton onward. These lists don’t always match the yearly totals exactly (Obama’s commutations are 1,716 listed, 1,715 counted), because of amended grants and people listed twice. An amended warrant is listed but not counted again. Being listed here records a grant of clemency, and a pardon doesn’t mean the person was innocent.</p></MethodologyNote>
          </ChartNotesRow>
        </ChartCard>
      </div>
    </div>
  );
}

const TERM_START: Record<string, string> = { clinton: "1993-01-20", bush43: "2001-01-20", obama: "2009-01-20", trump1: "2017-01-20", biden: "2021-01-20", trump2: "2025-01-20" };

function Pair({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="m-0 border-t border-line pt-3 font-mono text-[0.66rem] font-medium uppercase tracking-[0.08em] text-ink-muted">{label}</h3>
      <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 [&>*]:min-w-0">{children}</div>
    </div>
  );
}

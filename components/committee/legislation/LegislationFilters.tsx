"use client";

import { useMemo } from "react";
import { MultiSelectFilter, type MultiOption } from "@/components/charts/MultiSelectFilter";
import type { BillFilter } from "@/lib/committee-bills-derive";
import { NONE, monthLabel } from "@/lib/committee-bills-derive";
import { STAGES } from "@/lib/committee-bills-derive";
import type { CommitteeBillsPayload } from "@/lib/committee-bills-types";
import { pickLabel } from "@/lib/multi-select";
import { FOCUS_RING } from "./shared";

const FIELD = `h-[1.85rem] rounded-md border border-line-strong bg-surface-raised px-2.5 text-[0.8rem] text-ink ${FOCUS_RING}`;
const LABEL = "font-mono text-[0.6rem] uppercase tracking-[0.06em] text-ink-faint";

function Chip({ children, onClear, label }: { children: string; onClear: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClear}
      aria-label={label}
      className={`inline-flex items-center gap-1 rounded-full border border-line-strong bg-surface-raised px-2 py-0.5 text-[0.75rem] text-ink hover:bg-surface ${FOCUS_RING}`}
    >
      {children}
      <span aria-hidden className="text-ink-muted">
        ×
      </span>
    </button>
  );
}

/**
 * Search, sponsor party, policy area, subcommittee (both checkbox dropdowns, `MultiSelectFilter`, each row with its bills in this
 * Congress; a bill with none assigned is its own row) and the bipartisan checkbox; the active filters of every kind show as chips that clear themselves.
 */
export function LegislationFilters({
  payload,
  filter,
  onChange,
}: {
  payload: Pick<CommitteeBillsPayload, "areas" | "subs" | "rows">;
  filter: BillFilter;
  onChange: (patch: Partial<BillFilter>) => void;
}) {
  const areaOptions = useMemo<MultiOption<number>[]>(() => {
    const n = new Map<number, number>();
    for (const r of payload.rows) n.set(r.a ?? NONE, (n.get(r.a ?? NONE) ?? 0) + 1);
    const opts = payload.areas.map((label, id) => ({ id, label, count: String(n.get(id) ?? 0) })).sort((x, y) => x.label.localeCompare(y.label));
    return n.has(NONE) ? [...opts, { id: NONE, label: "No policy area", count: String(n.get(NONE)) }] : opts;
  }, [payload.areas, payload.rows]);
  const subOptions = useMemo<MultiOption<number>[]>(() => {
    const n = new Map<number, number>();
    for (const r of payload.rows) for (const u of r.u?.length ? r.u : [NONE]) n.set(u, (n.get(u) ?? 0) + 1);
    const opts = payload.subs.map((s, id) => ({ id, label: s.name, count: String(n.get(id) ?? 0) })).sort((x, y) => x.label.localeCompare(y.label));
    return n.has(NONE) ? [...opts, { id: NONE, label: "No subcommittee", count: String(n.get(NONE)) }] : opts;
  }, [payload.subs, payload.rows]);
  const chips: { key: string; text: string; clear: Partial<BillFilter>; label: string }[] = [];
  if (filter.stage) chips.push({ key: "stage", text: `${filter.stage.mode === "stop" ? "Stopped at" : "Reached"}: ${STAGES[filter.stage.k - 1]!.label}`, clear: { stage: null }, label: "Clear the step filter" });
  if (filter.month) chips.push({ key: "month", text: `Referred ${monthLabel(filter.month)}`, clear: { month: null }, label: "Clear the month" });
  if (filter.party) chips.push({ key: "party", text: filter.party === "R" ? "Republican sponsor" : "Democratic sponsor", clear: { party: "" }, label: "Clear the sponsor party" });
  if (filter.bipartisan) chips.push({ key: "bip", text: "Both parties cosponsor", clear: { bipartisan: false }, label: "Clear the bipartisan filter" });
  if (filter.area !== null) chips.push({ key: "area", text: pickLabel(filter.area, areaOptions, "policy areas"), clear: { area: null }, label: "Clear the policy area" });
  if (filter.sub !== null) chips.push({ key: "sub", text: pickLabel(filter.sub, subOptions, "subcommittees"), clear: { sub: null }, label: "Clear the subcommittee" });
  if (filter.query.trim()) chips.push({ key: "q", text: `“${filter.query.trim()}”`, clear: { query: "" }, label: "Clear the search" });

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-end gap-x-2.5 gap-y-2">
        <label className="flex min-w-0 flex-[1_1_100%] flex-col gap-0.5 sm:flex-[0_1_15rem]">
          <span className={LABEL}>Search</span>
          <input type="search" value={filter.query} onChange={(e) => onChange({ query: e.target.value })} placeholder="Title, bill number, sponsor" aria-label="Search bills by title, bill number, sponsor, policy area or law number" className={`${FIELD} placeholder:text-ink-faint`} />
        </label>
        <label className="flex min-w-0 flex-[1_1_40%] flex-col gap-0.5 sm:flex-none">
          <span className={LABEL}>Sponsor party</span>
          <select value={filter.party} onChange={(e) => onChange({ party: e.target.value as BillFilter["party"] })} className={`${FIELD} sm:w-[8rem]`}>
            <option value="">Any</option>
            <option value="R">Republican</option>
            <option value="D">Democratic</option>
          </select>
        </label>
        <div className="flex min-w-0 flex-[1_1_40%] flex-col gap-0.5 sm:flex-none">
          <span className={LABEL}>Policy area</span>
          <MultiSelectFilter label="Policy area" noun="policy areas" allLabel="All areas" options={areaOptions} value={filter.area} onChange={(area) => onChange({ area })} className="sm:w-[11rem]" />
        </div>
        {payload.subs.length > 0 && (
          <div className="flex min-w-0 flex-[1_1_40%] flex-col gap-0.5 sm:flex-none">
            <span className={LABEL}>Subcommittee</span>
            <MultiSelectFilter label="Subcommittee" noun="subcommittees" allLabel="All" options={subOptions} value={filter.sub} onChange={(sub) => onChange({ sub })} className="sm:w-[12rem]" />
          </div>
        )}
        <label className="inline-flex h-[1.85rem] items-center gap-1.5 whitespace-nowrap text-[0.78rem] text-ink-muted">
          <input type="checkbox" checked={filter.bipartisan} onChange={(e) => onChange({ bipartisan: e.target.checked })} />
          Cosponsors from both parties
        </label>
      </div>
      {chips.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <Chip key={c.key} label={c.label} onClear={() => onChange(c.clear)}>
              {c.text}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}

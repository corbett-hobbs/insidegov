import { LPR_GROUPS, LPR_REGION_STACK, groupValues, type LprMarker, type LprMetric } from "@/lib/lpr-chart";
import type { LprRegionKey, LprTerm, LprYear } from "@/lib/lpr-types";
import { BOX, BOX_COMPACT, TOP } from "./Cards";
import { GROUP_COLOR, REGION_COLOR } from "./lpr-style";
import { n } from "./refugee-style";

const fyRange = (fy: number) => `Oct 1, ${fy - 1} to Sep 30, ${fy}`;

/** Card for one numbered note on the axis. Never interactive. */
export function LprMarkerCard({ marker, width, left }: { marker: LprMarker; width: number; left: number }) {
  return (
    <div role="tooltip" data-lpr-hit className={`${BOX} max-h-[22rem] overflow-y-auto`} style={{ top: TOP, left, width }}>
      <div className="flex items-start gap-2">
        <span aria-hidden className="mt-px inline-flex h-[18px] min-w-[18px] flex-none items-center justify-center rounded-full bg-ink px-1 font-mono text-[0.68rem] font-semibold text-surface">
          {marker.n}
        </span>
        <div className="text-[0.82rem] font-semibold leading-[1.35] text-ink">{marker.title}</div>
      </div>
      <p className="m-0 mt-1 text-[0.78rem] leading-[1.5] text-ink-muted">{marker.text}</p>
    </div>
  );
}

/**
 * Card for one fiscal year. Green cards: the total, the president, the six class groups. Naturalizations: that count alone.
 * The other measure is shown once, labelled a separate count, and never added to the first.
 */
export function LprYearCard({
  year,
  terms,
  metric,
  regions,
  width,
  left,
  interactive,
}: {
  year: LprYear;
  /** Naturalizations by continent for this year, when there is any. */
  regions: Partial<Record<LprRegionKey, number>> | null;
  terms: ReadonlyMap<string, LprTerm>;
  metric: LprMetric;
  width: number;
  left: number;
  interactive: boolean;
}) {
  const t = terms.get(year.termId);
  const groups = groupValues(year);
  const head = metric === "lpr" ? `FY${year.fy} · ${n(year.lpr)} green cards` : `FY${year.fy} · ${year.naturalizations === null ? "—" : n(year.naturalizations)} naturalized`;
  const other = metric === "lpr" ? { label: "Naturalizations", value: year.naturalizations } : { label: "Green cards", value: year.lpr };
  if (!interactive) {
    const rows: { key: string; color: string; label: string; value: number }[] =
      metric === "lpr" && groups
        ? [...LPR_GROUPS].reverse().map((g) => ({ key: g.key, color: GROUP_COLOR[g.key], label: g.name, value: groups[g.key] }))
        : metric === "naturalizations" && regions
          ? [...LPR_REGION_STACK].reverse().filter((r) => (regions[r.key] ?? 0) > 0).map((r) => ({ key: r.key, color: REGION_COLOR[r.key], label: r.short, value: regions[r.key]! }))
          : [];
    return (
      <div role="tooltip" data-lpr-hit className={`${BOX_COMPACT} pointer-events-none text-[0.74rem] leading-[1.45] text-ink-muted`} style={{ top: TOP, left, width }}>
        <div className="font-mono text-[0.78rem] font-semibold text-ink">{head}</div>
        <div>{`${year.blended ? year.days.map((d) => `${d.last} ${d.days} days`).join(" · ") : (t?.president ?? "")} · ${year.preliminary ? "Preliminary" : "Final"}`}</div>
        {rows.length > 0 && (
          <div className="mt-1 grid grid-cols-[1fr_auto] gap-x-2 border-t border-line pt-1">
            {rows.map((r) => (
              <div key={r.key} className="contents">
                <span className="inline-flex items-center gap-1">
                  <i aria-hidden className="inline-block h-2 w-2 rounded-sm" style={{ background: r.color }} />
                  {r.label}
                </span>
                <b className="font-mono font-medium text-ink">{n(r.value)}</b>
              </div>
            ))}
          </div>
        )}
        <div className="mt-1 text-ink-faint">Select for detail</div>
      </div>
    );
  }
  return (
    <div role="tooltip" data-lpr-hit className={`${BOX} ${interactive ? "" : "pointer-events-none"}`} style={{ top: TOP, left, width }}>
      <div className="font-mono text-[0.82rem] font-semibold text-ink">{head}</div>
      <div className="text-[0.74rem] leading-[1.5] text-ink-muted">{fyRange(year.fy)}</div>
      <div className="mt-1.5 text-[0.8rem] leading-[1.5] text-ink-muted">
        {year.blended ? `${year.days.map((d) => `${d.last} ${d.days} days`).join(" · ")}; counted with ${t?.last ?? ""}` : (t?.president ?? "")}
      </div>
      <div className="text-[0.8rem] leading-[1.5] text-ink-muted">{year.preliminary ? "Preliminary: the quarterly report, before the Yearbook" : "Final"}</div>
      {metric === "lpr" && (
        <div className="mt-1.5 grid grid-cols-[1fr_auto] gap-x-3 border-t border-line pt-1.5 text-[0.8rem] leading-[1.5] text-ink-muted">
          {groups ? (
            [...LPR_GROUPS].reverse().map((g) => (
              <div key={g.key} className="contents">
                <span className="inline-flex items-center gap-1.5">
                  <i aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: GROUP_COLOR[g.key] }} />
                  {g.name}
                </span>
                <b className="font-mono font-medium text-ink">{n(groups[g.key])}</b>
              </div>
            ))
          ) : (
            <span className="col-span-2 text-[0.74rem]">No class detail before FY1999: totals only.</span>
          )}
        </div>
      )}
      {metric === "naturalizations" && regions && (
        <div className="mt-1.5 grid grid-cols-[1fr_auto] gap-x-3 border-t border-line pt-1.5 text-[0.8rem] leading-[1.5] text-ink-muted">
          {[...LPR_REGION_STACK].reverse().filter((r) => (regions[r.key] ?? 0) > 0).map((r) => (
            <div key={r.key} className="contents">
              <span className="inline-flex items-center gap-1.5">
                <i aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: REGION_COLOR[r.key] }} />
                {r.short}
              </span>
              <b className="font-mono font-medium text-ink">{n(regions[r.key]!)}</b>
            </div>
          ))}
          <span className="col-span-2 text-[0.72rem] text-ink-faint">{year.preliminary ? "By country of nationality (preliminary)" : "By country of birth"}</span>
        </div>
      )}
      <div className="mt-1.5 flex justify-between gap-3 border-t border-line pt-1.5 text-[0.8rem] leading-[1.5] text-ink-muted">
        <span>{other.label} (a separate count)</span>
        <b className="font-mono font-medium text-ink">{other.value === null ? "—" : n(other.value)}</b>
      </div>
    </div>
  );
}

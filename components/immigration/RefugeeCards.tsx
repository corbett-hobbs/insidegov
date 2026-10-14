import { TipCard, type TipRowData } from "../charts/TipCard";
import { GEO_NAME, GEO_STACK, type RefugeeMarker, type RefugeeTerm, type RefugeeYear } from "@/lib/refugee-types";
import { BOX, TOP } from "./Cards";
import { REGION_COLOR, dateLabel, n } from "./refugee-style";

const STATUS: Record<RefugeeMarker["status"], string> = { in_effect: "In effect", superseded: "Superseded", expired: "Expired", revoked: "Revoked" };

/**
 * Card for one rule pill on the ceiling chart: every rule the pill holds (a merged pill lists them all), with its dates, status
 * and what it did to refugee admissions. Hover cards ignore the pointer; a pinned (tapped or keyboard-opened) card takes it so a
 * long list scrolls. Court status is not tracked, and the card says so.
 */
export function RuleCard({ rules, width, left, interactive }: { rules: readonly RefugeeMarker[]; width: number; left: number; interactive: boolean }) {
  return (
    <div
      role="tooltip"
      data-rf-hit
      className={`${BOX} max-h-[22rem] overflow-y-auto ${interactive ? "" : "pointer-events-none"}`}
      style={{ top: TOP, left, width }}
    >
      {rules.map((r, i) => (
        <div key={r.id} className={i > 0 ? "mt-2.5 border-t border-line pt-2.5" : ""}>
          <div className="flex items-start gap-2">
            <span aria-hidden className="mt-px inline-flex h-[18px] min-w-[18px] flex-none items-center justify-center rounded-full bg-ink px-1 font-mono text-[0.68rem] font-semibold text-surface">
              {r.n}
            </span>
            <div className="text-[0.82rem] font-semibold leading-[1.35] text-ink">{r.title}</div>
          </div>
          <div className="mt-1 text-[0.74rem] leading-[1.5] text-ink-muted">
            {r.instrument}
            {r.citation ? ` (${r.citation})` : ""} · signed {dateLabel(r.signed)}
            {r.date !== r.signed ? `, effective ${dateLabel(r.date)}` : ""}
            {r.ended ? `, ended ${dateLabel(r.ended)}` : ""}
          </div>
          <div className="mt-1">
            <span className="inline-block rounded-full border border-line-strong px-2 text-[0.7rem] leading-[1.6] text-ink-muted">
              {STATUS[r.status]} as of {dateLabel(r.statusAsOf)}
            </span>
          </div>
          <p className="m-0 mt-1.5 text-[0.78rem] leading-[1.5] text-ink-muted">{r.summary}</p>
          <p className="m-0 mt-1 text-[0.78rem] leading-[1.5] text-ink-muted">
            <b className="font-semibold text-ink">Effect on refugees:</b> {r.effect}
          </p>
        </div>
      ))}
      <p className="m-0 mt-2 text-[0.72rem] leading-[1.45] text-ink-faint">Court challenges are not tracked here.</p>
    </div>
  );
}

const fyRange = (fy: number) => `Oct 1, ${fy - 1} to Sep 30, ${fy}`;

/** Card for one fiscal year: admissions, the ceiling in force and how much of it was used, the president, and arrivals by region. */
export function YearCard({
  year,
  terms,
  width,
  left,
  interactive,
}: {
  year: RefugeeYear;
  terms: ReadonlyMap<string, RefugeeTerm>;
  width: number;
  left: number;
  interactive: boolean;
}) {
  const president = terms.get(year.termId)?.president ?? "";
  const regions = GEO_STACK.filter((g) => year.regions[g] > 0).sort((a, b) => year.regions[b] - year.regions[a]);
  return (
    <div role="tooltip" data-rf-hit className={`${BOX} ${interactive ? "" : "pointer-events-none"}`} style={{ top: TOP, left, width }}>
      <div className="font-mono text-[0.82rem] font-semibold text-ink">{`FY${year.fy} · ${n(year.admissions)} admitted`}</div>
      <div className="text-[0.74rem] leading-[1.5] text-ink-muted">{fyRange(year.fy)}</div>
      <div className="mt-1.5 text-[0.8rem] leading-[1.5] text-ink-muted">
        {year.blended ? `${year.days.map((d) => `${d.last} ${d.days} days`).join(" · ")}; counted with ${terms.get(year.termId)?.last ?? ""}` : president}
      </div>
      <div className="text-[0.8rem] leading-[1.5] text-ink-muted">{year.preliminary ? "Preliminary: the first year-end report" : "Final"}</div>
      {year.ceiling !== null && (
        <div className="mt-1.5 border-t border-line pt-1.5 text-[0.8rem] leading-[1.5] text-ink-muted">
          <div className="flex justify-between gap-3">
            <span>Ceiling</span>
            <b className="font-mono font-medium text-ink">{n(year.ceiling)}</b>
          </div>
          {year.revised && year.ceilingInitial !== null && <div className="text-[0.74rem]">{`First set at ${n(year.ceilingInitial)}, revised during the year.`}</div>}
          {year.share !== null && <div className="text-[0.74rem]">{`${year.share < 0.1 ? (year.share * 100).toFixed(1) : Math.round(year.share * 100)}% of the ceiling`}</div>}
        </div>
      )}
      {regions.length > 0 && (
        <div className="mt-1.5 grid grid-cols-[1fr_auto] gap-x-3 border-t border-line pt-1.5 text-[0.8rem] leading-[1.5] text-ink-muted">
          {regions.map((g) => (
            <div key={g} className="contents">
              <span className="inline-flex items-center gap-1.5">
                <i aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: REGION_COLOR[g] }} />
                {GEO_NAME[g].name}
              </span>
              <b className="font-mono font-medium text-ink">{n(year.regions[g])}</b>
            </div>
          ))}
          {year.privateSector > 0 && (
            <div className="contents">
              <span className="inline-flex items-center gap-1.5">
                <i aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--ink-faint)", opacity: 0.55 }} />
                Private-sector initiative
              </span>
              <b className="font-mono font-medium text-ink">{n(year.privateSector)}</b>
            </div>
          )}
        </div>
      )}
      {year.cardNotes.map((note) => (
        <p key={note.id} className="m-0 mt-1.5 text-[0.78rem] leading-[1.5] text-ink-muted">
          {note.text}
        </p>
      ))}
    </div>
  );
}

/** Hover tooltip for one fiscal year (shared `Tooltip` content; the tap-pinned `YearCard` holds the detail). */
export function YearTip({ year, terms }: { year: RefugeeYear; terms: ReadonlyMap<string, RefugeeTerm> }) {
  const president = terms.get(year.termId)?.president ?? "";
  const who = year.blended ? year.days.map((d) => `${d.last} ${d.days} days`).join(" · ") : president;
  const regions = GEO_STACK.filter((g) => year.regions[g] > 0).sort((a, b) => year.regions[b] - year.regions[a]);
  const rows: TipRowData[] = regions.map((g) => ({ key: g, color: REGION_COLOR[g], label: GEO_NAME[g].short, value: n(year.regions[g]) }));
  if (year.privateSector > 0) rows.push({ key: "private", color: "var(--ink-faint)", label: "Private sector", value: n(year.privateSector) });
  const used = year.share === null ? "" : ` (${year.share < 0.1 ? (year.share * 100).toFixed(1) : Math.round(year.share * 100)}% used)`;
  return (
    <TipCard
      title={`FY${year.fy}`}
      value={n(year.admissions)}
      sub={`${who}${year.preliminary ? " · Preliminary" : ""}`}
      rows={rows}
      extra={year.ceiling !== null ? [{ key: "ceil", label: `Ceiling${used}`, value: n(year.ceiling) }] : []}
    />
  );
}

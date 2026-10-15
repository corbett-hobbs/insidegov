import { TipCard, type TipRowData } from "../charts/TipCard";
import { ENCOUNTER_SERIES, monthsLabel, partsOf, segments, USBP_ONLY_COLOR, type EncounterSeriesKey } from "@/lib/encounters-chart";
import type { EncounterScopeKey, EncountersMarker, EncountersNoteText, EncountersTerm, EncountersYear } from "@/lib/encounters-types";
import { BOX, TOP } from "./Cards";

const n = (v: number) => v.toLocaleString("en-US");
const fyRange = (fy: number) => `Oct 1, ${fy - 1} to Sep 30, ${fy}`;

/** Year-specific caveats that have no numbered marker and are not already in every year's Data notes. */
const YEAR_NOTE_IDS: readonly string[] = ["fy2000-sources-differ", "fy2017-southwest-restated"];

const whoOf = (y: EncountersYear, terms: ReadonlyMap<string, EncountersTerm>) =>
  y.blended ? y.days.map((d) => `${d.last} ${d.days} days`).join(" · ") : (terms.get(y.termId)?.president ?? "");

/** Rows of a year's figures, top segment first, as the stack reads. */
function rowsOf(y: EncountersYear, scope: EncounterScopeKey, only: EncounterSeriesKey | null): TipRowData[] {
  return [...segments(y, scope, only)]
    .reverse()
    .map((s) =>
      s.key === "usbp_only"
        ? { key: s.key, label: "Caught by Border Patrol", value: n(s.value), color: USBP_ONLY_COLOR }
        : { key: s.key, label: ENCOUNTER_SERIES.find((x) => x.key === s.key)!.short, value: n(s.value), color: ENCOUNTER_SERIES.find((x) => x.key === s.key)!.color },
    );
}

/** The ICE figure for the same year, as its own labelled line. Never a difference or a ratio. */
const iceRow = (removals: number | undefined): TipRowData[] => (removals === undefined ? [] : [{ key: "ice", label: "ICE removals, a separate count", value: n(removals) }]);

/** Hover tooltip for one fiscal year (shared `Tooltip` content; the tap-pinned card holds the detail). */
export function EncountersYearTip({ year, scope, only, terms, removals }: { year: EncountersYear; scope: EncounterScopeKey; only: EncounterSeriesKey | null; terms: ReadonlyMap<string, EncountersTerm>; removals: number | undefined }) {
  const p = partsOf(year, scope);
  const sub = [whoOf(year, terms), year.preliminary ? `Preliminary · ${year.months} months` : null, year.detail === "usbp_only" ? "Border Patrol only" : null].filter(Boolean).join(" · ");
  return <TipCard title={`FY${year.fy}`} value={n(only ? (p[only] ?? 0) : p.total)} sub={sub} rows={rowsOf(year, scope, only)} extra={iceRow(removals)} />;
}

/** Card for one fiscal year, opened by a tap or the keyboard: the figures, the administration, coverage and any year-specific caveat. */
export function EncountersYearCard({
  year,
  scope,
  terms,
  notes,
  removals,
  width,
  left,
}: {
  year: EncountersYear;
  scope: EncounterScopeKey;
  terms: ReadonlyMap<string, EncountersTerm>;
  notes: ReadonlyMap<string, EncountersNoteText>;
  removals: number | undefined;
  width: number;
  left: number;
}) {
  const p = partsOf(year, scope);
  const rows = rowsOf(year, scope, null);
  const caveats = year.noteIds.filter((id) => YEAR_NOTE_IDS.includes(id)).map((id) => notes.get(id)).filter((x): x is EncountersNoteText => !!x);
  return (
    <div role="tooltip" data-enc-hit className={`${BOX} pointer-events-none`} style={{ top: TOP, left, width }}>
      <div className="font-mono text-[0.82rem] font-semibold text-ink">{`FY${year.fy} · ${n(p.total)}`}</div>
      <div className="text-[0.74rem] leading-[1.5] text-ink-muted">{fyRange(year.fy)}</div>
      <div className="mt-1.5 text-[0.8rem] leading-[1.5] text-ink-muted">{whoOf(year, terms)}</div>
      <div className="text-[0.8rem] leading-[1.5] text-ink-muted">
        {year.preliminary ? `Preliminary: ${monthsLabel(year.months)}, may be revised` : "Final"}
      </div>
      <div className="mt-1.5 grid grid-cols-[1fr_auto] gap-x-3 border-t border-line pt-1.5 text-[0.8rem] leading-[1.5] text-ink-muted">
        {rows.map((r) => (
          <div key={r.key} className="contents">
            <span className="inline-flex items-center gap-1.5">
              <i aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: r.color }} />
              {r.label}
            </span>
            <b className="font-mono font-medium text-ink">{r.value}</b>
          </div>
        ))}
        {year.detail === "usbp_only" && <span className="col-span-2 text-[0.74rem]">Figures for official crossings begin in FY2004: this year is Border Patrol only.</span>}
        {year.ofoRounded && p.ofo !== null && <span className="col-span-2 text-[0.74rem]">Crossing figures are DHS statistics, rounded to the nearest ten.</span>}
        {p.title42ByComponent && (
          <span className="col-span-2 text-[0.74rem]">{`Title 42: ${n(p.title42ByComponent.usbp)} by Border Patrol, ${n(p.title42ByComponent.ofo)} at official crossings.`}</span>
        )}
      </div>
      {removals !== undefined && (
        <div className="mt-1.5 flex justify-between gap-3 border-t border-line pt-1.5 text-[0.8rem] leading-[1.5] text-ink-muted">
          <span>ICE removals (a separate count)</span>
          <b className="font-mono font-medium text-ink">{n(removals)}</b>
        </div>
      )}
      {caveats.map((c) => (
        <p key={c.id} className="m-0 mt-1.5 text-[0.78rem] leading-[1.5] text-ink-muted">
          {c.text}
        </p>
      ))}
    </div>
  );
}

/** Card for one pill: one numbered definition change, or every change a merged pill holds. Never interactive. */
export function EncountersMarkerCard({ markers, width, left }: { markers: readonly EncountersMarker[]; width: number; left: number }) {
  return (
    <div role="tooltip" data-enc-hit className={`${BOX} max-h-[22rem] overflow-y-auto`} style={{ top: TOP, left, width }}>
      {markers.map((m, i) => (
        <div key={m.id} className={i > 0 ? "mt-2.5 border-t border-line pt-2.5" : ""}>
          <div className="flex items-start gap-2">
            <span aria-hidden className="mt-px inline-flex h-[18px] min-w-[18px] flex-none items-center justify-center rounded-full bg-ink px-1 font-mono text-[0.68rem] font-semibold text-surface">
              {m.n}
            </span>
            <div className="text-[0.82rem] font-semibold leading-[1.35] text-ink">{m.title}</div>
          </div>
          <p className="m-0 mt-1 text-[0.78rem] leading-[1.5] text-ink-muted">{m.text}</p>
        </div>
      ))}
    </div>
  );
}

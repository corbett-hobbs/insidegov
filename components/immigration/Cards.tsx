import { TipCard } from "../charts/TipCard";
import type { IceMarker, IceTerm, IceYear } from "@/lib/immigration-derive";

export const BOX =
  "absolute z-[6] box-border rounded-lg border border-line-strong bg-surface px-3.5 py-3 shadow-[0_6px_20px_rgba(26,34,51,0.14)]";
export const TOP = 30;

/** Card for a numbered definition-change marker. Never interactive. */
export function MarkerCard({ marker, width, left }: { marker: IceMarker; width: number; left: number }) {
  return (
    <div role="tooltip" className={`${BOX} pointer-events-none`} style={{ top: TOP, left, width }}>
      <div className="text-[0.82rem] font-semibold leading-[1.35] text-ink">{marker.title}</div>
      <div className="mt-1 text-[0.8rem] leading-[1.5] text-ink-muted">{marker.text}</div>
    </div>
  );
}

const pct = (part: number, whole: number) => `${Math.round((part / whole) * 100)}%`;

const fyRange = (fy: number) => `Oct 1, ${fy - 1} to Sep 30, ${fy}`;

/**
 * Card for one fiscal year: value, status, administration (with day split for
 * blended years), corroboration, source link, and any caveat that has no
 * numbered marker. Hover cards ignore the pointer; a pinned (tapped or
 * keyboard-opened) card takes it so the source link works.
 */
export function BarCard({
  year,
  terms,
  width,
  left,
  interactive,
}: {
  year: IceYear;
  terms: ReadonlyMap<string, IceTerm>;
  width: number;
  left: number;
  interactive: boolean;
}) {
  const president = terms.get(year.termId)?.president ?? "";
  return (
    <div
      role="tooltip"
      data-ice-hit
      className={`${BOX} ${interactive ? "" : "pointer-events-none"}`}
      style={{ top: TOP, left, width }}
    >
      <div className="font-mono text-[0.82rem] font-semibold text-ink">
        {`FY${year.fy} · ${year.value.toLocaleString("en-US")}`}
      </div>
      <div className="text-[0.74rem] leading-[1.5] text-ink-muted">{fyRange(year.fy)}</div>
      <div className="mt-1.5 text-[0.8rem] leading-[1.5] text-ink-muted">
        {year.blended ? year.days.map((d) => `${d.last} ${d.days} days`).join(" · ") : president}
      </div>
      <div className="text-[0.8rem] leading-[1.5] text-ink-muted">
        {year.era === "ins"
          ? "Final · INS era, DHS statistics, removals only"
          : `${year.status === "final" ? "Final" : "Preliminary"} · ${year.corroborated ? "Confirmed by a second source" : "Single source"}`}
      </div>
      {year.agency ? (
        <div className="mt-1.5 grid grid-cols-[1fr_auto] gap-x-3 border-t border-line pt-1.5 text-[0.8rem] leading-[1.5] text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <i aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--agency-ice)" }} />
            After interior stop
          </span>
          <b className="font-mono font-medium text-ink">{`${year.agency.ice.toLocaleString("en-US")} · ${pct(year.agency.ice, year.value)}`}</b>
          <span className="inline-flex items-center gap-1.5">
            <i aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--agency-cbp)" }} />
            After border stop
          </span>
          <b className="font-mono font-medium text-ink">{`${year.agency.cbp.toLocaleString("en-US")} · ${pct(year.agency.cbp, year.value)}`}</b>
        </div>
      ) : (
        <div className="mt-1.5 border-t border-line pt-1.5 text-[0.78rem] leading-[1.5] text-ink-muted">{year.era === "ins" ? "No split by where the person was stopped on file for the INS era." : "ICE prints no split by where the person was stopped for this year."}</div>
      )}
      {year.detention && (
        <div className="mt-1.5 border-t border-line pt-1.5 text-[0.8rem] leading-[1.5] text-ink-muted">
          <div className="flex justify-between gap-3">
            <span>People detained, daily average</span>
            <b className="font-mono font-medium text-ink">{year.detention.value.toLocaleString("en-US")}</b>
          </div>
          {year.detention.ice !== null && year.detention.cbp !== null && (
            <div className="text-[0.74rem]">
              {`${year.detention.ice.toLocaleString("en-US")} first stopped inside the country · ${year.detention.cbp.toLocaleString("en-US")} at the border`}
            </div>
          )}
          {year.detention.status === "preliminary" && <div className="text-[0.74rem]">Detention figure is preliminary.</div>}
        </div>
      )}
      {year.cardNotes.map((n) => (
        <p key={n.id} className="m-0 mt-1.5 text-[0.78rem] leading-[1.5] text-ink-muted">
          {n.text}
        </p>
      ))}
      <a
        href={year.sourceUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-1.5 block text-[0.78rem] leading-[1.45] text-accent underline-offset-2 hover:underline"
      >
        {year.source}
      </a>
    </div>
  );
}

/** Hover tooltip for one fiscal year (shared `Tooltip` content; the tap-pinned `BarCard` holds the detail). */
export function YearTip({ year, terms }: { year: IceYear; terms: ReadonlyMap<string, IceTerm> }) {
  const president = terms.get(year.termId)?.president ?? "";
  const who = year.blended ? year.days.map((d) => `${d.last} ${d.days} days`).join(" · ") : president;
  return (
    <TipCard
      title={`FY${year.fy}`}
      value={year.value.toLocaleString("en-US")}
      sub={`${who}${year.era === "ins" ? " · INS era, DHS statistics" : year.status === "final" ? "" : " · Preliminary"}`}
      rows={year.agency ? [
        { key: "ice", label: "After interior stop", value: year.agency.ice.toLocaleString("en-US"), color: "var(--agency-ice)" },
        { key: "cbp", label: "After border stop", value: year.agency.cbp.toLocaleString("en-US"), color: "var(--agency-cbp)" },
      ] : []}
      extra={year.detention ? [{ key: "det", label: "Detained daily", value: year.detention.value.toLocaleString("en-US") }] : []}
    />
  );
}

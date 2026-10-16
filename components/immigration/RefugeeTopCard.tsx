"use client";

import { useId, useMemo, useRef, useState, type PointerEvent } from "react";
import { ChartCard } from "@/components/charts/ChartCard";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { LEGEND_ITEM, LEGEND_ROW_CAPPED } from "@/components/charts/legend";
import { LegendToggle, useIsolate } from "@/components/charts/LegendToggle";
import { SegmentLabel } from "@/components/charts/SegmentLabel";
import { TABLE_TOGGLE } from "@/components/charts/table-toggle";
import { TERM_BAND_H, TermBandSvg, termSegments } from "@/components/charts/TermBandSvg";
import { Tooltip, useTooltip } from "@/components/charts/Tooltip";
import { MethodologyNote } from "@/components/MethodologyNote";
import { ChartNotesRow } from "@/components/charts/ChartNotesRow";
import { yearLabelEvery } from "@/lib/chart-bars";
import { compactCount, niceCountTicks, spanLabel } from "@/lib/refugee-chart";
import { topByYear, topRuns } from "@/lib/refugee-derive";
import { GEO_NAME, GEO_STACK, type GeoGroup, type RefugeePayload, type TopYear } from "@/lib/refugee-types";
import { useElementWidth } from "@/lib/use-element-width";
import { REGION_COLOR, n } from "./refugee-style";
import { SourceLink } from "@/components/SourceLink";
import { useTakeawayContext } from "@/components/charts/ContextLine";
import { IMMIGRATION_TAKEAWAYS, contextFor } from "./takeaways";

const LABEL_H = 22;
const TICK = 5;
const axisText = (v: number) => (v >= 1000 ? `${+(v / 1000).toFixed(1)}k` : String(v));
const TH = "sticky top-0 border-b border-line-strong bg-surface-raised px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.05em] text-ink-faint first:text-left";
const TD = "border-b border-line px-2.5 py-1 font-mono text-ink first:text-left";

/**
 * "Who's sent the most refugees": the largest source country per fiscal year as run-length spans, with a bar per year below (that
 * country's refugees, coloured by its region). The same layout as foreign aid's "Who's been No. 1" and national security's "Who's
 * hosted the most". A country picked on the map highlights the years it led and dims the rest; the region key does the same for a
 * region. Click or drag sets the section's selected year. The newest (preliminary) year is hatched.
 */
export function RefugeeTopCard({
  payload,
  fromFy,
  toFy,
  fy,
  onFy,
  country,
}: {
  payload: RefugeePayload;
  fromFy: number;
  toFy: number;
  fy: number;
  onFy: (fy: number) => void;
  /** The country picked on the map (its key), or null. */
  country: string | null;
}) {
  const years = useMemo(() => topByYear(payload, fromFy, toFy), [payload, fromFy, toFy]);
  const runs = useMemo(() => topRuns(years), [years]);
  const [pickRegion, toggleRegion] = useIsolate<GeoGroup>();
  const [wrapRef, measured] = useElementWidth<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement>(null);
  const hatchId = useId().replace(/:/g, "");
  const tip = useTooltip<TopYear>();
  const [hover, setHover] = useState(-1);
  const down = useRef(false);
  const names = payload.countries;
  const termOf = new Map(payload.terms.map((t) => [t.termId, t]));
  const yearRow = new Map(payload.years.map((y) => [y.fy, y]));

  const W = measured || 960;
  const narrow = W < 520;
  const count = years.length;
  const MX = narrow ? 36 : 44;
  const MR = narrow ? 34 : 14;
  const step = (W - MX - MR) / Math.max(1, count);
  const labelFor = (r: { ci: number; from: number; to: number }) => spanLabel(names[r.ci].name, names[r.ci].key, (r.to - r.from + 1) * step, narrow);
  const anySlanted = runs.some((r) => r.ci >= 0 && labelFor(r).slant);
  const labelH = anySlanted ? 46 : LABEL_H;
  const bracketY = labelH + 6;
  const maxH = narrow ? 120 : 150;
  const plotTop = bracketY + TICK + 12;
  const baseY = plotTop + maxH;
  const H = baseY + 24 + TERM_BAND_H + 4;

  const topVal = (y: TopYear) => y.ranked[0]?.value ?? 0;
  const { ticks, top: maxTop } = niceCountTicks(Math.max(1, ...years.map(topVal)));
  const yOf = (v: number) => baseY - (v / maxTop) * maxH;
  const si = years.findIndex((y) => y.fy === fy);
  const segments = termSegments(count, (i) => {
    const t = termOf.get(yearRow.get(years[i].fy)?.termId ?? "");
    return t ? { id: t.termId, last: t.last, president: t.president, party: t.party } : null;
  });
  const bw = Math.min(Math.max(3, step * 0.72), 40);
  const dimYear = (y: TopYear) => {
    const t = y.ranked[0];
    if (!t) return false;
    return (country !== null && names[t.ci].key !== country) || (pickRegion !== null && t.group !== pickRegion);
  };
  const dimRun = (r: { ci: number; from: number }) => {
    if (r.ci < 0) return false;
    const grp = years[r.from].ranked[0]?.group;
    return (country !== null && names[r.ci].key !== country) || (pickRegion !== null && grp !== pickRegion);
  };

  const indexAt = (e: { clientX: number }) => {
    const r = svgRef.current!.getBoundingClientRect();
    return Math.min(count - 1, Math.max(0, Math.floor((e.clientX - r.left - MX) / step)));
  };
  const onDown = (e: PointerEvent<SVGSVGElement>) => {
    down.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    const i = indexAt(e);
    onFy(years[i].fy);
    tip.show(years[i], e);
  };
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const i = indexAt(e);
    if (down.current) onFy(years[i].fy);
    setHover(i);
    tip.show(years[i], e);
  };
  const end = () => {
    down.current = false;
  };

  const cur = years[si];
  const peak = years.reduce<TopYear | null>((a, b) => (b.ranked[0] && (!a || !a.ranked[0] || topVal(b) > topVal(a)) ? b : a), null);
  const regionsPresent = GEO_STACK.filter((g) => years.some((y) => y.ranked[0]?.group === g));
  const anyPrelim = years.some((y) => y.preliminary);

  const context = useTakeawayContext(IMMIGRATION_TAKEAWAYS.refugeeTop.takeaway, contextFor("refugeeTop"));
  if (count === 0) return null;
  return (
    <ChartCard title="Who’s sent the most refugees" takeaway={context.takeaway}>
      {context.panel}
      <div ref={wrapRef} className="touch-scroll relative -mx-3 sm:mx-0">
        <ChartFrame
          width={W}
          height={H}
          margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
          ariaLabel="The largest source country of refugees in each fiscal year, with its admissions as bars. The table view lists the same figures."
          svgRef={svgRef}
          onPointerLeave={() => {
            down.current = false;
            setHover(-1);
            tip.hide();
          }}
          svgProps={{ onPointerDown: onDown, onPointerMove: onMove, onPointerUp: end, onPointerCancel: end, style: { cursor: "crosshair", touchAction: "pan-y" } }}
        >
          {() => (
            <>
              <defs>
                <pattern id={hatchId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <line x1="0" y1="0" x2="0" y2="6" style={{ stroke: "var(--surface)", strokeWidth: 2.2 }} />
                </pattern>
              </defs>
              {si >= 0 && si < count && <rect x={MX + si * step} y={0} width={step} height={baseY + 3} rx={2} style={{ fill: "var(--surface-raised)", stroke: "var(--line-strong)" }} />}
              {hover >= 0 && hover < count && hover !== si && <rect x={MX + hover * step} y={0} width={step} height={baseY + 3} rx={2} style={{ fill: "none", stroke: "var(--line-strong)", strokeDasharray: "3 3" }} />}
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={MX} x2={W - MR} y1={yOf(t)} y2={yOf(t)} className={t === 0 ? "zero-line" : "grid-line"} />
                  {t > 0 && (
                    <text className="axis-tick-label" x={MX - 6} y={yOf(t) + 3.5} textAnchor="end">
                      {axisText(t)}
                    </text>
                  )}
                </g>
              ))}
              {runs.map((r) => {
                if (r.ci < 0) return null;
                const x = MX + r.from * step;
                const w = (r.to - r.from + 1) * step;
                const nm = names[r.ci].name;
                const isSel = country === names[r.ci].key;
                const dim = dimRun(r);
                const { flat, slant } = labelFor(r);
                const labelStyle = { fontFamily: "var(--font-serif, Georgia, serif)", fontWeight: 500, fill: "var(--ink)", opacity: dim ? 0.55 : 1 };
                return (
                  <g key={`${r.ci}-${r.from}`}>
                    <path
                      d={`M${x + 2} ${bracketY + TICK} V${bracketY} H${x + w - 2} V${bracketY + TICK}`}
                      fill="none"
                      strokeLinecap="round"
                      style={{ stroke: isSel ? "var(--accent)" : "var(--ink-muted)", strokeWidth: isSel ? 2 : 1.3, opacity: dim ? 0.4 : 1 }}
                    />
                    {flat && (
                      <text x={x + w / 2} y={bracketY - 6} textAnchor="middle" style={{ ...labelStyle, fontSize: flat === nm ? 14 : 12, fill: isSel ? "var(--accent)" : "var(--ink)" }}>
                        {flat}
                      </text>
                    )}
                    {slant && (
                      <text transform={`translate(${x + w / 2 - 2} ${bracketY - 5}) rotate(-60)`} textAnchor="start" style={{ ...labelStyle, fontSize: 11, fill: isSel ? "var(--accent)" : "var(--ink)" }}>
                        {slant}
                      </text>
                    )}
                  </g>
                );
              })}
              {years.map((y, i) => {
                const t = y.ranked[0];
                if (!t || t.value <= 0) return null;
                const h = Math.max(2, (t.value / maxTop) * maxH);
                const x = MX + i * step + (step - bw) / 2;
                const dim = dimYear(y);
                return (
                  <g key={y.fy} opacity={dim ? 0.3 : 1}>
                    <rect x={x} y={baseY - h} width={bw} height={h} style={{ fill: REGION_COLOR[t.group] }} />
                    <SegmentLabel x={x + bw / 2} y={baseY - h / 2} h={h} w={bw} text={compactCount(t.value)} />
                    {y.fy === fy && <rect x={x - 1} y={baseY - h - 1} width={bw + 2} height={h + 1} rx={1} style={{ fill: "none", stroke: "var(--ink)", strokeWidth: 1.2 }} />}
                    {y.preliminary && <rect x={x} y={baseY - h} width={bw} height={h} fill={`url(#${hatchId})`} />}
                  </g>
                );
              })}
              <line x1={MX} x2={W - MR} y1={baseY} y2={baseY} style={{ stroke: "var(--line-strong)" }} />
              {years.map((y, i) =>
                y.fy % yearLabelEvery(step) === 0 ? (
                  <text key={y.fy} className="axis-tick-label" x={MX + i * step + step / 2} y={baseY + 15} textAnchor="middle" style={y.fy === fy ? { fill: "var(--ink)", fontWeight: 600 } : undefined}>
                    {y.fy}
                  </text>
                ) : null,
              )}
              <TermBandSvg segments={segments} x0={MX} step={step} y={baseY + 24} />
              {peak?.ranked[0] &&
                (() => {
                  const i = years.indexOf(peak);
                  const h = (topVal(peak) / maxTop) * maxH;
                  const lab = compactCount(topVal(peak));
                  const tw = lab.length * 6.4;
                  const cx = Math.min(Math.max(MX + i * step + step / 2, MX + tw / 2), W - MR - tw / 2);
                  return (
                    <text className="axis-tick-label" x={cx} y={baseY - h - 5} textAnchor="middle">
                      {lab}
                    </text>
                  );
                })()}
            </>
          )}
        </ChartFrame>
        <Tooltip state={tip.state}>{(y) => <TopTip y={y} payload={payload} />}</Tooltip>
      </div>

      <div className={`mt-2.5 ${LEGEND_ROW_CAPPED}`}>
        {regionsPresent.map((g) => (
          <LegendToggle key={g} active={pickRegion === g} dimmed={pickRegion !== null && pickRegion !== g} onClick={() => toggleRegion(g)}>
            <i aria-hidden className="inline-block h-[10px] w-[10px] rounded-[2px]" style={{ background: REGION_COLOR[g] }} />
            {GEO_NAME[g].short}
          </LegendToggle>
        ))}
        {anyPrelim && (
          <span className={LEGEND_ITEM}>
            <i className="inline-block h-[10px] w-[10px] rounded-[2px] border border-line-strong" style={{ background: "repeating-linear-gradient(45deg, var(--ink-muted) 0 2px, transparent 2px 5px)" }} />
            Preliminary
          </span>
        )}
      </div>

      <ChartNotesRow>
        <MethodologyNote>
          <p>
            The country with the most refugees admitted in each fiscal year, by country of chargeability (normally the applicant&rsquo;s nationality, which can differ from the country they fled).
            {cur?.ranked[0] && <> FY{cur.fy}: {names[cur.ranked[0].ci].name}, {n(cur.ranked[0].value)}, {Math.round((cur.ranked[0].value / cur.total) * 100)}% of refugees admitted{cur.preliminary ? " (preliminary)" : ""}.</>} A bracket spans the years one country stayed No. 1. Bars are colored by the country&rsquo;s region and hatched where the year is preliminary (FY2026). Click or drag across the chart to choose the year shown in the cards above. <SourceLink id="wraps-admissions">State Department</SourceLink> data.
          </p>
        </MethodologyNote>
        <details className="mt-3 text-[0.8rem] text-ink-muted">
          <summary className={TABLE_TOGGLE}>View as table</summary>
          <div className="mt-2 max-h-60 overflow-auto rounded-md border border-line">
            <table className="w-full min-w-[30rem] border-collapse text-right">
              <caption className="sr-only">Largest source country of refugees by fiscal year</caption>
              <thead>
                <tr>
                  <th className={TH}>Fiscal year</th>
                  <th className={TH}>No. 1</th>
                  <th className={TH}>Region</th>
                  <th className={TH}>Admitted</th>
                  <th className={TH}>Share</th>
                </tr>
              </thead>
              <tbody>
                {[...years].reverse().map((y) => {
                  const t = y.ranked[0];
                  return (
                    <tr key={y.fy}>
                      <td className={TD}>
                        FY{y.fy}
                        {y.preliminary ? " (preliminary)" : ""}
                      </td>
                      <td className={`${TD} !font-sans`} style={{ textAlign: "left" }}>{t ? names[t.ci].name : "–"}</td>
                      <td className={`${TD} !font-sans`} style={{ textAlign: "left" }}>{t ? GEO_NAME[t.group].name : "–"}</td>
                      <td className={TD}>{t ? n(t.value) : "–"}</td>
                      <td className={TD}>{t ? `${Math.round((t.value / y.total) * 100)}%` : "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      </ChartNotesRow>
    </ChartCard>
  );
}

function TopTip({ y, payload }: { y: TopYear; payload: RefugeePayload }) {
  const names = payload.countries;
  const year = payload.years.find((v) => v.fy === y.fy);
  const term = payload.terms.find((t) => t.termId === year?.termId)?.last;
  const top = y.ranked[0];
  return (
    <div>
      <div style={{ fontWeight: 600 }}>
        FY{y.fy}
        {term ? ` · ${term}` : ""}
      </div>
      <div className="tt-mono" style={{ marginBottom: 4 }}>
        Largest source countries{y.preliminary ? " · preliminary" : ""}
      </div>
      {y.ranked.map((r, i) => (
        <div key={r.ci} style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
          <span>
            {i + 1}. {names[r.ci].name}
          </span>
          <span className="tt-mono">{n(r.value)}</span>
        </div>
      ))}
      {top && (
        <>
          <div className="tt-mono" style={{ margin: "6px 0 2px" }}>{names[top.ci].name} · {GEO_NAME[top.group].name}</div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
            <span>Share of refugees admitted</span>
            <span className="tt-mono">{Math.round((top.value / y.total) * 100)}%</span>
          </div>
        </>
      )}
    </div>
  );
}

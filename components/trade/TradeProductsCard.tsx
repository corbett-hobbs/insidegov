"use client";

import { memo, useMemo, useState, type ReactNode } from "react";
import { TABLE_TOGGLE } from "@/components/charts/table-toggle";
import { ChartCard } from "@/components/charts/ChartCard";
import { ChartNotesRow } from "@/components/charts/ChartNotesRow";
import { LEGEND_ITEM, LEGEND_ROW } from "@/components/charts/legend";
import { PillGroup } from "@/components/charts/PillGroup";
import { StackedRows, type StackedRowData } from "@/components/charts/StackedRows";
import { ToggleReadout } from "@/components/charts/ToggleReadout";
import { YearPicker } from "@/components/charts/YearPicker";
import { MethodologyNote } from "@/components/MethodologyNote";
import { SourceLink } from "@/components/SourceLink";
import { MONTH_NAMES } from "@/lib/indicator-time";
import { HS_CHAPTERS } from "@/lib/trade-hs-chapters";
import {
  fmtDollars,
  fmtPct,
  partnersOf,
  periodText,
  productsView,
  specialNote,
  type PartnerLine,
  type ProductLine,
  type ProductPartnersPayload,
  type ProductsFlow,
  type ProductsLag,
  type ProductsView,
  type TradeProductsPayload,
} from "@/lib/trade-products";
import { TRADE_TAKEAWAYS } from "./takeaways";

const FLOWS = [
  { value: "exports", label: "Exports" },
  { value: "imports", label: "Imports" },
] as const;

/** One solid colour for every bar (rule 8): each list is a single series, and the toggle says which flow. */
const BAR = "var(--ink-muted)";
const CAPTION = "m-0 font-mono text-[0.65rem] uppercase tracking-[0.06em] text-ink-muted";

const DataTable = memo(function DataTable({ view, where }: { view: ProductsView; where: string }) {
  const imports = view.flow === "imports";
  const head = (cells: string[]) => (
    <thead className="sticky top-0 bg-surface-raised">
      <tr className="font-mono text-[0.65rem] uppercase tracking-[0.05em] text-ink-muted">
        {cells.map((c) => (
          <th key={c} scope="col" className="px-2 py-1.5">{c}</th>
        ))}
      </tr>
    </thead>
  );
  const cols = imports ? ["HS", "Product", "Imports", "Share", "Duty rate"] : ["HS", "Product", "Exports", "Share"];
  const body = (lines: ProductLine[]) => (
    <tbody>
      {lines.map((l) => (
        <tr key={l.code} className="border-t border-line">
          <td className="px-2 py-1 font-mono">{l.code}</td>
          <th scope="row" className="px-2 py-1 font-normal">{l.name}</th>
          <td className="px-2 py-1">{fmtDollars(l.value)}</td>
          <td className="px-2 py-1">{fmtPct(l.share)}</td>
          {imports && <td className="px-2 py-1">{l.rate === null ? "—" : fmtPct(l.rate)}</td>}
        </tr>
      ))}
    </tbody>
  );
  const period = periodText(view.year, view.months, MONTH_NAMES);
  return (
    <details className="mt-3">
      <summary className={TABLE_TOGGLE}>View as table</summary>
      <p className="m-0 mt-1.5 text-[0.75rem] text-ink-muted">
        Every chapter, then the top products, for {where}, {period}, for screen readers and copying.{imports ? " Duty rate: calculated duties over imports for consumption." : ""}
      </p>
      <div className="mt-2 max-h-72 overflow-auto">
        <table className="w-full border-collapse text-left text-[0.75rem] tabular-nums">
          <caption className="sr-only">{`U.S. goods ${view.flow} by HS chapter, ${where}, ${period}`}</caption>
          {head(cols)}
          {body(view.chapters)}
        </table>
        <table className="mt-4 w-full border-collapse text-left text-[0.75rem] tabular-nums">
          <caption className="sr-only">{`Top U.S. goods ${view.flow} by HS heading, ${where}, ${period}`}</caption>
          {head(cols)}
          {body(view.headings)}
        </table>
        {view.special.length > 0 && (
          <table className="mt-4 w-full border-collapse text-left text-[0.75rem] tabular-nums">
            <caption className="sr-only">{`Special entries, not ranked as products, ${where}, ${period}`}</caption>
            {head(["HS", "Special entry (not ranked)", imports ? "Imports" : "Exports"])}
            <tbody>
              {view.special.map((s) => (
                <tr key={s.code} className="border-t border-line">
                  <td className="px-2 py-1 font-mono">{s.code}</td>
                  <th scope="row" className="px-2 py-1 font-normal">{s.label}</th>
                  <td className="px-2 py-1">{fmtDollars(s.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </details>
  );
});

/** An open line: which list it is in, and its code (two digits for a chapter, four for a product). */
interface Open {
  level: "chapter" | "heading";
  code: string;
}

/**
 * The countries behind an open line, under its row: same columns as the list (rank, name, bar, dollars, duty rate or
 * share), the bar measured against the line's own total so it reads as the country's share of it.
 */
function CountriesPanel({ line, flow, partners, state }: { line: ProductLine; flow: ProductsFlow; partners: PartnerLine[] | null; state: "loading" | "error" | "ok" }): ReactNode {
  const imports = flow === "imports";
  const note = (text: string) => <p className="m-0 px-2 py-2 text-[0.78rem] text-ink-muted">{text}</p>;
  // The list rows' own grid (`StackedRows`: rank, label, bar, dollars, rate; the bar drops to its own line under 400px), so the bar and the numbers sit under the row's.
  const GRID = "grid grid-cols-[24px_minmax(110px,260px)_minmax(60px,1fr)_50px_44px] items-center gap-x-2 px-2 @max-[400px]:grid-cols-[24px_1fr_auto_auto]";
  let body: ReactNode;
  if (state === "error") body = note("Couldn’t load the countries. Tap the line again to retry.");
  else if (state === "loading") body = note("Loading the countries…");
  else if (!partners || partners.length === 0) body = note("No countries recorded for this product.");
  else {
    const covered = partners.reduce((a, p) => a + p.share, 0);
    const caption = `Top ${partners.length} ${imports ? "suppliers" : "buyers"} · ${fmtPct(Math.min(1, covered))} of line`;
    // One bar on the line's own scale, one segment per country in steps of one grey, then one row per country under it.
    const tone = (i: number) => `color-mix(in oklab, var(--ink-muted) ${100 - i * 17}%, var(--surface))`;
    body = (
      <>
        <div className={`${GRID} gap-y-1`}>
          <span className={`${CAPTION} col-[1/4] @max-[400px]:col-[1/3]`}>{caption}</span>
          <span className={`${CAPTION} col-[4/6] text-right @max-[400px]:col-[3/5]`}>{imports ? "Duty rate" : "Share"}</span>
          <span className="col-[3] flex h-[11px] overflow-hidden rounded-[2px] bg-[color-mix(in_oklab,var(--ink)_5%,transparent)] @max-[400px]:col-[2/-1]" role="img" aria-label={caption}>
            {partners.map((p, i) => (
              <i key={p.code} className="block h-full" style={{ width: `${(p.value / line.value) * 100}%`, background: tone(i) }} title={`${p.name}: ${fmtDollars(p.value)}, ${fmtPct(p.share)} of ${line.name}`} />
            ))}
          </span>
        </div>
        <ol className="m-0 mt-1 list-none p-0 text-[0.82rem] text-ink">
          {partners.map((p, i) => (
            <li key={p.code} className={`${GRID} py-0.5`}>
              <svg width="8" height="8" aria-hidden className="justify-self-end">
                <rect width="8" height="8" rx="2" fill={tone(i)} />
              </svg>
              <span className="col-[2/4] truncate @max-[400px]:col-[2]" title={p.name}>{p.name}</span>
              <span className="text-right font-mono text-[0.75rem] tabular-nums">{fmtDollars(p.value)}</span>
              <span className="whitespace-nowrap text-left font-mono text-[0.7rem] tabular-nums text-ink-muted">{imports ? (p.rate === null ? "—" : fmtPct(p.rate)) : fmtPct(p.share)}</span>
            </li>
          ))}
        </ol>
      </>
    );
  }
  return <div className="mb-1.5 mt-0.5 rounded-md bg-[color-mix(in_oklab,var(--ink)_4%,transparent)] py-1.5">{body}</div>;
}

/**
 * "What the U.S. trades": goods by Harmonized System chapter, ranked by dollars, beside the top products
 * (four-digit headings), for the year the partners card above shows (the page's one selected year; this card's
 * own YearPicker sets the same year) and the page's Country filter (all countries when none is picked). An
 * Exports / Imports toggle; imports carry each chapter's collected rate (calculated duties over imports for
 * consumption). Chapters 98 and 99 are never ranked: they are a footnote line under the lists. Clicking a
 * chapter highlights its products and dims the rest (rule 4: a comparison highlights, never narrows); clicking a
 * product highlights its chapter. With all countries showing, a clicked line also opens a panel under its row with the
 * five countries that sent or took the most of it (`CountriesPanel`; data: `/data/trade/product-partners/[year]`, fetched the
 * first time a line opens, for the year on screen); with one country picked there is nothing to break down, so a click only highlights.
 * Model: `lib/trade-products.ts`; data: `/data/trade/products/[code]`.
 */
export function TradeProductsCard({
  payload,
  year,
  onYear,
  firstYear,
  lastYear,
  through,
  country,
  countryName,
  hasData,
  lag,
  loading,
  error,
  partners,
  partnersState,
  onWantPartners,
}: {
  payload: TradeProductsPayload | null;
  year: number;
  onYear: (y: number) => void;
  firstYear: number;
  lastYear: number;
  /** Last month of the latest data ("August"), for the takeaway. */
  through: string;
  country: string | null;
  countryName: string | null;
  /** False when the picked country has no product file (a former partner, say). */
  hasData: boolean;
  lag: (ProductsLag & { name: string })[];
  loading: boolean;
  error: boolean;
  /** The top countries behind each product for the year on screen, once fetched (the page fetches it after `onWantPartners` is first called). */
  partners: ProductPartnersPayload | null;
  partnersState: "idle" | "loading" | "error" | "ok";
  onWantPartners: () => void;
}) {
  const [flow, setFlow] = useState<ProductsFlow>("exports");
  const [open, setOpen] = useState<Open | null>(null);
  const view = useMemo(() => (payload && year >= firstYear ? productsView(payload, year, flow) : null), [payload, year, firstYear, flow]);
  const partial = !!view && view.months < 12;
  const where = countryName ?? "all countries";
  const title = `What the U.S. trades${countryName ? ` with ${countryName}` : ""}, ${year}${partial ? " so far" : ""}`;
  const imports = flow === "imports";
  // The highlighted chapter: the open chapter, or the chapter of the open product.
  const openChapter = open ? (open.level === "chapter" ? open.code : open.code.slice(0, 2)) : null;
  const active = openChapter !== null && view?.chapters.some((c) => c.code === openChapter) ? openChapter : null;
  const toggle = (level: Open["level"], code: string) => {
    setOpen((o) => (o?.level === level && o.code === code ? null : { level, code }));
    if (!country) onWantPartners();
  };
  const panelFor = (l: ProductLine, level: Open["level"]): ReactNode =>
    country === null && open?.level === level && open.code === l.code ? (
      <CountriesPanel
        line={l}
        flow={flow}
        partners={partners ? partnersOf(partners, year, flow, level, l.code, l.value) : null}
        state={partnersState === "error" ? "error" : partners ? "ok" : "loading"}
      />
    ) : undefined;

  const scaleMax = Math.max(1, view?.chapters[0]?.value ?? 1);
  const rowsOf = (lines: ProductLine[], isChapter: boolean): StackedRowData[] =>
    lines.map((l, i) => ({
      expandable: country === null,
      detail: panelFor(l, isChapter ? "chapter" : "heading"),
      id: l.code,
      rank: i + 1,
      label: l.name,
      segments: [{ value: l.value, color: BAR, title: `${l.name}: ${fmtDollars(l.value)}` }],
      total: fmtDollars(l.value),
      delta: imports ? (l.rate === null ? "—" : fmtPct(l.rate)) : fmtPct(l.share),
      selected: active !== null && (isChapter ? l.code === active : l.chapter === active),
      dimmed: active !== null && (isChapter ? l.code !== active : l.chapter !== active),
    }));
  const chapterRows = view ? rowsOf(view.chapters, true) : [];
  const headingRows = view ? rowsOf(view.headings, false) : [];
  const note = view ? specialNote(view) : null;
  const lagNotes = lag.filter((l) => l.year === year && l.flow === flow && (country === null || l.code === country));

  const line = view
    ? {
        values: [fmtDollars(view.total)],
        headline: fmtDollars(view.total),
        date: `Goods ${flow}, ${periodText(view.year, view.months, MONTH_NAMES)}`,
        term: view.rate !== null ? `Duty rate ${fmtPct(view.rate)}` : undefined,
      }
    : null;

  const empty = (() => {
    if (!hasData) return `Census reports no goods by product for ${countryName}.`;
    if (year < firstYear) return null; // its own message, with a button
    if (error) return `Couldn’t load the products for ${where}. Pick the country again to retry.`;
    if (!payload || loading) return `Loading ${where}…`;
    if (!view) return `No goods ${flow} ${countryName ? `to or from ${countryName}` : ""} recorded in ${year}.`.replace("  ", " ");
    return null;
  })();

  return (
    <ChartCard
      className="min-w-0"
      title={title}
      takeaway={countryName ? undefined : TRADE_TAKEAWAYS.products.takeaway(through)}
      lede={countryName ? `Goods ${flow === "exports" ? "sold to" : "bought from"} ${countryName}, by product.` : undefined}
      action={<YearPicker value={Math.max(year, firstYear)} range={[firstYear, lastYear]} onChange={onYear} format={String} ariaLabel="Year shown in the products lists (and the partners card)" />}
    >
      <ToggleReadout
        toggle={<PillGroup options={FLOWS} value={flow} onChange={(f) => setFlow(f as ProductsFlow)} ariaLabel="Exports or imports" />}
        line={line}
        pinned={false}
        onClear={() => setOpen(null)}
        hint=""
      />

      {year < firstYear && hasData ? (
        <div role="status" className="mt-3 flex min-h-[10rem] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-line px-4 text-center text-[0.85rem] text-ink-muted">
          Goods by product start in {firstYear}; the partners card above is showing {year}.
          <button type="button" onClick={() => onYear(firstYear)} className="rounded-md border border-line-strong bg-surface-raised px-3 py-1 text-[0.8rem] text-ink hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
            Show {firstYear}
          </button>
        </div>
      ) : empty ? (
        <div role="status" className="mt-3 flex min-h-[10rem] items-center justify-center rounded-md border border-dashed border-line px-4 text-center text-[0.85rem] text-ink-muted">
          {empty}
        </div>
      ) : (
        view && (
          <>
            {country === null && <p className="m-0 mt-3 px-2 text-[0.78rem] text-ink-muted">Tap a line to see the five countries behind it.</p>}
            <div className="mt-3 grid min-w-0 grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
              <div className="flex min-w-0 flex-col">
                <div className="flex items-baseline justify-between gap-2 px-2">
                  <h3 className={CAPTION}>By chapter · {view.chapters.length}</h3>
                  <span className={CAPTION}>{imports ? "Duty rate" : "Share"}</span>
                </div>
                {/* Phones: a fixed-height scroll box (rule 11a). Desktop: fills the height the products column sets. */}
                <div className="relative mt-1 h-[22rem] lg:h-auto lg:min-h-[18rem] lg:flex-1">
                  <div className="absolute inset-0 overflow-y-auto overscroll-contain touch-scroll" tabIndex={0} aria-label="Chapters, scrollable">
                    <StackedRows rows={chapterRows} scaleMax={scaleMax} onRowClick={(code) => toggle("chapter", code)} ariaLabel={`U.S. goods ${flow} by HS chapter, ${where}, ${year}, largest first`} emptyText="No goods recorded." wideLabels />
                  </div>
                </div>
              </div>
              <div className="flex min-w-0 flex-col">
                {/* The highlight note sits in the header row, so opening a line never pushes this list below the chapters list. */}
                <div className="flex h-4 items-baseline gap-2 px-2 leading-4">
                  <h3 className={`${CAPTION} shrink-0`}>Top products</h3>
                  {active ? (
                    <span className="flex min-w-0 flex-1 items-baseline gap-1.5 text-[0.75rem] normal-case tracking-normal text-ink-muted">
                      <span className="truncate" title={HS_CHAPTERS[active]?.name ?? active}>
                        {`· ${HS_CHAPTERS[active]?.name ?? active}${headingRows.some((r) => r.selected) ? "" : " (none here)"}`}
                      </span>
                      <button type="button" onClick={() => setOpen(null)} className="shrink-0 text-ink underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
                        Clear
                      </button>
                    </span>
                  ) : (
                    <span className="flex-1" />
                  )}
                  <span className={`${CAPTION} shrink-0`}>{imports ? "Duty rate" : "Share"}</span>
                </div>
                <div className="mt-1 max-h-[22rem] overflow-y-auto overscroll-contain touch-scroll lg:max-h-[26rem]" tabIndex={0} aria-label="Top products, scrollable">
                  <StackedRows
                    rows={headingRows}
                    scaleMax={scaleMax}
                    onRowClick={(code) => toggle("heading", code)}
                    ariaLabel={`Top U.S. goods ${flow} by HS heading, ${where}, ${year}, largest first`}
                    emptyText="No products recorded."
                    wideLabels
                  />
                </div>
              </div>
            </div>
            {note && <p className="m-0 mt-3 px-2 text-[0.78rem] leading-[1.5] text-ink-muted">{note}</p>}
            <div className={`${LEGEND_ROW} mt-2 px-2`}>
              <span className={LEGEND_ITEM}>
                <svg width="10" height="10" aria-hidden>
                  <rect width="10" height="10" rx="2" fill={BAR} />
                </svg>
                {imports ? "Imports" : "Exports"}, dollars (both lists on one scale)
              </span>
              <span className={LEGEND_ITEM}>{imports ? "Duty rate: calculated duties ÷ imports for consumption" : "Share: of all goods exports"}</span>
            </div>
          </>
        )
      )}

      <ChartNotesRow>
        <MethodologyNote>
          <p>
            <SourceLink id="census-trade">Census Bureau</SourceLink> goods trade by Harmonized System chapter (96 product groups) and the largest four-digit headings within them, 2010 on, in dollars: total exports and general imports, the same totals as the cards above. The duty rate is calculated duties over imports for consumption. Chapters 98 and 99 (returned American goods, repairs, estimated low-value shipments) are not products, so they are not ranked; the line under the lists sums them. Opening a line names the five countries with the most of it, on the same dollars, each with its own duty rate on imports.
            {partial && view ? ` ${view.year} covers January to ${MONTH_NAMES[view.months - 1]}.` : ""}
            {lagNotes.map((l) => ` ${l.flow === "exports" ? "Exports to" : "Imports from"} ${l.name} in ${l.year} so far are ${fmtPct(Math.abs(l.gap))} ${l.gap < 0 ? "below" : "above"} the goods file in the cards above, which already carries Census's revisions to earlier months; full years match.`).join("")}
          </p>
        </MethodologyNote>
        {view && <DataTable view={view} where={where} />}
      </ChartNotesRow>
    </ChartCard>
  );
}

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
import { EnduseYearsChart } from "./EnduseYearsChart";
import { MethodologyNote } from "@/components/MethodologyNote";
import { SourceLink } from "@/components/SourceLink";
import { MONTH_NAMES } from "@/lib/indicator-time";
import { ENDUSE_GROUPS, enduseCategoryByYear, enduseColor, enduseGroupIndex, enduseSeries, endusePartnersOf, enduseView, OTHER_COLOR, type EndusePartnersPayload, type TradeEndusePayload } from "@/lib/trade-enduse";
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

/** The same goods two ways: Harmonized System products, or Census end-use categories. */
const MODES = [
  { value: "product", label: "By product" },
  { value: "use", label: "By use" },
] as const;
type Mode = (typeof MODES)[number]["value"];

const FLOWS = [
  { value: "exports", label: "Exports" },
  { value: "imports", label: "Imports" },
] as const;

/** One solid colour for every bar (rule 8): each list is a single series, and the toggle says which flow. */
const BAR = "var(--ink-muted)";
const CAPTION = "m-0 font-mono text-[0.65rem] uppercase tracking-[0.06em] text-ink-muted";

/** One ranked list in the table fallback: its screen-reader caption and its lines. */
interface TableSection {
  caption: string;
  lines: ProductLine[];
}

/**
 * The table fallback for either view: the ranked lists (chapters then top products, or the categories), then the special
 * entries. `code` and `name` head the first two columns ("HS" / "Product", or "Code" / "Category").
 */
const DataTable = memo(function DataTable({ view, sections, code, name, intro, where }: { view: Pick<ProductsView, "flow" | "year" | "months" | "special">; sections: TableSection[]; code: string; name: string; intro: string; where: string }) {
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
  const cols = imports ? [code, name, "Imports", "Share", "Duty rate"] : [code, name, "Exports", "Share"];
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
        {intro}, for {where}, {period}, for screen readers and copying.{imports ? " Duty rate: calculated duties over imports for consumption." : ""}
      </p>
      <div className="mt-2 max-h-72 overflow-auto">
        {sections.map((t, i) => (
          <table key={t.caption} className={`${i > 0 ? "mt-4 " : ""}w-full border-collapse text-left text-[0.75rem] tabular-nums`}>
            <caption className="sr-only">{`${t.caption}, ${where}, ${period}`}</caption>
            {head(cols)}
            {body(t.lines)}
          </table>
        ))}
        {view.special.length > 0 && (
          <table className="mt-4 w-full border-collapse text-left text-[0.75rem] tabular-nums">
            <caption className="sr-only">{`Special entries, not ranked, ${where}, ${period}`}</caption>
            {head([code, "Special entry (not ranked)", imports ? "Imports" : "Exports"])}
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

/** An open line: which list it is in, and its code (two digits for a chapter, four for a product, five for a category in the "By use" view). */
interface Open {
  level: "chapter" | "heading" | "category";
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
  else if (!partners || partners.length === 0) body = note("No countries recorded for this line.");
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

/** The "By use" view's data, fetched by the page the first time someone switches to it (`onWant`). */
export interface ByUseProps {
  payload: TradeEndusePayload | null;
  /** False when the picked country has no end-use file. */
  hasData: boolean;
  loading: boolean;
  error: boolean;
  onWant: () => void;
  /** The top countries behind each category for the year on screen, once fetched (after `onWantPartners`). */
  partners: EndusePartnersPayload | null;
  partnersState: "idle" | "loading" | "error" | "ok";
  onWantPartners: () => void;
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
 *
 * A By product / By use toggle switches the same card (same year, Country filter, flow) to Census end-use categories
 * (aircraft, computers, semiconductors, cell phones): one ranked list drawn with the same rows, countries panel, footnote and
 * table, its special entries (minimum-value shipments, returned goods) in the footnote. With one country picked its rows do
 * not open (as for products) and, with no chapter to highlight, do nothing. Model: `lib/trade-enduse.ts`; data:
 * `/data/trade/enduse/[code]` and `/data/trade/enduse-partners/[year]`.
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
  byUse,
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
  byUse: ByUseProps;
}) {
  const [mode, setMode] = useState<Mode>("product");
  const [flow, setFlow] = useState<ProductsFlow>("exports");
  const [open, setOpen] = useState<Open | null>(null);
  const use = mode === "use";
  const productView = useMemo(() => (!use && payload && year >= firstYear ? productsView(payload, year, flow) : null), [use, payload, year, firstYear, flow]);
  const useView = useMemo(() => (use && byUse.payload && year >= firstYear ? enduseView(byUse.payload, year, flow) : null), [use, byUse.payload, year, firstYear, flow]);
  const view = use ? useView : productView;
  // The by-year chart's stack: Census's five end-use groups, each one colour (also drawn on every category's row in the list).
  const series = useMemo(() => (use && byUse.payload ? enduseSeries(byUse.payload, flow) : null), [use, byUse.payload, flow]);
  const partial = !!view && view.months < 12;
  const where = countryName ?? "all countries";
  const title = `What the U.S. trades${countryName ? ` with ${countryName}` : ""}, ${year}${partial ? " so far" : ""}`;
  const imports = flow === "imports";
  const rateHead = imports ? "Duty rate" : "Share";
  // The highlighted chapter: the open chapter, or the chapter of the open product. Categories have none.
  const openChapter = open && open.level !== "category" ? (open.level === "chapter" ? open.code : open.code.slice(0, 2)) : null;
  const active = openChapter !== null && productView?.chapters.some((c) => c.code === openChapter) ? openChapter : null;
  const toggle = (level: Open["level"], code: string) => {
    if (country) {
      // One country: nothing to break down. A product still highlights its chapter; a category has nothing to highlight.
      if (level !== "category") setOpen((o) => (o?.level === level && o.code === code ? null : { level, code }));
      return;
    }
    setOpen((o) => (o?.level === level && o.code === code ? null : { level, code }));
    (level === "category" ? byUse.onWantPartners : onWantPartners)();
  };
  const pickMode = (m: Mode) => {
    setMode(m);
    setOpen(null);
    if (m === "use") byUse.onWant();
  };
  const panelFor = (l: ProductLine, level: Open["level"]): ReactNode => {
    if (country !== null || open?.level !== level || open.code !== l.code) return undefined;
    const cat = level === "category";
    const file = cat ? byUse.partners : partners;
    const lines = !file ? null : cat ? endusePartnersOf(byUse.partners!, year, flow, l.code, l.value) : partnersOf(partners!, year, flow, level, l.code, l.value);
    return <CountriesPanel line={l} flow={flow} partners={lines} state={(cat ? byUse.partnersState : partnersState) === "error" ? "error" : file ? "ok" : "loading"} />;
  };

  const lines = useView ? useView.categories : productView?.chapters ?? [];
  const scaleMax = Math.max(1, lines[0]?.value ?? 1);
  const rowsOf = (lines: ProductLine[], level: Open["level"]): StackedRowData[] =>
    lines.map((l, i) => ({
      expandable: country === null,
      detail: panelFor(l, level),
      id: l.code,
      rank: i + 1,
      label: l.name,
      segments: [{ value: l.value, color: level === "category" && enduseGroupIndex(l.code) >= 0 ? enduseColor(enduseGroupIndex(l.code)) : BAR, title: `${l.name}: ${fmtDollars(l.value)}` }],
      total: fmtDollars(l.value),
      delta: imports ? (l.rate === null ? "—" : fmtPct(l.rate)) : fmtPct(l.share),
      selected: active !== null && (level === "chapter" ? l.code === active : l.chapter === active),
      dimmed: active !== null && (level === "chapter" ? l.code !== active : l.chapter !== active),
    }));
  const chapterRows = productView ? rowsOf(productView.chapters, "chapter") : [];
  const headingRows = productView ? rowsOf(productView.headings, "heading") : [];
  const categoryRows = useView ? rowsOf(useView.categories, "category") : [];
  const note = view ? specialNote(view, use ? "kinds of goods" : "products") : null;
  const lagNotes = lag.filter((l) => l.year === year && l.flow === flow && (country === null || l.code === country));

  const line = view
    ? {
        values: [fmtDollars(view.total)],
        headline: fmtDollars(view.total),
        date: `Goods ${flow}, ${periodText(view.year, view.months, MONTH_NAMES)}`,
        term: view.rate !== null ? `Duty rate ${fmtPct(view.rate)}` : undefined,
      }
    : null;

  const by = use ? "use" : "product";
  const empty = (() => {
    if (!(use ? byUse.hasData : hasData)) return `Census reports no goods by ${by} for ${countryName}.`;
    if (year < firstYear) return null; // its own message, with a button
    if (use ? byUse.error : error) return `Couldn’t load the goods by ${by} for ${where}. ${use ? "Switch to By use again" : "Pick the country again"} to retry.`;
    if (use ? !byUse.payload || byUse.loading : !payload || loading) return `Loading ${where}…`;
    if (!view) return `No goods ${flow} ${countryName ? `to or from ${countryName}` : ""} recorded in ${year}.`.replace("  ", " ");
    return null;
  })();

  return (
    <ChartCard
      className="min-w-0"
      title={title}
      takeaway={countryName ? undefined : (use ? TRADE_TAKEAWAYS.enduse : TRADE_TAKEAWAYS.products).takeaway(through)}
      lede={countryName ? `Goods ${flow === "exports" ? "sold to" : "bought from"} ${countryName}, by ${by}.` : undefined}
      action={<YearPicker value={Math.max(year, firstYear)} range={[firstYear, lastYear]} onChange={onYear} format={String} ariaLabel="Year shown in the products lists (and the partners card)" />}
    >
      <ToggleReadout
        toggle={
          <div className="flex flex-wrap gap-2">
            <PillGroup options={MODES} value={mode} onChange={(m) => pickMode(m as Mode)} ariaLabel="Goods by product or by use" />
            <PillGroup options={FLOWS} value={flow} onChange={(f) => setFlow(f as ProductsFlow)} ariaLabel="Exports or imports" />
          </div>
        }
        line={line}
        pinned={false}
        onClear={() => setOpen(null)}
        hint=""
      />

      {year < firstYear && (use ? byUse.hasData : hasData) ? (
        <div role="status" className="mt-3 flex min-h-[10rem] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-line px-4 text-center text-[0.85rem] text-ink-muted">
          Goods by {by} start in {firstYear}; the partners card above is showing {year}.
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
            {country === null && <p className="m-0 mt-3 px-2 text-[0.78rem] text-ink-muted">Tap a line to see the five countries behind it{use ? " and trace it across the years" : ""}.</p>}
            {useView ? (
              <div className="mt-3 grid min-w-0 grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
                <div className="flex min-w-0 flex-col">
                  <div className="flex h-4 items-baseline justify-between gap-2 px-2 leading-4">
                    <h3 className={CAPTION}>By use · {useView.categories.length}</h3>
                    <span className={CAPTION}>{rateHead}</span>
                  </div>
                  {/* One list of about 130 categories: a scroll box at every width (rule 11a), the same height as the By product lists. */}
                  <div className="mt-1 h-[22rem] overflow-y-auto overscroll-contain touch-scroll lg:h-[26rem]" tabIndex={0} aria-label="Categories, scrollable">
                    <StackedRows
                      rows={categoryRows}
                      scaleMax={scaleMax}
                      onRowClick={(code) => toggle("category", code)}
                      ariaLabel={`U.S. goods ${flow} by end-use category, ${where}, ${year}, largest first`}
                      emptyText="No goods recorded."
                      wideLabels
                    />
                  </div>
                </div>
                {series && (
                  <EnduseYearsChart
                    series={series}
                    year={year}
                    onYear={onYear}
                    code={open?.level === "category" ? open.code : null}
                    codeName={open?.level === "category" ? useView.categories.find((c) => c.code === open.code)?.name ?? null : null}
                    focus={open?.level === "category" && byUse.payload ? enduseCategoryByYear(byUse.payload, flow, series, open.code) : null}
                  />
                )}
              </div>
            ) : (
              productView && (
                <div className="mt-3 grid min-w-0 grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
                  <div className="flex min-w-0 flex-col">
                    <div className="flex items-baseline justify-between gap-2 px-2">
                      <h3 className={CAPTION}>By chapter · {productView.chapters.length}</h3>
                      <span className={CAPTION}>{rateHead}</span>
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
                      <span className={`${CAPTION} shrink-0`}>{rateHead}</span>
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
              )
            )}
            {note && <p className="m-0 mt-3 px-2 text-[0.78rem] leading-[1.5] text-ink-muted">{note}</p>}
            <div className={`${LEGEND_ROW} mt-2 px-2`}>
              {use && series ? (
                <>
                  {ENDUSE_GROUPS.map((t, i) => (
                    <span key={t.code} className={LEGEND_ITEM}>
                      <svg width="10" height="10" aria-hidden>
                        <rect width="10" height="10" rx="2" fill={enduseColor(i)} />
                      </svg>
                      {t.name}
                    </span>
                  ))}
                  <span className={LEGEND_ITEM}>
                    <svg width="10" height="10" aria-hidden>
                      <rect width="10" height="10" rx="2" fill={OTHER_COLOR} />
                    </svg>
                    Other &amp; special
                  </span>
                </>
              ) : (
                <span className={LEGEND_ITEM}>
                  <svg width="10" height="10" aria-hidden>
                    <rect width="10" height="10" rx="2" fill={BAR} />
                  </svg>
                  {imports ? "Imports" : "Exports"}, dollars (both lists on one scale)
                </span>
              )}
              <span className={LEGEND_ITEM}>{imports ? "Duty rate: calculated duties ÷ imports for consumption" : "Share: of all goods exports"}</span>
            </div>
          </>
        )
      )}

      <ChartNotesRow>
        <MethodologyNote>
          {use ? (
            <p>
              <SourceLink id="census-trade">Census Bureau</SourceLink> goods trade by end-use category (what goods are used for, about 140 kinds from soybeans to semiconductors), 2010 on, the first year Census publishes it, in dollars: total exports and general imports, the same totals as the cards above. Exports publish civilian aircraft, engines and parts as one line; imports split them into three, so add those up to compare. Minimum-value shipments, returned U.S. goods and other special transactions are not kinds of goods, so they are not ranked; the line under the list sums them. Opening a line names its top five countries and draws its slice in dark, inside its group, across every year in the chart beside the list. The chart stacks Census’s five end-use groups (foods, industrial supplies, capital goods, autos, consumer goods; the colour is also on each category’s bar in the list), and the small remainder, other goods and the special entries, in grey; its line follows the year picked or played.
              {partial && view ? ` ${view.year} covers January to ${MONTH_NAMES[view.months - 1]}.` : ""}
              {lagNotes.map((l) => lagText(l)).join("")}
            </p>
          ) : (
            <p>
              <SourceLink id="census-trade">Census Bureau</SourceLink> goods trade by Harmonized System chapter (96 product groups) and the largest four-digit headings within them, 2010 on, in dollars: total exports and general imports, the same totals as the cards above. The duty rate is calculated duties over imports for consumption. Chapters 98 and 99 (returned American goods, repairs, estimated low-value shipments) are not products, so they are not ranked; the line under the lists sums them. Opening a line names the five countries with the most of it, on the same dollars, each with its own duty rate on imports.
              {partial && view ? ` ${view.year} covers January to ${MONTH_NAMES[view.months - 1]}.` : ""}
              {lagNotes.map((l) => lagText(l)).join("")}
            </p>
          )}
        </MethodologyNote>
        {useView ? (
          <DataTable view={useView} sections={[{ caption: `U.S. goods ${flow} by end-use category`, lines: useView.categories }]} code="Code" name="Category" intro="Every category" where={where} />
        ) : (
          productView && (
            <DataTable
              view={productView}
              sections={[
                { caption: `U.S. goods ${flow} by HS chapter`, lines: productView.chapters },
                { caption: `Top U.S. goods ${flow} by HS heading`, lines: productView.headings },
              ]}
              code="HS"
              name="Product"
              intro="Every chapter, then the top products"
              where={where}
            />
          )
        )}
      </ChartNotesRow>
    </ChartCard>
  );
}

// The goods file already carries Census's revisions to earlier months; the product and end-use files (which agree) catch up later.
const lagText = (l: ProductsLag & { name: string }) =>
  ` ${l.flow === "exports" ? "Exports to" : "Imports from"} ${l.name} in ${l.year} so far are ${fmtPct(Math.abs(l.gap))} ${l.gap < 0 ? "below" : "above"} the goods file in the cards above, which already carries Census's revisions to earlier months; full years match.`;

"use client";

import { memo, useCallback, useRef, useState, type CSSProperties, type ReactNode } from "react";
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
import { breakdown, linkedCodes, type BreakdownKind, type BreakdownPart, type ChapterUsePayload } from "@/lib/trade-chapter-use";
import { endusePartnersOf, enduseView, type EndusePartnersPayload, type EnduseView, type TradeEndusePayload } from "@/lib/trade-enduse";
import { ENDUSE_LABELS } from "@/lib/trade-enduse-labels";
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

/** One solid colour for every bar in both lists (rule 8): each list is a single series, and the toggle says which flow. */
const BAR = "var(--ink-muted)";
const CAPTION = "m-0 font-mono text-[0.65rem] uppercase tracking-[0.06em] text-ink-muted";
/** The panel's rows use the list rows' own grid (`StackedRows` with `wideLabels`: rank, label, bar, dollars, last column), so its numbers sit under the row's. */
const GRID = "grid grid-cols-[24px_minmax(110px,260px)_minmax(60px,1fr)_50px_44px] items-center gap-x-2 px-2 @max-[400px]:grid-cols-[24px_1fr_auto_auto]";
/** Breakdown colours: five named parts, then grey for the Other line and lighter grey for special entries. */
const PART_COLOURS = ["var(--breakdown-1)", "var(--breakdown-2)", "var(--breakdown-3)", "var(--breakdown-4)", "var(--breakdown-5)"] as const;
const PART_OTHER = "var(--breakdown-other)";
const PART_SPECIAL = "color-mix(in oklab, var(--ink-muted) 45%, var(--surface))";
/** The countries: steps of one grey, so colour in an open panel always means a use or a chapter, never a country. */
const countryTone = (i: number) => `color-mix(in oklab, var(--ink-muted) ${100 - i * 17}%, var(--surface))`;

type Loaded = "loading" | "error" | "ok";

/** One ranked list in the table fallback. */
interface TableSection {
  caption: string;
  code: string;
  name: string;
  lines: ProductLine[];
  special: ProductsView["special"];
  specialHead: string;
}

/** The table fallback: every chapter, then every use, each followed by the special entries it leaves out. */
const DataTable = memo(function DataTable({ flow, period, sections, where }: { flow: ProductsFlow; period: string; sections: TableSection[]; where: string }) {
  const imports = flow === "imports";
  const head = (cells: string[]) => (
    <thead className="sticky top-0 bg-surface-raised">
      <tr className="font-mono text-[0.65rem] uppercase tracking-[0.05em] text-ink-muted">
        {cells.map((c) => (
          <th key={c} scope="col" className="px-2 py-1.5">{c}</th>
        ))}
      </tr>
    </thead>
  );
  return (
    <details className="mt-3">
      <summary className={TABLE_TOGGLE}>View as table</summary>
      <p className="m-0 mt-1.5 text-[0.75rem] text-ink-muted">
        Every chapter, then every use, for {where}, {period}, for screen readers and copying.{imports ? " Duty rate: calculated duties over imports for consumption." : ""}
      </p>
      <div className="mt-2 max-h-72 overflow-auto">
        {sections.map((t, i) => (
          <div key={t.caption}>
            <table className={`${i > 0 ? "mt-4 " : ""}w-full border-collapse text-left text-[0.75rem] tabular-nums`}>
              <caption className="sr-only">{`${t.caption}, ${where}, ${period}`}</caption>
              {head(imports ? [t.code, t.name, "Imports", "Share", "Duty rate"] : [t.code, t.name, "Exports", "Share"])}
              <tbody>
                {t.lines.map((l) => (
                  <tr key={l.code} className="border-t border-line">
                    <td className="px-2 py-1 font-mono">{l.code}</td>
                    <th scope="row" className="px-2 py-1 font-normal">{l.name}</th>
                    <td className="px-2 py-1">{fmtDollars(l.value)}</td>
                    <td className="px-2 py-1">{fmtPct(l.share)}</td>
                    {imports && <td className="px-2 py-1">{l.rate === null ? "—" : fmtPct(l.rate)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
            {t.special.length > 0 && (
              <table className="mt-2 w-full border-collapse text-left text-[0.75rem] tabular-nums">
                <caption className="sr-only">{`Special entries, not ranked as ${t.name.toLowerCase()}s, ${where}, ${period}`}</caption>
                {head([t.code, t.specialHead, imports ? "Imports" : "Exports"])}
                <tbody>
                  {t.special.map((s) => (
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
        ))}
      </div>
    </details>
  );
});

/** An open line: which list it is in, and its code (two digits for a chapter, five for a use). */
interface Open {
  kind: BreakdownKind;
  code: string;
}

const note = (text: string) => <p className="m-0 px-2 py-1 text-[0.78rem] text-ink-muted">{text}</p>;

/** One section of an open line's panel: a caption with a right-hand column head, one bar split into parts, then a row per part. */
function PanelSection({ caption, right, segments, children }: { caption: string; right: string; segments: { key: string; value: number; colour: string; title: string }[]; children: ReactNode }) {
  return (
    <>
      <div className={`${GRID} gap-y-1`}>
        <span className={`${CAPTION} col-[1/4] @max-[400px]:col-[1/3]`}>{caption}</span>
        <span className={`${CAPTION} col-[4/6] text-right @max-[400px]:col-[3/5]`}>{right}</span>
        <span className="col-[3] flex h-[11px] overflow-hidden rounded-[2px] bg-[color-mix(in_oklab,var(--ink)_5%,transparent)] @max-[400px]:col-[2/-1]" role="img" aria-label={caption}>
          {segments.map((s) => (
            <i key={s.key} className="block h-full border-r border-surface last:border-r-0" style={{ width: `${s.value * 100}%`, background: s.colour }} title={s.title} />
          ))}
        </span>
      </div>
      <ol className="m-0 mt-1 list-none p-0 text-[0.82rem] text-ink">{children}</ol>
    </>
  );
}

const swatch = (fill: string) => (
  <svg width="8" height="8" aria-hidden className="justify-self-end">
    <rect width="8" height="8" rx="2" fill={fill} />
  </svg>
);

const lowerFirst = (s: string) => (s.length > 1 && /[a-z]/.test(s[1]) ? s[0].toLowerCase() + s.slice(1) : s);

/**
 * "What it's used for" (an open chapter's end uses) or "Where it comes from" (an open use's chapters): the top five
 * parts and an Other line, each with its share of the line and, under its name, how much of that whole use (or
 * chapter) this line accounts for.
 */
function BreakdownSection({ line, kind, flow, parts, count, state }: { line: ProductLine; kind: BreakdownKind; flow: ProductsFlow; parts: BreakdownPart[] | null; count: number; state: Loaded }) {
  const chapter = kind === "chapter";
  const title = chapter ? "What it’s used for" : "Where it comes from";
  if (state === "error") return note(`${title}: couldn’t load. Tap the line again to retry.`);
  if (state === "loading" || !parts) return note(`${title}: loading…`);
  if (parts.length === 0) return note(`${title}: nothing recorded.`);
  const noun = chapter ? (count === 1 ? "use" : "uses") : count === 1 ? "chapter" : "chapters";
  const colour = (p: BreakdownPart, i: number) => (p.special ? PART_SPECIAL : p.code === null ? PART_OTHER : PART_COLOURS[i] ?? PART_OTHER);
  const context = (p: BreakdownPart) =>
    p.whole === null || p.value >= p.whole * 0.995 ? null : chapter ? `${fmtPct(p.value / p.whole)} of all ${lowerFirst(p.name)} ${flow}` : `${fmtPct(p.value / p.whole)} of the chapter’s ${flow}`;
  return (
    <PanelSection
      caption={`${title} · ${count} ${noun}`}
      right="Share"
      segments={parts.map((p, i) => ({ key: p.code ?? p.name, value: p.share, colour: colour(p, i), title: `${p.name}: ${fmtDollars(p.value)}, ${fmtPct(p.share)} of ${line.name}` }))}
    >
      {parts.map((p, i) => {
        const c = context(p);
        return (
          <li key={p.code ?? p.name} className={`${GRID} py-0.5`}>
            {swatch(colour(p, i))}
            <span className="col-[2/4] min-w-0 @max-[400px]:col-[2]">
              <span className={`block truncate ${p.code === null ? "italic text-ink-muted" : ""}`} title={p.name}>
                {p.name}
              </span>
              {c && <span className="block text-[0.7rem] leading-tight text-ink-muted">{c}</span>}
            </span>
            <span className="text-right font-mono text-[0.75rem] tabular-nums">{fmtDollars(p.value)}</span>
            <span className="whitespace-nowrap text-left font-mono text-[0.7rem] tabular-nums text-ink-muted">{fmtPct(p.share)}</span>
          </li>
        );
      })}
    </PanelSection>
  );
}

/** The countries behind an open line: one grey bar on the line's own scale, then a row per country with its duty rate (imports) or share. */
function CountriesSection({ line, flow, partners, state }: { line: ProductLine; flow: ProductsFlow; partners: PartnerLine[] | null; state: Loaded }) {
  const imports = flow === "imports";
  if (state === "error") return note("Couldn’t load the countries. Tap the line again to retry.");
  if (state === "loading") return note("Loading the countries…");
  if (!partners || partners.length === 0) return note("No countries recorded for this line.");
  const covered = partners.reduce((a, p) => a + p.share, 0);
  return (
    <PanelSection
      caption={`Top ${partners.length} ${imports ? "suppliers" : "buyers"} · ${fmtPct(Math.min(1, covered))} of line`}
      right={imports ? "Duty rate" : "Share"}
      segments={partners.map((p, i) => ({ key: p.code, value: p.value / line.value, colour: countryTone(i), title: `${p.name}: ${fmtDollars(p.value)}, ${fmtPct(p.share)} of ${line.name}` }))}
    >
      {partners.map((p, i) => (
        <li key={p.code} className={`${GRID} py-0.5`}>
          {swatch(countryTone(i))}
          <span className="col-[2/4] truncate @max-[400px]:col-[2]" title={p.name}>
            {p.name}
          </span>
          <span className="text-right font-mono text-[0.75rem] tabular-nums">{fmtDollars(p.value)}</span>
          <span className="whitespace-nowrap text-left font-mono text-[0.7rem] tabular-nums text-ink-muted">{imports ? (p.rate === null ? "—" : fmtPct(p.rate)) : fmtPct(p.share)}</span>
        </li>
      ))}
    </PanelSection>
  );
}

/** A callback ref that reports the element's height (margins included), kept current as it resizes; 0 once it unmounts. */
function useHeight(): [(el: HTMLElement | null) => void, number] {
  const [h, setH] = useState(0);
  const ro = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: HTMLElement | null) => {
    ro.current?.disconnect();
    ro.current = null;
    if (!el) {
      setH(0);
      return;
    }
    const measure = () => {
      const cs = getComputedStyle(el);
      setH(Math.ceil(el.getBoundingClientRect().height + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom)));
    };
    const o = new ResizeObserver(measure);
    o.observe(el);
    ro.current = o;
    measure();
  }, []);
  return [ref, h];
}

/** The page's files for one list kind: its ranked payload and the top-countries file behind its lines. */
export interface ListFiles<P, Q> {
  payload: P | null;
  /** False when the picked country has no file of this kind. */
  hasData: boolean;
  loading: boolean;
  error: boolean;
  /** The top countries behind each line for the year on screen, once fetched (after `onWantPartners`). */
  partners: Q | null;
  partnersState: "idle" | "loading" | "error" | "ok";
  onWantPartners: () => void;
}

/**
 * "What the U.S. trades": goods two ways side by side, on one dollar scale, for the year the partners card above shows (the
 * page's one selected year; this card's own YearPicker sets the same year) and the page's Country filter (all countries
 * when none is picked). Left, Harmonized System chapters (what the goods are); right, Census end-use categories (what they
 * are for). An Exports / Imports toggle; imports carry each line's collected rate (calculated duties over imports for
 * consumption). Special entries (chapters 98-99; minimum-value shipments and returned goods) are never ranked: a footnote
 * line under the lists sums each.
 *
 * With all countries showing, a tapped line opens a panel under its row: its breakdown (a chapter's uses, or a use's
 * chapters: `BreakdownSection`, data `/data/trade/chapter-use/[year]`) above the five countries behind it
 * (`CountriesSection`, data `/data/trade/product-partners/[year]` or `/data/trade/enduse-partners/[year]`), all fetched
 * for the year on screen the first time a line opens. The other list keeps the lines linked to it lit and dims the rest
 * (rule 4: a comparison highlights, never narrows). Each list is a fixed-height scroll box (rule 11a); an open panel adds
 * its own height to its box, and on two columns to the other box too, so the open list keeps the rows it showed and the
 * other list shows more instead of leaving a gap. With one country picked there is nothing to break down, so rows do not open.
 * Models: `lib/trade-products.ts`, `lib/trade-enduse.ts`, `lib/trade-chapter-use.ts`.
 */
export function TradeProductsCard({
  year,
  onYear,
  firstYear,
  lastYear,
  through,
  country,
  countryName,
  lag,
  chapters,
  uses,
  chapterUse,
  chapterUseState,
  onWantChapterUse,
  jump,
}: {
  year: number;
  onYear: (y: number) => void;
  firstYear: number;
  lastYear: number;
  /** Last month of the latest data ("August"), for the takeaway. */
  through: string;
  country: string | null;
  countryName: string | null;
  lag: (ProductsLag & { name: string })[];
  chapters: ListFiles<TradeProductsPayload, ProductPartnersPayload>;
  uses: ListFiles<TradeEndusePayload, EndusePartnersPayload>;
  /** Every chapter x use pair for the year on screen, once fetched (after `onWantChapterUse`). */
  chapterUse: ChapterUsePayload | null;
  chapterUseState: "idle" | "loading" | "error" | "ok";
  onWantChapterUse: () => void;
  /** The "2 questions ↓" link at the end of the notes row (`ChartJumpLink`). */
  jump?: ReactNode;
}) {
  const [flow, setFlow] = useState<ProductsFlow>("exports");
  const [open, setOpen] = useState<Open | null>(null);
  const [panelRef, panelH] = useHeight();
  const chapterView = chapters.payload && year >= firstYear ? productsView(chapters.payload, year, flow) : null;
  const useView: EnduseView | null = uses.payload && year >= firstYear ? enduseView(uses.payload, year, flow) : null;
  const view = chapterView ?? useView;
  const partial = !!view && view.months < 12;
  const where = countryName ?? "all countries";
  const title = `What the U.S. trades${countryName ? ` with ${countryName}` : ""}, ${year}${partial ? " so far" : ""}`;
  const imports = flow === "imports";
  const rateHead = imports ? "Duty rate" : "Share";
  const period = view ? periodText(view.year, view.months, MONTH_NAMES) : String(year);

  // A line stays open across a year or flow change only while it is still in the list; a country closes it.
  const openLine = open && country === null ? (open.kind === "chapter" ? chapterView?.chapters : useView?.categories)?.find((l) => l.code === open.code) ?? null : null;
  const pairs = chapterUse && chapterUse.year === year ? chapterUse : null;
  const linked = openLine && pairs ? linkedCodes(pairs, flow, open!.kind, openLine.code) : null;

  const toggle = (kind: BreakdownKind, code: string) => {
    if (country) return; // One country: nothing to break down.
    setOpen((o) => (o?.kind === kind && o.code === code ? null : { kind, code }));
    (kind === "chapter" ? chapters : uses).onWantPartners();
    onWantChapterUse();
  };

  const chapterName = (c: string) => HS_CHAPTERS[c]?.name ?? `Chapter ${c}`;
  const useName = (c: string) => ENDUSE_LABELS[flow][c] ?? `Category ${c}`;
  const chapterTotal = (c: string) => chapterView?.chapters.find((l) => l.code === c)?.value ?? null;
  const useTotal = (c: string) => useView?.categories.find((l) => l.code === c)?.value ?? null;

  const panelFor = (l: ProductLine, kind: BreakdownKind): ReactNode => {
    if (!openLine || open!.kind !== kind || openLine.code !== l.code) return undefined;
    const chapter = kind === "chapter";
    const b = pairs ? breakdown(pairs, flow, kind, l.code, chapter ? useName : chapterName, chapter ? useTotal : chapterTotal) : null;
    const pairsState: Loaded = chapterUseState === "error" ? "error" : pairs ? "ok" : "loading";
    const files = chapter ? chapters : uses;
    const lines = !files.partners ? null : chapter ? partnersOf(chapters.partners!, year, flow, l.code, l.value) : endusePartnersOf(uses.partners!, year, flow, l.code, l.value);
    const partnersState: Loaded = files.partnersState === "error" ? "error" : files.partners ? "ok" : "loading";
    return (
      <div ref={panelRef} className="mb-1.5 mt-0.5 rounded-md bg-[color-mix(in_oklab,var(--ink)_4%,transparent)] py-1.5">
        <BreakdownSection line={l} kind={kind} flow={flow} parts={b?.parts ?? null} count={b?.count ?? 0} state={pairsState} />
        <div className="mx-2 my-2 border-t border-line" />
        <CountriesSection line={l} flow={flow} partners={lines} state={partnersState} />
      </div>
    );
  };

  const scaleMax = Math.max(1, chapterView?.chapters[0]?.value ?? 0, useView?.categories[0]?.value ?? 0);
  const rowsOf = (lines: ProductLine[], kind: BreakdownKind): StackedRowData[] =>
    lines.map((l, i) => ({
      expandable: country === null,
      detail: panelFor(l, kind),
      id: l.code,
      rank: i + 1,
      label: l.name,
      segments: [{ value: l.value, color: BAR, title: `${l.name}: ${fmtDollars(l.value)}` }],
      total: fmtDollars(l.value),
      delta: imports ? (l.rate === null ? "—" : fmtPct(l.rate)) : fmtPct(l.share),
      selected: !!openLine && open!.kind === kind && openLine.code === l.code,
      dimmed: !!linked && open!.kind !== kind && !linked.has(l.code),
    }));

  const lagNotes = lag.filter((l) => l.year === year && l.flow === flow && (country === null || l.code === country));
  const line = view
    ? {
        values: [fmtDollars(view.total)],
        headline: fmtDollars(view.total),
        date: `Goods ${flow}, ${period}`,
        term: view.rate !== null ? `Duty rate ${fmtPct(view.rate)}` : undefined,
      }
    : null;

  /** Why a list has nothing to show, or null when it does. */
  const emptyFor = (files: ListFiles<unknown, unknown>, by: string, v: unknown): string | null => {
    if (!files.hasData) return `Census reports no goods by ${by} for ${countryName}.`;
    if (files.error) return `Couldn’t load the goods by ${by} for ${where}. Pick the country again to retry.`;
    if (!files.payload || files.loading) return `Loading ${where}…`;
    if (!v) return `No goods ${flow} by ${by}${countryName ? ` with ${countryName}` : ""} recorded in ${year}.`;
    return null;
  };
  const columns = [
    { kind: "chapter" as const, head: "By chapter", what: "what it is", lines: chapterView?.chapters ?? [], empty: emptyFor(chapters, "chapter", chapterView), aria: `U.S. goods ${flow} by HS chapter, ${where}, ${year}, largest first` },
    { kind: "use" as const, head: "By use", what: "what it’s for", lines: useView?.categories ?? [], empty: emptyFor(uses, "use", useView), aria: `U.S. goods ${flow} by end-use category, ${where}, ${year}, largest first` },
  ];
  const note = specialNote(chapterView, useView);
  const anyData = chapters.hasData || uses.hasData;

  return (
    <ChartCard
      id="what-the-u-s-trades"
      className="min-w-0"
      title={title}
      takeaway={countryName ? undefined : TRADE_TAKEAWAYS.products.takeaway(through)}
      lede={countryName ? `Goods ${flow === "exports" ? "sold to" : "bought from"} ${countryName}, by chapter and by use.` : undefined}
      action={<YearPicker value={Math.max(year, firstYear)} range={[firstYear, lastYear]} onChange={onYear} format={String} ariaLabel="Year shown in the goods lists (and the partners card)" />}
    >
      <ToggleReadout
        toggle={<PillGroup options={FLOWS} value={flow} onChange={(f) => setFlow(f as ProductsFlow)} ariaLabel="Exports or imports" />}
        line={line}
        pinned={false}
        onClear={() => setOpen(null)}
        hint=""
      />

      {year < firstYear && anyData ? (
        <div role="status" className="mt-3 flex min-h-[10rem] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-line px-4 text-center text-[0.85rem] text-ink-muted">
          Goods by chapter and use start in {firstYear}; the partners card above is showing {year}.
          <button type="button" onClick={() => onYear(firstYear)} className="rounded-md border border-line-strong bg-surface-raised px-3 py-1 text-[0.8rem] text-ink hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
            Show {firstYear}
          </button>
        </div>
      ) : (
        <>
          {country === null && view && (
            <p className="m-0 mt-3 px-2 text-[0.78rem] text-ink-muted">Tap a chapter to see what it’s used for, or a use to see which chapters it comes from, with the five countries behind it.</p>
          )}
          <div className="mt-3 grid min-w-0 grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
            {columns.map((c) => {
              const own = openLine && open!.kind === c.kind ? panelH : 0;
              // The open list's box grows by its panel's height on every width, so the tapped row stays put with its whole panel under it;
              // side by side, the other box grows with it and shows more rows instead of leaving a gap.
              const style = { "--own": `${own}px`, "--grow": `${openLine ? panelH : 0}px` } as CSSProperties;
              return (
                <div key={c.kind} className="flex min-w-0 flex-col">
                  <div className="flex h-4 items-baseline justify-between gap-2 px-2 leading-4">
                    <h3 className={CAPTION}>
                      {c.head}
                      {c.lines.length > 0 ? ` · ${c.lines.length}` : ""} <span className="normal-case tracking-normal">({c.what})</span>
                    </h3>
                    <span className={CAPTION}>{rateHead}</span>
                  </div>
                  {c.empty ? (
                    <div role="status" className="mt-1 flex h-[22rem] items-center justify-center rounded-md border border-dashed border-line px-4 text-center text-[0.85rem] text-ink-muted lg:h-[26rem]">
                      {c.empty}
                    </div>
                  ) : (
                    <div
                      style={style}
                      className="mt-1 h-[calc(22rem+var(--own))] overflow-y-auto overscroll-contain touch-scroll lg:h-[calc(26rem+var(--grow))]"
                      tabIndex={0}
                      aria-label={`${c.head}, scrollable`}
                    >
                      <StackedRows rows={rowsOf(c.lines, c.kind)} scaleMax={scaleMax} onRowClick={(code) => toggle(c.kind, code)} ariaLabel={c.aria} emptyText="No goods recorded." wideLabels centreSelected={false} />
                    </div>
                  )}
                </div>
              );
            })}
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
      )}

      <ChartNotesRow>
        <MethodologyNote>
          <p>
            <SourceLink id="census-trade">Census Bureau</SourceLink> goods trade two ways, 2010 on, in dollars: total exports and general imports, the same totals as the cards above. By chapter: the 96 product groups of the Harmonized System, the tariff schedule’s own groups. By use: Census’s end-use categories (what goods are for, about 140 kinds from soybeans to semiconductors). Exports publish civilian aircraft, engines and parts as one use; imports split them into three, so add those up to compare. The duty rate is calculated duties over imports for consumption. Special entries (chapters 98 and 99: returned American goods, repairs, estimated low-value shipments; and the matching end-use entries such as minimum-value shipments) are not kinds of goods, so neither list ranks them; the note under the lists sums them. Opening a line splits it the other way (all countries only), from every ten-digit import or export line, each filed under one chapter and, through Census’s concordance, one use; special entries are their own part when they are 0.5% of the line or more. A chapter’s split adds up to its total above; a use’s can differ from its published total by a few percent, because the concordance does not quite match Census’s own category totals. The line also names the five countries with the most of it, each with its own duty rate on imports.
            {partial && view ? ` ${view.year} covers January to ${MONTH_NAMES[view.months - 1]}.` : ""}
            {lagNotes.map((l) => lagText(l)).join("")}
          </p>
        </MethodologyNote>
        {chapterView && useView && (
          <DataTable
            flow={flow}
            period={period}
            where={where}
            sections={[
              { caption: `U.S. goods ${flow} by HS chapter`, code: "HS", name: "Chapter", lines: chapterView.chapters, special: chapterView.special, specialHead: "Special entry (not ranked)" },
              { caption: `U.S. goods ${flow} by end-use category`, code: "Code", name: "Use", lines: useView.categories, special: useView.special, specialHead: "Special entry (not ranked)" },
            ]}
          />
        )}
        {jump}
      </ChartNotesRow>
    </ChartCard>
  );
}

// The goods file already carries Census's revisions to earlier months; the product and end-use files (which agree) catch up later.
const lagText = (l: ProductsLag & { name: string }) =>
  ` ${l.flow === "exports" ? "Exports to" : "Imports from"} ${l.name} in ${l.year} so far are ${fmtPct(Math.abs(l.gap))} ${l.gap < 0 ? "below" : "above"} the goods file in the cards above, which already carries Census's revisions to earlier months; full years match.`;

"use client";

import { useEffect, useMemo, useState } from "react";
import { ChartCard } from "@/components/charts/ChartCard";
import { ChartNotesRow } from "@/components/charts/ChartNotesRow";
import { LEGEND_ITEM, LEGEND_ROW } from "@/components/charts/legend";
import { TABLE_TOGGLE } from "@/components/charts/table-toggle";
import { TipCard } from "@/components/charts/TipCard";
import { DotCardTooltips, useDotCard } from "@/components/charts/Tooltip";
import { MethodologyNote } from "@/components/MethodologyNote";
import { SourceLink } from "@/components/SourceLink";
import { MONTH_NAMES } from "@/lib/indicator-time";
import { fmtDollars, fmtPct, type ProductsFlow } from "@/lib/trade-products";
import { GREY_ID, SANKEY_OTHER, SANKEY_OUTSIDE, SANKEY_TOP, nodeSize, sankeyLinks, sankeyModel, sankeyTakeaway, type ProductUsePayload, type SankeyModel, type SankeyNode, type SankeyPick } from "@/lib/trade-sankey";
import { layoutSankey, type Measure } from "@/lib/trade-sankey-layout";
import { useElementWidth } from "@/lib/use-element-width";

/** What a hover or tap is on: one node, or one (source, target) band with its colours merged. */
type Hit = { kind: "node"; id: string } | { kind: "link"; source: string; target: string };
const hitKey = (h: Hit) => (h.kind === "node" ? `n:${h.id}` : `l:${h.source}>${h.target}`);
const sameHit = (a: Hit, b: Hit) => hitKey(a) === hitKey(b);

const KIND_WORD = { chapter: "Chapter", product: "Product", use: "Use" } as const;
const CAPTION = "m-0 font-mono text-[0.65rem] uppercase tracking-[0.06em] text-ink-muted";
const lowerFirst = (s: string) => (s.length > 1 && /[a-z]/.test(s[1]) ? s[0].toLowerCase() + s.slice(1) : s);

/** Text widths for the layout, measured with the page's own fonts (a canvas shared by every render). */
let ctx: CanvasRenderingContext2D | null = null;
const measure: Measure = (text, px, mono) => {
  if (typeof document === "undefined") return text.length * px * 0.56;
  ctx ??= document.createElement("canvas").getContext("2d");
  if (!ctx) return text.length * px * 0.56;
  const root = getComputedStyle(document.documentElement);
  const family = mono ? root.getPropertyValue("--font-mono") || "monospace" : getComputedStyle(document.body).fontFamily;
  ctx.font = `${px}px ${family}`;
  return ctx.measureText(text).width;
};

/**
 * "From product to use": a Sankey from HS chapter to product (four-digit heading) to Census end use for the line tapped
 * in "What the U.S. trades" (a chapter, a product, or a category in its By use view), following that card's year and
 * Exports / Imports toggle; with the tap cleared it shows that card's top line. All countries only: the page removes
 * the card while a country is picked. Hover previews a band's or node's tooltip and highlights it; a tap pins it
 * (closed by a tap elsewhere, Esc or a scroll). Model: `lib/trade-sankey.ts`; geometry: `lib/trade-sankey-layout.ts`;
 * data: `/data/trade/product-use/[year]`, fetched the first time the card shows.
 */
export function TradeSankeyCard({
  payload,
  state,
  year,
  partial,
  flow,
  pick,
}: {
  payload: ProductUsePayload | null;
  state: "loading" | "error" | "ok";
  year: number;
  /** The year is still in progress ("so far" in the title, as in the card above). */
  partial: boolean;
  flow: ProductsFlow;
  pick: SankeyPick;
}) {
  const model = useMemo(() => (payload && payload.year === year ? sankeyModel(payload, flow, pick) : null), [payload, year, flow, pick]);
  const title = `From product to use, ${year}${partial ? " so far" : ""}`;
  const takeaway = model ? sankeyTakeaway(model, MONTH_NAMES) : undefined;
  const flowWord = flow === "imports" ? "Imports" : "Exports";

  let status: string | null = null;
  if (state === "error") status = "Couldn’t load the products and uses. Tap a line in the card above to retry.";
  else if (!payload || payload.year !== year) status = "Loading…";
  else if (!model) status = `No goods ${flow} recorded on this line in ${year}.`;

  return (
    <ChartCard className="min-w-0" title={title} takeaway={takeaway}>
      {model && (
        <p className="m-0 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[0.78rem] text-ink-muted">
          <span>
            {KIND_WORD[pick.kind]}: <span className="font-medium text-ink">{model.name}</span> · {flowWord} · {fmtDollars(model.total)}
          </span>
          <span>Tap a line in “What the U.S. trades” to follow it here.</span>
        </p>
      )}
      {status ? (
        <div role="status" className="mt-3 flex min-h-[10rem] items-center justify-center rounded-md border border-dashed border-line px-4 text-center text-[0.85rem] text-ink-muted">
          {status}
        </div>
      ) : (
        model && <SankeyChart model={model} />
      )}
      {model && <Legend model={model} />}
      <ChartNotesRow>
        <MethodologyNote>
          <p>
            Each band is the dollar value of U.S. goods {flow === "imports" ? "imports (general imports)" : "exports (total exports)"}, all countries, that the{" "}
            <SourceLink id="census-trade">Census Bureau</SourceLink> files under both a four-digit HS heading (a product) and an end-use category. Census gives every 10-digit tariff line exactly one end use, so the bands add up to the product totals in the card above and, within 0.3%, to its use totals.{" "}
            {pick.kind === "use" ? "On a use, each product shows only what it sends to that use." : "Grey is the part of a use that comes from outside the line picked."} Special entries (returned goods, low-value shipments) are not drawn as products, so a use’s products can sum to less than its total above.
            {partial && payload ? ` ${year} covers January to ${MONTH_NAMES[payload.months - 1]}.` : ""}
          </p>
        </MethodologyNote>
        {model && <SankeyTable model={model} />}
      </ChartNotesRow>
    </ChartCard>
  );
}

function Legend({ model }: { model: SankeyModel }) {
  const byUse = model.pick.kind === "use";
  const other = model.nodes.some((n) => n.folded > 1);
  const grey = model.nodes.find((n) => n.grey);
  return (
    <div className={`${LEGEND_ROW} mt-2`}>
      <span className={LEGEND_ITEM}>{byUse ? "Bands take the colour of the chapter they start from" : "Bands take the colour of the use they reach"}</span>
      {grey && (
        <span className={LEGEND_ITEM}>
          <svg width="10" height="10" aria-hidden>
            <rect width="10" height="10" rx="2" fill={SANKEY_OUTSIDE} />
          </svg>
          {grey.label} (outside the selection)
        </span>
      )}
      {other && (
        <span className={LEGEND_ITEM}>
          <svg width="10" height="10" aria-hidden>
            <rect width="10" height="10" rx="2" fill={SANKEY_OTHER} />
          </svg>
          Other: past the top {byUse ? `${SANKEY_TOP.chapters} chapters or ${SANKEY_TOP.products} products` : `${SANKEY_TOP.products} products or ${SANKEY_TOP.uses} uses`}, or under 1%
        </span>
      )}
    </div>
  );
}

function SankeyTable({ model }: { model: SankeyModel }) {
  const links = useMemo(() => sankeyLinks(model), [model]);
  return (
    <details className="mt-2">
      <summary className={TABLE_TOGGLE}>View as table</summary>
      <div className="mt-2 max-h-72 overflow-auto">
        <table className="w-full border-collapse text-left text-[0.75rem] tabular-nums">
          <caption className="sr-only">{`${KIND_WORD[model.pick.kind]} ${model.name}, ${model.flow}, ${model.year}: every band, from chapter to product, then product to use`}</caption>
          <thead className="sticky top-0 bg-surface-raised">
            <tr className="font-mono text-[0.65rem] uppercase tracking-[0.05em] text-ink-muted">
              <th scope="col" className="px-2 py-1.5">From</th>
              <th scope="col" className="px-2 py-1.5">To</th>
              <th scope="col" className="px-2 py-1.5 text-right">Value</th>
            </tr>
          </thead>
          <tbody>
            {links.map((l) => (
              <tr key={`${l.source.id}>${l.target.id}`} className="border-t border-line">
                <td className="px-2 py-1">{l.source.label}</td>
                <td className="px-2 py-1">{l.target.label}</td>
                <td className="px-2 py-1 text-right font-mono">{fmtDollars(l.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function SankeyChart({ model }: { model: SankeyModel }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  // Re-measure once the web fonts have loaded (canvas widths before that use a fallback face).
  const [fonts, setFonts] = useState(0);
  useEffect(() => {
    let live = true;
    document.fonts?.ready.then(() => live && setFonts((n) => n + 1));
    return () => {
      live = false;
    };
  }, []);
  const layout = useMemo(() => (width > 0 ? layoutSankey(model, width, measure, (n) => fmtDollars(nodeSize(n))) : null), [model, width, fonts]); // eslint-disable-line react-hooks/exhaustive-deps
  const byId = useMemo(() => new Map(model.nodes.map((n) => [n.id, n])), [model]);
  const card = useDotCard<Hit>(sameHit);
  const { hide, leave } = card;
  // A pinned card also closes on a page scroll (rule 6a), besides a tap elsewhere and Esc.
  const pinned = card.pinned != null;
  useEffect(() => {
    if (!pinned) return;
    window.addEventListener("scroll", hide, { passive: true });
    return () => window.removeEventListener("scroll", hide);
  }, [pinned, hide]);
  // A new selection closes the hover preview and any pinned card.
  useEffect(() => {
    hide();
    leave();
  }, [model, hide, leave]);

  const active = card.pinned?.data ?? card.tip.state?.data ?? null;
  const lit = (source: string, target: string) => !active || (active.kind === "link" ? active.source === source && active.target === target : active.id === source || active.id === target);

  return (
    <div className="-mx-3 mt-2 sm:mx-0" ref={ref}>
      {layout && !layout.wide && <p className={`${CAPTION} px-3 sm:px-0`}>Chapter ↓ Product ↓ Use</p>}
      {layout && (
        <svg width={layout.width} height={layout.height} viewBox={`0 0 ${layout.width} ${layout.height}`} className="mt-1 block max-w-full overflow-hidden" role="img" aria-label={`Sankey: ${model.name}, ${model.flow} ${model.year}, from chapter to product to use. The table under the chart lists every band.`}>
          {layout.captions.map((c) => (
            <text key={c.text} x={c.x} y={c.y} textAnchor={c.anchor} className="fill-ink-muted font-mono text-[10px] uppercase tracking-[0.06em]">
              {c.text}
            </text>
          ))}
          <g>
            {layout.ribbons.map((r) => {
              const on = lit(r.source, r.target);
              const hit: Hit = { kind: "link", source: r.source, target: r.target };
              return <path key={r.key} d={r.d} fill={r.colour} fillOpacity={active ? (on ? (r.grey ? 0.95 : 0.85) : 0.18) : r.grey ? 0.75 : 0.55} className="cursor-pointer transition-[fill-opacity] duration-100" {...card.bind(hit)} />;
            })}
          </g>
          <g>
            {layout.nodes.map((l) => {
              const n = l.node;
              const fill = n.grey ? SANKEY_OUTSIDE : n.colour;
              const w = layout.wide;
              const b = layout.bar;
              const hit: Hit = { kind: "node", id: n.id };
              // The hit target is the node's whole slot, so a thin node is still easy to tap.
              const slot = w ? { x: l.x - 3, y: l.slot[0], width: b + 6, height: l.slot[1] } : { x: l.slot[0], y: l.y - 3, width: l.slot[1], height: b + 6 };
              return (
                <g key={n.id} className="cursor-pointer" {...card.bind(hit)}>
                  <rect {...slot} fill="transparent" />
                  {w ? <rect x={l.x} y={l.y} width={b} height={Math.max(l.selLen, 0.5)} fill={fill} /> : <rect x={l.x} y={l.y} width={Math.max(l.selLen, 0.5)} height={b} fill={fill} />}
                  {n.outside > 0 && (w ? <rect x={l.x} y={l.y + l.selLen} width={b} height={l.len - l.selLen} fill={SANKEY_OUTSIDE} /> : <rect x={l.x + l.selLen} y={l.y} width={l.len - l.selLen} height={b} fill={SANKEY_OUTSIDE} />)}
                </g>
              );
            })}
          </g>
          <g className="pointer-events-none">
            {layout.labels.map((l) => {
              const cls = `${l.grey ? "fill-ink-muted italic" : "fill-ink"}${l.halo ? " sankey-halo" : ""}`;
              const value = (
                <tspan className="fill-ink-muted font-mono" style={{ fontSize: l.valuePx, fontStyle: "normal" }} {...(l.twoLines ? { x: l.x, dy: 13 } : { dx: l.dx })}>
                  {l.value}
                </tspan>
              );
              return (
                <text key={l.id} x={l.rotate ? undefined : l.x} y={l.rotate ? undefined : l.y} transform={l.rotate ? `translate(${l.x.toFixed(1)},${l.y.toFixed(1)}) rotate(${l.rotate.toFixed(1)})` : undefined} textAnchor={l.anchor} className={cls} style={{ fontSize: l.px }}>
                  {l.name}
                  {value}
                </text>
              );
            })}
          </g>
        </svg>
      )}
      <DotCardTooltips card={card}>{(h) => <HitTip hit={h} model={model} byId={byId} />}</DotCardTooltips>
    </div>
  );
}

function HitTip({ hit, model, byId }: { hit: Hit; model: SankeyModel; byId: Map<string, SankeyNode> }) {
  const sel = lowerFirst(model.name);
  if (hit.kind === "link") {
    const a = byId.get(hit.source);
    const b = byId.get(hit.target);
    if (!a || !b) return null; // a card left over from the previous selection, for the one render before it closes
    const v = model.segments.filter((s) => s.source === hit.source && s.target === hit.target).reduce((q, s) => q + s.value, 0);
    const title = `${a.label} → ${b.label}`;
    if (hit.source === GREY_ID) {
      const g = model.grey.find((x) => x.target === hit.target);
      if (!g) return null;
      const what = model.pick.kind === "chapter" ? "chapters" : "products";
      const rows = g.top.map((t, i) => ({ key: String(i), label: t.name, value: fmtDollars(t.value) }));
      if (g.count > g.top.length) rows.push({ key: "more", label: `+ ${g.count - g.top.length} more`, value: "" });
      return <TipCard title={title} value={fmtDollars(v)} sub={`From ${g.count} other ${g.count === 1 ? what.slice(0, -1) : what}, largest:`} rows={rows} />;
    }
    return (
      <TipCard
        title={title}
        value={fmtDollars(v)}
        sub={
          <>
            {fmtPct(v / nodeSize(a))} of {lowerFirst(a.label)}
            <br />
            {fmtPct(v / nodeSize(b))} of {lowerFirst(b.label)}
          </>
        }
      />
    );
  }
  const n = byId.get(hit.id);
  if (!n) return null;
  const size = nodeSize(n);
  const what = n.col === 0 ? "chapters" : n.col === 1 ? "products" : "uses";
  const cap = n.col === 0 ? SANKEY_TOP.chapters : n.col === 1 ? SANKEY_TOP.products : SANKEY_TOP.uses;
  let sub: string;
  if (n.grey) sub = "Trade in these uses from outside the selection";
  else if (n.folded > 1) sub = `${n.folded} ${what}, each under 1% of the selection or past the top ${cap}`;
  else if (n.outside > 0) sub = `${fmtPct(n.value / size)} from ${sel} (${fmtDollars(n.value)}); the rest from outside it`;
  else if (n.full > n.value * 1.001) sub = model.pick.kind === "product" && n.col === 0 ? `The product is ${fmtPct(n.value / n.full)} of the chapter’s ${fmtDollars(n.full)}` : `${fmtPct(n.value / n.full)} of its ${fmtDollars(n.full)} goes to ${sel}`;
  else sub = n.folded === 1 ? "Under 1% of the selection" : n.col === 0 ? `HS chapter ${n.code}` : n.col === 1 ? `HS heading ${n.code}` : `End use ${n.code}`;
  return <TipCard title={n.label} value={fmtDollars(size)} sub={sub} />;
}

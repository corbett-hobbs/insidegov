import { ENDUSE_LABELS } from "./trade-enduse-labels";
import { HS_CHAPTERS, SPECIAL_HEADINGS } from "./trade-hs-chapters";
import { fmtDollars, type ProductsFlow } from "./trade-products";

/**
 * Pure model for the "From product to use" Sankey card under "What the U.S. trades": the line tapped there (an HS
 * chapter, a four-digit heading, or a Census end-use category), followed through Chapter -> Product (HS4) -> Use for
 * one year and flow, all countries. Data: `/data/trade/product-use/[year]` (the year's (heading, use, dollars) triples,
 * `pipeline/output/trade_product_use/`); see docs/TRADE_METHODOLOGY.md ("Goods by product and use").
 *
 * - Chapter pick: the chapter -> its top 8 headings + "N other products" -> their top 6 uses + "N other uses".
 * - Product pick: its chapter (sized to the product) -> the product -> its uses (top 6 + Other).
 * - Use pick: top 6 chapters + Other -> top 8 headings + Other -> the one use. Products are sized by what they send to
 *   that use only.
 * - A line under 1% of the selection folds into Other; an Other of one line is named after it.
 * - Chapter and product picks draw each named use at its full total: the part from outside the selection comes in as
 *   a grey band from one grey node ("From other chapters" / "From other products") at the bottom of the product column.
 *   A use that takes under 1% of the selection gets no grey band. Use picks have no grey.
 *
 * Special pairs (a chapter 98/99 heading, or a special end use) are never drawn as a chapter, product or use, but a
 * use's full total counts them, so a use node matches the "By use" list above.
 */

/** What `/data/trade/product-use/[year]` serves: both flows of one year, as `[hs4, use, dollars]` triples. */
export interface ProductUsePayload {
  year: number;
  /** 12 for a full year; fewer for the year in progress (every value is year to date). */
  months: number;
  flows: Record<ProductsFlow, { rows: ProductUseTriple[]; special: ProductUseTriple[] }>;
  /** Plain-English name of every ordinary heading the rows carry. */
  names: Record<string, string>;
}
export type ProductUseTriple = readonly [hs4: string, use: string, value: number];

export type SankeyKind = "chapter" | "product" | "use";
/** The line followed: a two-digit chapter, a four-digit heading or a five-digit end use. */
export interface SankeyPick {
  kind: SankeyKind;
  code: string;
}

/** Caps: named nodes per column before the rest fold into Other. */
export const SANKEY_TOP = { chapters: 6, products: 8, uses: 6 } as const;
/** A line under this share of the selection folds into Other, and a use under it gets no grey band. */
export const SANKEY_MIN_SHARE = 0.01;

/** Six solid colours (rule 8), assigned to the colour-key column in order of size; Other and outside are neutral. */
export const SANKEY_COLOURS = ["var(--sankey-1)", "var(--sankey-2)", "var(--sankey-3)", "var(--sankey-4)", "var(--sankey-5)", "var(--sankey-6)"] as const;
export const SANKEY_OTHER = "var(--sankey-other)";
export const SANKEY_OUTSIDE = "var(--sankey-outside)";
export const SANKEY_NODE = "var(--sankey-node)";

export const GREY_ID = "grey";

export interface SankeyNode {
  id: string;
  col: 0 | 1 | 2;
  label: string;
  /** Chapter, heading or end-use code; null for an Other bucket of several lines and the grey node. */
  code: string | null;
  /** The selection's part, in dollars. */
  value: number;
  /** The part from outside the selection (a named use on a chapter or product pick), drawn grey on the node. */
  outside: number;
  /** The line's total over everything (chapter, product or use), when it is more than `value`. */
  full: number;
  /** Lines folded in, for an Other bucket (1 when it is one named line). 0 for an ordinary node. */
  folded: number;
  /** The grey "outside the selection" node. */
  grey: boolean;
  /** Fill of the selection part: the colour key, ink for a node that is not on the key column, neutral for Other. */
  colour: string;
}

/** One drawn ribbon: a (source, target) link in one colour. A link split by colour is several segments. */
export interface SankeySegment {
  source: string;
  target: string;
  value: number;
  colour: string;
}

/** What a grey band carries for its tooltip: the largest outside sources and how many there are. */
export interface SankeyGrey {
  target: string;
  value: number;
  top: { name: string; value: number }[];
  count: number;
}

export interface SankeyModel {
  pick: SankeyPick;
  flow: ProductsFlow;
  year: number;
  months: number;
  /** The selected line's name. */
  name: string;
  /** The selection's dollars (what the chart draws, outside grey excluded). */
  total: number;
  nodes: SankeyNode[];
  segments: SankeySegment[];
  grey: SankeyGrey[];
  /** Distinct chapters, products and uses in the selection, before folding. */
  counts: { chapters: number; products: number; uses: number };
}

const lowerFirst = (s: string) => (s.length > 1 && /[a-z]/.test(s[1]) ? s[0].toLowerCase() + s.slice(1) : s);
export const chapterName = (code: string) => HS_CHAPTERS[code]?.name ?? `Chapter ${code}`;
export const endUseName = (flow: ProductsFlow, code: string) => ENDUSE_LABELS[flow][code] ?? `End use ${code}`;
export const headingLabel = (payload: Pick<ProductUsePayload, "names">, flow: ProductsFlow, hs: string) => payload.names[hs] ?? SPECIAL_HEADINGS[hs]?.[flow] ?? `Heading ${hs}`;

/** The name of a picked line, for the selection line and the takeaway. */
export function pickName(payload: Pick<ProductUsePayload, "names">, flow: ProductsFlow, pick: SankeyPick): string {
  return pick.kind === "chapter" ? chapterName(pick.code) : pick.kind === "product" ? headingLabel(payload, flow, pick.code) : endUseName(flow, pick.code);
}

const add = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v);
const ranked = (m: Map<string, number>) => [...m].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

/**
 * The named lines of one column: the largest first, each at least `SANKEY_MIN_SHARE` of the selection, at most `cap`.
 * Everything else folds into Other. Exported for the tests.
 */
export function namedLines(totals: Map<string, number>, selection: number, cap: number): { keep: string[]; rest: string[] } {
  const all = ranked(totals).map(([k]) => k);
  const keep = all.filter((k) => totals.get(k)! >= SANKEY_MIN_SHARE * selection).slice(0, cap);
  const kept = new Set(keep);
  return { keep, rest: all.filter((k) => !kept.has(k)) };
}

/** The Sankey for one pick, or null when the year has no trade on that line. */
export function sankeyModel(payload: ProductUsePayload, flow: ProductsFlow, pick: SankeyPick): SankeyModel | null {
  const { rows, special } = payload.flows[flow];
  const chOf = (hs: string) => hs.slice(0, 2);
  const inSel = pick.kind === "chapter" ? (t: ProductUseTriple) => chOf(t[0]) === pick.code : pick.kind === "product" ? (t: ProductUseTriple) => t[0] === pick.code : (t: ProductUseTriple) => t[1] === pick.code;
  const sel = rows.filter((t) => inSel(t) && t[2] > 0);
  const total = sel.reduce((a, t) => a + t[2], 0);
  if (total <= 0) return null;

  // Totals over everything (for "x% of all ...") and over the selection.
  const useAll = new Map<string, number>();
  const prodAll = new Map<string, number>();
  const chAll = new Map<string, number>();
  for (const t of [...rows, ...special]) {
    add(useAll, t[1], t[2]);
    add(prodAll, t[0], t[2]);
    add(chAll, chOf(t[0]), t[2]);
  }
  const cSel = new Map<string, number>();
  const pSel = new Map<string, number>();
  const uSel = new Map<string, number>();
  for (const t of sel) {
    add(cSel, chOf(t[0]), t[2]);
    add(pSel, t[0], t[2]);
    add(uSel, t[1], t[2]);
  }

  const byUse = pick.kind === "use";
  const C = namedLines(cSel, total, byUse ? SANKEY_TOP.chapters : Infinity);
  const P = namedLines(pSel, total, SANKEY_TOP.products);
  const U = namedLines(uSel, total, byUse ? 1 : SANKEY_TOP.uses);
  const cId = (c: string) => (C.rest.includes(c) ? "c:other" : `c:${c}`);
  const pId = (p: string) => (P.rest.includes(p) ? "p:other" : `p:${p}`);
  const uId = (u: string) => (U.rest.includes(u) ? "u:other" : `u:${u}`);

  const nodes: SankeyNode[] = [];
  const node = (n: Omit<SankeyNode, "outside" | "full" | "folded" | "grey" | "colour"> & Partial<SankeyNode>) =>
    nodes.push({ outside: 0, full: n.value, folded: 0, grey: false, colour: SANKEY_NODE, ...n });
  const sum = (m: Map<string, number>, ks: string[]) => ks.reduce((a, k) => a + (m.get(k) ?? 0), 0);
  const other = (col: 0 | 1 | 2, prefix: string, rest: string[], m: Map<string, number>, plural: string, nameOf: (k: string) => string) => {
    if (!rest.length) return;
    const one = rest.length === 1;
    node({ id: `${prefix}:other`, col, code: one ? rest[0] : null, label: one ? nameOf(rest[0]) : `${rest.length} other ${plural}`, value: sum(m, rest), folded: rest.length, colour: SANKEY_OTHER });
  };
  const hName = (hs: string) => headingLabel(payload, flow, hs);

  // Chapter column. On a product pick the chapter is sized to the product.
  for (const c of C.keep) node({ id: `c:${c}`, col: 0, code: c, label: chapterName(c), value: cSel.get(c)!, full: chAll.get(c) ?? 0 });
  other(0, "c", C.rest, cSel, "chapters", chapterName);
  for (const p of P.keep) node({ id: `p:${p}`, col: 1, code: p, label: hName(p), value: pSel.get(p)!, full: prodAll.get(p) ?? 0 });
  other(1, "p", P.rest, pSel, "products", hName);
  for (const u of U.keep) node({ id: `u:${u}`, col: 2, code: u, label: endUseName(flow, u), value: uSel.get(u)!, full: useAll.get(u) ?? 0 });
  other(2, "u", U.rest, uSel, "uses", (u) => endUseName(flow, u));

  // Colour key: the use column (chapter and product picks) or the chapter column (use picks), in order of size.
  const keyCol = byUse ? 0 : 2;
  let ci = 0;
  for (const n of nodes) if (n.col === keyCol && n.folded === 0) n.colour = SANKEY_COLOURS[ci++ % SANKEY_COLOURS.length];
  const colourOf = new Map(nodes.map((n) => [n.id, n.colour]));

  // Segments: chapter -> product and product -> use, each coloured by the path's key node.
  const seg = new Map<string, SankeySegment>();
  const addSeg = (source: string, target: string, value: number, colour: string) => {
    const k = `${source}>${target}|${colour}`;
    const s = seg.get(k);
    if (s) s.value += value;
    else seg.set(k, { source, target, value, colour });
  };
  for (const t of sel) {
    const c = cId(chOf(t[0]));
    const p = pId(t[0]);
    const u = uId(t[1]);
    const colour = colourOf.get(byUse ? c : u)!;
    addSeg(c, p, t[2], colour);
    addSeg(p, u, t[2], colour);
  }

  // Grey: each named use's part from outside the selection, with its largest sources.
  const grey: SankeyGrey[] = [];
  if (!byUse) {
    for (const u of U.keep) {
      const inside = uSel.get(u)!;
      const value = (useAll.get(u) ?? 0) - inside;
      if (value <= 0 || inside < SANKEY_MIN_SHARE * total) continue;
      const src = new Map<string, number>();
      for (const t of [...rows, ...special]) if (t[1] === u && !inSel(t) && t[2] > 0) add(src, pick.kind === "chapter" ? chOf(t[0]) : t[0], t[2]);
      const list = ranked(src);
      grey.push({ target: `u:${u}`, value, top: list.slice(0, 3).map(([k, v]) => ({ name: pick.kind === "chapter" ? chapterName(k) : hName(k), value: v })), count: list.length });
      nodes.find((n) => n.id === `u:${u}`)!.outside = value;
      addSeg(GREY_ID, `u:${u}`, value, SANKEY_OUTSIDE);
    }
    if (grey.length)
      node({ id: GREY_ID, col: 1, code: null, label: pick.kind === "chapter" ? "From other chapters" : "From other products", value: grey.reduce((a, g) => a + g.value, 0), grey: true, colour: SANKEY_OUTSIDE });
  }
  // A product pick's chapter is drawn at the product's size; its full total stays for the tooltip.
  return {
    pick,
    flow,
    year: payload.year,
    months: payload.months,
    name: pickName(payload, flow, pick),
    total,
    nodes,
    segments: [...seg.values()],
    grey,
    counts: { chapters: cSel.size, products: pSel.size, uses: uSel.size },
  };
}

/** A node's drawn size: its selection part plus the grey part. */
export const nodeSize = (n: SankeyNode) => n.value + n.outside;

/** The (source, target) links, colours merged, largest first: the table and the band tooltips. */
export function sankeyLinks(m: SankeyModel): { source: SankeyNode; target: SankeyNode; value: number }[] {
  const byId = new Map(m.nodes.map((n) => [n.id, n]));
  const agg = new Map<string, number>();
  for (const s of m.segments) add(agg, `${s.source}>${s.target}`, s.value);
  return [...agg]
    .map(([k, value]) => {
      const [s, t] = k.split(">");
      return { source: byId.get(s)!, target: byId.get(t)!, value };
    })
    .sort((a, b) => a.source.col - b.source.col || b.value - a.value);
}

const pct = (r: number) => (r >= 0.995 ? "100%" : r < 0.01 ? "under 1%" : `${Math.round(r * 100)}%`);
/** "a, b and c"; with semicolons when a name has its own comma ("civilian aircraft, engines & parts"). */
const listOf = (xs: string[]) => {
  if (xs.length <= 1) return xs.join("");
  const sep = xs.some((x) => x.includes(",")) ? "; " : ", ";
  return `${xs.slice(0, -1).join(sep)}${sep === "; " ? "; and " : " and "}${xs[xs.length - 1]}`;
};

/**
 * The takeaway under the title (rule 7c): what this selection shows, at most two sentences, ink. Figures only; the
 * period reads "in 2025" or "in 2026 through August". Sentences are built so no verb has to agree with a product name
 * ("Imports of computers ... split", "58% goes to ...").
 */
export function sankeyTakeaway(m: SankeyModel, monthNames: readonly string[]): string {
  const when = m.months < 12 ? `in ${m.year} through ${monthNames[m.months - 1]}` : `in ${m.year}`;
  const Flow = m.flow === "imports" ? "Imports" : "Exports";
  const flow = m.flow;
  const lead = `${Flow} of ${lowerFirst(m.name)} (${fmtDollars(m.total)} ${when})`;
  const named = (col: 1 | 2) => m.nodes.filter((n) => n.col === col && n.folded === 0 && !n.grey);
  const share = (n: SankeyNode) => n.value / m.total;
  const lc = (n: SankeyNode) => lowerFirst(n.label);

  if (m.pick.kind === "use") {
    const { products: nP, chapters: nC } = m.counts;
    if (nP === 1) return `${lead} all come from one product, ${lc(m.nodes.find((n) => n.col === 1)!)}.`;
    const first = `${lead} come from ${nP} products in ${nC === 1 ? "one chapter" : `${nC} chapters`}.`;
    const [a, b] = named(1);
    if (!a) return first;
    return `${first} The largest is ${lc(a)} at ${pct(share(a))}${b ? `, then ${lc(b)} at ${pct(share(b))}` : ""}.`;
  }

  // Chapter and product picks: where the selection goes, then how much of its main uses it supplies.
  const uses = named(2);
  const nUses = m.counts.uses;
  let first: string;
  if (nUses === 1) first = `${lead} all go to one end use, ${lc(uses[0])}.`;
  else if (share(uses[0]) >= 0.995) first = `${lead} go almost entirely to one end use, ${lc(uses[0])}.`;
  else if (uses.length >= 2 && share(uses[0]) + share(uses[1]) >= 0.995) first = `${lead} split between ${lc(uses[0])} (${fmtDollars(uses[0].value)}) and ${lc(uses[1])} (${fmtDollars(uses[1].value)}).`;
  else {
    const top = uses.slice(0, 3);
    first = `${lead} feed ${nUses} end uses; ${pct(top.reduce((a, n) => a + share(n), 0))} goes to ${listOf(top.map(lc))}.`;
  }

  const supplied = (n: SankeyNode) => n.value / (n.value + n.outside);
  const of = (n: SankeyNode, all: boolean) => (supplied(n) >= 0.995 ? `all ${flow} of ${lc(n)}` : `${pct(supplied(n))} of ${all ? "all " : ""}${flow} of ${lc(n)}`);
  const main = uses.filter((n) => share(n) >= 0.05);
  if (!main.length) return first;
  if (m.pick.kind === "product") {
    const [a, b] = main;
    return `${first} They make up ${of(a, true)}${b ? ` and ${of(b, false)}` : ""}.`;
  }
  // Chapter: the main use it supplies least, and where the rest of that use comes from.
  const mixed = [...main].sort((a, b) => supplied(a) - supplied(b))[0];
  if (supplied(mixed) >= 0.95) return `${first} Each of its main uses comes almost entirely from this chapter.`;
  const g = m.grey.find((x) => x.target === mixed.id);
  const top = g?.top[0];
  const rest = g && top && top.value > g.value / 2 ? `most of the rest comes from ${lowerFirst(top.name)}` : `the rest comes from ${g?.count ?? 0} other chapters`;
  return `${first} The chapter supplies ${of(mixed, true)}; ${rest}.`;
}

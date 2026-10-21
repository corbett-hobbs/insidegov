import type { ProductsFlow } from "./trade-products";

/**
 * Pure model for the breakdown an opened line shows in "What the U.S. trades": a chapter's split across Census end
 * uses ("What it's used for"), or an end use's split across HS chapters ("Where it comes from"). Built from
 * `trade_product_use` (every HS heading x end use), summed to chapter x use on the server (`lib/trade-chapter-use-data.ts`).
 * Pairs with a special end use or a chapter 98/99 heading are kept apart (`special`) and shown as one "Special entries"
 * part. A line splits over its own pairs, so its parts always sum to 100%; for a chapter that total is the published one,
 * for a use it can differ from Census's published category total by a few percent (the ten-digit concordance does not
 * quite match it). See docs/TRADE_METHODOLOGY.md.
 */

/** One chapter x use pair, whole dollars (exports, or general imports). */
export type ChapterUsePair = readonly [chapter: string, use: string, value: number];

/** What `/data/trade/chapter-use/[year]` serves: every chapter x use pair of one year, both flows, largest first. */
export interface ChapterUsePayload {
  year: number;
  /** 12 = the calendar year; fewer = year to date. */
  months: number;
  /** Ranked pairs: an ordinary chapter (01-97) and an ordinary end use. */
  flows: Record<ProductsFlow, ChapterUsePair[]>;
  /** Special pairs: a special end use (minimum-value shipments, returned goods...) or a chapter 98/99 heading. */
  special: Record<ProductsFlow, ChapterUsePair[]>;
}

export type BreakdownKind = "chapter" | "use";

/** Named parts before the rest folds into one "N other …" line. */
export const BREAKDOWN_TOP = 5;
/** A part under this share of the line folds into the Other line. */
export const BREAKDOWN_MIN_SHARE = 0.01;
/** Special entries under this share of a line are rounding, folded into nothing (they stay in the line's total). */
export const SPECIAL_MIN_SHARE = 0.005;

export interface BreakdownPart {
  /** Use code (a chapter's parts) or chapter code (a use's parts); null for the Other line and Special entries. */
  code: string | null;
  name: string;
  value: number;
  /** Share of the line's own pairs, special entries included (the parts sum to 1). */
  share: number;
  /** The part's own total over all trade (that whole use, or that whole chapter), when known; null for Other and Special. */
  whole: number | null;
  /** Lines folded into an Other line; 0 for an ordinary part. */
  folded: number;
  special: boolean;
}

export interface Breakdown {
  parts: BreakdownPart[];
  /** Distinct uses (or chapters) the line reaches, before folding. */
  count: number;
  /** The line's own total in the file: its pairs plus its special entries. */
  total: number;
}

/** The (other side code, value) pairs of one line, largest first. */
function pairsOf(list: readonly ChapterUsePair[], kind: BreakdownKind, code: string): [string, number][] {
  const out: [string, number][] = [];
  for (const [ch, use, v] of list) {
    if (v <= 0) continue;
    if (kind === "chapter" ? ch === code : use === code) out.push([kind === "chapter" ? use : ch, v]);
  }
  return out.sort((a, b) => b[1] - a[1]);
}

/**
 * One line's breakdown over its own pairs: the top `BREAKDOWN_TOP` parts of at least 1% each, then one Other line (an
 * Other of one part keeps its own name), then Special entries when they are 0.5% of the line or more. `name` names a
 * code on the other side; `whole` gives that code's own total (null when unknown).
 */
export function breakdown(
  payload: ChapterUsePayload,
  flow: ProductsFlow,
  kind: BreakdownKind,
  code: string,
  name: (code: string) => string,
  whole: (code: string) => number | null,
): Breakdown {
  const pairs = pairsOf(payload.flows[flow], kind, code);
  const special = pairsOf(payload.special[flow], kind, code).reduce((a, p) => a + p[1], 0);
  const total = pairs.reduce((a, p) => a + p[1], 0) + special;
  const share = (v: number) => (total > 0 ? v / total : 0);
  const part = (c: string, v: number): BreakdownPart => ({ code: c, name: name(c), value: v, share: share(v), whole: whole(c), folded: 0, special: false });
  const keep: BreakdownPart[] = [];
  const rest: [string, number][] = [];
  pairs.forEach(([c, v], i) => (i < BREAKDOWN_TOP && share(v) >= BREAKDOWN_MIN_SHARE ? keep.push(part(c, v)) : rest.push([c, v])));
  if (rest.length === 1) keep.push(part(...rest[0]));
  else if (rest.length > 1) {
    const v = rest.reduce((a, r) => a + r[1], 0);
    keep.push({ code: null, name: `${rest.length} other ${kind === "chapter" ? "uses" : "chapters"}`, value: v, share: share(v), whole: null, folded: rest.length, special: false });
  }
  if (special > 0 && share(special) >= SPECIAL_MIN_SHARE) keep.push({ code: null, name: "Special entries", value: special, share: share(special), whole: null, folded: 0, special: true });
  return { parts: keep, count: pairs.length, total };
}

/**
 * The codes on the other side that one line is linked to: a pair worth at least 1% of the line or of the other code's
 * own pairs. The other list keeps these lit and dims the rest.
 */
export function linkedCodes(payload: ChapterUsePayload, flow: ProductsFlow, kind: BreakdownKind, code: string): Set<string> {
  const pairs = pairsOf(payload.flows[flow], kind, code);
  const lineTotal = pairs.reduce((a, p) => a + p[1], 0);
  const otherTotals = new Map<string, number>();
  for (const [ch, use, v] of payload.flows[flow]) {
    const k = kind === "chapter" ? use : ch;
    otherTotals.set(k, (otherTotals.get(k) ?? 0) + v);
  }
  return new Set(pairs.filter(([c, v]) => v >= BREAKDOWN_MIN_SHARE * lineTotal || v >= BREAKDOWN_MIN_SHARE * (otherTotals.get(c) ?? Infinity)).map(([c]) => c));
}

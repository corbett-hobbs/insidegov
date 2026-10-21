import { SANKEY_COLOURS, SANKEY_OTHER, SANKEY_OUTSIDE, nodeSize, type SankeyModel, type SankeyNode } from "./trade-sankey";

/**
 * Geometry for the "From product to use" Sankey (`components/trade/TradeSankeyCard.tsx`): pure, no DOM, so it runs in
 * the component and in tests. Text widths come in through `measure`. Ported from the owner-approved mockup
 * (`docs/mockups/trade-sankey-mock.html` on branch claude/trade-sankey-mock-58d14f).
 *
 * - **Wide (>= 720px): left to right.** Chapter labels sit left of their column, product labels right of theirs (with a
 *   surface halo over the bands), use labels right of theirs; a node tall enough (28px) takes the name and value on
 *   two lines. A name too long for the room is shortened with an ellipsis (the tooltip has it in full).
 * - **Narrow: top to bottom.** A label that fits across its node sits level. Otherwise it slants up and to the right
 *   at 55 degrees: row 0's labels rise from the node's left corner, row 2's end at the node's right corner, reaching
 *   down and to the left, and row 1 takes whichever side slants less in total. A label steepens only where it would
 *   leave the chart, and a neighbour steepens just enough to keep a 14px gap from it, so no label leaves the SVG.
 */

export type Measure = (text: string, px: number, mono: boolean) => number;

export const SANKEY_WIDE_MIN = 720;
const SLANT = (55 * Math.PI) / 180;
const MIN_GAP = 14;

export interface LaidNode {
  node: SankeyNode;
  /** Top-left corner of the bar. */
  x: number;
  y: number;
  /** Bar length across the flow (height when wide, width when narrow) and the selection part of it. */
  len: number;
  selLen: number;
  /** The node's slot across the flow: start and size (at least the label's minimum). */
  slot: [number, number];
}

export interface Ribbon {
  key: string;
  source: string;
  target: string;
  colour: string;
  grey: boolean;
  d: string;
}

export interface SankeyLabel {
  id: string;
  name: string;
  value: string;
  /** Text anchor point; for a slanted label, the corner it rotates about. */
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
  /** Degrees, negative = up and to the right. 0 for a level label. */
  rotate: number;
  /** Name and value on two lines (wide layout only). */
  twoLines: boolean;
  halo: boolean;
  grey: boolean;
  /** Font sizes of the name and of the value (mono), and the space before a value on the same line. */
  px: number;
  valuePx: number;
  dx: number;
}

export interface SankeyLayout {
  wide: boolean;
  width: number;
  height: number;
  /** Bar thickness along the flow. */
  bar: number;
  nodes: LaidNode[];
  ribbons: Ribbon[];
  labels: SankeyLabel[];
  captions: { text: string; x: number; y: number; anchor: "start" | "end" }[];
}

const colourRank = (c: string) => (c === SANKEY_OUTSIDE ? 99 : c === SANKEY_OTHER ? 98 : SANKEY_COLOURS.indexOf(c as (typeof SANKEY_COLOURS)[number]));

/** Shortens `text` with an ellipsis until it fits `max` px (never below one character). */
export function fitText(text: string, max: number, px: number, measure: Measure): string {
  if (measure(text, px, false) <= max) return text;
  let lo = 1;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measure(`${text.slice(0, mid).trimEnd()}…`, px, false) <= max) lo = mid;
    else hi = mid - 1;
  }
  return `${text.slice(0, lo).trimEnd()}…`;
}

/** Column order: largest first, then Other, then the grey node. */
function columns(m: SankeyModel): SankeyNode[][] {
  return [0, 1, 2].map((c) => m.nodes.filter((n) => n.col === c).sort((a, b) => +a.grey - +b.grey || +(a.folded > 0) - +(b.folded > 0) || b.value - a.value));
}

export function layoutSankey(m: SankeyModel, width: number, measure: Measure, valueOf: (n: SankeyNode) => string): SankeyLayout {
  const wide = width >= SANKEY_WIDE_MIN;
  const cols = columns(m);
  const laid = new Map<string, LaidNode>();
  const labels: SankeyLabel[] = [];
  const captions: SankeyLayout["captions"] = [];
  const bar = wide ? 10 : 12;
  const gap = wide ? 7 : 3;
  const tot = Math.max(...cols.map((c) => c.reduce((a, n) => a + nodeSize(n), 0)));
  const maxN = Math.max(...cols.map((c) => c.length));
  let height: number;

  if (wide) {
    const px = 12;
    const cap = Math.max(110, Math.floor((width - 3 * bar - 160) / 3));
    const names = new Map(m.nodes.map((n) => [n.id, fitText(n.label, cap, px, measure)]));
    const h0 = Math.max(380, Math.min(560, width * 0.42));
    const k = (h0 - gap * (maxN - 1)) / tot;
    const ext = cols.map((c, ci) => {
      let y = 0;
      for (const n of c) {
        const len = Math.max(nodeSize(n) * k, 1.5);
        const slot = Math.max(len, len >= 28 ? 28 : 15);
        laid.set(n.id, { node: n, x: ci, y: y + (slot - len) / 2, len, selLen: len * (n.value / nodeSize(n)), slot: [y, slot] });
        y += slot + gap;
      }
      return y - gap;
    });
    // A label's width: name over value on a tall node, name then value on one line otherwise.
    const lineW = (n: SankeyNode) => {
      const nw = measure(names.get(n.id)!, px, false);
      const vw = measure(valueOf(n), 11, true);
      return laid.get(n.id)!.slot[1] >= 28 ? Math.max(nw, vw) : nw + 6 + vw;
    };
    const L = Math.max(...cols[0].map(lineW)) + 12;
    const R = Math.max(...cols[2].map(lineW)) + 12;
    const mid = Math.max(...cols[1].map(lineW)) + 12;
    const top = 20; // the column captions
    const x0 = L;
    const x2 = width - R - bar;
    let x1 = x0 + (x2 - x0) * 0.4;
    if (x2 - x1 - bar < mid + 60) x1 = x2 - bar - mid - 60;
    x1 = Math.max(x1, x0 + bar + 40);
    const xs = [x0, x1, x2];
    for (const l of laid.values()) l.x = xs[l.x];
    const H = Math.max(...ext);
    cols.forEach((c, ci) => {
      const off = top + (H - ext[ci]) / 2;
      for (const n of c) {
        const l = laid.get(n.id)!;
        l.y += off;
        l.slot = [l.slot[0] + off, l.slot[1]];
      }
    });
    height = top + H + 2;
    for (const l of laid.values()) {
      const n = l.node;
      const two = l.slot[1] >= 28;
      const cy = l.slot[0] + l.slot[1] / 2;
      const left = n.col === 0;
      labels.push({
        id: n.id,
        name: names.get(n.id)!,
        value: valueOf(n),
        x: left ? l.x - 6 : l.x + bar + 6,
        y: two ? cy - 2 : cy + 4,
        anchor: left ? "end" : "start",
        rotate: 0,
        twoLines: two,
        halo: n.col === 1,
        grey: n.grey,
        px,
        valuePx: 11,
        dx: 6,
      });
    }
    captions.push({ text: "Chapter", x: x0 + bar, y: 11, anchor: "end" }, { text: "Product", x: x1, y: 11, anchor: "start" }, { text: "Use", x: x2, y: 11, anchor: "start" });
  } else {
    const pad = 4;
    const px = 10.5;
    const inner = width - pad * 2;
    let k = (inner - gap * (maxN - 1)) / tot;
    for (let it = 0; it < 8; it++) {
      const need = Math.max(...cols.map((c) => c.reduce((a, n) => a + Math.max(nodeSize(n) * k, 17), 0) + gap * (c.length - 1)));
      if (need <= inner) break;
      k *= (inner / need) * 0.995;
    }
    for (const c of cols) {
      let x = 0;
      for (const n of c) {
        const len = Math.max(nodeSize(n) * k, 1.5);
        const slot = Math.max(len, 17);
        laid.set(n.id, { node: n, x: pad + x + (slot - len) / 2, y: 0, len, selLen: len * (n.value / nodeSize(n)), slot: [pad + x, slot] });
        x += slot + gap;
      }
      const off = (inner - (x - gap)) / 2;
      for (const n of c) {
        const l = laid.get(n.id)!;
        l.x += off;
        l.slot = [l.slot[0] + off, l.slot[1]];
      }
    }
    // Label widths and which lie level.
    const lw = new Map<string, number>();
    const flat = new Map<string, boolean>();
    for (const c of cols)
      for (const n of c) {
        const w = measure(n.label, px, false) + 5 + measure(valueOf(n), px - 0.5, true) + 6;
        lw.set(n.id, w);
        const l = laid.get(n.id)!;
        flat.set(n.id, w <= l.slot[1] || (c.length === 1 && w <= width - 4));
      }
    // Slant one row's labels: up (rising right from the left corner) or down (ending at the right corner, reaching
    // down-left). Walk in from the edge a label could run off; a label steepens only if it would leave the chart, and
    // takes its neighbour's angle when at its own it would come within MIN_GAP of that steeper label.
    type Slant = { id: string; ax: number; a: number };
    const slant = (c: SankeyNode[], up: boolean): Slant[] => {
      const seq = c
        .filter((n) => !flat.get(n.id))
        .map((n) => {
          const s = laid.get(n.id)!.slot;
          return { id: n.id, ax: up ? s[0] + Math.min(6, s[1] / 2) : s[0] + s[1] - Math.min(6, s[1] / 2), a: SLANT };
        });
      if (up) seq.reverse();
      let prev: Slant | null = null;
      for (const o of seq) {
        const w = lw.get(o.id)!;
        const room = (up ? width - o.ax : o.ax) - 8;
        let a = SLANT;
        if (w > room) a = Math.max(a, Math.acos(Math.max(0, Math.min(1, room / w))));
        if (prev && a < prev.a) {
          const dx = Math.abs(o.ax - prev.ax);
          const depth = Math.min(w * Math.sin(a), lw.get(prev.id)! * Math.sin(prev.a));
          const g = (dx - depth * (1 / Math.tan(a) - 1 / Math.tan(prev.a))) * Math.sin(a);
          if (g < MIN_GAP) a = prev.a;
        }
        o.a = a;
        prev = o;
      }
      return seq;
    };
    const angle = new Map<string, Slant>();
    const take = (r: Slant[]) => r.forEach((o) => angle.set(o.id, o));
    take(slant(cols[0], true));
    take(slant(cols[2], false));
    const r1u = slant(cols[1], true);
    const r1d = slant(cols[1], false);
    const total = (r: Slant[]) => r.reduce((q, o) => q + o.a, 0);
    const up1 = total(r1u) <= total(r1d);
    take(up1 ? r1u : r1d);
    const area = (c: SankeyNode[]) => Math.max(16, ...c.map((n) => (flat.get(n.id) ? 16 : lw.get(n.id)! * Math.sin(angle.get(n.id)!.a) + 8)));
    const A0 = area(cols[0]);
    const A1 = area(cols[1]);
    const A2 = area(cols[2]);
    const y0 = A0 + 4;
    const y1 = y0 + bar + (up1 ? A1 + 30 : 70);
    const y2 = y1 + bar + (up1 ? 70 : A1 + 40);
    [y0, y1, y2].forEach((y, ci) => cols[ci].forEach((n) => (laid.get(n.id)!.y = y)));
    height = y2 + bar + A2 + 4;
    for (const l of laid.values()) {
      const n = l.node;
      const up = n.col === 0 || (n.col === 1 && up1);
      const base = { id: n.id, name: n.label, value: valueOf(n), twoLines: false, halo: n.col === 1, grey: n.grey, px, valuePx: px - 0.5, dx: 5 };
      if (flat.get(n.id)) {
        const w = lw.get(n.id)!;
        const cx = Math.min(Math.max(l.slot[0] + l.slot[1] / 2, w / 2 + 2), width - w / 2 - 2);
        labels.push({ ...base, x: cx, y: up ? l.y - 5 : l.y + bar + 13, anchor: "middle", rotate: 0 });
      } else {
        const s = angle.get(n.id)!;
        labels.push({ ...base, x: s.ax, y: up ? l.y - 4 : l.y + bar + 11, anchor: up ? "start" : "end", rotate: (-s.a * 180) / Math.PI });
      }
    }
  }

  // Ribbons: one per (source, target, colour), stacked along each node in the order of the far end.
  const pos = (id: string) => (wide ? laid.get(id)!.y : laid.get(id)!.x);
  const items = m.segments.map((s) => ({ ...s, key: `${s.source}>${s.target}|${s.colour}`, grey: s.colour === SANKEY_OUTSIDE }));
  type Item = (typeof items)[number];
  const outs = new Map<string, Item[]>();
  const ins = new Map<string, Item[]>();
  for (const s of items) {
    if (!outs.has(s.source)) outs.set(s.source, []);
    if (!ins.has(s.target)) ins.set(s.target, []);
    outs.get(s.source)!.push(s);
    ins.get(s.target)!.push(s);
  }
  const scale = (id: string) => {
    const l = laid.get(id)!;
    return l.len / nodeSize(l.node);
  };
  const stack = (groups: Map<string, Item[]>, order: (a: Item, b: Item) => number) => {
    const off = new Map<string, number>();
    for (const [id, list] of groups) {
      list.sort(order);
      let o = 0;
      for (const r of list) {
        off.set(r.key, o);
        o += r.value * scale(id);
      }
    }
    return off;
  };
  const off0 = stack(outs, (a, b) => pos(a.target) - pos(b.target) || colourRank(a.colour) - colourRank(b.colour));
  const off1 = stack(ins, (a, b) => +a.grey - +b.grey || pos(a.source) - pos(b.source) || colourRank(a.colour) - colourRank(b.colour));
  const f = (v: number) => Math.round(v * 10) / 10;
  const ribbons: Ribbon[] = items.map((s) => {
    const a = laid.get(s.source)!;
    const b = laid.get(s.target)!;
    const w0 = s.value * scale(s.source);
    const w1 = s.value * scale(s.target);
    const o0 = off0.get(s.key)!;
    const o1 = off1.get(s.key)!;
    let d: string;
    if (wide) {
      const xa = a.x + bar;
      const xb = b.x;
      const ya = a.y + o0;
      const yb = b.y + o1;
      const xm = (xa + xb) / 2;
      d = `M${f(xa)},${f(ya)}C${f(xm)},${f(ya)} ${f(xm)},${f(yb)} ${f(xb)},${f(yb)}L${f(xb)},${f(yb + w1)}C${f(xm)},${f(yb + w1)} ${f(xm)},${f(ya + w0)} ${f(xa)},${f(ya + w0)}Z`;
    } else {
      const ya = a.y + bar;
      const yb = b.y;
      const xa = a.x + o0;
      const xb = b.x + o1;
      const ym = (ya + yb) / 2;
      d = `M${f(xa)},${f(ya)}C${f(xa)},${f(ym)} ${f(xb)},${f(ym)} ${f(xb)},${f(yb)}L${f(xb + w1)},${f(yb)}C${f(xb + w1)},${f(ym)} ${f(xa + w0)},${f(ym)} ${f(xa + w0)},${f(ya)}Z`;
    }
    return { key: s.key, source: s.source, target: s.target, colour: s.colour, grey: s.grey, d };
  });

  return { wide, width, height, bar, nodes: [...laid.values()], ribbons, labels, captions };
}

/**
 * A label's box in SVG coordinates, for tests and debugging: level labels from their anchor, slanted ones from the
 * rotated baseline plus a glyph height. Two-line labels count both lines.
 */
export function labelBox(l: SankeyLabel, measure: Measure): { x0: number; x1: number; y0: number; y1: number } {
  const nameW = measure(l.name, l.px, false);
  const valW = measure(l.value, l.valuePx, true);
  const w = l.twoLines ? Math.max(nameW, valW) : nameW + l.dx + valW;
  const asc = l.px * 0.8;
  const desc = l.px * 0.25;
  if (l.rotate === 0) {
    const x0 = l.anchor === "start" ? l.x : l.anchor === "end" ? l.x - w : l.x - w / 2;
    return { x0, x1: x0 + w, y0: l.y - asc, y1: l.y + desc + (l.twoLines ? 13 : 0) };
  }
  const a = (-l.rotate * Math.PI) / 180;
  const dx = w * Math.cos(a);
  const dy = w * Math.sin(a);
  // Glyphs sit on the up-left side of the baseline.
  const gx = asc * Math.sin(a);
  const gy = asc * Math.cos(a);
  if (l.anchor === "start") return { x0: l.x - gx, x1: l.x + dx, y0: l.y - dy - gy, y1: l.y + desc };
  return { x0: l.x - dx - gx, x1: l.x, y0: l.y - gy, y1: l.y + dy + desc };
}

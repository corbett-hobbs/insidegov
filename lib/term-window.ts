/** A presidential term's first and last position on a window's axis (inclusive). */
export interface TermExtent {
  from: number;
  to: number;
}

/** Indexes of the terms the window covers whole; none while the window is the full range (nothing is "selected" then). */
export function selectedTerms(terms: readonly TermExtent[], min: number, max: number, value: readonly [number, number]): number[] {
  if (value[0] === min && value[1] === max) return [];
  return terms.flatMap((t, k) => (t.from >= value[0] && t.to <= value[1] ? [k] : []));
}

/** The window that adds the terms `a` to `b` (inclusive) to the current one; from the full range it becomes just those terms. */
export function addTermRun(terms: readonly TermExtent[], a: number, b: number, min: number, max: number, value: readonly [number, number]): [number, number] {
  const lo = Math.min(terms[a].from, terms[b].from);
  const hi = Math.max(terms[a].to, terms[b].to);
  const full = value[0] === min && value[1] === max;
  return full ? [lo, hi] : [Math.min(lo, value[0]), Math.max(hi, value[1])];
}

/**
 * The window after tapping term `k`: an unselected term is added (with any terms between, since the window is one run); a selected term at
 * either end of the run is dropped; the only selected term clears the filter; a selected term in the middle can't go without a gap, so the
 * window stays as it is. Shared by the slider's `TermBand` and the bands drawn under the charts.
 */
export function toggleTermWindow(terms: readonly TermExtent[], k: number, min: number, max: number, value: readonly [number, number]): [number, number] {
  const sel = selectedTerms(terms, min, max, value);
  if (!sel.includes(k)) return addTermRun(terms, k, k, min, max, value);
  if (sel.length === 1) return [min, max];
  if (k === sel[0]) return [terms[sel[1]].from, value[1]];
  if (k === sel[sel.length - 1]) return [value[0], terms[sel[sel.length - 2]].to];
  return [value[0], value[1]];
}

/** A page's year window as a chart's term band needs it: the full range, the current window and how to change it. */
export interface TermWindow {
  min: number;
  max: number;
  value: readonly [number, number];
  onChange: (next: [number, number]) => void;
}

/** What a tappable band needs for term `k` of `terms`: whether it is selected, whether it fades (others are selected), and what a press does. */
export function termPress(terms: readonly TermExtent[], k: number, w: TermWindow): { picked: boolean; faded: boolean; onPress: () => void } {
  const sel = selectedTerms(terms, w.min, w.max, w.value);
  const picked = sel.includes(k);
  return { picked, faded: sel.length > 0 && !picked, onPress: () => w.onChange(toggleTermWindow(terms, k, w.min, w.max, w.value)) };
}

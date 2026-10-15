/**
 * Pure helpers for the checkbox filters (`components/charts/MultiSelectFilter`). A selection is `null` (every option
 * ticked, i.e. no filter) or a set of the ticked ids; a set that holds every option is always stored as `null`, so
 * "nothing is filtered" has one spelling. An empty set is allowed: it is the moment between Clear and the first tick,
 * and it shows nothing.
 */
export type Picked<T> = ReadonlySet<T> | null;

/** `null` when `set` holds every id in `all`, else `set`. */
export function normalizePick<T>(set: ReadonlySet<T>, all: readonly T[]): Picked<T> {
  return all.every((id) => set.has(id)) ? null : set;
}

/** Is `id` ticked? `null` (no filter) ticks everything. */
export const isPicked = <T>(sel: Picked<T>, id: T): boolean => sel === null || sel.has(id);

/** Exactly one option ticked, and it is `id`. */
export const isOnly = <T>(sel: Picked<T>, id: T): boolean => sel !== null && sel.size === 1 && sel.has(id);

/** The one ticked id when exactly one is ticked, else null. */
export function soleOf<T>(sel: Picked<T>): T | null {
  if (sel === null || sel.size !== 1) return null;
  return [...sel][0]!;
}

/** What a click on a row, bar or legend entry does: pick just that option, or, when it is already the only one, clear the filter. */
export const toggleOnly = <T>(sel: Picked<T>, id: T): Picked<T> => (isOnly(sel, id) ? null : new Set([id]));

/** Tick or untick one option, keeping the "all ticked is null" rule. */
export function setPicked<T>(sel: Picked<T>, id: T, on: boolean, all: readonly T[]): Picked<T> {
  const next = new Set(sel ?? all);
  if (on) next.add(id);
  else next.delete(id);
  return normalizePick(next, all);
}

export function samePick<T>(a: Picked<T>, b: Picked<T>): boolean {
  if (a === null || b === null) return a === b;
  return a.size === b.size && [...a].every((v) => b.has(v));
}

/** How many of `all` are ticked. */
export const pickedCount = <T>(sel: Picked<T>, all: readonly T[]): number => (sel === null ? all.length : all.filter((id) => sel.has(id)).length);

/**
 * The control's face: "All policy areas", the one option's name, "All but X" when a single option is unticked, "3 of 8 policy
 * areas" otherwise, "No policy areas" for an empty selection.
 */
export function pickLabel<T>(sel: Picked<T>, items: readonly { id: T; label: string }[], noun: string, allLabel = `All ${noun}`): string {
  const on = items.filter((i) => isPicked(sel, i.id));
  if (on.length === items.length) return allLabel;
  if (on.length === 0) return `No ${noun}`;
  if (on.length === 1) return on[0]!.label;
  if (items.length - on.length === 1) return `All but ${items.find((i) => !isPicked(sel, i.id))!.label}`;
  return `${on.length} of ${items.length} ${noun}`;
}

/** The ticked labels as prose for a lede or chip: "Land and farming, Energy" (every option → null). */
export function pickedLabels<T>(sel: Picked<T>, items: readonly { id: T; label: string }[]): string[] | null {
  return sel === null ? null : items.filter((i) => sel.has(i.id)).map((i) => i.label);
}

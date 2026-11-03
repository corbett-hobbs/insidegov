/**
 * Pure half of refresh-takeaways.ts: the guard that decides whether an edit to a page's takeaway copy or its test may be
 * applied without a human. An edit passes only if it changes numerals and nothing else: every number in the old text
 * becomes "#" and the two texts must then be identical. A reworded claim ("fell" to "rose", a month, a sign) fails and
 * the PR stays open.
 */

export interface Edit {
  file: string;
  old: string;
  new: string;
}

const NUMBER = /\d[\d,]*(?:\.\d+)?/g;
const skeleton = (s: string) => s.replace(NUMBER, "#");

/** True when `after` differs from `before` only in the numbers it contains. */
export function numeralsOnly(before: string, after: string): boolean {
  return before !== after && skeleton(before) === skeleton(after);
}

/** Applies the edits to the given files, or says why none may be. `files` maps path to content; only those paths are editable. */
export function applyEdits(files: Record<string, string>, edits: Edit[]): { files: Record<string, string> } | { error: string } {
  if (edits.length === 0) return { error: "no edits proposed" };
  const out = { ...files };
  for (const e of edits) {
    const text = out[e.file];
    if (text === undefined) return { error: `${e.file} is not one of the files offered` };
    if (!numeralsOnly(e.old, e.new)) return { error: `edit in ${e.file} changes more than numerals: "${e.old}" -> "${e.new}"` };
    const at = text.indexOf(e.old);
    if (at < 0 || text.indexOf(e.old, at + 1) >= 0) return { error: `"${e.old}" does not occur exactly once in ${e.file}` };
    out[e.file] = text.slice(0, at) + e.new + text.slice(at + e.old.length);
  }
  return { files: out };
}

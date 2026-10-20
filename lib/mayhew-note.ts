/**
 * A one-line description for a major law from Mayhew's own entry for it (`pipeline/reference/mayhew-major-laws.json`, `quote`), for the
 * laws whose CRS summary gives no usable first sentence (an omnibus act opens with a table of contents or a very long sentence).
 * Mayhew's words, trimmed, never reworded: his entry reads "Label. Description. Year." (1973-2010) or "Label. Description. (Month)"
 * (2011 on), so the date notes go, the label goes when it only repeats the law's title, and a veto note goes (the card lists signed laws).
 * An entry that is only a capitalised label, or a provision of a bigger law with no description, gives nothing or says it "Includes" it.
 */
const MONTH = "(?:January|February|March|April|May|June|July|August|September|October|November|December)";
const MONTH_ONLY = new RegExp(`^\\(?${MONTH}\\b[^.]*?\\)?\\.?$`);
const MONTH_LIST = new RegExp(`^${MONTH}(?:[,\\s–—-]+(?:and\\s+)?${MONTH})*\\.?$`);
const YEAR_ONLY = /^\(?(?:19|20)\d\d\)?\.?$/;
const VETO = /\b[Oo]ver [A-Z][\w.’' ]*veto\b/;
const ABBREV_END = /\b(?:St|Mr|Mrs|Dr|Jr|Sr)\.$/;
const MAX = 300;

const isCaps = (s: string) => /[A-Za-z]/.test(s) && !/[a-z]/.test(s);

/** Split on sentence ends, but not after "St." and the like. */
function sentences(q: string): string[] {
  const out: string[] = [];
  for (const piece of q.trim().split(/(?<=[.!?])\s+(?=[“"(A-Z0-9$])/)) {
    const last = out[out.length - 1];
    if (last !== undefined && ABBREV_END.test(last)) out[out.length - 1] = `${last} ${piece}`;
    else out.push(piece);
  }
  return out.map((s) => s.trim()).filter(Boolean);
}

const stem = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
const words = (s: string) => s.split(/[\s/-]+/).map(stem).filter((w) => w.length >= 4);

/** Whether a label only restates the law's title (most of its significant words are in the title). */
function repeatsTitle(label: string, title: string): boolean {
  const w = words(label);
  if (w.length === 0) return false;
  const t = new Set(words(title));
  return w.filter((x) => t.has(x)).length / w.length >= 0.5;
}

const finish = (s: string) => {
  const t = s.replace(/[\s;,]+$/, "");
  return /[.!?”)"]$/.test(t) ? t : `${t}.`;
};

/** The description, or null when Mayhew's entry has none to show. `scope` is the entry's: "part" = a provision of the law. */
export function mayhewNote(quote: string, title: string, scope: "whole" | "part"): string | null {
  let ps = sentences(quote)
    .map((s) => s.replace(new RegExp(`\\s*\\(${MONTH}[^)]*\\)`, "g"), "").trim())
    .map((s) => {
      // "INFRASTRUCTURE – a historic $1.2 trillion ..." : the capitalised label is dropped, the rest opens a sentence.
      const m = /^[A-Z][A-Z0-9 ,'’&-]{3,}\s+[–—-]\s+(.+)$/.exec(s);
      return m ? m[1]!.charAt(0).toUpperCase() + m[1]!.slice(1) : s;
    })
    .filter((s) => s !== "" && s !== "." && !YEAR_ONLY.test(s) && !MONTH_ONLY.test(s) && !MONTH_LIST.test(s) && !VETO.test(s));
  if (ps.length === 0) return null;
  // Too little left after the label goes ("Mayor and council.") to mean anything alone: keep a title-like label, give up on a capitalised one.
  const SHORT = 30;
  if (isCaps(ps[0]!)) {
    if (ps.length === 1 || ps.slice(1).join(" ").length < 20) return null;
    ps = ps.slice(1);
  } else if (ps.length > 1 && scope === "whole" && repeatsTitle(ps[0]!, title) && ps.slice(1).join(" ").length >= SHORT) ps = ps.slice(1);
  // A lone sentence that is only another name for an act ("Opioid Crisis Response Act of 2018.") says nothing about it.
  if (ps.length === 1 && /^[A-Z][^.]*\bAct(?: of \d{4})?\.?$/.test(ps[0]!)) return null;
  if (ps.some(isCaps)) return null;
  // Over the cap, keep whole sentences from the front while they fit.
  let text = "";
  for (const s of ps) {
    const next = text === "" ? s : `${text} ${s}`;
    if (next.length > MAX) break;
    text = next;
  }
  if (text === "") return null;
  text = finish(text.replace(/\)\s+(?:19|20)\d\d\.?$/, ")"));
  return scope === "part" ? `Includes: ${text}` : text;
}

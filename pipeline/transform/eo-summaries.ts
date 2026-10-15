import { z } from "zod";
import { splitSentences } from "./wikipedia-case-summaries";

/**
 * One- or two-sentence summaries of executive orders: what each order does, written by the Claude API from the order's own text
 * (`classification/eo-summaries-auto.ts`, which reads `raw/federal-register/executive_order_texts.json`). This file holds the
 * committed cache's schema and the check every sentence must pass; the executive-orders transform joins the cache onto the orders.
 *
 * The check exists because a model left to itself writes what it remembers about an order, or the order's stated reasons instead
 * of its actions. Every summary must come with a verbatim quote of the order's operative clause (a "shall", "hereby", "is
 * revoked", "is amended" ...), every number in the summary must be in the order, and most of its words must be the order's own.
 */
export const EO_SUMMARIES = "pipeline/classification/eo_summaries.json";
export const EO_SUMMARY_MAX_CHARS = 240;
/** The length the model is asked for. Lower than the hard cap so a model that writes up to its target is not rejected for a few characters. */
export const EO_SUMMARY_TARGET_CHARS = 200;
const MIN_CHARS = 30;

export const eoSummaryEntry = z.strictObject({
  eo_number: z.number().int(),
  summary: z.string().min(1),
  /** The order's own words, verbatim, that the summary rests on: the clause that does the main thing. */
  evidence: z.string().min(1),
  model: z.string().min(1),
});
export type EoSummaryEntry = z.infer<typeof eoSummaryEntry>;
export const eoSummaryCache = z.array(eoSummaryEntry);

/**
 * Words that mark a clause as one that acts, not one that explains: the directive "shall", the permissive "may" ("a tariff
 * may be imposed", "the Secretary may designate"), the formal "hereby", a passive
 * "is/are (hereby/further) revoked/amended/established/...", the President acting in the first person ("I find", "I direct"), or
 * an amendment's own instructions ("striking ... and inserting").
 */
export const OPERATIVE = /\b(shall|may|hereby|(?:is|are)\s+(?:(?:hereby|further|also)\s+)*(?:[a-z]+(?:ed|en|ue)|set|made|paid)\b|I\s+(?:hereby\s+)?(?:find|determine|declare|direct|order|designate|delegate|expand|extend|continue|revoke|amend|modify|authorize|assign|establish)|(?:strik|insert|delet|add|redesignat|reletter)ing\b)/i;

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
/** 0-99 in words, as orders often write them ("sixty days", "twenty-five percent"); null above 99. */
export function numberWord(n: number): string | null {
  if (!Number.isInteger(n) || n < 0 || n > 99) return null;
  if (n < 20) return ONES[n]!;
  return TENS[Math.floor(n / 10)]! + (n % 10 ? `-${ONES[n % 10]}` : "");
}

const norm = (s: string): string => s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
/** Word stems (first five letters of each 4+ letter word), so "Revokes" matches "revoked" and "establishes" matches "establishment". */
const stems = (s: string): string[] => (norm(s).match(/[a-z0-9]{4,}/g) ?? []).map((w) => w.slice(0, 5));

/** Why the summary fails, or null when it passes. `text` is the order's full text. */
export function checkEoSummary(summary: string, evidence: string, text: string): string | null {
  if (summary.length < MIN_CHARS) return "the summary is too short";
  if (summary.length > EO_SUMMARY_MAX_CHARS) return `the summary is ${summary.length} characters; the limit is ${EO_SUMMARY_MAX_CHARS}`;
  if (/[\n\r]/.test(summary) || !/[.!?]["”)]?$/.test(summary)) return "the summary must be plain prose ending in a full stop, with no line breaks";
  const n = splitSentences(summary).length;
  if (n < 1 || n > 2) return `the summary has ${n} sentences; it must have one or two`;
  if (/^(this|the) (executive )?order\b|^executive order\b|^the president\b/i.test(summary)) return 'start with the action verb ("Establishes", "Revokes", "Directs"), not with "This order", "Executive Order" or "The President"';
  const t = norm(text);
  // A long clause may be quoted with "..." for the words left out: every piece must be in the order, in the same order.
  const pieces = norm(evidence).split(/\s*(?:\.\.\.|…)\s*/).filter(Boolean);
  if (Math.max(0, ...pieces.map((p) => p.length)) < 20) return "the evidence quote is too short";
  let at = 0;
  for (const p of pieces) {
    const i = t.indexOf(p, at);
    if (i < 0) return "the evidence is not a verbatim stretch of the order's text; copy it exactly (mark any words left out with ...)";
    at = i + p.length;
  }
  if (!OPERATIVE.test(evidence)) return 'the evidence must be an operative clause (one that says "shall", "hereby", "is revoked", "is amended", "is established", ...), not the purpose or findings';
  // A number must be in the order as written, or spelled out there ("sixty days" summarised as "60 days").
  const stray = (summary.match(/\d[\d,.]*/g) ?? [])
    .map((x) => x.replace(/[.,]+$/, ""))
    .find((x) => !t.includes(x) && !(numberWord(Number(x)) && new RegExp(`\\b${numberWord(Number(x))}\\b`).test(t)));
  if (stray) return `the number ${stray} is not in the order`;
  const have = new Set(stems(text));
  const mine = stems(summary);
  if (mine.length === 0 || mine.filter((w) => have.has(w)).length / mine.length < 0.7) return "too many of the summary's words are not in the order; use the order's own terms";
  return null;
}

export interface EoSummariesReport {
  summarized: number;
  /** Cached summaries dropped because they no longer pass `checkEoSummary` against the order's current text (or it has none). */
  failing_check: number[];
  /** Cached summaries for orders not in the data. */
  orphans: number[];
  by_model: Record<string, number>;
}

/**
 * The cached summaries the build may show: each re-checked against the order's text, so a hand-edited cache entry or a changed
 * Federal Register text can never put an unchecked sentence on the page.
 */
export function checkedSummaries(entries: readonly EoSummaryEntry[], texts: ReadonlyMap<number, string>, orders: ReadonlySet<number>): { summaries: Map<number, string>; report: EoSummariesReport } {
  const summaries = new Map<number, string>();
  const report: EoSummariesReport = { summarized: 0, failing_check: [], orphans: [], by_model: {} };
  for (const e of entries) {
    if (!orders.has(e.eo_number)) {
      report.orphans.push(e.eo_number);
      continue;
    }
    const text = texts.get(e.eo_number);
    if (!text || checkEoSummary(e.summary, e.evidence, text)) {
      report.failing_check.push(e.eo_number);
      continue;
    }
    summaries.set(e.eo_number, e.summary);
    report.summarized++;
    report.by_model[e.model] = (report.by_model[e.model] ?? 0) + 1;
  }
  return { summaries, report };
}

import { readFileSync } from "node:fs";
import { z } from "zod";

/**
 * The reviewed question lists, one per page (`pipeline/faq/questions/<page>.json`): what the FAQ section may answer, grouped
 * under the page's chart rows (Economy `CARD_ROWS` labels) or sections (Immigration), with the sources each answer must come
 * from. The questions start from what people search for (Google autocomplete, `searched` records the phrase) and come in two
 * kinds only: who something matters to, and the difference between two things. Never why a number moved (that is a context
 * line) or how it is measured (that is the chart's Data notes). Edited by hand and reviewed like code.
 */

export const FAQ_PAGES = ["economy", "immigration", "energy", "trade", "foreign-aid", "troops-abroad"] as const;
export type FaqPage = (typeof FAQ_PAGES)[number];

export const questionSource = z.strictObject({
  /** Shown under the answer: the publisher, then the page or dataset ("Bureau of Labor Statistics, Consumer Expenditures in 2024"). */
  label: z.string().min(1),
  /** Shown under the answer, and fetched for the drafting model and the checks unless `fetch` or `facts` says otherwise. */
  url: z.url(),
  /** A different address to read the same source from (a PDF or an API behind a page that renders in the browser). */
  fetch: z.url().optional(),
  /**
   * The source's figures come from the site's own copy of the agency's data (`facts.ts`), not from the page at `url`, which
   * only renders in a browser. The re-check workflow re-runs these when the data updates.
   */
  facts: z.enum(["encounters", "debt", "electricity", "ngExports", "aid", "troops"]).optional(),
});
export type QuestionSource = z.infer<typeof questionSource>;

export const question = z.strictObject({
  /** Stable id: the published answer keeps it, and the re-check finds the question's sources by it. */
  id: z.string().regex(/^[a-z0-9-]+$/),
  kind: z.enum(["matters", "difference"]),
  q: z.string().min(1),
  /** The search phrase the question came from, as Google's autocomplete gave it. */
  searched: z.string().min(1),
  /** DOM ids of the cards the question is about (Economy and Immigration `chart-…`, Energy `spr`, Trade `tariffs` …). */
  chartIds: z.array(z.string().regex(/^[a-z][a-z0-9-]*$/)).min(1),
  sources: z.array(questionSource).min(1),
  /** A note to the drafting model on what the answer should cover (not shown on the site). */
  brief: z.string().optional(),
  /** Names the answer may use as plain fact (the check otherwise rejects politicians and parties). */
  allowNames: z.array(z.string()).optional(),
});
export type Question = z.infer<typeof question>;

export const questionList = z.strictObject({
  page: z.enum(FAQ_PAGES),
  /** Output files the page's answers draw figures from: a change to one re-runs the checks (`faq-recheck.yml`). */
  dataFiles: z.array(z.string()),
  groups: z.array(z.strictObject({ row: z.string().min(1), questions: z.array(question).min(1) })).min(1),
});
export type QuestionList = z.infer<typeof questionList>;

/** Why a question is outside the two kinds, or null. */
export function checkQuestion(q: Question): string | null {
  if (!/\?$/.test(q.q)) return "a question ends with a question mark";
  if (/\bhow (is|are|do|does)\b.*\b(measured|calculated|counted|defined)\b/i.test(q.q)) return "how a figure is measured belongs in the chart's Data notes";
  if (/\bwhy (did|has|have|is|are|does|do) .*\b(rise|rising|rose|fall|falling|fell|drop|dropping|dropped|go(ing)? up|go(ing)? down|climb|surge|increase|decrease|so high|so low)\b/i.test(q.q))
    return "why a number moved belongs in a context line";
  if (q.kind === "difference" && !/\bdifference between\b/i.test(q.q)) return 'a "difference" question asks "What is the difference between X and Y?"';
  if (q.kind === "matters" && !/^(who|why)\b/i.test(q.q)) return 'a "matters" question asks who something matters to, or why it matters';
  return null;
}

export function readQuestionList(page: FaqPage): QuestionList {
  const list = questionList.parse(JSON.parse(readFileSync(`pipeline/faq/questions/${page}.json`, "utf8")));
  if (list.page !== page) throw new Error(`questions/${page}.json says page ${list.page}`);
  const ids = new Set<string>();
  for (const q of list.groups.flatMap((g) => g.questions)) {
    if (ids.has(q.id)) throw new Error(`questions/${page}.json: duplicate id ${q.id}`);
    ids.add(q.id);
    const why = checkQuestion(q);
    if (why) throw new Error(`questions/${page}.json ${q.id}: ${why}`);
  }
  return list;
}

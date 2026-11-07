import type { FaqItem } from "../../lib/news-types";
import { checkFaqAnswer } from "./check";
import type { QuestionList } from "./questions";
import { readSource } from "./sources";

/**
 * One answer re-checked against its sources as they read now: the same checks the draft passed, plus that the question is
 * still on the reviewed list and every source it cites is one that list gives it. Used before publishing (an owner may have
 * edited the answer in the issue) and by the re-check workflow.
 */
export type Verdict = ({ ok: true } | { ok: false; reason: string; unreadable?: boolean }) & {
  /** Sources checked against their saved copy because the page could not be read now: "url (saved 2026-10-27)". */
  savedCopies?: string[];
};

export async function verifyItem(item: FaqItem, list: QuestionList): Promise<Verdict> {
  const q = list.groups.flatMap((g) => g.questions).find((x) => x.id === item.id);
  if (!q) return { ok: false, reason: `${item.id} is not on the reviewed question list (pipeline/faq/questions/${list.page}.json)` };
  const cited = [];
  const savedCopies: string[] = [];
  for (const s of item.sources) {
    const src = q.sources.find((x) => x.url === s.url);
    if (!src) return { ok: false, reason: `${s.url} is not one of this question's sources on the reviewed list` };
    try {
      const r = await readSource(src);
      cited.push({ label: s.label, url: s.url, text: r.text });
      if (r.saved) savedCopies.push(`${s.url} (saved ${r.saved})`);
    } catch (err) {
      return { ok: false, unreadable: true, reason: `could not read ${s.url}: ${(err as Error).message}` };
    }
  }
  const why = checkFaqAnswer(item.a, cited, { allowNames: q.allowNames });
  return why ? { ok: false, reason: why, savedCopies } : { ok: true, savedCopies };
}

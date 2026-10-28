import { z } from "zod";
import { faqFile } from "../../lib/news-types";
import { FAQ_PAGES, type FaqPage } from "./questions";

/**
 * The approval issue for one page's FAQ drafts, modelled on the social drafts (pipeline/insights/issue.ts): every answer
 * with its sources for the owner to read, and a hidden machine-readable block the publisher reads. One open issue per page;
 * the `faq-approved` label is the approval. To change an answer, edit it in the block: the publisher re-runs the checks.
 */

export const FAQ_DRAFT_LABEL = "faq-draft";
export const FAQ_APPROVED_LABEL = "faq-approved";
export const FAQ_RECHECK_LABEL = "faq-recheck";

export const faqDraft = faqFile.extend({
  page: z.enum(FAQ_PAGES),
  model: z.string(),
  /** Questions with no answer that passed the checks, and why. */
  dropped: z.array(z.object({ id: z.string(), q: z.string(), reason: z.string() })),
});
export type FaqDraft = z.infer<typeof faqDraft>;

const PAGE_NAME: Record<FaqPage, string> = { economy: "Economy", immigration: "Immigration", energy: "Energy", trade: "Trade", "foreign-aid": "Foreign aid" };
const OPEN = "<!-- faq-draft";
const CLOSE = "-->";

/** The title carries `[faq-<page>]`, by which the opener finds the page's open issue. */
export const issueKey = (page: FaqPage) => `[faq-${page}]`;

export function issueTitle(d: FaqDraft): string {
  const n = d.groups.reduce((s, g) => s + g.items.length, 0);
  return `FAQ draft: ${PAGE_NAME[d.page]} (${n} answers) ${issueKey(d.page)}`;
}

export function issueBody(d: FaqDraft, extra: { runUrl?: string } = {}): string {
  return [
    `Frequently asked questions for the **${PAGE_NAME[d.page]}** page, drafted ${d.asOf} by \`${d.model}\` from the sources listed under each answer, from the reviewed questions in \`pipeline/faq/questions/${d.page}.json\`.`,
    "",
    "Each answer passed the checks in `pipeline/faq/check.ts`: 2-4 sentences, every number found in a source it cites, no causal claims about policy, no loaded adjectives, no politicians or parties, sources on the allowed list. Please still read each one against its sources.",
    "",
    ...d.groups.flatMap((g) => [
      `## ${g.row}`,
      "",
      ...g.items.flatMap((it) => [`**${it.q}**`, "", `> ${it.a}`, "", `Sources: ${it.sources.map((s) => `[${s.label}](${s.url})`).join("; ")} · charts: ${it.chartIds.map((c) => `\`${c}\``).join(", ")} · id \`${it.id}\``, ""]),
    ]),
    ...(d.dropped.length ? ["## Dropped (no answer passed the checks)", "", ...d.dropped.map((x) => `- \`${x.id}\` ${x.q}: ${x.reason}`), ""] : []),
    `**To approve:** add the \`${FAQ_APPROVED_LABEL}\` label. The publish workflow re-runs the checks against the sources as they read then, writes \`pipeline/output/faq_${d.page}.json\` and opens a pull request; nothing reaches the site before that PR merges. **To change an answer:** edit its \`a\` in the block below (keep the \`id\`); the checks run again on publish. **To leave a question out:** delete its item from the block. **To reject:** close the issue.`,
    ...(extra.runUrl ? ["", `[Drafting run](${extra.runUrl})`] : []),
    "",
    blockComment(d),
    "",
  ].join("\n");
}

/** The draft as an HTML comment. "--" cannot appear inside one; JSON lets us escape it. */
export function blockComment(d: FaqDraft): string {
  return `${OPEN}\n${JSON.stringify(d, null, 2).replace(/--/g, "-\\u002d")}\n${CLOSE}`;
}

/** The draft from an issue body, or null when there is none or it does not parse. */
export function parseFaqBlock(body: string): FaqDraft | null {
  const start = body.indexOf(OPEN);
  if (start < 0) return null;
  const end = body.indexOf(CLOSE, start + OPEN.length);
  if (end < 0) return null;
  try {
    const v = faqDraft.safeParse(JSON.parse(body.slice(start + OPEN.length, end)));
    return v.success ? v.data : null;
  } catch {
    return null;
  }
}

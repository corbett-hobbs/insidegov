import { mkdirSync, writeFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { FaqItem } from "../../lib/news-types";
import { checkFaqAnswer, MAX_SENTENCES, MIN_SENTENCES, type CitedSource } from "./check";
import type { FaqDraft } from "./issue";
import { FAQ_PAGES, readQuestionList, type FaqPage, type Question } from "./questions";
import { readSource } from "./sources";

/**
 * Drafts the FAQ answers for one page from its reviewed question list (`questions/<page>.json`): fetches each question's
 * sources, has Claude answer from them only, and keeps an answer only if `checkFaqAnswer` passes. A rejected answer is asked
 * again with the reason (three tries); a question that still fails, or whose sources cannot be read, is dropped and listed.
 * Writes `faq-drafts/<page>.json` (git-ignored), which `pnpm faq:issue` turns into the approval issue. Publishes nothing.
 *
 *   pnpm faq:draft -- --page economy               # needs ANTHROPIC_API_KEY (env, or the git-ignored .env.local)
 *   pnpm faq:draft -- --page immigration --only refugee-vs-asylum
 *
 * FAQ_MODEL / FAQ_EFFORT override the model (Sonnet 5.5 at xhigh, as for the executive-order summaries); FAQ_VERBOSE=1 logs
 * each rejected answer with the reason.
 */
const MODEL = process.env.FAQ_MODEL ?? "claude-sonnet-5-5";
const EFFORT = (process.env.FAQ_EFFORT ?? "xhigh") as "low" | "medium" | "high" | "xhigh" | "max";
/** The longest a source may be in the prompt; agency glossaries run to 80K characters. */
const SOURCE_CHARS = 60_000;

const SYSTEM = `You answer one question in the "Frequently asked questions" section of InsideGov, a nonpartisan civic-data site, for a general reader. You are given the question, a note on what the answer should cover, and the text of each source you may use. Always answer by calling the record_answer tool.

Rules:
- Answer from the given sources only. Never use what you remember. If the sources do not support part of the brief, leave that part out.
- Answer the question directly. Never talk about the sources or what they leave out ("the report does not say..."). If the sources cannot answer the question at all, record an empty answer.
- ${MIN_SENTENCES} to ${MAX_SENTENCES} sentences of plain prose, under 600 characters. Lead with the direct answer. No lists, headings or links.
- Plain and neutral: no adjectives or characterizations carried over from the sources (e.g. "historic", "surge", "crisis", "massive"), and none of your own.
- Never say a policy, law, order or official caused something. Say what a rule does, not what it led to.
- No politicians or parties: name the office ("the President", "Congress"), not the person.
- Every number must be one a source you cite gives, written as the source gives it (you may round a large figure to the compact form). Write figures of 10,000 or more compactly: "166.6K", "1.2M", "$9.9B", "$40.2 trillion". Below 10,000 write the exact figure ("7,500"). Do not compute new figures (no shares, differences or ratios the sources do not state).
- When the sources give figures for several years, use the most recent one, and say which year it is.
- sources: the URLs of the sources the answer actually uses, from the list given.`;

try {
  process.loadEnvFile(".env.local");
} catch {
  /* no .env.local (CI passes the secret as an env var) */
}

const client = new Anthropic({ maxRetries: 4 });
const usage = { input: 0, output: 0, rejected: 0 };

function tool(urls: string[]): Anthropic.Beta.BetaTool {
  return {
    name: "record_answer",
    description: "Record the answer and the sources it uses.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { answer: { type: "string" }, sources: { type: "array", items: { type: "string", enum: urls } } },
      required: ["answer", "sources"],
      additionalProperties: false,
    },
  };
}
const reply = z.object({ answer: z.string(), sources: z.array(z.string()) });

/** The checked answer, or why there is none. */
async function answer(q: Question): Promise<{ item: FaqItem } | { error: string }> {
  const texts = new Map<string, string>();
  for (const s of q.sources) {
    try {
      texts.set(s.url, await readSource(s));
    } catch (err) {
      return { error: `source unreadable: ${(err as Error).message}` };
    }
  }
  const prompt = [
    `Question: ${q.q}`,
    q.brief ? `What the answer should cover: ${q.brief}` : "",
    ...q.sources.map((s, i) => `<source n="${i + 1}" label="${s.label}" url="${s.url}">\n${texts.get(s.url)!.slice(0, SOURCE_CHARS)}\n</source>`),
  ]
    .filter(Boolean)
    .join("\n\n");
  let feedback = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    let res: Anthropic.Beta.BetaMessage;
    try {
      res = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 8000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: EFFORT },
        system: SYSTEM,
        tools: [tool(q.sources.map((s) => s.url))],
        tool_choice: { type: "auto" },
        messages: [{ role: "user", content: `${prompt}${feedback}` }],
      });
    } catch (err) {
      if (err instanceof Anthropic.APIError) return { error: `API ${err.status ?? ""} ${err.message.slice(0, 200)}` };
      throw err;
    }
    usage.input += res.usage.input_tokens;
    usage.output += res.usage.output_tokens;
    if (res.stop_reason === "refusal") return { error: "refused" };
    const call = res.content.find((c): c is Anthropic.Beta.BetaToolUseBlock => c.type === "tool_use");
    const v = reply.safeParse(call?.input);
    if (!v.success) {
      feedback = "\n\n---\nAnswer by calling the record_answer tool.";
      continue;
    }
    const a = v.data.answer.trim().replace(/\s+/g, " ");
    if (!a) return { error: "the sources do not answer the question" };
    const cited = q.sources.filter((s) => v.data.sources.includes(s.url));
    const citedTexts: CitedSource[] = cited.map((s) => ({ label: s.label, url: s.url, text: texts.get(s.url)! }));
    const why = checkFaqAnswer(a, citedTexts, { allowNames: q.allowNames });
    if (!why) return { item: { id: q.id, q: q.q, a, sources: cited.map(({ label, url }) => ({ label, url })), chartIds: q.chartIds } };
    usage.rejected++;
    if (process.env.FAQ_VERBOSE) console.log(`  ${q.id} try ${attempt} rejected: ${why}\n    ${a}`);
    feedback = `\n\n---\nA previous answer was rejected: ${why}.\nRejected answer: ${a}\nRejected sources: ${v.data.sources.join(", ")}`;
  }
  return { error: `failed the checks 3 times (${feedback.split("\n")[2]?.replace("A previous answer was rejected: ", "") ?? ""})` };
}

const arg = (flag: string) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : undefined);
const page = arg("--page") as FaqPage | undefined;
if (!page || !FAQ_PAGES.includes(page)) throw new Error(`--page ${FAQ_PAGES.join(" | ")}`);
const only = arg("--only")?.split(",");
if (!process.env.ANTHROPIC_API_KEY) {
  console.log("faq:draft  ANTHROPIC_API_KEY not set; nothing drafted");
  process.exit(0);
}
const list = readQuestionList(page);
const draft: FaqDraft = { page, asOf: new Date().toISOString().slice(0, 10), model: MODEL, groups: [], dropped: [] };
for (const g of list.groups) {
  const qs = g.questions.filter((q) => !only || only.includes(q.id));
  const results = await Promise.all(qs.map(answer));
  const items: FaqItem[] = [];
  results.forEach((r, i) => ("item" in r ? items.push(r.item) : draft.dropped.push({ id: qs[i]!.id, q: qs[i]!.q, reason: r.error })));
  if (items.length) draft.groups.push({ row: g.row, items });
}
mkdirSync("faq-drafts", { recursive: true });
writeFileSync(`faq-drafts/${page}.json`, `${JSON.stringify(draft, null, 2)}\n`);
const n = draft.groups.reduce((s, g) => s + g.items.length, 0);
console.log(`faq:draft  ${page}: ${n} answers, ${draft.dropped.length} dropped, model ${MODEL} effort ${EFFORT}, ${usage.input.toLocaleString("en-US")} input / ${usage.output.toLocaleString("en-US")} output tokens, ${usage.rejected} answers rejected by the checks → faq-drafts/${page}.json`);
for (const d of draft.dropped) console.log(`  dropped ${d.id}: ${d.reason}`);

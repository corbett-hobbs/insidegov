import { existsSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { executiveOrder } from "../../lib/executive-orders-entities";
import { readEoTexts } from "../fetch/executive-order-texts";
import { EO_SUMMARIES, EO_SUMMARY_TARGET_CHARS, checkEoSummary, eoSummaryCache, type EoSummaryEntry } from "../transform/eo-summaries";

/**
 * One- or two-sentence summaries of what each executive order does, written by the Claude API from the order's full text
 * (`pnpm fetch:eo-texts` first). The model must lead with the order's action, found by its operative verbs ("shall", "is hereby
 * revoked", "I hereby direct"), not with the order's stated reasons, and must quote that operative clause verbatim; `checkEoSummary`
 * rejects a summary whose quote is not in the order, whose numbers are not in the order, or whose words stray from it. A rejected
 * answer is asked again (up to three tries) with the reason; an order that still fails stays uncached and is asked again next run.
 * Answers are stored by order number in `pipeline/classification/eo_summaries.json` and never overwritten.
 *
 *   pnpm summarize:eos                  # needs ANTHROPIC_API_KEY (env, or the git-ignored .env.local)
 *   pnpm summarize:eos -- --limit 20    # try a few
 *   pnpm summarize:eos -- --only 14151,12891
 *   pnpm summarize:eos -- --from 2009-01-20      # orders signed on or after a date
 *
 * EO_SUMMARY_VERBOSE=1 logs each answer the check rejects, with the reason.
 * To compare models or effort levels, write a trial to its own file instead of the committed cache:
 *   EO_SUMMARY_MODEL=claude-sonnet-5-5 EO_SUMMARY_EFFORT=high EO_SUMMARY_OUT=/tmp/sonnet-high.json pnpm summarize:eos -- --only ...
 *
 * Not part of `pnpm transform` / CI: the cache is a committed artifact. Run by .github/workflows/executive-orders-freshness.yml
 * for new orders.
 */
// Sonnet 5.5 at xhigh, chosen after a blind side-by-side with Opus 5.5 (medium, low) and Sonnet 5.5 high on the same 28 orders:
// it had the fewest answers rejected by the check, at about half Opus's cost.
const MODEL = process.env.EO_SUMMARY_MODEL ?? "claude-sonnet-5-5";
const EFFORT = (process.env.EO_SUMMARY_EFFORT ?? "xhigh") as "low" | "medium" | "high" | "xhigh" | "max";
const OUT = process.env.EO_SUMMARY_OUT ?? EO_SUMMARIES;
const PARALLEL = Number(process.env.EO_SUMMARY_PARALLEL ?? 4);

try {
  process.loadEnvFile(".env.local");
} catch {
  /* no .env.local (CI passes the secret as an env var) */
}

const SYSTEM = `You write one line of a public table of U.S. executive orders. You are given the full text of one order, as published in the Federal Register. Always answer by calling the record_summary tool.

Find what the order actually does. Its actions are in the operative clauses, which turn on directive verbs: "shall", "is hereby ordered", "is revoked", "is amended", "is established", "is designated", "I hereby declare", "I hereby direct", "are directed to". The opening authority recital ("By the authority vested in me...") is not an action, and neither are the purpose, policy, findings or background passages: those explain why, and are not what you report. Skip the boilerplate general provisions (no private right of action, subject to appropriations, effective date) unless the order does nothing else.

summary: what the order does, in ONE sentence; use a second sentence only if the order has a second main action that does not fit in the first. Never more than two sentences, and ${EO_SUMMARY_TARGET_CHARS} characters at most in total; aim for 120 to ${EO_SUMMARY_TARGET_CHARS}. Give the main action and the one or two specifics that matter most, not every detail; most orders fit in one sentence.
- Present tense, starting with the action verb, the order being the unstated subject. Examples of the form: "Defers certain diesel fuel tax payment obligations and provides penalty relief." / "Requires executive agencies to use the terms superintelligence and SI in place of artificial intelligence and AI."
- Be specific: name who must act, on what, and the concrete thing created, changed, revoked or required (the committee, the program, the country, the order amended and what changed in it). For an order that amends or revokes others, say what the change does, not just that it amends.
- Neutral and factual. Describe the action in plain words; do not carry over the order's characterizations, adjectives or slogans (e.g. "radical", "wasteful", "historic", "illegal", "common-sense"), and add none of your own.
- Only what the text says. Never use what you remember about the order or its context. Numbers, names and dates only as the text gives them.
- Do not start with "This order", "The order", "Executive Order" or "The President", and do not repeat the title.

evidence: the exact words of the order's main operative clause, copied verbatim from the text (a clause containing "shall", "hereby", "is revoked", "is amended" or similar), at least a full clause long. To shorten a long clause, replace the words you leave out with "..."; everything else must be copied exactly.`;

const TOOL: Anthropic.Beta.BetaTool = {
  name: "record_summary",
  description: "Record the summary of what the order does and the verbatim operative clause it rests on.",
  strict: true,
  input_schema: {
    type: "object",
    properties: { evidence: { type: "string" }, summary: { type: "string" } },
    required: ["evidence", "summary"],
    additionalProperties: false,
  },
};
const verdict = z.object({ evidence: z.string(), summary: z.string() });

const client = new Anthropic({ maxRetries: 4 });
const usage = { input: 0, output: 0, rejected: 0 };

/** The checked summary, or the reason the last answer failed. */
async function ask(eo: number, text: string): Promise<{ entry: EoSummaryEntry } | { error: string }> {
  let feedback = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    let res: Anthropic.Beta.BetaMessage;
    try {
      res = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 4000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: EFFORT },
        system: SYSTEM,
        tools: [TOOL],
        tool_choice: { type: "auto" },
        messages: [{ role: "user", content: `${text}${feedback}` }],
      });
    } catch (err) {
      if (err instanceof Anthropic.APIError) return { error: `API ${err.status ?? ""} ${err.message.slice(0, 200)}` };
      throw err;
    }
    usage.input += res.usage.input_tokens;
    usage.output += res.usage.output_tokens;
    if (res.stop_reason === "refusal") return { error: `refused (${res.stop_details?.category ?? "no category"})` };
    const call = res.content.find((c): c is Anthropic.Beta.BetaToolUseBlock => c.type === "tool_use");
    const v = verdict.safeParse(call?.input);
    if (!v.success) {
      feedback = "\n\n---\nAnswer by calling the record_summary tool.";
      continue;
    }
    const summary = v.data.summary.trim().replace(/\s+/g, " ");
    const why = checkEoSummary(summary, v.data.evidence, text);
    if (!why) return { entry: { eo_number: eo, summary, evidence: v.data.evidence.trim(), model: res.model } };
    usage.rejected++;
    if (process.env.EO_SUMMARY_VERBOSE) console.log(`  ${eo} try ${attempt} rejected: ${why}\n    summary: ${summary}\n    evidence: ${v.data.evidence}`);
    feedback = `\n\n---\nA previous answer was rejected: ${why}.\nRejected summary: ${summary}\nRejected evidence: ${v.data.evidence}`;
  }
  return { error: `failed the check 3 times (${feedback.split("\n")[3] ?? ""})` };
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.log("summarize:eos  ANTHROPIC_API_KEY not set; nothing summarised");
  process.exit(0);
}

const orders = z.array(executiveOrder).parse(JSON.parse(readFileSync("pipeline/output/executive_orders.json", "utf8")));
const texts = readEoTexts();
const cache = new Map((existsSync(OUT) ? eoSummaryCache.parse(JSON.parse(readFileSync(OUT, "utf8"))) : []).map((e) => [e.eo_number, e] as const));

const arg = (flag: string) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : undefined);
const only = arg("--only")?.split(",").map(Number);
const limit = Number(arg("--limit") ?? Infinity);
const from = arg("--from");
// Newest first: a partial run covers the orders people look at most.
const pending = orders
  .filter((o) => !from || o.signing_date >= from)
  .map((o) => o.eo_number)
  .filter((n) => texts.has(n) && !cache.has(n) && (!only || only.includes(n)))
  .sort((a, b) => b - a)
  .slice(0, limit);
const noText = orders.filter((o) => !texts.has(o.eo_number)).length;
if (pending.length === 0) {
  console.log(`summarize:eos  nothing to summarise${noText ? ` (${noText} orders have no text yet: pnpm fetch:eo-texts)` : ""}`);
  process.exit(0);
}

const save = () => writeFile(OUT, `[\n${[...cache.values()].sort((a, b) => a.eo_number - b.eo_number).map((e) => JSON.stringify(e)).join(",\n")}\n]\n`);
let added = 0;
const failed: string[] = [];
let next = 0;
async function worker() {
  while (next < pending.length) {
    const eo = pending[next++]!;
    const r = await ask(eo, texts.get(eo)!.text);
    if ("error" in r) {
      failed.push(`${eo}: ${r.error}`);
      continue;
    }
    cache.set(eo, r.entry);
    if (++added % 50 === 0) {
      console.log(`  ${added} / ${pending.length}`);
      await save();
    }
  }
}
await Promise.all(Array.from({ length: PARALLEL }, worker));
await save();
console.log(`summarize:eos  +${added} summaries, ${failed.length} left for the next run, model ${MODEL} effort ${EFFORT}, ${usage.input.toLocaleString("en-US")} input / ${usage.output.toLocaleString("en-US")} output tokens, ${usage.rejected} answers rejected by the check`);
for (const f of failed) console.log(`  ${f}`);

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Insight } from "./types";

/**
 * Captions for insight drafts. The Claude API rewrites an insight's template into one or two plain sentences; then
 * `checkCaption` enforces the rules in code, and a caption that breaks one is asked again with the reason (three tries)
 * and otherwise dropped. The rules:
 *   - every number in the caption is the text of one of the insight's facts (each fact re-derived from data cells by
 *     verify.ts), so nothing the model adds or rounds differently gets through;
 *   - no spelled-out quantities ("doubled", "half", "three"), which would dodge that check;
 *   - no partisan or loaded words, no causal claims ("because of", "thanks to"), no hashtags, links, mentions or "!";
 *   - at most CAPTION_MAX_CHARS, leaving room for the link the poster appends (Bluesky allows 300 graphemes).
 */

export const CAPTION_MAX_CHARS = 240;

/** Partisan labels, loaded adjectives and verbs, and causal framing. Matched as whole words, case-insensitively. */
export const BANNED_WORDS = [
  "democrat", "democrats", "democratic", "republican", "republicans", "gop", "liberal", "liberals", "conservative", "conservatives",
  "left-wing", "right-wing", "leftist", "radical", "extremist", "socialist", "maga", "woke", "patriot", "patriots", "regime",
  "crisis", "disaster", "disastrous", "catastrophe", "catastrophic", "chaos", "chaotic", "invasion", "flood", "flooded", "flooding",
  "surge", "surged", "surging", "skyrocket", "skyrocketed", "skyrocketing", "soar", "soared", "soaring", "plummet", "plummeted",
  "plummeting", "plunge", "plunged", "plunging", "crash", "crashed", "collapse", "collapsed", "slash", "slashed", "explode",
  "exploded", "exploding", "massive", "huge", "staggering", "shocking", "alarming", "dramatic", "dramatically", "historic",
  "unprecedented", "failed", "failure", "success", "successful", "great", "terrible", "devastating", "booming", "boom", "win",
  "wins", "victory", "blame", "blamed", "credit", "credited", "caused", "thanks", "record", "records", "record-breaking",
  "all-time", "only", "just", "merely", "whopping", "incredible", "amazing", "good", "bad", "worse", "worst", "best", "better",
];
const CAUSAL_PHRASES = ["because of", "due to", "as a result", "led to", "driven by", "thanks to", "under the leadership"];
const NUMBER_WORDS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "dozen", "dozens",
  "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety", "hundred", "hundreds", "thousands", "millions",
  "billions", "trillions", "half", "halved", "double", "doubled", "doubling", "triple", "tripled", "twice", "quadrupled", "quarter",
];

/**
 * Numbers in text, each with any "%" or scale word that follows it ("$3.12" -> "3.12", "13.6 million" -> "13.6 million",
 * "12 percent" -> "12%"). The sign and "$" are dropped: direction and currency are said in words and checked as text.
 */
export function numberTokens(text: string): string[] {
  const re = /\d[\d,]*(?:\.\d+)?(?:\s?(%|percent\b)|\s(thousand|million|billion|trillion)\b)?/gi;
  return [...text.matchAll(re)].map((m) => {
    const n = m[0].match(/^\d[\d,]*(?:\.\d+)?/)![0].replace(/,/g, "");
    if (m[1]) return `${n}%`;
    if (m[2]) return `${n} ${m[2].toLowerCase()}`;
    return n;
  });
}

/**
 * Every reason the caption fails (none: it passes). `facts` are the insight's facts, headline number first; the poster
 * re-runs this on the draft's stored facts, so a caption edited in the issue is held to the same rules.
 */
export function checkCaption(caption: string, facts: { id?: string; text: string; president?: string }[]): string[] {
  const errors: string[] = [];
  if (caption.length > CAPTION_MAX_CHARS) errors.push(`${caption.length} characters; the limit is ${CAPTION_MAX_CHARS}`);
  if (caption.trim().length < 40) errors.push("too short to say anything");
  if (/https?:|www\.|\.(?:com|org|gov|fyi)\b/i.test(caption)) errors.push("contains a link (the link is added separately)");
  if (/[#@!?]/.test(caption)) errors.push('contains "#", "@", "!" or "?"');
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(caption)) errors.push("contains an emoji");
  const lower = caption.toLowerCase();
  const words = new Set(lower.match(/[a-z]+(?:-[a-z]+)*/g) ?? []);
  const banned = BANNED_WORDS.filter((w) => words.has(w));
  if (banned.length) errors.push(`uses loaded or partisan words: ${banned.join(", ")}`);
  const causal = CAUSAL_PHRASES.filter((p) => lower.includes(p));
  if (causal.length) errors.push(`makes a causal claim: ${causal.join(", ")}`);
  const spelled = NUMBER_WORDS.filter((w) => words.has(w));
  if (spelled.length) errors.push(`spells out a quantity (${spelled.join(", ")}); write numbers only as the facts give them`);

  const allowed = new Set(facts.flatMap((f) => numberTokens(f.text)));
  const used = numberTokens(caption);
  const stray = used.filter((t) => !allowed.has(t));
  if (stray.length) errors.push(`numbers not among the facts: ${[...new Set(stray)].join(", ")}`);
  const singled = singledOutTerms(caption, facts);
  if (singled) errors.push(singled);
  const headline = numberTokens(facts[0]?.text ?? "");
  if (used.length === 0) errors.push("states no number");
  else if (headline.length && !headline.some((t) => used.includes(t))) errors.push(`leaves out the headline number (${facts[0]!.text})`);
  return errors;
}

/**
 * A term comparison may name all of the earlier terms or none of them (the chart shows them all), never a hand-picked
 * few: "down 28%; at the same point the 2021 term was down 35%" picks its comparison. Terms are recognised by start year
 * or by a president's last name that the current term does not share.
 */
export function singledOutTerms(caption: string, facts: { id?: string; text: string; president?: string }[]): string | null {
  const terms = facts.filter((f) => f.id?.startsWith("term_start_"));
  const currentId = facts[0]?.id?.replace(/^term_/, "term_start_");
  const current = terms.find((f) => f.id === currentId);
  if (!current) return null;
  const earlier = terms.filter((f) => f !== current);
  const used = new Set(numberTokens(caption));
  const named = earlier.filter((f) => used.has(f.text) || (f.president && f.president !== current.president && new RegExp(`\\b${f.president}\\b`).test(caption)));
  if (named.length === 0 || named.length === earlier.length) return null;
  return `names ${named.length} of the ${earlier.length} earlier terms (${named.map((f) => f.text).join(", ")}); name all of them or none (the chart shows them all)`;
}

// Opus 5.5 by default. The task is short, but the rules are strict and a rejected caption costs a retry.
const MODEL = process.env.SOCIAL_CAPTION_MODEL ?? "claude-opus-5-5";
const EFFORT = (process.env.SOCIAL_CAPTION_EFFORT ?? "medium") as "low" | "medium" | "high" | "xhigh" | "max";

const SYSTEM = `You write the caption for one chart that InsideGov, a nonpartisan site of U.S. government data, will post to social media. Always answer by calling the record_caption tool.

You are given one insight: a headline, a reference caption, the facts (each with the exact text you may use), and context notes.

The caption:
- One or two plain declarative sentences, ${CAPTION_MAX_CHARS} characters at most. State what the data shows, as a wire-service data reporter would.
- Every number you write must be copied exactly from a fact's text (same rounding, same unit words, e.g. "13.85 million barrels a day", "$4.33 a gallon", "12.4%"). Never compute, round, convert or estimate a number, and never spell one out ("two", "half", "doubled").
- Include the first fact (the headline number).
- No adjectives that judge or dramatize (surge, plunge, soaring, massive, crisis, historic, record), no party names or ideological labels, no claims about causes or consequences, no predictions, and nothing you know from outside the facts. Name a president only to identify a term.
- Comparisons across presidential terms are side by side at the same elapsed time; describe them that way and do not imply credit or blame. Mention either every earlier term or none of them (the chart shows them all, so stating the current term's figure and its rank among the terms, if a fact gives one, is usually best); never pick out one or a few, such as the predecessor.
- No hashtags, links, mentions, emoji, exclamation marks or questions. The link to the data is added after your text.
- Respect the context notes (for example, say "encounters", never "people" or "migrants", when encounters count events).`;

const TOOL: Anthropic.Beta.BetaTool = {
  name: "record_caption",
  description: "Record the caption for the chart.",
  strict: true,
  input_schema: { type: "object", properties: { caption: { type: "string" } }, required: ["caption"], additionalProperties: false },
};
const answer = z.object({ caption: z.string() });

export type CaptionResult = { caption: string; source: "claude" | "template"; model?: string; attempts: number } | { error: string };

export function insightPrompt(insight: Insight): string {
  return JSON.stringify(
    {
      headline: insight.headline,
      reference_caption: insight.template,
      facts: insight.facts.map((f) => ({ id: f.id, text: f.text })),
      context: insight.context,
      source: insight.source,
    },
    null,
    2,
  );
}

/** The template caption, if it passes the check (it is built from the facts, so it should; tests hold it to that). */
export function templateCaption(insight: Insight): CaptionResult {
  const errors = checkCaption(insight.template, insight.facts);
  return errors.length ? { error: `template fails the check: ${errors.join("; ")}` } : { caption: insight.template, source: "template", attempts: 0 };
}

export async function claudeCaption(client: Anthropic, insight: Insight): Promise<CaptionResult> {
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
        tools: [TOOL],
        tool_choice: { type: "auto" },
        messages: [{ role: "user", content: `${insightPrompt(insight)}${feedback}` }],
      });
    } catch (err) {
      if (err instanceof Anthropic.APIError) return { error: `API ${err.status ?? ""} ${err.message.slice(0, 200)}` };
      throw err;
    }
    if (res.stop_reason === "refusal") return { error: `refused (${res.stop_details?.category ?? "no category"})` };
    const call = res.content.find((c): c is Anthropic.Beta.BetaToolUseBlock => c.type === "tool_use");
    const parsed = answer.safeParse(call?.input);
    if (!parsed.success) {
      feedback = "\n\n---\nAnswer by calling the record_caption tool.";
      continue;
    }
    const caption = parsed.data.caption.trim().replace(/\s+/g, " ");
    const errors = checkCaption(caption, insight.facts);
    if (errors.length === 0) return { caption, source: "claude", model: res.model, attempts: attempt };
    feedback = `\n\n---\nA previous caption was rejected: ${errors.join("; ")}.\nRejected caption: ${caption}`;
  }
  return { error: `failed the caption check 3 times (${feedback.split("\n")[2] ?? ""})` };
}

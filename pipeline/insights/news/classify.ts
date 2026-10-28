import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

/**
 * The Claude check for the page cards and the social news lane (one detector for both): which headlines of a candidate
 * story are straight news of one current development, and, for a chartless story, which chart measures it.
 */
const MODEL = process.env.SOCIAL_NEWS_MODEL || "claude-haiku-5-5";
const EFFORT = (process.env.SOCIAL_NEWS_EFFORT || "low") as "low" | "medium" | "high" | "xhigh" | "max";

/**
 * The check for a page card's candidate story (news/cards.ts): which of its headlines are straight news reports of the
 * same single current development, with the chart's topic central. It sees the outlets' names and titles (never their
 * leans) and the chart; it writes nothing that is shown. Opinion, analysis and explainers are what it is there to catch
 * at outlets that mix them into their news feeds without marking them (HuffPost).
 */
const CARD_SYSTEM = `InsideGov, a nonpartisan site of U.S. government data, shows on each chart's page how different news outlets headlined the same story, next to the chart's own data. You are given headlines from several outlets that keyword rules matched to one chart, from the same few days. Always answer by calling the record_story tool.

Return in "keep" the numbers of the headlines that ALL report the same single, current development of national significance in the United States (a government action or announcement, a court ruling, an agreement, a new official figure, a notable market move) where the chart's topic is central, not mentioned in passing. If the headlines cover several developments, keep only the one most outlets reported. Leave out:
- opinion, columns, commentary, analysis, explainers, "what it means for you", personal finance tips, live blogs, newsletters, quizzes, roundups of several stories;
- local or company news, foreign news with no U.S. policy angle, and headlines where the topic is incidental;
- headlines about a different development than the one you keep.
When unsure about a headline, leave it out. Return an empty list when no development qualifies. Your reason is one short sentence for the maintainer; it is never shown.

When the input has a "pick_chart" list, the page has no chart for this topic. In "chart" return the id of the ONE chart in that list whose data directly measures what the story is about (a story about oil imports and the oil imports chart; not a story about oil that merely touches energy, and not a chart that is only background). Return \"none\" when none does; a wrong link is worse than none. Without a \"pick_chart\" list, return \"none\".`;

const CARD_TOOL: Anthropic.Beta.BetaTool = {
  name: "record_story",
  description: "Record which headlines report the same single current development.",
  strict: true,
  input_schema: {
    type: "object",
    properties: { keep: { type: "array", items: { type: "integer" } }, reason: { type: "string" }, chart: { type: "string" } },
    required: ["keep", "reason", "chart"],
    additionalProperties: false,
  },
};
const cardAnswer = z.object({ keep: z.array(z.number().int()), reason: z.string(), chart: z.string().optional() });

export type CandidateInput = {
  topic: string;
  chart: string;
  country?: string;
  headlines: { title: string; outlet: string; published: string }[];
  /** A chartless story: the page's charts to pick one from, if any measures what the story is about. */
  pickChart?: { id: string; label: string; about: string }[];
};

export function candidatePrompt(c: CandidateInput): string {
  return JSON.stringify(
    { topic: c.topic, country: c.country ?? null, chart: c.chart, ...(c.pickChart ? { pick_chart: c.pickChart } : {}), headlines: c.headlines.map((h, i) => ({ n: i + 1, outlet: h.outlet, title: h.title, published: h.published })) },
    null,
    2,
  );
}

/** The 0-based indexes of the headlines to keep, or null when the check could not answer (the caller decides then). */
export async function checkCandidate(client: Anthropic, c: CandidateInput): Promise<{ keep: number[]; reason: string; chart?: string } | null> {
  let res: Anthropic.Beta.BetaMessage;
  try {
    res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: EFFORT },
      system: CARD_SYSTEM,
      tools: [CARD_TOOL],
      tool_choice: { type: "auto" },
      messages: [{ role: "user", content: candidatePrompt(c) }],
    });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.log(`  Claude check error: API ${err.status ?? ""} ${err.message.slice(0, 200)}`);
      return null;
    }
    throw err;
  }
  if (res.stop_reason === "refusal") return { keep: [], reason: `check refused (${res.stop_details?.category ?? "no category"})` };
  const call = res.content.find((x): x is Anthropic.Beta.BetaToolUseBlock => x.type === "tool_use");
  const parsed = cardAnswer.safeParse(call?.input);
  if (!parsed.success) return null;
  const keep = [...new Set(parsed.data.keep)].filter((n) => n >= 1 && n <= c.headlines.length).map((n) => n - 1);
  // Only a chart from the offered list counts: anything else (or none) leaves the story without a chart.
  const chart = c.pickChart?.find((p) => p.id === parsed.data.chart)?.id;
  return { keep, reason: parsed.data.reason, ...(chart ? { chart } : {}) };
}

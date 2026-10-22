import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Story } from "./match";

/**
 * The relevance check: keywords find candidates ("diesel" also matches a truck recall), the Claude API decides whether
 * the topic is central to a real, current, national story that the chart gives context for. It sees only headlines
 * and the chart description, answers yes or no with a reason, and writes nothing that is posted. Without an API key
 * the keyword match and the two-publisher rule stand alone (the human approval still applies).
 */

const MODEL = process.env.SOCIAL_NEWS_MODEL ?? "claude-opus-5-5";
const EFFORT = (process.env.SOCIAL_NEWS_EFFORT ?? "low") as "low" | "medium" | "high" | "xhigh" | "max";

const SYSTEM = `InsideGov, a nonpartisan site of U.S. government data, posts a factual chart to social media when a topic it has data on is in the news. You decide whether a story is worth that chart. Always answer by calling the record_decision tool.

Answer relevant = true only when all of these hold:
- The headlines report a current development (today or yesterday) of national significance: a government action or announcement, an agreement, an official decision, a new official figure, or a notable market move.
- The topic is central to the story, not mentioned in passing.
- The chart described would give a reader useful factual background on the story.
- For a story about one country, the headlines are actually about that country.

Answer false for opinion and analysis pieces, explainers, local or company news (one refinery, one truck recall), personal finance tips, sports, entertainment, and stories where the topic is incidental. When unsure, answer false. Your reason is one short sentence for the human reviewer; it is never posted.`;

const TOOL: Anthropic.Beta.BetaTool = {
  name: "record_decision",
  description: "Record whether the story is worth the chart.",
  strict: true,
  input_schema: {
    type: "object",
    properties: { relevant: { type: "boolean" }, reason: { type: "string" } },
    required: ["relevant", "reason"],
    additionalProperties: false,
  },
};
const answer = z.object({ relevant: z.boolean(), reason: z.string() });

export function storyPrompt(story: Story): string {
  return JSON.stringify(
    {
      topic: story.topic.id,
      country: story.country?.name ?? null,
      chart: story.topic.chart,
      headlines: story.headlines.slice(0, 12).map((h) => ({ title: h.title, source: h.source, published: h.published, official: h.feed === "whitehouse" })),
    },
    null,
    2,
  );
}

export type Decision = { relevant: boolean; reason: string; model?: string };

export async function classifyStory(client: Anthropic, story: Story): Promise<Decision> {
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
      messages: [{ role: "user", content: storyPrompt(story) }],
    });
  } catch (err) {
    if (err instanceof Anthropic.APIError) return { relevant: false, reason: `relevance check failed: API ${err.status ?? ""} ${err.message.slice(0, 160)}` };
    throw err;
  }
  if (res.stop_reason === "refusal") return { relevant: false, reason: `relevance check refused (${res.stop_details?.category ?? "no category"})` };
  const call = res.content.find((c): c is Anthropic.Beta.BetaToolUseBlock => c.type === "tool_use");
  const parsed = answer.safeParse(call?.input);
  if (!parsed.success) return { relevant: false, reason: "relevance check gave no decision" };
  return { ...parsed.data, model: res.model };
}

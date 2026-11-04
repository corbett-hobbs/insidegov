import { existsSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { OFFENSE_CATEGORIES, offenseCategory } from "../../lib/clemency-entities";
import { OFFENSE_CACHE, buildGrants, offenseKey } from "../transform/clemency-run";

/**
 * One offense category per distinct offense text on DOJ's recipient lists, by the Claude API (Sonnet 5.5, xhigh). The category goes
 * by the first offense listed, and the model must quote the words it rests on; an answer whose quote isn't in the text is asked again.
 * Answers are stored in `pipeline/classification/clemency_offenses.json` and never overwritten. `pnpm classify:clemency`; needs
 * ANTHROPIC_API_KEY. `--limit N` tries a few. Run by .github/workflows/clemency-freshness.yml for new grants.
 */
const MODEL = "claude-sonnet-5-5";
const EFFORT = "xhigh" as const;
const BATCH = 40;
const PARALLEL = Number(process.env.CLEMENCY_PARALLEL ?? 6);
try {
  process.loadEnvFile(".env.local");
} catch {
  /* CI passes the secret as an env var */
}

const SYSTEM = `You file federal convictions for a public table of presidential clemency grants. Each numbered item is DOJ's offense text for one person, possibly several offenses. Choose ONE category by the FIRST offense listed, reading a conspiracy or attempt as the crime it aims at. Items may be statute citations: 21 USC 841/846/952/960/963 are drugs; 18 USC 922/924 firearms; 8 USC 1324/1326 immigration.

drugs: making, selling, possessing, importing or trafficking controlled substances.
fraud: fraud, embezzlement, false statements to banks or agencies, tax offenses, money laundering, counterfeiting, securities and health care fraud, by private parties.
corruption: bribery, kickbacks, honest services, campaign finance, perjury or obstruction, and other offenses by or aimed at public officials or elections.
violent: homicide, assault, robbery, kidnapping, sex offenses, threats, terrorism.
firearms: weapons offenses with no other crime first.
property: theft, burglary, stolen goods, interstate transport of stolen property, arson with no injury.
immigration: alien smuggling, harboring, illegal entry or re-entry.
regulatory: environmental, wildlife, emissions, food and drug labeling, export control, licensing, liquor tax and wagering rules, public-land rules, and offenses against a regulatory scheme that involve no theft or deceit.
other: anything else, including purely military offenses, draft refusal, clinic-access and protest offenses, espionage, and text naming no offense.

Use only the text. evidence: the words of the first offense, copied exactly from the item. Answer with the record_offenses tool, one entry per item.`;
const TOOL: Anthropic.Beta.BetaTool = {
  name: "record_offenses",
  description: "Record one category and verbatim evidence for every numbered item.",
  input_schema: {
    type: "object",
    properties: { items: { type: "array", items: { type: "object", properties: { n: { type: "integer" }, category: { type: "string", enum: [...OFFENSE_CATEGORIES] }, evidence: { type: "string" } }, required: ["n", "category", "evidence"] } } },
    required: ["items"],
  },
};
const answer = z.object({ items: z.array(z.object({ n: z.number(), category: offenseCategory, evidence: z.string() })) });
const entry = z.object({ offense: z.string(), category: offenseCategory, evidence: z.string(), model: z.string() });
type Entry = z.infer<typeof entry>;
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
/** The quote must be in the text, so an answer can't rest on something the list doesn't say. */
export const evidenceHolds = (offense: string, evidence: string) => evidence.trim().length > 2 && norm(offense).includes(norm(evidence));

const client = new Anthropic({ maxRetries: 4 });
async function askBatch(texts: string[]): Promise<Entry[]> {
  const got = new Map<number, Entry>();
  for (let attempt = 1; attempt <= 3 && got.size < texts.length; attempt++) {
    const todo = texts.map((t, i) => [t, i + 1] as const).filter(([, n]) => !got.has(n));
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: EFFORT },
      system: SYSTEM,
      tools: [TOOL],
      tool_choice: { type: "auto" },
      messages: [{ role: "user", content: todo.map(([t, n]) => `${n}. ${t}`).join("\n") }],
    } as Anthropic.Beta.MessageCreateParamsNonStreaming);
    const call = res.content.find((c): c is Anthropic.Beta.BetaToolUseBlock => c.type === "tool_use");
    const a = answer.safeParse(call?.input);
    if (!a.success) continue;
    for (const it of a.data.items) {
      const t = texts[it.n - 1];
      if (t && evidenceHolds(t, it.evidence)) got.set(it.n, { offense: t, category: it.category, evidence: it.evidence.trim(), model: res.model });
    }
  }
  return [...got.values()];
}

async function main() {
  const limit = process.argv.includes("--limit") ? Number(process.argv[process.argv.indexOf("--limit") + 1]) : Infinity;
  const cache: Entry[] = existsSync(OFFENSE_CACHE) ? z.array(entry).parse(JSON.parse(readFileSync(OFFENSE_CACHE, "utf8"))) : [];
  const have = new Set(cache.map((e) => offenseKey(e.offense)));
  const need = new Map<string, string>();
  for (const g of buildGrants()) if (g.offense && g.people == null && !have.has(offenseKey(g.offense))) need.set(offenseKey(g.offense), g.offense);
  const texts = [...need.values()].slice(0, limit);
  console.log(`${texts.length} offense texts to classify`);
  const batches: string[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) batches.push(texts.slice(i, i + BATCH));
  const save = () => writeFile(OFFENSE_CACHE, `[\n${[...cache].sort((a, b) => a.offense.localeCompare(b.offense)).map((e) => JSON.stringify(e)).join(",\n")}\n]\n`);
  let next = 0;
  await Promise.all(
    Array.from({ length: PARALLEL }, async () => {
      while (next < batches.length) {
        const b = batches[next++]!;
        try {
          cache.push(...(await askBatch(b)));
        } catch (err) {
          console.error(err instanceof Error ? err.message.slice(0, 200) : err);
        }
        await save();
        console.log(`${next}/${batches.length} batches, ${cache.length} cached`);
      }
    }),
  );
  await save();
}
if (import.meta.url === `file://${process.argv[1]}`) void main();

/**
 * Totals pipeline/.cache/llm-usage.jsonl (written by pipeline/llm-usage.ts) by script and model, and by day.
 * Run: pnpm llm:usage
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

type Line = { at: string; run: string; script: string; model: string; calls: number; input: number; output: number; cacheRead: number; cacheWrite: number; webSearches: number };

const file = join(process.cwd(), "pipeline", ".cache", "llm-usage.jsonl");
if (!existsSync(file)) {
  console.log("No usage recorded yet (pipeline/.cache/llm-usage.jsonl). Run a pipeline script that calls the API first.");
  process.exit(0);
}
const lines: Line[] = readFileSync(file, "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l) as Line);

function total(by: (l: Line) => string, title: string) {
  const m = new Map<string, { calls: number; input: number; output: number }>();
  for (const l of lines) {
    const t = m.get(by(l)) ?? { calls: 0, input: 0, output: 0 };
    t.calls += l.calls;
    t.input += l.input + l.cacheRead + l.cacheWrite;
    t.output += l.output;
    m.set(by(l), t);
  }
  console.log(`\n${title}`);
  for (const [k, t] of [...m].sort((a, b) => b[1].input + b[1].output - (a[1].input + a[1].output))) {
    console.log(`  ${k.padEnd(60)} ${String(t.calls).padStart(6)} calls  in ${t.input.toLocaleString("en-US").padStart(12)}  out ${t.output.toLocaleString("en-US").padStart(10)}`);
  }
}

total((l) => `${l.script}  ${l.model}`, "By script and model");
total((l) => l.at.slice(0, 10), "By day (UTC)");

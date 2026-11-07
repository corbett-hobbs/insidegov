import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Where the Claude API credits go. Every pipeline script that calls the API reports each response's token usage here
 * (`recordUsage`); when the process exits, one line per script and model is printed to the log, added to the Actions
 * job summary (GITHUB_STEP_SUMMARY), and appended to `pipeline/.cache/llm-usage.jsonl` (gitignored), so a spike on the
 * Console's Cost page can be traced to a script and a run. `pnpm llm:usage` totals that file.
 *
 * Tokens only: no dollar figures, because prices change and a stale rate would mislead. Multiply by the model's rates on
 * the Console's pricing page.
 */
export type Usage = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  server_tool_use?: { web_search_requests?: number | null; web_fetch_requests?: number | null } | null;
};

export type UsageRow = {
  script: string;
  model: string;
  calls: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  webSearches: number;
};

const rows = new Map<string, UsageRow>();
let hooked = false;

/** Add one API response's usage to this process's totals. Safe to call with a missing `usage`. */
export function recordUsage(script: string, model: string | undefined, usage: Usage | null | undefined): void {
  const key = `${script}\u0000${model ?? "unknown"}`;
  let row = rows.get(key);
  if (!row) {
    row = { script, model: model ?? "unknown", calls: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, webSearches: 0 };
    rows.set(key, row);
  }
  row.calls += 1;
  row.input += usage?.input_tokens ?? 0;
  row.output += usage?.output_tokens ?? 0;
  row.cacheRead += usage?.cache_read_input_tokens ?? 0;
  row.cacheWrite += usage?.cache_creation_input_tokens ?? 0;
  row.webSearches += usage?.server_tool_use?.web_search_requests ?? 0;
  if (!hooked) {
    hooked = true;
    process.on("exit", flushUsage);
  }
}

const n = (x: number) => x.toLocaleString("en-US");

/** One log line per script and model. */
export function formatUsage(list: UsageRow[]): string[] {
  return list.map(
    (r) =>
      `LLM usage  ${r.script}  ${r.model}  ${n(r.calls)} call${r.calls === 1 ? "" : "s"}  in ${n(r.input)}  out ${n(r.output)}` +
      (r.cacheRead || r.cacheWrite ? `  cache read ${n(r.cacheRead)} write ${n(r.cacheWrite)}` : "") +
      (r.webSearches ? `  web searches ${n(r.webSearches)}` : ""),
  );
}

/** The recorded rows so far (for tests). */
export function usageRows(): UsageRow[] {
  return [...rows.values()];
}

export function resetUsage(): void {
  rows.clear();
}

function flushUsage(): void {
  const list = usageRows();
  if (!list.length) return;
  for (const line of formatUsage(list)) console.log(line);
  try {
    const stamp = new Date().toISOString();
    const run = process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_WORKFLOW ?? ""}#${process.env.GITHUB_RUN_ID}` : "local";
    const file = join(process.cwd(), "pipeline", ".cache", "llm-usage.jsonl");
    mkdirSync(dirname(file), { recursive: true });
    appendFileSync(file, list.map((r) => JSON.stringify({ at: stamp, run, ...r })).join("\n") + "\n");
    const summary = process.env.GITHUB_STEP_SUMMARY;
    if (summary) {
      const table = [
        "### Claude API usage",
        "",
        "| Script | Model | Calls | Input | Output | Cache read | Cache write | Web searches |",
        "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
        ...list.map((r) => `| ${r.script} | ${r.model} | ${n(r.calls)} | ${n(r.input)} | ${n(r.output)} | ${n(r.cacheRead)} | ${n(r.cacheWrite)} | ${n(r.webSearches)} |`),
        "",
      ].join("\n");
      appendFileSync(summary, table);
    }
  } catch {
    // Logging must never fail a pipeline run.
  }
}

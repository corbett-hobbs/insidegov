/**
 * Keeps a page's takeaway figures true after a data refresh, so the gate in .github/actions/gate-and-merge does not
 * stop a refresh for a number that moved by one. Run when `pnpm test` failed:
 *
 *   tsx pipeline/maintenance/refresh-takeaways.ts [--summary out.md]
 *
 * It exits 1 (leaving the tree untouched) unless every failing test is in a `*-takeaways.test.ts` file. Otherwise it gives
 * Claude the failure output plus the test file and the local files it imports, and applies the edits it proposes, but only
 * edits that change figures and month names and nothing else (takeaway-refresh.ts). A claim whose wording is no longer true is therefore
 * never rewritten; it stays a failure for a human. Up to three rounds; the takeaway tests must pass at the end.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { applyEdits, type Edit } from "./takeaway-refresh";

const MODEL = process.env.TAKEAWAY_REFRESH_MODEL ?? "claude-sonnet-5-5";
const ROUNDS = 3;
const TAKEAWAY_TEST = /-takeaways\.test\.ts$/;

interface Report {
  testResults: { name: string; assertionResults: { status: string; fullName: string; failureMessages: string[] }[] }[];
}

function runTests(files: string[] = []): Report {
  const out = join(mkdtempSync(join(tmpdir(), "takeaways-")), "report.json");
  spawnSync("pnpm", ["exec", "vitest", "run", "--reporter=json", `--outputFile=${out}`, ...files], { stdio: ["ignore", "ignore", "inherit"] });
  return JSON.parse(readFileSync(out, "utf8")) as Report;
}

const failures = (r: Report) =>
  r.testResults.flatMap((f) =>
    f.assertionResults.filter((a) => a.status === "failed").map((a) => ({ file: relative(process.cwd(), f.name), name: a.fullName, message: a.failureMessages.join("\n").replace(/\x1b\[[0-9;]*m/g, "").slice(0, 1500) })),
  );

/** The test file and the local source files it imports (the specs that hold the sentences). */
function candidates(testFile: string): string[] {
  const text = readFileSync(testFile, "utf8");
  const found = new Set([testFile]);
  for (const m of text.matchAll(/from\s+"(\.{1,2}\/[^"]+)"/g)) {
    const base = resolve(dirname(testFile), m[1]!);
    const hit = [".ts", ".tsx", "/index.ts", "/index.tsx"].map((x) => base + x).find(existsSync);
    if (hit) found.add(relative(process.cwd(), hit));
  }
  return [...found];
}

const SYSTEM = `A data refresh changed numbers that a page's hand-written takeaway sentences cite. Each failing test compares a figure computed from the data with a figure typed in the test; the takeaway sentences and the test's "says" phrases and expected values must be updated to the new figures.
Rules:
- Propose edits that change figures and month names only: digits, decimals, years, and a month name moving to the newer month ("October" to "November") when the data now ends later. Do not change a single other character (other words, signs, punctuation, order). A "2026-10" style date in a test counts as digits.
- Take every new value from the failure output ("Received"), never guess. Where the failure output stops at the first failing assertion, reason about the other figures in the same sentence from what the failure implies, and include them only if you can derive them; the tests are re-run and any still failing means a human looks.
- Each "old" string must be copied exactly and occur exactly once in its file; make it long enough to be unique.
- Always answer by calling apply_edits.
- If the sentence is no longer true in its wording (a claim like "only in 2009–2012", "fell", "highest since 2000" that the data now contradicts), propose no edits.`;

async function propose(fails: ReturnType<typeof failures>, files: Record<string, string>): Promise<Edit[]> {
  const body = {
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM,
    tools: [
      {
        name: "apply_edits",
        description: "Figure-and-month-only edits that make the sentences and tests match the refreshed data. Empty when the wording is no longer true.",
        input_schema: {
          type: "object",
          properties: { edits: { type: "array", items: { type: "object", properties: { file: { type: "string" }, old: { type: "string" }, new: { type: "string" } }, required: ["file", "old", "new"] } } },
          required: ["edits"],
        },
      },
    ],
    tool_choice: { type: "auto" },
    messages: [
      {
        role: "user",
        content: `Failing tests:\n${fails.map((f) => `### ${f.file} > ${f.name}\n${f.message}`).join("\n\n")}\n\nFiles you may edit:\n${Object.entries(files).map(([p, t]) => `=== ${p} ===\n${t}`).join("\n\n")}`,
      },
    ],
  };
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(body),
    });
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 2000 * attempt));
      continue;
    }
    if (!res.ok) throw new Error(`API ${res.status} ${(await res.text()).slice(0, 200)}`);
    const json = (await res.json()) as { content?: { type: string; input?: { edits?: Edit[] } }[] };
    return json.content?.find((c) => c.type === "tool_use")?.input?.edits ?? [];
  }
  throw new Error("API unavailable after 3 attempts");
}

function restore(paths: string[]) {
  if (paths.length) execFileSync("git", ["checkout", "--", ...paths]);
}

async function main() {
  const summaryOut = process.argv.includes("--summary") ? process.argv[process.argv.indexOf("--summary") + 1] : undefined;
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");

  let fails = failures(runTests());
  if (fails.length === 0) return console.log("refresh-takeaways  no failing tests; nothing to do");
  const outside = fails.filter((f) => !TAKEAWAY_TEST.test(f.file));
  if (outside.length) throw new Error(`failures outside the takeaway tests, not refreshing: ${outside.map((f) => `${f.file} > ${f.name}`).join("; ")}`);

  const touched = new Set<string>();
  const log: string[] = [];
  try {
    for (let round = 1; round <= ROUNDS && fails.length; round++) {
      const testFiles = [...new Set(fails.map((f) => f.file))];
      const paths = [...new Set(testFiles.flatMap(candidates))];
      const files = Object.fromEntries(paths.map((p) => [p, readFileSync(p, "utf8")]));
      const edits = await propose(fails, files);
      const applied = applyEdits(files, edits);
      if ("error" in applied) throw new Error(`round ${round}: ${applied.error}`);
      for (const e of edits) {
        log.push(`- \`${e.file}\`: \`${e.old}\` → \`${e.new}\``);
        touched.add(e.file);
      }
      for (const [p, t] of Object.entries(applied.files)) if (t !== files[p]) writeFileSync(p, t);
      fails = failures(runTests(testFiles));
      console.log(`refresh-takeaways  round ${round}: ${edits.length} edit(s), ${fails.length} still failing`);
    }
    if (fails.length) throw new Error(`still failing after ${ROUNDS} rounds: ${fails.map((f) => `${f.file} > ${f.name}`).join("; ")}`);
  } catch (err) {
    restore([...touched]);
    throw err;
  }
  if (summaryOut) {
    writeFileSync(summaryOut, `The gate refreshed takeaway figures that this data refresh had moved (figures and month names only, wording untouched):\n\n${log.join("\n")}\n`);
  }
}

main().catch((err) => {
  console.error(`refresh-takeaways  ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});

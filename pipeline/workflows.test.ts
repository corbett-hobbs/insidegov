import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse, parseDocument } from "yaml";

/**
 * The workflow and action files only run on GitHub, so a syntax slip is not seen until a scheduled run fails: a stray
 * colon in the drafting action's email subject stopped every social draft for six days, and the step's
 * continue-on-error showed it as green. This parses every file the way a YAML reader would and checks the wiring a
 * parse cannot: that local actions exist, that `steps.<id>` points at a step in the same job, and that a drafting step
 * which may not block its workflow emails when it fails.
 */

const ROOT = join(__dirname, "..", ".github");
const workflows = readdirSync(join(ROOT, "workflows")).filter((f) => /\.ya?ml$/.test(f)).map((f) => join("workflows", f));
const actions = readdirSync(join(ROOT, "actions")).map((d) => join("actions", d, "action.yml"));
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

type Step = { id?: string; if?: string | boolean; uses?: string; "continue-on-error"?: unknown; with?: Record<string, unknown> };
type Job = { steps?: Step[] };
const jobsOf = (rel: string): [string, Job][] => Object.entries((parse(read(rel)) as { jobs?: Record<string, Job> }).jobs ?? {});

describe("workflow and action files", () => {
  it.each([...workflows, ...actions])("%s is valid YAML", (rel) => {
    const doc = parseDocument(read(rel));
    expect(doc.errors.map((e) => `${rel}: ${e.message.split("\n")[0]}`)).toEqual([]);
    expect(doc.warnings.map((e) => `${rel}: ${e.message.split("\n")[0]}`)).toEqual([]);
  });

  it("every local action a workflow uses exists", () => {
    const missing: string[] = [];
    for (const rel of [...workflows, ...actions]) {
      for (const m of read(rel).matchAll(/uses:\s*\.\/(\.github\/actions\/[\w-]+)/g)) {
        if (!existsSync(join(ROOT, "..", m[1]!, "action.yml"))) missing.push(`${rel}: ${m[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("every steps.<id> reference in a workflow names a step of that job", () => {
    const bad: string[] = [];
    for (const rel of workflows) {
      for (const [name, job] of jobsOf(rel)) {
        const ids = new Set((job.steps ?? []).flatMap((s) => (s.id ? [s.id] : [])));
        const text = JSON.stringify(job);
        for (const m of text.matchAll(/steps\.([\w-]+)\./g)) if (!ids.has(m[1]!)) bad.push(`${rel} (${name}): steps.${m[1]}`);
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it("a drafting step that cannot block its workflow emails when it fails", () => {
    const unguarded: string[] = [];
    for (const rel of workflows) {
      for (const [name, job] of jobsOf(rel)) {
        const steps = job.steps ?? [];
        steps.forEach((s, i) => {
          if (!s.uses?.endsWith("/social-drafts") || !s["continue-on-error"]) return;
          const watched = s.id && steps.slice(i + 1).some((n) => n.uses?.endsWith("/notify") && String(n.if ?? "").includes(`steps.${s.id}.outcome == 'failure'`));
          if (!watched) unguarded.push(`${rel} (${name})`);
        });
      }
    }
    expect(unguarded).toEqual([]);
  });
});

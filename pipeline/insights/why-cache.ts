import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Why } from "./types";

/**
 * Researched "why it moved" answers, kept so a draft that is made again (a rerun, a backfill, or a draft dropped later by
 * the caption check and tried again next run) does not pay for the web research twice. The research is the most expensive
 * call in the pipeline: web fetch and search over up to 12 turns. Only answers that passed research's own checks are kept;
 * an error is never cached, so it is tried again. Entries older than TTL_DAYS are ignored, because the news behind a reason
 * goes stale. File: pipeline/.cache/why.json (git-ignored); WHY_CACHE=<path> moves it, WHY_CACHE=off turns it off.
 */
export type WhyEntry = { at: string; model: string; why: Why };
export const WHY_TTL_DAYS = 3;

const file = () => process.env.WHY_CACHE ?? "pipeline/.cache/why.json";
const off = () => file() === "off";

function load(): Record<string, WhyEntry> {
  try {
    if (off() || !existsSync(file())) return {};
    return JSON.parse(readFileSync(file(), "utf8") || "{}") as Record<string, WhyEntry>;
  } catch {
    return {};
  }
}

export function cachedWhy(id: string, now = Date.now()): WhyEntry | null {
  const e = load()[id];
  if (!e || !(now - Date.parse(e.at) < WHY_TTL_DAYS * 86_400_000)) return null;
  return e;
}

export function saveWhy(id: string, model: string, why: Why, now = Date.now()): void {
  if (off()) return;
  try {
    const all = load();
    for (const [k, e] of Object.entries(all)) if (!(now - Date.parse(e.at) < WHY_TTL_DAYS * 86_400_000)) delete all[k];
    all[id] = { at: new Date(now).toISOString(), model, why };
    mkdirSync(dirname(file()), { recursive: true });
    writeFileSync(file(), `${JSON.stringify(all, null, 2)}\n`);
  } catch {
    // A cache that can't be written costs a repeat call next time, nothing more.
  }
}

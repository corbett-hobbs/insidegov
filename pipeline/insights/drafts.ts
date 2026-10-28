import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { claudeCaption, templateCaption } from "./caption";
import { renderCarousel } from "./carousel";
import { researchWhy } from "./research";
import { SITE_URL, renderChart } from "./chart";
import { type Reply, checkReplies, planThread, replyNumbers } from "./thread";
import { renderBreakdownCharts } from "./thread-charts";
import { axisProblems, titleProblems } from "./title";
import type { Insight, NewsTrigger, Release, Why } from "./types";
import { CellIndex, verifyInsight } from "./verify";

/**
 * Turns insights into drafts on disk: verify every fact against the data, research why the number moved (research.ts;
 * skipped with --no-llm or when why.ts has a hand-written one), write a caption (Claude, or the template with --no-llm),
 * render the chart and the carousel. A draft whose facts or caption fail is dropped and reported, never written.
 *
 * Each draft is `<slug>.png` + `<slug>.json`, plus its Instagram carousel `<slug>-ig-1.png` … (carousel.tsx);
 * `index.md` and `index.html` list them for review.
 */

export type Draft = {
  id: string;
  slug: string;
  dataset: Insight["dataset"];
  kind: Insight["kind"];
  period: string;
  headline: string;
  /** The title drawn on the chart (title.ts). */
  title: string;
  caption: string;
  caption_source: "claude" | "template";
  caption_model: string | null;
  link: string;
  /** Exactly what would be posted: the caption, a blank line, the link. */
  post_text: string;
  image: string;
  /** The Instagram carousel's slides, in order (posted by hand); absent on drafts made before carousels. */
  slides?: string[];
  alt: string;
  source: string;
  score: number;
  facts: { id: string; text: string; president?: string; derivation: Insight["facts"][number]["derivation"] }[];
  template: string;
  series_id: string;
  frequency: Insight["frequency"];
  /** When the data came out, whether the draft must say so, and when it goes stale (freshness.ts). */
  release: Release | null;
  /** News drafts: the caption's fixed opening sentence, and the story behind the draft. */
  lead?: string;
  news?: NewsTrigger;
  /** Why the number moved, with its sources (research.ts), or why there is none. */
  why?: Why;
  why_error?: string;
  /** The long-form thread on X and Bluesky: the replies after the chart post (thread.ts); absent when the draft posts alone. */
  replies?: Omit<Reply, "chart">[];
  /** The number tokens the replies were generated with (an edited reply may not add one). */
  reply_numbers?: string[];
  /** Parts of the thread left out, and why. */
  reply_notes?: string[];
};

export function slugFor(id: string): string {
  return id.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
}

export type BuildOptions = { outDir: string; useLlm: boolean; ref?: string; parallel?: number; log?: (msg: string) => void };

export async function buildDrafts(insights: Insight[], opts: BuildOptions): Promise<{ drafts: Draft[]; dropped: string[] }> {
  const log = opts.log ?? console.log;
  mkdirSync(opts.outDir, { recursive: true });
  const index = new CellIndex(opts.ref);
  const client = opts.useLlm ? new Anthropic({ maxRetries: 4 }) : null;
  const drafts: Draft[] = [];
  const dropped: string[] = [];
  let next = 0;
  async function worker() {
    while (next < insights.length) {
      let insight = insights[next++]!;
      // The chart's title and axis label follow the standing rule (title.ts): plain words, method in the data note.
      const titleErrors = [...titleProblems(insight.title), ...(insight.chart.axisLabel ? axisProblems(insight.chart.axisLabel) : [])];
      if (titleErrors.length) {
        dropped.push(`${insight.id}: chart text breaks the title rule (${titleErrors.join("; ")})`);
        continue;
      }
      const factErrors = verifyInsight(insight, index);
      if (factErrors.length) {
        dropped.push(`${insight.id}: facts do not trace to the data (${factErrors.join("; ")})`);
        continue;
      }
      // News drafts have their own fixed caption rules (news/), so only data drafts get a researched why.
      let whyError: string | undefined;
      if (client && !insight.why && insight.kind !== "news") {
        const found = await researchWhy(client, insight);
        if ("why" in found) insight = { ...insight, why: found.why };
        else whyError = found.error;
      }
      const result = client ? await claudeCaption(client, insight) : templateCaption(insight);
      if ("error" in result) {
        dropped.push(`${insight.id}: ${result.error}`);
        continue;
      }
      const slug = slugFor(insight.id);
      writeFileSync(join(opts.outDir, `${slug}.png`), await renderChart(insight));
      const slides = (await renderCarousel(insight)).map((png, i) => {
        const file = `${slug}-ig-${i + 1}.png`;
        writeFileSync(join(opts.outDir, file), png);
        return file;
      });
      const thread = await buildThread(insight, slug, opts.outDir);
      const link = `${SITE_URL}${insight.url}${insight.anchor ?? ""}`;
      const draft: Draft = {
        id: insight.id,
        slug,
        dataset: insight.dataset,
        kind: insight.kind,
        period: insight.period,
        headline: insight.headline,
        title: insight.title,
        caption: result.caption,
        caption_source: result.source,
        caption_model: result.model ?? null,
        link,
        post_text: `${result.caption}\n\n${link}`,
        image: `${slug}.png`,
        slides,
        alt: insight.alt,
        source: insight.source,
        score: Math.round(insight.score * 10) / 10,
        facts: insight.facts.map((f) => ({ id: f.id, text: f.text, ...(f.president ? { president: f.president } : {}), derivation: f.derivation })),
        template: insight.template,
        series_id: insight.seriesId,
        frequency: insight.frequency,
        release: insight.release ?? null,
        ...(insight.lead ? { lead: insight.lead } : {}),
        ...(insight.news ? { news: insight.news } : {}),
        ...(insight.why ? { why: insight.why } : {}),
        ...(whyError ? { why_error: whyError } : {}),
        ...(thread.replies ? { replies: thread.replies, reply_numbers: replyNumbers(thread.replies) } : {}),
        ...(thread.notes.length ? { reply_notes: thread.notes } : {}),
      };
      writeFileSync(join(opts.outDir, `${slug}.json`), `${JSON.stringify(draft, null, 2)}\n`);
      drafts.push(draft);
      log(`  ${result.source === "claude" ? "claude" : "template"}  ${insight.id}`);
    }
  }
  await Promise.all(Array.from({ length: opts.parallel ?? 4 }, worker));
  const order = new Map(insights.map((i, n) => [i.id, n] as const));
  drafts.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  writeIndex(opts.outDir, drafts, dropped);
  return { drafts, dropped };
}

/**
 * The thread's replies for one insight (thread.ts), with each breakdown block drawn as `<slug>-t-<n>.png` (n is the post's
 * number in the thread). A thread that fails the plain checks is left out whole: the draft then posts alone.
 */
async function buildThread(insight: Insight, slug: string, outDir: string): Promise<{ replies?: Omit<Reply, "chart">[]; notes: string[] }> {
  const plan = planThread(insight);
  if (!plan) return { notes: [] };
  const cards = plan.replies.some((r) => r.chart !== undefined) ? await renderBreakdownCharts(insight) : [];
  const replies = plan.replies.map((r, i) => {
    if (r.chart === undefined) return { text: r.text };
    const image = `${slug}-t-${i + 2}.png`;
    writeFileSync(join(outDir, image), cards[r.chart]!);
    return { text: r.text, image, alt: r.alt };
  });
  const problems = checkReplies(replies, insight.facts, replyNumbers(replies));
  return problems.length ? { notes: [...plan.notes, `the thread was left out: ${problems.join("; ")}`] } : { replies, notes: plan.notes };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** index.md (for a terminal or GitHub) and index.html (open in a browser to review images and captions together). */
export function writeIndex(outDir: string, drafts: Draft[], dropped: string[]): void {
  const md = [
    `# Social post drafts (${drafts.length})`,
    "",
    "Nothing here is posted. Each draft: chart, caption (every number checked against the data), link.",
    "",
    ...drafts.flatMap((d, n) => [
      `## ${n + 1}. ${d.headline}`,
      "",
      `![${d.alt.replace(/[[\]]/g, "")}](${d.image})`,
      "",
      `> ${d.caption}`,
      ">",
      `> ${d.link}`,
      "",
      ...(d.replies?.length ? [`Thread (${d.replies.length} replies):`, "", ...d.replies.flatMap((r, i) => [`${i + 2}. ${r.text.replace(/\n+/g, " / ")}${r.image ? ` ![](${r.image})` : ""}`]), ""] : []),
      `\`${d.id}\` · score ${d.score} · caption: ${d.caption_source}${d.caption_model ? ` (${d.caption_model})` : ""}${d.release ? ` · released ${d.release.releasedOn}${d.release.estimated ? " (est.)" : ""}, fresh until ${d.release.expiresOn}${d.release.lagged ? " · lagged" : ""}` : ""}`,
      "",
    ]),
    ...(dropped.length ? ["## Dropped", "", ...dropped.map((d) => `- ${d}`), ""] : []),
  ].join("\n");
  writeFileSync(join(outDir, "index.md"), md);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Social drafts</title>
<style>body{font:16px/1.5 system-ui,sans-serif;background:#eef1f5;color:#1a2233;margin:0;padding:24px 16px}main{max-width:760px;margin:0 auto}
article{background:#fff;border-radius:10px;padding:16px;margin:0 0 24px;box-shadow:0 1px 2px #0001}img{width:100%;height:auto;border:1px solid #d7dce3;border-radius:6px}
.slides{display:flex;gap:6px;margin-top:8px}.slides img{width:19%;border-radius:4px}.post{white-space:pre-wrap;font-size:17px;margin:12px 0}.meta{color:#5b6472;font-size:13px}details{font-size:13px;color:#5b6472}code{font-size:12px}</style></head>
<body><main><h1>Social post drafts (${drafts.length})</h1><p>Nothing here is posted. Each caption's numbers were checked against the data cells listed under "Facts".</p>
${drafts
  .map(
    (d, n) => `<article><div class="meta">${n + 1} · ${esc(d.dataset)} · ${esc(d.kind)} · ${esc(d.period)} · score ${d.score} · caption: ${esc(d.caption_source)}${d.release ? ` · released ${esc(d.release.releasedOn)}${d.release.estimated ? " (est.)" : ""}, fresh until ${esc(d.release.expiresOn)}${d.release.lagged ? " · lagged" : ""}` : ""}</div>
<img src="${esc(d.image)}" alt="${esc(d.alt)}">${d.slides?.length ? `<div class="slides">${d.slides.map((f) => `<a href="${esc(f)}"><img src="${esc(f)}" alt=""></a>`).join("")}</div>` : ""}<div class="post">${esc(d.caption)}\n\n<a href="${esc(d.link)}">${esc(d.link)}</a></div>${d.replies?.length ? `<div class="post"><b>Thread</b>\n${d.replies.map((r, i) => `${i + 2}. ${esc(r.text)}${r.image ? `\n<img src="${esc(r.image)}" alt="${esc(r.alt ?? "")}">` : ""}`).join("\n\n")}</div>` : ""}
<details><summary>Facts and template</summary><p><b>Template:</b> ${esc(d.template)}</p><ul>${d.facts.map((f) => `<li><b>${esc(f.text)}</b> <code>${esc(f.id)}</code></li>`).join("")}</ul></details></article>`,
  )
  .join("\n")}
${dropped.length ? `<h2>Dropped</h2><ul>${dropped.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>` : ""}
</main></body></html>\n`;
  writeFileSync(join(outDir, "index.html"), html);
}

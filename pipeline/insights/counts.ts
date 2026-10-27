import { graphemes, MAX_GRAPHEMES } from "./bluesky";
import { checkCaption } from "./caption";
import { INSTAGRAM_MAX, instagramCaption } from "./instagram";
import type { DraftBlock } from "./issue";
import { X_MAX, xLength } from "./x";

/**
 * The "Length" section of a draft issue: how close each post is to each platform's limit, and whether the caption still
 * passes the check. Written when the issue opens and rewritten whenever the issue is edited (social-counts.yml), so
 * someone changing the wording sees the effect without counting characters.
 */

export const COUNTS_OPEN = "<!-- social-counts -->";
export const COUNTS_CLOSE = "<!-- /social-counts -->";

/** "245 / 300 (55 left)" or "⚠ 312 / 300 (12 over)". */
export function fit(used: number, max: number): string {
  return used <= max ? `${used} / ${max} (${max - used} left)` : `⚠ ${used} / ${max} (${used - max} over)`;
}

export function lengthSection(block: DraftBlock): string {
  const lines: string[] = [];
  if (block.kind === "intro" && block.thread) {
    lines.push("| Post | Bluesky (limit 300) | X (limit 280) |", "| --- | --- | --- |");
    const n = Math.max(block.thread.bluesky.length, block.thread.x.length);
    for (let i = 0; i < n; i++) {
      const b = block.thread.bluesky[i];
      const x = block.thread.x[i];
      lines.push(`| ${i + 1} | ${b === undefined ? "" : fit(graphemes(b), MAX_GRAPHEMES)} | ${x === undefined ? "" : fit(xLength(x), X_MAX)} |`);
    }
  } else {
    const bsky = `${block.caption}\n\n${block.link}`;
    const xPlain = xLength(block.caption);
    const xLinked = xLength(`${block.caption}\n\n${block.link}`);
    const insta = instagramCaption(block);
    lines.push(
      `- **Bluesky** (caption and link): ${fit(graphemes(bsky), MAX_GRAPHEMES)}`,
      `- **X** (caption, no link by default): ${fit(xPlain, X_MAX)}; with the link: ${fit(xLinked, X_MAX)}`,
      `- **Instagram** (caption, link-in-bio line and hashtags): ${fit(graphemes(insta), INSTAGRAM_MAX)}`,
    );
    const errors = checkCaption(block.caption, block.facts, { lagged: block.release?.lagged, lead: block.lead });
    lines.push(errors.length ? `- ⚠ **Caption check fails:** ${errors.join("; ")}. It will not post until this is fixed.` : "- ✅ Caption check passes (numbers match the facts, no loaded words).");
    // Instagram is posted by hand: the text to paste, rebuilt with the rest of this section when the caption is edited.
    lines.push("", "**Instagram text** (to post by hand; hashtags are set per series in `instagram.ts`)", "", "```text", insta, "```");
  }
  return `${COUNTS_OPEN}\n**Length**\n\n${lines.join("\n")}\n${COUNTS_CLOSE}`;
}

/** The body with its Length section rebuilt from the (possibly edited) block; unchanged if it has no section. */
export function refreshCounts(body: string, block: DraftBlock): string {
  const start = body.indexOf(COUNTS_OPEN);
  const end = body.indexOf(COUNTS_CLOSE);
  if (start < 0 || end < start) return body;
  return body.slice(0, start) + lengthSection(block) + body.slice(end + COUNTS_CLOSE.length);
}

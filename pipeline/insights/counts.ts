import { graphemes, MAX_GRAPHEMES } from "./bluesky";
import { checkCaption } from "./caption";
import { INSTAGRAM_MAX, instagramCaption } from "./instagram";
import type { DraftBlock } from "./issue";
import { checkReplies } from "./thread";
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

/** The caption check's verdict, as a bullet. */
function captionCheckLine(block: DraftBlock): string {
  const errors = checkCaption(block.caption, block.facts, { lagged: block.release?.lagged, lead: block.lead });
  return errors.length ? `- ⚠ **Caption check fails:** ${errors.join("; ")}. It will not post until this is fixed.` : "- ✅ Caption check passes (numbers match the facts, no loaded words).";
}

/** The thread's length table and check (nothing when the draft is one post). */
function threadLines(block: DraftBlock): string[] {
  if (!block.replies?.length) return [];
  const lines = ["", "**Thread** (the replies after the chart post; the link is added to the last)", "", "| Post | Bluesky (limit 300) | X (limit 280, link counts 23) |", "| --- | --- | --- |"];
  block.replies.forEach((r, i) => {
    const last = i === block.replies!.length - 1;
    const b = last ? `${r.text}\n\n${block.link}` : r.text;
    lines.push(`| ${i + 2}${last ? " (last)" : ""} | ${fit(graphemes(b), MAX_GRAPHEMES)} | ${last ? `${fit(xLength(r.text), X_MAX)}; with the link: ${fit(xLength(`${r.text}\n\n${block.link}`), X_MAX)}` : fit(xLength(r.text), X_MAX)} |`);
  });
  const problems = checkReplies(block.replies, block.facts, block.reply_numbers ?? []);
  lines.push("", problems.length ? `- ⚠ **Thread check fails:** ${problems.join("; ")}. It will not post until this is fixed.` : "- ✅ Thread check passes (numbers match the facts, no loaded words).");
  return lines;
}

/** Instagram is posted by hand: the text to paste, rebuilt with the rest of the section when the caption is edited. */
const instagramTextLines = (block: DraftBlock): string[] => ["**Instagram text** (to post by hand; hashtags are set per series in `instagram.ts`)", "", "```text", instagramCaption(block), "```"];

/** The intro thread's length table, or a data draft's lengths for every platform in one list (the older layout, still what an edited older issue is rewritten as). */
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
    lines.push(
      `- **Bluesky** (caption and link): ${fit(graphemes(`${block.caption}\n\n${block.link}`), MAX_GRAPHEMES)}`,
      `- **X** (caption, no link by default): ${fit(xLength(block.caption), X_MAX)}; with the link: ${fit(xLength(`${block.caption}\n\n${block.link}`), X_MAX)}`,
      `- **Instagram** (caption, link-in-bio line and hashtags): ${fit(graphemes(instagramCaption(block)), INSTAGRAM_MAX)}`,
      captionCheckLine(block),
      ...threadLines(block),
      "",
      ...instagramTextLines(block),
    );
  }
  return `${COUNTS_OPEN}\n**Length**\n\n${lines.join("\n")}\n${COUNTS_CLOSE}`;
}

export const INSTAGRAM_COUNTS_OPEN = "<!-- social-counts-instagram -->";
export const INSTAGRAM_COUNTS_CLOSE = "<!-- /social-counts-instagram -->";

/** A data draft's Bluesky and X lengths, caption check and thread table: the Bluesky and X half of the issue. */
export function blueskyXSection(block: DraftBlock): string {
  const lines = [
    `- **Bluesky** (caption and link): ${fit(graphemes(`${block.caption}\n\n${block.link}`), MAX_GRAPHEMES)}`,
    `- **X** (caption, no link by default): ${fit(xLength(block.caption), X_MAX)}; with the link: ${fit(xLength(`${block.caption}\n\n${block.link}`), X_MAX)}`,
    captionCheckLine(block),
    ...threadLines(block),
  ];
  return `${COUNTS_OPEN}\n**Length**\n\n${lines.join("\n")}\n${COUNTS_CLOSE}`;
}

/** The Instagram half: its length and the text to paste. */
export function instagramSection(block: DraftBlock): string {
  return `${INSTAGRAM_COUNTS_OPEN}\n**Length:** ${fit(graphemes(instagramCaption(block)), INSTAGRAM_MAX)} (caption, link-in-bio line and hashtags)\n\n${instagramTextLines(block).join("\n")}\n${INSTAGRAM_COUNTS_CLOSE}`;
}

/** Replaces the text from `open` to `close` with `section`; the body unchanged when it has no such region. */
function replaceRegion(body: string, open: string, close: string, section: string): string {
  const start = body.indexOf(open);
  const end = body.indexOf(close);
  return start < 0 || end < start ? body : body.slice(0, start) + section + body.slice(end + close.length);
}

/**
 * The body with its Length sections rebuilt from the (possibly edited) block; unchanged if it has none. A body with a
 * separate Instagram section has the two halves rewritten; an older one, with every platform in one list, is rewritten as one.
 */
export function refreshCounts(body: string, block: DraftBlock): string {
  if (!body.includes(INSTAGRAM_COUNTS_OPEN)) return replaceRegion(body, COUNTS_OPEN, COUNTS_CLOSE, lengthSection(block));
  return replaceRegion(replaceRegion(body, COUNTS_OPEN, COUNTS_CLOSE, blueskyXSection(block)), INSTAGRAM_COUNTS_OPEN, INSTAGRAM_COUNTS_CLOSE, instagramSection(block));
}

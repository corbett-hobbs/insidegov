import { MAX_GRAPHEMES, graphemes } from "./bluesky";
import { BANNED_WORDS, numberTokens } from "./caption";
import { explainer, explainerShort, hasLag } from "./explain";
import type { DraftBlock } from "./issue";
import { keyMoments } from "./moments";
import { newsOutlet, rowValue, signedFact } from "./research";
import type { Insight } from "./types";
import { X_MAX, xLength } from "./x";

/**
 * The long-form thread for a data draft, posted to X and Bluesky: the chart post (the caption and the chart card), then
 * replies that say more. Text is text and only charts are images, so the reasons, the key moments and the measure's
 * definition are plain posts, and each breakdown block is a chart card (thread-charts.tsx).
 *
 *   caption + chart   the draft's caption (caption.ts) and chart card: the root, written and checked as before
 *   why               "Why it went up" (research.ts): the researched paragraphs, packed into posts, text only
 *   breakdown         each block of "What drove it" (breakdown.ts): one line of signed changes and a bar chart
 *   moments           dated actions from the site's sourced timelines (moments.ts), listed in order, not as causes
 *   explainer         what the series measures (explain.ts), when there is neither a reason nor a breakdown, when it states a release lag (explain.ts hasLag), or when the chart has two lines
 *   sources           the data source and the pages the reasons came from; the link is added when it posts
 *
 * Every sentence comes from something already checked: the why's paragraphs passed checkWhy, the breakdown line is
 * built from verified facts, the moments are the site's curated timeline, the explainer has no numbers or causes.
 * checkReplies runs the plain rules on all of them again at posting time, so an edited reply cannot add a number or a
 * loaded word. News drafts are threads in the same format as data drafts (the intro has its own).
 */

/** X's limit and the tighter of the two platforms: one text fits both (Bluesky allows 300). */
export const REPLY_MAX = 280;

export type Reply = {
  text: string;
  /** Planned: the breakdown block this reply's chart draws (drafts.ts renders it and sets `image`). */
  chart?: number;
  /** The chart image's file in the drafts folder (and, in the issue block, its URL). */
  image?: string;
  alt?: string;
};

export type ThreadPlan = {
  replies: Reply[];
  /** Why a part of the thread was left out, for the issue. */
  notes: string[];
};

/** The facts' number tokens plus years: what a reply may state. */
const YEAR = /^(?:19|20)\d\d$/;

/** Words that never say a reason, so a "why" made of them adds nothing to a thread. */
const NO_REASON_TITLE = /^what changed$/i;
const NO_REASON_LINE = /\bno (?:reason|cause|explanation)\b|\b(?:does|do) not (?:give|state|say)\b|\bnot confirmed\b|\b(?:neither|none)\b[^.]*\b(?:states?|gives?|says?)\b[^.]*\b(?:reason|cause)\b/i;

/** Whether the researched "why" actually gives a reason (a "What changed" answer only says where the number comes from). */
export function givesReason(why: NonNullable<Insight["why"]>): boolean {
  return !NO_REASON_TITLE.test(why.title.trim()) && !NO_REASON_LINE.test(why.captionLine) && !why.paragraphs.some((p) => NO_REASON_LINE.test(p));
}

/** Sentences, split after a period and a space ("U.S." is not a sentence end). */
const sentences = (text: string): string[] =>
  text
    .replace(/\bU\.S\./g, "U.S\u0000")
    .split(/(?<=\.)\s+/)
    .map((s) => s.replace(/\u0000/g, ".").trim())
    .filter(Boolean);

/**
 * Packs paragraphs into posts of at most `max` characters, keeping them whole and in order (two paragraphs share a post
 * when they fit); a paragraph that is too long is split between its sentences. Null when a single sentence is too long.
 */
export function packParagraphs(paragraphs: string[], max = REPLY_MAX, first = ""): string[] | null {
  const parts: string[] = [];
  for (const p of paragraphs) {
    if (p.length <= max) parts.push(p);
    else {
      let cur = "";
      for (const s of sentences(p)) {
        if (s.length > max) return null;
        if (cur && `${cur} ${s}`.length > max) {
          parts.push(cur);
          cur = s;
        } else cur = cur ? `${cur} ${s}` : s;
      }
      if (cur) parts.push(cur);
    }
  }
  const posts: string[] = [];
  for (const part of parts) {
    const last = posts.at(-1);
    if (last !== undefined && `${last}\n\n${part}`.length <= max) posts[posts.length - 1] = `${last}\n\n${part}`;
    else posts.push(part);
  }
  // The heading goes on the first post when it fits there.
  if (first && posts[0] !== undefined && `${first}\n\n${posts[0]}`.length <= max) posts[0] = `${first}\n\n${posts[0]}`;
  return posts;
}

function whyReplies(insight: Insight): { replies: Reply[]; note?: string } {
  const why = insight.why;
  if (!why) return { replies: [] };
  if (!givesReason(why)) return { replies: [], note: "the research found no reason for the change, so the thread has no reasons post" };
  const packed = packParagraphs(why.paragraphs, REPLY_MAX, `${why.title}.`);
  if (!packed) return { replies: [], note: "a sentence of the reasons is too long for one post" };
  return { replies: packed.map((text) => ({ text })) };
}

/** "Natural gas +16.9B kWh, Solar +7.0B kWh": a block's rows as signed changes, parentheses dropped from names. */
function rowsText(insight: Insight, rows: { name: string; fact: string }[]): string {
  return rows.map((r) => `${r.name.replace(/\s*\(.*\)\s*$/, "")} ${rowValue(insight, r.fact)}`).join(", ");
}

function breakdownReplies(insight: Insight): { replies: Reply[]; note?: string } {
  const b = insight.breakdown;
  if (!b) return { replies: [] };
  const replies: Reply[] = [];
  // Levels (where each line stands): one post and one card for both blocks, when they fit.
  if (b.levels) {
    const text = `${b.title}\n\n${b.blocks.map((blk) => `${blk.label} ${rowsText(insight, blk.rows)}.`).join(" ")}`;
    if (text.length <= REPLY_MAX) return { replies: [{ text, chart: 0, alt: text.replace(/\n+/g, " ").slice(0, 1000) }] };
  }
  for (const [i, blk] of b.blocks.entries()) {
    const total = blk.total ? ` ${blk.total.name} ${rowValue(insight, blk.total.fact)}.` : "";
    const head = i === 0 ? `${b.title}\n\n` : "";
    // Trim the smallest rows (the last ones) until the line fits; a chart still shows them all.
    let rows = blk.rows;
    let text = `${head}${blk.label}: ${rowsText(insight, rows)}.${total}`;
    while (text.length > REPLY_MAX && rows.length > 2) {
      rows = rows.slice(0, -1);
      text = `${head}${blk.label}: ${rowsText(insight, rows)}.${total}`;
    }
    if (text.length > REPLY_MAX) return { replies, note: "a breakdown line is too long for one post" };
    replies.push({ text, chart: i, alt: `${b.title}. ${blk.label}: ${rowsText(insight, blk.rows)}.${total}`.slice(0, 1000) });
  }
  return { replies };
}

/** "March 23, 2018: tariffs begin", the dates written out, one line each. */
function momentLines(insight: Insight): string[] {
  return keyMoments(insight).map((m) => `${new Date(`${m.date}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}: ${m.label}`);
}

function momentsReplies(insight: Insight): { replies: Reply[]; note?: string } {
  const lines = momentLines(insight);
  if (!lines.length) return { replies: [] };
  const head = "Key moments, in order. They are listed for context, not as causes of the change:";
  const posts: string[] = [];
  let cur = head;
  for (const line of lines) {
    if (line.length > REPLY_MAX) return { replies: [], note: "a key moment is too long for one post" };
    if (`${cur}\n\n${line}`.length > REPLY_MAX && cur !== head) {
      posts.push(cur);
      cur = line;
    } else cur = cur === head ? `${cur}\n\n${line}` : `${cur}\n${line}`;
  }
  posts.push(cur);
  return { replies: posts.map((text) => ({ text })) };
}

function explainerReplies(insight: Insight): Reply[] {
  const short = explainerShort(insight);
  if (short && `What this measures.\n\n${short}`.length <= REPLY_MAX) return [{ text: `What this measures.\n\n${short}` }];
  const lines = explainer(insight);
  const packed = lines.length ? packParagraphs(lines, REPLY_MAX, "What this measures.") : null;
  return (packed ?? []).map((text) => ({ text }));
}

/** The closing post: where the data is from and, when the reasons were researched, the pages they come from. */
function sourcesReply(insight: Insight): Reply {
  const data = `Data: ${insight.source}.`;
  // A news source is named by its outlet: its title is a headline, which may carry words the posts never use themselves.
  const names = insight.why && givesReason(insight.why) ? [...new Set(insight.why.sources.map((s) => newsOutlet(s.url) ?? s.name))] : [];
  let text = data;
  for (let n = names.length; n > 0; n--) {
    const t = `${data} Reasons: ${names.slice(0, n).join("; ")}.`;
    if (t.length <= REPLY_MAX - 28) {
      text = t;
      break;
    }
  }
  return { text };
}

/** The replies after the chart post, or null when there is nothing to add (the draft then posts as a single post). */
export function planThread(insight: Insight): ThreadPlan | null {
  const notes: string[] = [];
  const sections = [whyReplies(insight), breakdownReplies(insight), momentsReplies(insight)];
  const replies = sections.flatMap((s) => s.replies);
  for (const s of sections) if (s.note) notes.push(s.note);
  if ((!replies.length && !(insight.why && givesReason(insight.why)) && !insight.breakdown) || hasLag(insight) || insight.alsoSeriesId) replies.push(...explainerReplies(insight));
  if (!replies.length) return null;
  replies.push(sourcesReply(insight));
  return { replies, notes };
}

/** One post of a thread as it goes out: the chart post (the caption, the chart card) or a reply, and its link if it carries one. */
export type Part = { text: string; imageUrl?: string; alt?: string; link?: string };

/**
 * The posts of a draft's thread on one platform, in order. The link goes only on the last one (on X only when
 * `xLink`, since X charges far more for a post with a URL; Bluesky always carries it).
 */
export function partsOf(b: Pick<DraftBlock, "caption" | "image_url" | "alt" | "replies" | "link">, platform: "bluesky" | "x", xLink: boolean): Part[] {
  const parts: Part[] = [{ text: b.caption, ...(b.image_url ? { imageUrl: b.image_url, alt: b.alt } : {}) }, ...(b.replies ?? []).map((r) => ({ text: r.text, ...(r.image_url ? { imageUrl: r.image_url, alt: r.alt } : {}) }))];
  if (b.replies?.length && (platform === "bluesky" || xLink)) parts[parts.length - 1]!.link = b.link;
  return parts;
}

/** A thread post longer than its platform allows (with its link), found before anything is posted. */
export function threadFit(b: Parameters<typeof partsOf>[0], xLink: boolean): string[] {
  if (!b.replies?.length) return [];
  const errors: string[] = [];
  partsOf(b, "bluesky", xLink).forEach((t, i) => {
    const n = graphemes(t.link ? `${t.text}\n\n${t.link}` : t.text);
    if (n > MAX_GRAPHEMES) errors.push(`post ${i + 1} is ${n} characters on Bluesky; the limit is ${MAX_GRAPHEMES}`);
  });
  partsOf(b, "x", xLink).forEach((t, i) => {
    const n = xLength(t.link ? `${t.text}\n\n${t.link}` : t.text);
    if (n > X_MAX) errors.push(`post ${i + 1} is ${n} characters on X; the limit is ${X_MAX}`);
  });
  return errors;
}

const EXEMPT = new Set(["only", "just", "record", "records", "caused"]);

/**
 * Every reason a reply fails the plain rules (none: it passes): length, no links, hashtags, mentions, emoji, "!" or "?",
 * no loaded or partisan words, and no number that is not a fact, a year, or one the thread was generated with.
 * `allowed` are the number tokens of the replies as they were generated (a "12 months" label, a curated moment's
 * "180 million"), so an edit that adds a figure fails.
 */
export function checkReply(text: string, facts: { text: string }[], allowed: readonly string[] = [], max = REPLY_MAX): string[] {
  const errors: string[] = [];
  if (text.trim().length < 20) errors.push("too short to say anything");
  if (text.length > max) errors.push(`${text.length} characters; the limit is ${max}`);
  if (/https?:|www\.|\.(?:com|org|gov|fyi)\b/i.test(text)) errors.push("contains a link (the link is added to the last reply)");
  if (/[#@!?]/.test(text)) errors.push('contains "#", "@", "!" or "?"');
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text)) errors.push("contains an emoji");
  const words = new Set(text.toLowerCase().match(/[a-z]+(?:-[a-z]+)*/g) ?? []);
  const banned = BANNED_WORDS.filter((w) => words.has(w) && !EXEMPT.has(w));
  if (banned.length) errors.push(`uses loaded or partisan words: ${banned.join(", ")}`);
  const ok = new Set([...facts.flatMap((f) => numberTokens(f.text)), ...allowed]);
  const stray = numberTokens(text).filter((t) => !ok.has(t) && !YEAR.test(t));
  if (stray.length) errors.push(`numbers not among the facts: ${[...new Set(stray)].join(", ")}`);
  return errors;
}

/** The number tokens (not years) the replies were generated with, stored in the issue so edits are held to them. */
export function replyNumbers(replies: { text: string }[]): string[] {
  return [...new Set(replies.flatMap((r) => numberTokens(r.text)).filter((t) => !YEAR.test(t)))];
}

/** checkReply over a draft's replies, each error tagged with its post number (the chart post is 1). */
export function checkReplies(replies: { text: string }[], facts: { text: string }[], allowed: readonly string[] = []): string[] {
  return replies.flatMap((r, i) => checkReply(r.text, facts, allowed).map((e) => `reply ${i + 2}: ${e}`));
}

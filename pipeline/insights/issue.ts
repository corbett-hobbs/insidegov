import { lengthSection } from "./counts";
import type { Draft } from "./drafts";
import { slotLabel } from "./schedule";
import type { CellRef, Derivation, Frequency, InsightKind, NewsTrigger, Release } from "./types";

/**
 * The GitHub issue for one draft: image, the exact post text, every fact traced to its data cells, and a hidden
 * machine-readable block the (disabled) poster reads. One issue per draft; the label is the approval.
 */

export const DRAFT_LABEL = "social-draft";
export const APPROVED_LABEL = "social-approved";
export const POSTED_LABEL = "social-posted";

export const INTRO_LABEL = "social-intro";
/** News drafts (pipeline/insights/news): approving one posts it within minutes instead of at the next slot. */
export const NEWS_LABEL = "social-news";
export const EXPIRED_LABEL = "social-expired";

/** What the scheduler and posters need, stored in the issue body as an HTML comment. */
export type DraftBlock = {
  id: string;
  kind: InsightKind | "intro";
  dataset: string;
  series_id: string;
  period: string;
  /** How often the data comes out (sets the freshness window); absent on the intro. */
  frequency?: Frequency;
  score: number;
  caption: string;
  link: string;
  /** Null for the text-only intro thread. */
  image_url: string | null;
  alt: string;
  facts: { id: string; text: string; president?: string }[];
  release: Release | null;
  /** The intro only: the whole thread per platform (posts in order, each a reply to the one before). */
  thread?: { bluesky: string[]; x: string[] };
  /** News drafts: the caption must start with this (checked again before posting). */
  lead?: string;
  /** News drafts: the story, and when the draft stops being postable. */
  news?: NewsTrigger;
};

const OPEN = "<!-- social-draft";
const CLOSE = "-->";

export function issueTitle(draft: Pick<Draft, "headline" | "id">): string {
  const h = draft.headline.length > 90 ? `${draft.headline.slice(0, 89).trimEnd()}…` : draft.headline;
  return `Social draft: ${h} [${draft.id}]`;
}

function cellText(c: CellRef): string {
  const key = Object.entries(c.key)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
  return `\`${c.file.replace(/^pipeline\/output\//, "")}\` ${key}${c.field === "__row" ? "" : ` → ${c.negate ? "−" : ""}${c.field}${c.index === undefined ? "" : `[${c.index}]`}`}`;
}

function cellsText(cells: CellRef[]): string {
  if (cells.length === 0) return "no rows";
  if (cells.length > 3) return `${cells.length} rows of \`${cells[0]!.file.replace(/^pipeline\/output\//, "")}\` (${cellText(cells[0]!)} … ${cellText(cells.at(-1)!)})`;
  return cells.map(cellText).join(" + ");
}

export function derivationText(d: Derivation): string {
  switch (d.op) {
    case "value":
      return cellsText(d.cells);
    case "pct_change":
      return `% change from ${cellsText(d.from)} to ${cellsText(d.to)}`;
    case "change":
      return `change from ${cellsText(d.from)} to ${cellsText(d.to)}`;
    case "date":
      return `date ${d.date}`;
    case "duration":
      return `${d.unit} from ${d.from} to ${d.to}`;
  }
}

export function issueBody(draft: Draft, imageUrl: string, extra: { dataPr?: string; runUrl?: string } = {}): string {
  const block: DraftBlock = {
    id: draft.id,
    kind: draft.kind,
    dataset: draft.dataset,
    series_id: draft.series_id,
    period: draft.period,
    frequency: draft.frequency,
    score: draft.score,
    caption: draft.caption,
    link: draft.link,
    image_url: imageUrl,
    alt: draft.alt,
    facts: draft.facts.map((f) => ({ id: f.id, text: f.text, ...(f.president ? { president: f.president } : {}) })),
    release: draft.release,
    ...(draft.lead ? { lead: draft.lead } : {}),
    ...(draft.news ? { news: draft.news } : {}),
  };
  const r = draft.release;
  const n = draft.news;
  return [
    `![${draft.alt.replace(/[[\]]/g, "")}](${imageUrl})`,
    "",
    "**Post text**",
    "",
    "```text",
    draft.post_text,
    "```",
    "",
    lengthSection(block),
    "",
    ...slidesSection(draft, imageUrl),
    `Dataset \`${draft.dataset}\` · ${draft.kind.replace("_", " ")} · period ${draft.period} · caption by ${draft.caption_source}${draft.caption_model ? ` (${draft.caption_model})` : ""}${extra.dataPr ? ` · data PR ${extra.dataPr}` : ""}${extra.runUrl ? ` · [run](${extra.runUrl})` : ""}`,
    "",
    "<details><summary>Every number the caption may use, traced to the data</summary>",
    "",
    "| Fact | Text | Derived from |",
    "| --- | --- | --- |",
    ...draft.facts.map((f) => `| \`${f.id}\` | ${f.text} | ${derivationText(f.derivation).replace(/\|/g, "\\|")} |`),
    "",
    `Reference template: ${draft.template}`,
    "",
    "</details>",
    "",
    ...(n
      ? [
          `**In the news** (${n.reason}):`,
          "",
          ...n.headlines.slice(0, 8).map((h) => `- ${h.feed === "whitehouse" ? "**Official:** " : ""}[${h.title.replace(/[[\]]/g, "")}](${h.url}) · ${h.source} · ${h.published.slice(0, 16).replace("T", " ")} UTC`),
          "",
          `**Freshness:** news drafts go stale fast. Approve by **${slotLabel(n.expiresAt)}** or it expires unposted. The caption opens with the fixed sentence "${draft.lead}" and does not describe the news; the headlines above are for you, not the post.`,
          "",
          "**To approve:** add the `" + APPROVED_LABEL + "` label. A news draft does not wait for a slot: it posts within a few minutes (or as soon as the spacing rules allow, see `pipeline/insights/README.md`). **To reject:** close the issue. Nothing posts while the repo variable `SOCIAL_POSTING_ENABLED` is unset. To change the caption, edit `caption` in the block below (keep the opening sentence); the poster re-checks it before posting.",
          "",
        ]
      : []),
    ...(r && !n
      ? [
          `**Freshness:** data released ${r.releasedOn}${r.estimated ? " (estimated)" : ""}; queue it by **${r.expiresOn}** or it expires unposted.${r.lagged ? " The data covers a period that ended " + r.periodEnd + ", so the chart and caption say it is newly released." : ""}`,
          "",
        ]
      : []),
    ...(n ? [] : ["**To approve:** add the `" + APPROVED_LABEL + "` label. That queues it; the scheduler posts it at the next open slot (one or two a weekday, see `pipeline/insights/README.md`). **To reject:** close the issue. Nothing posts while the repo variable `SOCIAL_POSTING_ENABLED` is unset. To change the caption, edit `caption` in the block below; the poster re-checks it against the facts before posting.", ""]),
    blockComment(block),
    "",
  ].join("\n");
}

/**
 * The Instagram carousel (carousel.tsx), posted by hand: each slide as a thumbnail linking to the full 1080x1350 image,
 * in order. The slides sit next to the chart image, so their URLs share its folder.
 */
export function slidesSection(draft: Pick<Draft, "image" | "slides">, imageUrl: string): string[] {
  if (!draft.slides?.length) return [];
  const base = imageUrl.slice(0, imageUrl.length - draft.image.length);
  return [
    `**Instagram slides** (${draft.slides.length}, 1080×1350): open each, save it, and upload them in this order with the Instagram text above.`,
    "",
    draft.slides.map((f, i) => `<a href="${base}${f}"><img src="${base}${f}" width="150" alt="Slide ${i + 1}"></a>`).join(" "),
    "",
  ];
}

/** The block as an HTML comment. "--" cannot appear inside one; JSON lets us escape it. */
export function blockComment(block: DraftBlock): string {
  return `${OPEN}\n${JSON.stringify(block, null, 2).replace(/--/g, "-\\u002d")}\n${CLOSE}`;
}

/** The hidden block from an issue body, or null when there is none or it does not parse. */
export function parseDraftBlock(body: string): DraftBlock | null {
  const start = body.indexOf(OPEN);
  if (start < 0) return null;
  const end = body.indexOf(CLOSE, start + OPEN.length);
  if (end < 0) return null;
  try {
    const v = JSON.parse(body.slice(start + OPEN.length, end)) as DraftBlock;
    return typeof v.caption === "string" && typeof v.link === "string" && (typeof v.image_url === "string" || v.image_url === null) && Array.isArray(v.facts) ? v : null;
  } catch {
    return null;
  }
}

import { lengthSection } from "./counts";
import type { Draft } from "./drafts";
import type { CellRef, Derivation, Frequency, InsightKind, Release } from "./types";

/**
 * The GitHub issue for one draft: image, the exact post text, every fact traced to its data cells, and a hidden
 * machine-readable block the (disabled) poster reads. One issue per draft; the label is the approval.
 */

export const DRAFT_LABEL = "social-draft";
export const APPROVED_LABEL = "social-approved";
export const POSTED_LABEL = "social-posted";

export const INTRO_LABEL = "social-intro";
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
  return `\`${c.file.replace(/^pipeline\/output\//, "")}\` ${key}${c.field === "__row" ? "" : ` → ${c.negate ? "−" : ""}${c.field}`}`;
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
  };
  const r = draft.release;
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
    ...(r
      ? [
          `**Freshness:** data released ${r.releasedOn}${r.estimated ? " (estimated)" : ""}; queue it by **${r.expiresOn}** or it expires unposted.${r.lagged ? " The data covers a period that ended " + r.periodEnd + ", so the chart and caption say it is newly released." : ""}`,
          "",
        ]
      : []),
    "**To approve:** add the `" + APPROVED_LABEL + "` label. That queues it; the scheduler posts it at the next open slot (one or two a weekday, see `pipeline/insights/README.md`). **To reject:** close the issue. Nothing posts while the repo variable `SOCIAL_POSTING_ENABLED` is unset. To change the caption, edit `caption` in the block below; the poster re-checks it against the facts before posting.",
    "",
    blockComment(block),
    "",
  ].join("\n");
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

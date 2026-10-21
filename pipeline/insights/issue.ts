import type { Draft } from "./drafts";
import type { CellRef, Derivation } from "./types";

/**
 * The GitHub issue for one draft: image, the exact post text, every fact traced to its data cells, and a hidden
 * machine-readable block the (disabled) poster reads. One issue per draft; the label is the approval.
 */

export const DRAFT_LABEL = "social-draft";
export const APPROVED_LABEL = "social-approved";
export const POSTED_LABEL = "social-posted";

/** What the poster needs, stored in the issue body as an HTML comment. */
export type DraftBlock = { id: string; caption: string; link: string; image_url: string; alt: string; facts: { id: string; text: string; president?: string }[] };

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
  const block: DraftBlock = { id: draft.id, caption: draft.caption, link: draft.link, image_url: imageUrl, alt: draft.alt, facts: draft.facts.map((f) => ({ id: f.id, text: f.text, ...(f.president ? { president: f.president } : {}) })) };
  // "--" cannot appear inside an HTML comment; JSON lets us escape it.
  const json = JSON.stringify(block, null, 2).replace(/--/g, "-\\u002d");
  return [
    `![${draft.alt.replace(/[[\]]/g, "")}](${imageUrl})`,
    "",
    "**Post text**",
    "",
    "```text",
    draft.post_text,
    "```",
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
    "**To approve:** add the `" + APPROVED_LABEL + "` label. **To reject:** close the issue. Nothing is posted automatically: Bluesky posting is disabled until the repo variable `SOCIAL_POSTING_ENABLED` is `true` (see `pipeline/insights/README.md`). To change the caption, edit `caption` in the block below; the poster re-checks it against the facts before posting.",
    "",
    `${OPEN}\n${json}\n${CLOSE}`,
    "",
  ].join("\n");
}

/** The hidden block from an issue body, or null when there is none or it does not parse. */
export function parseDraftBlock(body: string): DraftBlock | null {
  const start = body.indexOf(OPEN);
  if (start < 0) return null;
  const end = body.indexOf(CLOSE, start + OPEN.length);
  if (end < 0) return null;
  try {
    const v = JSON.parse(body.slice(start + OPEN.length, end)) as DraftBlock;
    return typeof v.caption === "string" && typeof v.link === "string" && typeof v.image_url === "string" && Array.isArray(v.facts) ? v : null;
  } catch {
    return null;
  }
}

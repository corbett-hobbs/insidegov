import { htmlToText } from "./ice";

/**
 * Text extract of an OHSS Yearbook Table 39 page (pure; the fetch script writes it next to the HTML snapshot and the
 * transform reads only it). Format, one item per line:
 *   `# <page title>`, `## columns`, `Year | <header> | ...`, `## rows`, `<year> | <cell> | ...`, `## notes`, then the
 *   printed Notes line and each numbered footnote as `<n>: <text>`.
 * Headers lose their footnote markers (`[1]`, superscripts) and column order is kept as printed: it differs between
 * editions (the 2022 page leads with Removals), so the transform finds columns by header text.
 */
const clean = (html: string) => htmlToText(html.replace(/<sup>[\s\S]*?<\/sup>/gi, "")).replace(/\s*\[\d+\]\s*/g, " ").replace(/\s+/g, " ").trim();

export function extractTable39(html: string): string {
  const title = clean(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s*\|\s*OHSS$/, "");
  const table = html.match(/<table[\s\S]*?<\/table>/i)?.[0];
  if (!table) throw new Error("Table 39 page has no <table>");
  const headers = [...table.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map((m) => clean(m[1])).filter(Boolean);
  const out = [`# ${title}`, "## columns", headers.join(" | "), "## rows"];
  for (const tr of table.matchAll(/<tr>\s*<td>(\d{4})<\/td>([\s\S]*?)<\/tr>/gi)) {
    out.push([tr[1], ...[...tr[2].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => clean(c[1]))].join(" | "));
  }
  out.push("## notes");
  const notes = clean(html.match(/Notes:[\s\S]*?Source:[^<]*/i)?.[0] ?? "");
  if (notes) out.push(notes);
  for (const m of html.matchAll(/id="endnote-(\d)"[^>]*>([\s\S]*?)<a[^>]*aria-label="Back to endnote/gi)) out.push(`${m[1]}: ${clean(m[2])}`);
  return out.join("\n") + "\n";
}

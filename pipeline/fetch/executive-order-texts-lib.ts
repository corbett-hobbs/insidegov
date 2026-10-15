/**
 * Pure helpers for `executive-order-texts.ts`: where an order's plain text lives on federalregister.gov, and how to cut the
 * GPO page down to the order itself (title line through the last section, no page furniture, no signature block).
 */

/** The Federal Register's plain-text rendering of a document: `full_text/text/<publication date as YYYY/MM/DD>/<document number>.txt`. */
export function rawTextUrl(publicationDate: string, documentNumber: string): string {
  return `https://www.federalregister.gov/documents/full_text/text/${publicationDate.replaceAll("-", "/")}/${documentNumber}.txt`;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/**
 * The order's text from the GPO page: HTML and page furniture stripped, hard-wrapped lines joined into one line per paragraph,
 * paragraphs separated by a blank line. Starts at "Executive Order N of <date>"; ends at "THE WHITE HOUSE," or the `[FR Doc` trailer, with
 * the signature line above it dropped. GPO's ``double quotes'' become plain "double quotes". Null when the page
 * has no "Executive Order N" heading for this order (not a page for this order).
 */
export function cleanOrderText(page: string, eoNumber: number): string | null {
  const text = page
    .replace(/<[^>]*>/g, "")
    .replace(/&(#\d+|[a-z]+);/gi, (m, e: string) => (e.startsWith("#") ? String.fromCharCode(Number(e.slice(1))) : (ENTITIES[e.toLowerCase()] ?? m)))
    .replace(/``|''/g, '"')
    .replace(/[\r\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");
  const lines = text.split("\n");
  // The heading: "Executive Order 12891 of January 15, 1994" (a page can name the order earlier, in a contents list, without
  // " of <date>"), or "Executive Order No. 13927 ...". Failing that, the page's only heading-like line: "Executive Order" alone
  // on a few 1990s pages, or a misprinted number (EO 13523 is printed "Executive Order 15323").
  const heading = (re: RegExp) => lines.findIndex((l) => re.test(l));
  let start = heading(new RegExp(`^\\s*Executive Order (?:No\\. )?${eoNumber} of\\b`));
  if (start < 0) start = heading(new RegExp(`^\\s*Executive Order (?:No\\. )?${eoNumber}\\b`));
  const lone = /^\s*Executive Order(?: (?:No\. )?\d+ of\b.*)?\s*$/;
  if (start < 0 && lines.filter((l) => lone.test(l)).length === 1) start = heading(lone);
  if (start < 0) return null;

  const paragraphs: string[] = [];
  let current: string[] = [];
  const flush = () => {
    if (current.length) paragraphs.push(current.reduce((acc, l) => (acc.endsWith("-") && /^[a-z]/.test(l) ? acc + l : `${acc} ${l}`)));
    current = [];
  };
  for (const raw of lines.slice(start)) {
    const line = raw.trim();
    if (/^\[FR Doc/.test(line) || /THE WHITE HOUSE\b/.test(line)) break;
    // GPO's signature mark, alone on its line or run on after the last sentence: the order ends there.
    const sig = line.indexOf("(Presidential Sig.)");
    if (sig >= 0) {
      if (sig > 0) current.push(line.slice(0, sig).trim());
      break;
    }
    // Page furniture: page markers, running heads, billing codes, the "Presidential Documents" banner.
    if (/^\[\[Page [^\]]*\]\]$/.test(line) || /^Federal Register \/ Vol\./.test(line) || /^(Presidential Documents|The President)\s*$/.test(line) || /^_{5,}$/.test(line) || /^Billing code/i.test(line)) continue;
    if (line === "") flush();
    else current.push(line);
  }
  flush();
  // The signature just above "THE WHITE HOUSE" on pages without GPO's mark: the president's name in capitals ("WILLIAM J. CLINTON").
  while (paragraphs.length > 1 && /^[A-Z][A-Z. ]{5,}$/.test(paragraphs.at(-1)!.trim())) paragraphs.pop();
  const out = paragraphs.map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n\n");
  return out.length > 0 ? out : null;
}

import "server-only";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tradeProductUseRow } from "./trade-product-use-entities";
import type { ChapterUsePair, ChapterUsePayload } from "./trade-chapter-use";

/**
 * Build-time reader for the goods-by-product-and-use files (`pipeline/output/trade_product_use/<year>.json`), summed
 * from HS heading x end use to chapter x end use. Only the static `/data/trade/chapter-use/[year]` route calls it, so
 * the files never ride in a server function (`outputFileTracingExcludes` in next.config.ts keeps them out). The ranked
 * pairs and the special ones (a special end use or a chapter 98/99 heading) are summed separately, as the card's lists keep them.
 */

const DIR = join(process.cwd(), "pipeline", "output", "trade_product_use");

/** Heading x use tuples summed to chapter x use, largest first. */
function byChapter(tuples: readonly (readonly [string, string, number, ...number[]])[]): ChapterUsePair[] {
  const sums = new Map<string, number>();
  for (const t of tuples) {
    const k = `${t[0].slice(0, 2)}|${t[1]}`;
    sums.set(k, (sums.get(k) ?? 0) + t[2]);
  }
  return [...sums].map(([k, v]): ChapterUsePair => [k.slice(0, 2), k.slice(3), v]).sort((a, b) => b[2] - a[2]);
}

/** Years with a file (the route's static params). */
export function getChapterUseYears(): number[] {
  return readdirSync(DIR)
    .filter((f) => /^\d{4}\.json$/.test(f))
    .map((f) => Number(f.slice(0, 4)))
    .sort((a, b) => a - b);
}

/** One year's chapter x use pairs, both flows, largest first; null for a year with no file. */
export function getChapterUsePayload(year: number): ChapterUsePayload | null {
  if (!getChapterUseYears().includes(year)) return null;
  const rows = (JSON.parse(readFileSync(join(DIR, `${year}.json`), "utf8")) as unknown[]).map((r) => tradeProductUseRow.parse(r));
  const flows = {} as ChapterUsePayload["flows"];
  const special = {} as ChapterUsePayload["special"];
  let months = 12;
  for (const r of rows) {
    flows[r.flow] = byChapter(r.rows);
    special[r.flow] = byChapter(r.special);
    months = r.months;
  }
  if (!flows.exports || !flows.imports) return null;
  return { year, months, flows, special };
}

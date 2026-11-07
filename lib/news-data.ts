import "server-only";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { faqFile, newsFile, type FaqFile, type NewsFile, type NewsPage } from "./news-types";
import { hasEnoughOutlets } from "./news-derive";

/**
 * Build-time reader for the page-level "In the news" and "FAQ" sections: `news_<page>.json` and `faq_<page>.json` in
 * `pipeline/output/` (the schemas are in `lib/news-types.ts`). A missing or empty file is `null`, and the page then shows
 * no section, header link, nav entry or per-card jump link; a malformed file fails the build, like the site's other data.
 * `NEWS_DATA_DIR` points the reader at another folder (`pipeline/fixtures/` renders the sample stories).
 */
const dir = () => process.env.NEWS_DATA_DIR ?? join(process.cwd(), "pipeline", "output");

function read(file: string): unknown | null {
  const path = join(dir(), file);
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
}

export function getNewsFile(page: NewsPage): NewsFile | null {
  const raw = read(`news_${page}.json`);
  if (raw === null) return null;
  const parsed = newsFile.parse(raw);
  const stories = parsed.stories.filter((s) => {
    const ok = hasEnoughOutlets(s.headlines);
    if (!ok) console.warn(`news_${page}.json: story ${s.id} skipped (needs headlines from at least two outlets)`);
    return ok;
  });
  return stories.length ? { ...parsed, stories } : null;
}

export function getFaqFile(page: NewsPage): FaqFile | null {
  const raw = read(`faq_${page}.json`);
  if (raw === null) return null;
  const parsed = faqFile.parse(raw);
  return parsed.groups.length ? parsed : null;
}

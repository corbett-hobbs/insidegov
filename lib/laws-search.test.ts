import { readdirSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { buildSearchIndex, lawKey, makeSummarySearch } from "./laws-search";

describe("the summary word index", () => {
  const index = buildSearchIndex([
    [lawKey(111, 148), "Requires veterans and the Department of Health to cover patients."],
    [lawKey(118, 6), "Increases veterans compensation."],
    [lawKey(100, 1), "Names a post office."],
  ]);
  const has = makeSummarySearch(index);

  it("finds laws by a word or the start of one", () => {
    expect([...has("veterans")].sort()).toEqual([lawKey(111, 148), lawKey(118, 6)].sort());
    expect([...has("vetera")]).toHaveLength(2);
    expect([...has("patient")]).toEqual([lawKey(111, 148)]);
  });
  it("needs every part of a word that splits, and finds nothing for a miss or a stop word", () => {
    expect([...has("post-office")]).toEqual([lawKey(100, 1)]);
    expect(has("veterans-office").size).toBe(0);
    expect(has("zzzz").size).toBe(0);
    expect(has("the").size).toBe(0);
  });
  it("keeps the postings sorted and gap-coded", () => {
    const i = index.words.indexOf("veterans");
    expect(index.postings[i]).toEqual([lawKey(111, 148), lawKey(118, 6) - lawKey(111, 148)]);
  });
});

describe("the committed summaries", () => {
  it("index to a size a browser can fetch on first keystroke", () => {
    const docs: [number, string][] = [];
    for (const f of readdirSync("pipeline/output/law_details")) {
      const shard = JSON.parse(readFileSync(`pipeline/output/law_details/${f}`, "utf8")) as { congress: number; laws: Record<string, { summary: string[] | null }> };
      for (const [id, d] of Object.entries(shard.laws)) if (d.summary) docs.push([lawKey(shard.congress, Number(id.split("-pub-")[1])), d.summary.join(" ")]);
    }
    const idx = buildSearchIndex(docs);
    const json = JSON.stringify(idx);
    console.log("search index", (json.length / 1e6).toFixed(1), "MB raw,", (gzipSync(json).length / 1e6).toFixed(1), "MB gzipped,", idx.words.length, "words");
    expect(gzipSync(json).length).toBeLessThan(6_000_000);
    expect([...makeSummarySearch(idx)("veterans")].length).toBeGreaterThan(100);
  }, 120_000);
});

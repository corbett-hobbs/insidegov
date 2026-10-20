import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mayhewEarlyFile } from "./mayhew-early";
import { mayhewEarlyWikiFile, mayhewWikiFor } from "./mayhew-early-wiki";

const read = (f: string) => JSON.parse(readFileSync(`pipeline/reference/${f}`, "utf8"));
const wiki = mayhewEarlyWikiFile.parse(read("mayhew-early-wiki.json"));
const laws = mayhewEarlyFile.parse(read("mayhew-1947-1972.json")).entries.filter((e) => e.kind === "law");
const landmark = new Set((read("early-law-votes.json").laws as { timeline?: string; mayhew?: string }[]).filter((v) => v.timeline && v.mayhew).map((v) => v.mayhew));

describe("mayhew-early-wiki.json", () => {
  it("reviews every signed law that is not a Timeline landmark, once", () => {
    for (const e of laws) {
      const n = Number(e.entry_id in wiki.linked) + Number(e.entry_id in wiki.unlinked);
      expect(n, e.entry_id).toBe(landmark.has(e.entry_id) ? 0 : 1);
    }
  });
  it("keeps titles plain and unique per article only where the note explains the share", () => {
    for (const e of Object.values(wiki.linked)) expect(e.wiki).not.toMatch(/[#_]/);
    const dup = Object.entries(wiki.linked).filter(([, a], i, all) => all.findIndex(([, b]) => b.wiki === a.wiki) !== i);
    for (const [id] of dup) expect(wiki.linked[id]!.note, id).toBeTruthy();
  });
  it("looks a pick up by entry id", () => {
    expect(mayhewWikiFor(wiki, "88-09")).toBe("Revenue Act of 1964");
    expect(mayhewWikiFor(wiki, "81-03")).toBeUndefined();
  });
  it("rejects an entry that is both linked and unlinked", () => {
    expect(mayhewEarlyWikiFile.safeParse({ ...wiki, unlinked: { ...wiki.unlinked, "88-09": "x" } }).success).toBe(false);
  });
});

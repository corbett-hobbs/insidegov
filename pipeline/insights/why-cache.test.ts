import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cachedWhy, saveWhy, WHY_TTL_DAYS } from "./why-cache";

const why = { title: "t", captionLine: "c", paragraphs: ["p"], sources: [{ name: "n", url: "https://x.gov" }] };
const DAY = 86_400_000;

describe("why cache", () => {
  beforeEach(() => {
    process.env.WHY_CACHE = join(mkdtempSync(join(tmpdir(), "why-")), "why.json");
  });
  afterEach(() => {
    delete process.env.WHY_CACHE;
  });

  it("returns what was saved, until it is older than the TTL", () => {
    const t0 = Date.parse("2026-11-01T00:00:00Z");
    saveWhy("a", "m", why, t0);
    expect(cachedWhy("a", t0 + DAY)?.why).toEqual(why);
    expect(cachedWhy("a", t0 + (WHY_TTL_DAYS + 0.1) * DAY)).toBeNull();
    expect(cachedWhy("b", t0)).toBeNull();
  });

  it("does nothing when turned off", () => {
    process.env.WHY_CACHE = "off";
    saveWhy("a", "m", why);
    expect(cachedWhy("a")).toBeNull();
  });
});

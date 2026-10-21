import { existsSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { median, sparkPath, thin } from "./og-sparkline";

// The data modules are server-only; under vitest they are just file readers.
vi.mock("server-only", () => ({}));
const { TOPIC_PATHS, topicCard } = await import("./og-topics");

describe("sparkline helpers", () => {
  it("thins a long series to the cap, keeping both ends", () => {
    const v = Array.from({ length: 1000 }, (_, i) => i);
    const t = thin(v, 100);
    expect(t).toHaveLength(100);
    expect(t[0]).toBe(0);
    expect(t[99]).toBe(999);
    expect(thin([1, 2, 3], 100)).toEqual([1, 2, 3]);
  });

  it("fits the path to the series' own extent and ends on the last point", () => {
    const p = sparkPath([0, 10, 5], 100, 50, 0)!;
    expect(p.line).toBe("M 0.0 50.0 L 50.0 0.0 L 100.0 25.0");
    expect(p.end).toEqual({ x: 100, y: 25 });
    expect(sparkPath([3], 100, 50)).toBeNull();
    expect(sparkPath([2, 2], 100, 50, 0)!.end.y).toBe(25);
  });

  it("takes the median of the finite values", () => {
    expect(median([3, null, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([null])).toBeNull();
  });
});

// Each card reads its page's full payload; under a parallel run that can pass vitest's 5s default.
describe("topic share cards", { timeout: 30_000 }, () => {
  it.each(TOPIC_PATHS)("%s has a figure, a caption and something to draw", (path) => {
    const c = topicCard(path);
    expect(c.figure).toMatch(/\d/);
    expect(c.caption.length).toBeGreaterThan(10);
    expect(c.caption).not.toMatch(/NaN|undefined/);
    if (c.strip) expect(c.strip.length).toBeGreaterThan(0);
    else expect(c.series.filter(Number.isFinite).length).toBeGreaterThan(4);
    expect(Number(c.from)).toBeLessThan(Number(c.to));
  });

  it("has an opengraph-image and twitter-image next to every topic page", () => {
    for (const path of TOPIC_PATHS) {
      expect(existsSync(`app/${path}/page.tsx`), path).toBe(true);
      expect(existsSync(`app/${path}/opengraph-image.tsx`), path).toBe(true);
      expect(existsSync(`app/${path}/twitter-image.tsx`), path).toBe(true);
    }
  });
});

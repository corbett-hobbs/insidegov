import { describe, expect, it, vi } from "vitest";

// The data modules are server-only; under vitest they are just file readers.
vi.mock("server-only", () => ({}));
const { hubDescription, hubDescriptionPaths, lastAbove } = await import("./hub-seo");

describe("hub descriptions", () => {
  it("gives every topic page a data-led description under 160 characters", () => {
    for (const path of hubDescriptionPaths()) {
      const d = hubDescription(path, "FALLBACK");
      expect(d, path).not.toBe("FALLBACK");
      expect(d.length, path).toBeLessThanOrEqual(160);
      expect(d, path).toMatch(/\d/);
      expect(d, path).not.toMatch(/undefined|NaN|null/);
    }
  }, 60_000); // reads every topic page's data files
  it("falls back to the plain line for a page with no builder", () => {
    expect(hubDescription("/about", "Plain.")).toBe("Plain.");
  });
  it("finds the last year that beat the latest value", () => {
    const ys = [{ y: 2012, v: 400 }, { y: 2013, v: 450 }, { y: 2020, v: 100 }, { y: 2025, v: 420 }];
    expect(lastAbove(ys, 420, (x) => x.v)?.y).toBe(2013);
    expect(lastAbove(ys, 500, (x) => x.v)).toBeNull();
  });
});

import { describe, expect, it, vi } from "vitest";

// The data module is server-only; under vitest it is just a file reader.
vi.mock("server-only", () => ({}));
const { getPresidentDirectory, getPresidentPage, signatureLaws } = await import("./president-data");

describe("signature laws", () => {
  it("names every pick under its president's Major laws count", () => {
    const rows = getPresidentDirectory();
    for (const [president, { law, label }] of signatureLaws()) {
      const row = rows.find((r) => r.name === president);
      expect(row, president).toBeDefined();
      expect(row!.majorTop?.title, president).toBe(label ?? law);
    }
    // Builds every president's page, which reads most of the site's data: slow on CI.
  }, 60_000);
});

describe("early law links", () => {
  it("links a Mayhew law from the reviewed Wikipedia file and a Timeline landmark from its event, and leaves an unlinked one plain", () => {
    const rows = getPresidentPage("lyndon-b-johnson")!.earlyMajor;
    const href = (t: string) => rows.find((r) => r.title === t)?.href;
    expect(href("Wilderness Act of 1964")).toBe("https://en.wikipedia.org/wiki/Wilderness_Act");
    expect(href("Civil Rights Act of 1964")).toMatch(/^https:\/\/en\.wikipedia\.org\/wiki\//);
    expect(href("Minimum wage increase")).toBeUndefined();
    expect(rows.filter((r) => r.href).length).toBeGreaterThan(rows.length / 2);
  }, 60_000);
});

import { describe, expect, it, vi } from "vitest";

// The data module is server-only; under vitest it is just a file reader.
vi.mock("server-only", () => ({}));
const { getPresidentDirectory, signatureLaws } = await import("./president-data");

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

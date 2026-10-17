import { describe, expect, it } from "vitest";
import type { Administration } from "./executive-orders-entities";
import { courtPresidentBand } from "./court-president-band";

const a = (start: string, president: string, party: "Democratic" | "Republican", end: string | null): Administration => ({ term_id: start, president, president_slug: president.toLowerCase().replace(/ /g, "-"), party, start, end });

const admins = [
  a("1933-03-04", "Franklin D. Roosevelt", "Democratic", "1945-04-11"),
  a("1945-04-12", "Harry S. Truman", "Democratic", "1953-01-19"),
  a("2021-01-20", "Joe Biden", "Democratic", "2025-01-19"),
  a("2025-01-20", "Donald Trump", "Republican", null),
];

describe("courtPresidentBand", () => {
  const band = courtPresidentBand(admins, 1937, 2024);

  it("clamps a tenure that began before the first term to the axis start", () => {
    expect(band[0]).toMatchObject({ last: "Roosevelt", party: "D", from: 1937 });
  });

  it("puts an inauguration on the term axis: Truman, April 1945, falls in the 1944 term (Oct 1944 to Jun 1945)", () => {
    const t = band.find((b) => b.last === "Truman")!;
    expect(t.from).toBeGreaterThan(1944.5);
    expect(t.from).toBeLessThan(1945);
  });

  it("drops a president whose tenure starts after the last term, and clamps the one it overlaps", () => {
    expect(band.find((b) => b.last === "Trump")).toBeUndefined();
    expect(band.find((b) => b.last === "Biden")!.to).toBe(2024);
  });

  it("runs a sitting president to the right edge when they began before it", () => {
    const b = courtPresidentBand(admins, 1937, 2026);
    expect(b.find((x) => x.last === "Trump")!.to).toBe(2026);
  });
});

import { describe, expect, it } from "vitest";
import { isOnly, isPicked, normalizePick, pickLabel, pickedCount, pickedLabels, samePick, setPicked, soleOf, toggleOnly } from "./multi-select";

const ALL = ["a", "b", "c", "d"];
const ITEMS = ALL.map((id) => ({ id, label: id.toUpperCase() }));

describe("multi-select selection", () => {
  it("stores a full set as null", () => {
    expect(normalizePick(new Set(ALL), ALL)).toBeNull();
    expect(normalizePick(new Set(["a", "b"]), ALL)).toEqual(new Set(["a", "b"]));
    expect(normalizePick(new Set<string>(), ALL)).toEqual(new Set());
  });

  it("treats null as everything ticked", () => {
    expect(isPicked(null, "a")).toBe(true);
    expect(isPicked(new Set(["b"]), "a")).toBe(false);
    expect(pickedCount(null, ALL)).toBe(4);
    expect(pickedCount(new Set(["a", "z"]), ALL)).toBe(1);
  });

  it("ticks and unticks, returning to null when all are ticked again", () => {
    const off = setPicked(null, "a", false, ALL);
    expect(off).toEqual(new Set(["b", "c", "d"]));
    expect(setPicked(off, "a", true, ALL)).toBeNull();
    expect(setPicked(new Set<string>(), "c", true, ALL)).toEqual(new Set(["c"]));
  });

  it("picks one option and clears on a second click", () => {
    const one = toggleOnly(null, "b");
    expect(one).toEqual(new Set(["b"]));
    expect(isOnly(one, "b")).toBe(true);
    expect(isOnly(one, "a")).toBe(false);
    expect(isOnly(null, "b")).toBe(false);
    expect(toggleOnly(one, "b")).toBeNull();
    expect(toggleOnly(new Set(["a", "b"]), "b")).toEqual(new Set(["b"]));
  });

  it("finds the sole option", () => {
    expect(soleOf(null)).toBeNull();
    expect(soleOf(new Set(["a", "b"]))).toBeNull();
    expect(soleOf(new Set([2]))).toBe(2);
  });

  it("compares selections", () => {
    expect(samePick(null, null)).toBe(true);
    expect(samePick(null, new Set(ALL))).toBe(false);
    expect(samePick(new Set(["a", "b"]), new Set(["b", "a"]))).toBe(true);
    expect(samePick(new Set(["a"]), new Set(["b"]))).toBe(false);
  });

  it("words the control's face", () => {
    expect(pickLabel(null, ITEMS, "topics")).toBe("All topics");
    expect(pickLabel(null, ITEMS, "topics", "Every topic")).toBe("Every topic");
    expect(pickLabel(new Set<string>(), ITEMS, "topics")).toBe("No topics");
    expect(pickLabel(new Set(["c"]), ITEMS, "topics")).toBe("C");
    expect(pickLabel(new Set(["a", "b", "d"]), ITEMS, "topics")).toBe("All but C");
    expect(pickLabel(new Set(["a", "b"]), ITEMS, "topics")).toBe("2 of 4 topics");
  });

  it("lists ticked labels in option order", () => {
    expect(pickedLabels(null, ITEMS)).toBeNull();
    expect(pickedLabels(new Set(["d", "a"]), ITEMS)).toEqual(["A", "D"]);
  });
});

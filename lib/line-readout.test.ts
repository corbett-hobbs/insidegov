import { describe, expect, it } from "vitest";
import { isShown, readoutRows, rowValues, type ReadoutLine } from "./line-readout";

type Key = "main" | "second";
const gas = (diesel: string | null): ReadoutLine<Key>[] => [
  { key: "main", label: "Regular", value: "$4.33" },
  { key: "second", label: "Diesel", value: diesel, optional: true },
];

describe("readoutRows", () => {
  it("lists every line as a peer while nothing is isolated", () => {
    expect(readoutRows(gas("$6.18"), null).map((r) => r.key)).toEqual(["main", "second"]);
  });

  it("keeps only the isolated line, so the other value is gone", () => {
    const rows = readoutRows(gas("$6.18"), "second");
    expect(rows).toEqual([{ key: "second", label: "Diesel", value: "$6.18", optional: true }]);
    expect(rowValues(rows)).toEqual(["Diesel $6.18"]);
    expect(readoutRows(gas("$6.18"), "main").map((r) => r.label)).toEqual(["Regular"]);
  });

  it("drops an optional line with no figure, unless it is the isolated one", () => {
    expect(readoutRows(gas(null), null).map((r) => r.key)).toEqual(["main"]);
    expect(readoutRows(gas(null), "second")).toHaveLength(1);
    expect(rowValues(readoutRows(gas(null), "second"))).toEqual(["Diesel —"]);
  });

  it("keeps a non-optional line with no figure as a dash", () => {
    const rows = readoutRows<ReadoutLine<Key>>([{ key: "main", label: "A", value: null }, { key: "second", label: "B", value: "2" }], null);
    expect(rowValues(rows)).toEqual(["A —", "B 2"]);
  });

  it("ignores a pick that matches no line", () => {
    expect(readoutRows(gas("$6.18"), "gone" as Key)).toHaveLength(2);
  });

  it("keeps extra fields on the rows it returns", () => {
    const rows = readoutRows([{ key: "a", label: "A", value: "1", color: "red" }], null);
    expect(rows[0].color).toBe("red");
  });
});

describe("rowValues", () => {
  it("joins label and value in the order given", () => {
    expect(rowValues(gas("$6.18"))).toEqual(["Regular $4.33", "Diesel $6.18"]);
  });
});

describe("isShown", () => {
  it("shows everything until a line is isolated, then only that line", () => {
    expect(isShown<Key>(null, "main")).toBe(true);
    expect(isShown<Key>("second", "main")).toBe(false);
    expect(isShown<Key>("second", "second")).toBe(true);
  });
});

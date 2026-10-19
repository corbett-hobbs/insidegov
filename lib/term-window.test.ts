import { describe, expect, it } from "vitest";
import { selectedTerms, toggleTermWindow } from "./term-window";

const terms = [
  { from: 2001, to: 2009 },
  { from: 2009, to: 2017 },
  { from: 2017, to: 2021 },
];

describe("toggleTermWindow", () => {
  it("narrows the full range to the tapped term", () => {
    expect(toggleTermWindow(terms, 1, 2001, 2021, [2001, 2021])).toEqual([2009, 2017]);
  });
  it("adds a neighbour to the run", () => {
    expect(toggleTermWindow(terms, 2, 2001, 2021, [2009, 2017])).toEqual([2009, 2021]);
  });
  it("drops an end term and clears the only one", () => {
    expect(toggleTermWindow(terms, 2, 2001, 2021, [2009, 2021])).toEqual([2009, 2017]);
    expect(toggleTermWindow(terms, 1, 2001, 2021, [2009, 2017])).toEqual([2001, 2021]);
  });
  it("leaves the window alone for a middle term", () => {
    expect(toggleTermWindow(terms, 1, 1990, 2030, [2001, 2021])).toEqual([2001, 2021]);
  });
  it("selects nothing while the window is the full range", () => {
    expect(selectedTerms(terms, 2001, 2021, [2001, 2021])).toEqual([]);
  });
});

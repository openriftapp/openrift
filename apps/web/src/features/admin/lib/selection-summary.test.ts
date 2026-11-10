import { describe, expect, it } from "vitest";

import { selectionSummary, splitSelection } from "./selection-summary";

const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];
const keyOf = (row: { id: string }) => row.id;

describe("splitSelection", () => {
  it("keeps ticked rows the filter hides and counts them", () => {
    const result = splitSelection(rows, rows.slice(0, 1), keyOf, new Set(["a", "b"]));
    expect(result.selected.map(keyOf)).toEqual(["a", "b"]);
    expect(result.hiddenCount).toBe(1);
  });

  it("drops ticks whose row is no longer loaded", () => {
    const result = splitSelection(rows, rows, keyOf, new Set(["a", "gone"]));
    expect(result.selected.map(keyOf)).toEqual(["a"]);
    expect(result.hiddenCount).toBe(0);
  });

  it("returns nothing when nothing is ticked", () => {
    expect(splitSelection(rows, rows, keyOf, new Set())).toEqual({ selected: [], hiddenCount: 0 });
  });
});

describe("selectionSummary", () => {
  it("says only the count when nothing is hidden", () => {
    expect(selectionSummary(3, 0)).toBe("3 selected");
  });

  it("says how many of the ticked rows the filter hides", () => {
    expect(selectionSummary(3, 1)).toBe("3 selected, 1 hidden by filter");
  });
});

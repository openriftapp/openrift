import { describe, expect, it } from "vitest";

import { collapseFilterOptions } from "./collapse-filter-options";

const OPTIONS = ["OGN", "SFD", "UNL", "OGS", "ARC", "PG"];
const SUPPLEMENTAL = new Set(["OGS", "ARC", "PG"]);

describe("collapseFilterOptions", () => {
  it("keeps only the non-hideable options and counts the rest", () => {
    expect(collapseFilterOptions(OPTIONS, SUPPLEMENTAL, [])).toEqual({
      visible: ["OGN", "SFD", "UNL"],
      hiddenCount: 3,
    });
  });

  it("keeps a pinned hideable option visible in its original position", () => {
    expect(collapseFilterOptions(OPTIONS, SUPPLEMENTAL, ["ARC"])).toEqual({
      visible: ["OGN", "SFD", "UNL", "ARC"],
      hiddenCount: 2,
    });
  });

  it("ignores pinned values that are not hideable or not options", () => {
    expect(collapseFilterOptions(OPTIONS, SUPPLEMENTAL, ["OGN", "XYZ"])).toEqual({
      visible: ["OGN", "SFD", "UNL"],
      hiddenCount: 3,
    });
  });

  it("hides nothing when no option is hideable", () => {
    expect(collapseFilterOptions(OPTIONS, new Set(), [])).toEqual({
      visible: OPTIONS,
      hiddenCount: 0,
    });
  });

  it("reports zero hidden when every hideable option is pinned", () => {
    expect(collapseFilterOptions(OPTIONS, SUPPLEMENTAL, ["OGS", "ARC", "PG"]).hiddenCount).toBe(0);
  });

  it("folds nothing when every option is hideable", () => {
    expect(collapseFilterOptions(["OGS", "PG"], SUPPLEMENTAL, [])).toEqual({
      visible: ["OGS", "PG"],
      hiddenCount: 0,
    });
  });

  it("handles an empty option list", () => {
    expect(collapseFilterOptions([], SUPPLEMENTAL, ["OGS"])).toEqual({
      visible: [],
      hiddenCount: 0,
    });
  });
});

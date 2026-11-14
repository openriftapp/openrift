import { describe, expect, it } from "vitest";

import { discardLabel, primaryLabel } from "./suggestion-labels";

describe("discardLabel", () => {
  it("says Discard for one suggestion", () => {
    expect(discardLabel(1, "Provider B")).toBe("Discard");
  });

  it("names the count and the source when it checks several", () => {
    expect(discardLabel(2, "Provider B")).toBe("Discard 2 from Provider B");
  });

  it("names what else the row settles on another record", () => {
    expect(discardLabel(1, "Provider B", "1 image")).toBe("Discard (also settles 1 image)");
    expect(discardLabel(2, "Provider B", null)).toBe("Discard 2 from Provider B");
  });
});

describe("primaryLabel", () => {
  it("is plain Next when nothing is discarded", () => {
    expect(primaryLabel(0)).toBe("Next");
  });

  it("counts the discarded sources", () => {
    expect(primaryLabel(3)).toBe("Discard 3 & next");
  });
});

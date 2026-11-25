import { describe, expect, it } from "vitest";

import { valueParts } from "./value-diff";

const marked = (current: string | undefined, proposed: string) =>
  valueParts(current, proposed)
    .filter((part) => part.changed)
    .map((part) => part.text);

describe("valueParts", () => {
  it("marks only the part of a code that differs", () => {
    expect(marked("OGS-001/024", "OGS-001/24")).toEqual(["24"]);
    expect(marked("OGN-166b/298", "OGN-166B/298")).toEqual(["166B"]);
  });

  it("marks the whole value when the live field is empty", () => {
    expect(marked("—", "Promo")).toEqual(["Promo"]);
    expect(marked(undefined, "Promo")).toEqual(["Promo"]);
  });

  it("marks the whole value when it only lost something", () => {
    expect(marked("Promo, Top 4", "Promo")).toEqual(["Promo"]);
  });

  it("marks nothing for an equal value", () => {
    expect(marked("Epic", "Epic")).toEqual([]);
  });

  it("returns the suggested text in full", () => {
    expect(
      valueParts("OGS-001/024", "OGS-001/24")
        .map((part) => part.text)
        .join(""),
    ).toBe("OGS-001/24");
  });
});

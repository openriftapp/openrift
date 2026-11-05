import { describe, expect, it } from "vitest";

import { omitZeroCompletion } from "./completion-visibility";

describe("omitZeroCompletion", () => {
  it("drops entries at 0% and keeps the rest in order", () => {
    const entries = [
      { key: "a", percent: 12 },
      { key: "b", percent: 0 },
      { key: "c", percent: 100 },
    ];
    expect(omitZeroCompletion(entries).map((entry) => entry.key)).toEqual(["a", "c"]);
  });

  it("keeps a barely started entry", () => {
    expect(omitZeroCompletion([{ percent: 0.2 }])).toHaveLength(1);
  });

  it("returns an empty list when every entry is at 0%", () => {
    expect(omitZeroCompletion([{ percent: 0 }, { percent: 0 }])).toEqual([]);
  });

  it("returns an empty list for no entries", () => {
    expect(omitZeroCompletion([])).toEqual([]);
  });
});

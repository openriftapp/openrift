import { describe, expect, it } from "vitest";

import { listKindNoun } from "./list-intent-meta";

describe("listKindNoun", () => {
  it("uses the singular noun when the count is exactly one", () => {
    expect(listKindNoun("card", 1)).toBe("card");
    expect(listKindNoun("printing", 1)).toBe("printing");
    expect(listKindNoun("copy", 1)).toBe("copy");
  });

  it("uses the plural noun for zero or many", () => {
    expect(listKindNoun("card", 0)).toBe("cards");
    expect(listKindNoun("printing", 3)).toBe("printings");
    expect(listKindNoun("copy", 2)).toBe("copies");
  });
});

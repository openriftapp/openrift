import { describe, expect, it } from "vitest";

import { listEntryCountLabel } from "@/features/lists/lib/list-entry-count";

describe("listEntryCountLabel", () => {
  it("uses the singular noun for one entry", () => {
    expect(listEntryCountLabel("card", 1)).toBe("1 Card");
    expect(listEntryCountLabel("copy", 1)).toBe("1 Copy");
  });

  it("uses the plural noun for zero and many entries", () => {
    expect(listEntryCountLabel("card", 0)).toBe("0 Cards");
    expect(listEntryCountLabel("printing", 3)).toBe("3 Printings");
    expect(listEntryCountLabel("copy", 12)).toBe("12 Copies");
  });
});

import { describe, expect, it } from "vitest";

import { isCardSection } from "./admin-search-values";

describe("isCardSection", () => {
  it("still accepts attention so older links keep working", () => {
    expect(isCardSection("attention")).toBe(true);
    expect(isCardSection("fields")).toBe(false);
  });
});

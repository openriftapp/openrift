import { MARKETPLACE_LINKS } from "@openrift/shared/marketplace";
import { ALL_MARKETPLACES } from "@openrift/shared/types/pricing";
import { describe, expect, it } from "vitest";

import { MARKETPLACE_COUNT, marketplaceNames } from "./marketplace-copy";

describe("marketplace copy", () => {
  it("counts every marketplace the product prices", () => {
    expect(MARKETPLACE_COUNT).toBe(4);
  });

  it("names every marketplace", () => {
    const names = marketplaceNames();
    for (const marketplace of ALL_MARKETPLACES) {
      expect(names).toContain(MARKETPLACE_LINKS[marketplace].label);
    }
    expect(names).toMatch(/, and /u);
  });

  it("lists them as a choice when asked", () => {
    expect(marketplaceNames("or")).toMatch(/, or /u);
  });
});

import { describe, expect, it } from "vitest";

import { isBuildIdSafe } from "./api-format.js";

describe("isBuildIdSafe", () => {
  it("allows responses without a Cache-Control header", () => {
    expect(isBuildIdSafe(null)).toBe(true);
  });

  it("allows no-store responses", () => {
    expect(isBuildIdSafe("no-store")).toBe(true);
    expect(isBuildIdSafe("private, no-store")).toBe(true);
  });

  it("rejects publicly cacheable responses", () => {
    expect(isBuildIdSafe("public, max-age=3600, stale-while-revalidate=86400")).toBe(false);
    expect(isBuildIdSafe("public, max-age=60, stale-while-revalidate=300")).toBe(false);
  });

  it("rejects privately cacheable responses (browser cache still replays them)", () => {
    expect(isBuildIdSafe("private, max-age=60, stale-while-revalidate=300")).toBe(false);
  });

  it("rejects no-cache responses (revalidation refreshes the stored headers instead)", () => {
    expect(isBuildIdSafe("private, no-cache")).toBe(false);
  });
});

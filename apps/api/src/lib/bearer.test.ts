import { describe, expect, it } from "vitest";

import { bearerToken } from "./bearer.js";

describe("bearerToken", () => {
  it("returns the trimmed token", () => {
    expect(bearerToken("Bearer abc123 ")).toBe("abc123");
  });

  it("returns null for a missing header or another scheme", () => {
    expect(bearerToken(undefined)).toBeNull();
    expect(bearerToken(null)).toBeNull();
    expect(bearerToken("Basic dXNlcjpwYXNz")).toBeNull();
    expect(bearerToken("bearer abc")).toBeNull();
  });

  it("returns null for an empty token", () => {
    expect(bearerToken("Bearer    ")).toBeNull();
  });
});

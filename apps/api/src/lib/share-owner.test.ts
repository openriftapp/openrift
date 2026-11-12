import { describe, expect, it } from "vitest";

import { gravatarHashForEmail } from "./gravatar.js";
import { bylineName, toShareOwner } from "./share-owner.js";

describe("toShareOwner", () => {
  it("keeps the display name and hashes the email", () => {
    expect(toShareOwner({ displayName: "Teemo", email: "teemo@example.com" })).toEqual({
      displayName: "Teemo",
      gravatarHash: gravatarHashForEmail("teemo@example.com"),
    });
  });

  it("leaves the display name null without a name, so the byline is omitted", () => {
    expect(toShareOwner({ displayName: null, email: "x@example.com" }).displayName).toBeNull();
    expect(toShareOwner({ displayName: "  ", email: "x@example.com" }).displayName).toBeNull();
    expect(toShareOwner({ displayName: "", email: "x@example.com" }).displayName).toBeNull();
  });

  it("has no gravatar hash without an email", () => {
    expect(toShareOwner({ displayName: "Group", email: null })).toEqual({
      displayName: "Group",
      gravatarHash: null,
    });
  });
});

describe("bylineName", () => {
  it("trims a name", () => {
    expect(bylineName("  Ashe ")).toBe("Ashe");
  });

  it("treats a missing or blank name as no byline", () => {
    expect(bylineName(null)).toBeUndefined();
    expect(bylineName(undefined)).toBeUndefined();
    expect(bylineName("")).toBeUndefined();
    expect(bylineName("   ")).toBeUndefined();
  });
});

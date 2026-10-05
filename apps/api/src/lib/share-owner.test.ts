import { describe, expect, it } from "vitest";

import { gravatarHashForEmail } from "./gravatar.js";
import { toShareOwner } from "./share-owner.js";

describe("toShareOwner", () => {
  it("keeps the display name and hashes the email", () => {
    expect(toShareOwner({ displayName: "Teemo", email: "teemo@example.com" })).toEqual({
      displayName: "Teemo",
      gravatarHash: gravatarHashForEmail("teemo@example.com"),
    });
  });

  it("falls back to Anonymous without a display name", () => {
    expect(toShareOwner({ displayName: null, email: "x@example.com" }).displayName).toBe(
      "Anonymous",
    );
  });

  it("has no gravatar hash without an email", () => {
    expect(toShareOwner({ displayName: "Group", email: null })).toEqual({
      displayName: "Group",
      gravatarHash: null,
    });
  });
});

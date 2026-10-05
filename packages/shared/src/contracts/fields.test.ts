import { describe, expect, it } from "vitest";

import { nameField, shareOwnerSchema, shareStateResponseSchema } from "./fields.js";

describe("nameField", () => {
  it("trims before measuring", () => {
    expect(nameField(5).parse("  abc  ")).toBe("abc");
  });

  it("rejects empty and whitespace-only names", () => {
    expect(nameField(5).safeParse("").success).toBe(false);
    expect(nameField(5).safeParse("   ").success).toBe(false);
  });

  it("enforces the maximum on the trimmed value", () => {
    expect(nameField(3).safeParse("  abc  ").success).toBe(true);
    expect(nameField(3).safeParse("abcd").success).toBe(false);
  });

  it("composes with optional", () => {
    expect(nameField(3).optional().parse(undefined)).toBeUndefined();
  });
});

describe("shareStateResponseSchema", () => {
  it("accepts a null token and requires isPublic", () => {
    expect(shareStateResponseSchema.safeParse({ shareToken: null, isPublic: false }).success).toBe(
      true,
    );
    expect(shareStateResponseSchema.safeParse({ shareToken: "t" }).success).toBe(false);
  });
});

describe("shareOwnerSchema", () => {
  it("accepts a null gravatar hash", () => {
    expect(shareOwnerSchema.safeParse({ displayName: "A", gravatarHash: null }).success).toBe(true);
    expect(shareOwnerSchema.safeParse({ displayName: "A" }).success).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import {
  displayNameField,
  isEmailAddress,
  newPasswordField,
  PASSWORD_MIN_LENGTH,
} from "./account-validation";

describe("displayNameField", () => {
  it("trims and accepts letters, digits, spaces, periods, underscores and hyphens", () => {
    expect(displayNameField().parse("  Mary-Jane O.Connor_42 ")).toBe("Mary-Jane O.Connor_42");
  });

  it("rejects an empty name", () => {
    expect(displayNameField().safeParse("   ").success).toBe(false);
  });

  it("rejects a name over 50 characters", () => {
    expect(displayNameField().safeParse("a".repeat(51)).success).toBe(false);
  });

  it("rejects characters outside the allowed set", () => {
    expect(displayNameField().safeParse("Teemo <3").success).toBe(false);
  });
});

describe("newPasswordField", () => {
  it("accepts a password of the minimum length and rejects a shorter one", () => {
    const field = newPasswordField("too short");
    expect(field.safeParse("x".repeat(PASSWORD_MIN_LENGTH)).success).toBe(true);
    expect(field.safeParse("x".repeat(PASSWORD_MIN_LENGTH - 1)).error?.issues[0]?.message).toBe(
      "too short",
    );
  });
});

describe("isEmailAddress", () => {
  it("accepts an address with surrounding whitespace", () => {
    expect(isEmailAddress("  summoner@example.com ")).toBe(true);
  });

  it("rejects text that only contains an at sign", () => {
    expect(isEmailAddress("summoner@")).toBe(false);
    expect(isEmailAddress("@")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isEmailAddress("")).toBe(false);
  });
});

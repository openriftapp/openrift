import { describe, expect, it } from "vitest";

import {
  nextReferralThreshold,
  readReferralCode,
  referralTier,
  withReferralCode,
} from "./referral.js";

describe("referralTier", () => {
  it.each([
    [0, 0],
    [1, 1],
    [4, 1],
    [5, 2],
    [24, 2],
    [25, 3],
    [400, 3],
  ])("maps %i counted referrals to tier %i", (counted, tier) => {
    expect(referralTier(counted)).toBe(tier);
  });
});

describe("nextReferralThreshold", () => {
  it("returns the next threshold above the count", () => {
    expect(nextReferralThreshold(0)).toBe(1);
    expect(nextReferralThreshold(1)).toBe(5);
    expect(nextReferralThreshold(24)).toBe(25);
  });

  it("returns null at the top tier", () => {
    expect(nextReferralThreshold(25)).toBeNull();
  });
});

describe("withReferralCode", () => {
  it("appends the code as a fragment", () => {
    expect(withReferralCode("https://example.test/decks/share/x", "AbC123xyz789")).toBe(
      "https://example.test/decks/share/x#r=AbC123xyz789",
    );
  });

  it("replaces an existing fragment", () => {
    expect(withReferralCode("https://example.test/a#section", "AbC123xyz789")).toBe(
      "https://example.test/a#r=AbC123xyz789",
    );
  });

  it("returns the url unchanged without a code", () => {
    expect(withReferralCode("https://example.test/a", null)).toBe("https://example.test/a");
    expect(withReferralCode("https://example.test/a", undefined)).toBe("https://example.test/a");
  });
});

describe("readReferralCode", () => {
  it("reads a valid code with or without the leading hash", () => {
    expect(readReferralCode("#r=AbC123xyz789")).toBe("AbC123xyz789");
    expect(readReferralCode("r=AbC123xyz789")).toBe("AbC123xyz789");
  });

  it("rejects malformed codes", () => {
    expect(readReferralCode("#r=short")).toBeNull();
    expect(readReferralCode("#r=AbC123xyz789!")).toBeNull();
    expect(readReferralCode("#section")).toBeNull();
    expect(readReferralCode("")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";

import { PROFILE_BIO_MAX_LENGTH, validateProfileBio } from "./profile-bio.js";

describe("validateProfileBio", () => {
  it("accepts a one-line bio and trims it", () => {
    expect(validateProfileBio("  Fury and Chaos player from Frankfurt.  ")).toEqual({
      ok: true,
      value: "Fury and Chaos player from Frankfurt.",
    });
  });

  it("collapses line breaks and repeated whitespace into single spaces", () => {
    expect(validateProfileBio("Collecting\n\na full   playset")).toEqual({
      ok: true,
      value: "Collecting a full playset",
    });
  });

  it("normalizes empty, whitespace-only, null and undefined to null", () => {
    expect(validateProfileBio("")).toEqual({ ok: true, value: null });
    expect(validateProfileBio("   \n ")).toEqual({ ok: true, value: null });
    expect(validateProfileBio(null)).toEqual({ ok: true, value: null });
    expect(validateProfileBio(undefined)).toEqual({ ok: true, value: null });
  });

  it("rejects a bio over the length cap, measured after collapsing whitespace", () => {
    expect(validateProfileBio("a".repeat(PROFILE_BIO_MAX_LENGTH)).ok).toBe(true);
    expect(validateProfileBio("a".repeat(PROFILE_BIO_MAX_LENGTH + 1)).ok).toBe(false);
    expect(validateProfileBio(`${"a".repeat(PROFILE_BIO_MAX_LENGTH)}   `).ok).toBe(true);
  });

  it("rejects non-string input", () => {
    expect(validateProfileBio(42).ok).toBe(false);
    expect(validateProfileBio({}).ok).toBe(false);
  });
});

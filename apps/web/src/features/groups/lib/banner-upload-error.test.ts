import { describe, expect, it } from "vitest";

import { bannerUploadErrorMessage } from "./banner-upload-error";

describe("bannerUploadErrorMessage", () => {
  it("names the size cap on a 413", () => {
    expect(bannerUploadErrorMessage(413)).toContain("20 MB");
  });

  it("explains a rejected file type", () => {
    expect(bannerUploadErrorMessage(400)).toContain("not an image");
  });

  it("points a plain member at the admins", () => {
    expect(bannerUploadErrorMessage(403)).toContain("admins");
  });

  it("says to come back tomorrow on a 429", () => {
    expect(bannerUploadErrorMessage(429)).toContain("tomorrow");
  });

  it("falls back for anything else", () => {
    expect(bannerUploadErrorMessage(500)).toBe(
      "The upload did not go through. Try again in a moment.",
    );
  });
});

import { describe, expect, it } from "vitest";

import { gravatarUrlFromHash } from "@/lib/gravatar";

describe("gravatarUrlFromHash", () => {
  it("builds a URL with the default size and error fallback", () => {
    expect(gravatarUrlFromHash("abc123")).toBe("https://gravatar.com/avatar/abc123?s=80&d=404");
  });

  it("accepts a custom size", () => {
    expect(gravatarUrlFromHash("abc123", 200)).toBe(
      "https://gravatar.com/avatar/abc123?s=200&d=404",
    );
  });

  it("builds a URL for an empty hash", () => {
    expect(gravatarUrlFromHash("")).toBe("https://gravatar.com/avatar/?s=80&d=404");
  });
});
